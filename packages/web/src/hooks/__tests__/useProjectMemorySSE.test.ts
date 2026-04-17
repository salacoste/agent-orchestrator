/**
 * useProjectMemorySSE hook tests.
 * Story 60-9, AC #12.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import type { ProjectMemory } from "@composio/ao-core";
import { useProjectMemorySSE } from "../useProjectMemorySSE";

// Mock EventSource with addEventListener support for named SSE events
class MockEventSource {
  url: string;
  readyState = 0;
  onopen: ((event: Event) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  CONNECTING = 0;
  OPEN = 1;
  CLOSED = 2;
  closed = false;

  private listeners = new Map<string, Set<(event: MessageEvent) => void>>();

  constructor(url: string) {
    this.url = url;
    mockInstances.push(this);
  }

  close() {
    this.readyState = this.CLOSED;
    this.closed = true;
  }

  addEventListener(type: string, listener: (event: MessageEvent) => void) {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, new Set());
    }
    this.listeners.get(type)!.add(listener);
  }

  removeEventListener(type: string, listener: (event: MessageEvent) => void) {
    this.listeners.get(type)?.delete(listener);
  }

  simulateOpen() {
    this.readyState = this.OPEN;
    this.onopen?.(new Event("open"));
  }

  simulateError() {
    this.readyState = this.CLOSED;
    this.onerror?.(new Event("error"));
  }

  /** Simulate a named SSE event (e.g. "memory-update") */
  simulateNamedEvent(eventType: string, data: unknown) {
    const listeners = this.listeners.get(eventType);
    if (!listeners) return;
    const event = new MessageEvent(eventType, {
      data: JSON.stringify(data),
    });
    for (const listener of listeners) {
      listener(event);
    }
  }
}

let mockInstances: MockEventSource[] = [];

const SAMPLE_MEMORY: ProjectMemory = {
  entries: [
    {
      id: "e1",
      type: "convention",
      content: "Use kebab-case",
      source: "session-1",
      timestamp: "2026-04-17T00:00:00Z",
    },
  ],
};

describe("useProjectMemorySSE", () => {
  let originalEventSource: typeof EventSource;
  let originalFetch: typeof global.fetch;

  beforeEach(() => {
    vi.useFakeTimers();
    mockInstances = [];
    originalEventSource = global.EventSource;
    originalFetch = global.fetch;
    global.EventSource = MockEventSource as unknown as typeof EventSource;
  });

  afterEach(() => {
    global.EventSource = originalEventSource;
    global.fetch = originalFetch;
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it("returns initial null state", () => {
    global.fetch = vi.fn(() => new Promise(() => {}));
    const { result } = renderHook(() => useProjectMemorySSE("session-1"));

    expect(result.current.memory).toBeNull();
    expect(result.current.exists).toBe(false);
    expect(result.current.connected).toBe(false);
  });

  it("fetches initial data via REST", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          sessionId: "session-1",
          memory: SAMPLE_MEMORY,
          exists: true,
        }),
    });

    const { result } = renderHook(() => useProjectMemorySSE("session-1"));

    await act(async () => {
      await vi.runAllTimersAsync();
    });

    expect(global.fetch).toHaveBeenCalledWith("/api/session/session-1/memory");
    expect(result.current.memory).toEqual(SAMPLE_MEMORY);
    expect(result.current.exists).toBe(true);
  });

  it("handles REST fetch failure gracefully", async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error("Network error"));

    const { result } = renderHook(() => useProjectMemorySSE("session-1"));

    await act(async () => {
      await vi.runAllTimersAsync();
    });

    expect(result.current.memory).toBeNull();
    expect(result.current.exists).toBe(false);
  });

  it("subscribes to SSE with named event listener", () => {
    global.fetch = vi.fn(() => new Promise(() => {}));

    renderHook(() => useProjectMemorySSE("session-1"));

    const es = mockInstances[0]!;
    expect(es.listeners.has("memory-update")).toBe(true);
    expect(es.listeners.get("memory-update")!.size).toBeGreaterThan(0);
  });

  it("updates memory on SSE message", () => {
    global.fetch = vi.fn(() => new Promise(() => {}));

    const { result } = renderHook(() => useProjectMemorySSE("session-1"));

    const es = mockInstances[0]!;
    act(() => {
      es.simulateOpen();
    });

    expect(result.current.connected).toBe(true);

    const updatedMemory: ProjectMemory = {
      entries: [...SAMPLE_MEMORY.entries, { id: "e2", type: "decision", content: "Use ESM" }],
    };

    act(() => {
      es.simulateNamedEvent("memory-update", {
        sessionId: "session-1",
        memory: updatedMemory,
        exists: true,
      });
    });

    expect(result.current.memory).toEqual(updatedMemory);
    expect(result.current.exists).toBe(true);
  });

  it("ignores malformed SSE messages", () => {
    global.fetch = vi.fn(() => new Promise(() => {}));

    const { result } = renderHook(() => useProjectMemorySSE("session-1"));

    const es = mockInstances[0]!;
    act(() => {
      es.simulateOpen();
    });

    const listeners = es.listeners.get("memory-update")!;
    act(() => {
      for (const listener of listeners) {
        listener(new MessageEvent("memory-update", { data: "not json" }));
      }
    });

    expect(result.current.memory).toBeNull();
  });

  it("reconnects with exponential backoff on error", () => {
    global.fetch = vi.fn(() => new Promise(() => {}));

    renderHook(() => useProjectMemorySSE("session-1"));

    expect(mockInstances).toHaveLength(1);

    // Error → reconnect at 1s
    mockInstances[0]!.simulateError();
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(mockInstances).toHaveLength(2);

    // Error → reconnect at 2s
    mockInstances[1]!.simulateError();
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(mockInstances).toHaveLength(3);

    // Error → reconnect at 4s
    mockInstances[2]!.simulateError();
    act(() => {
      vi.advanceTimersByTime(4000);
    });
    expect(mockInstances).toHaveLength(4);

    // Error → capped at 8s
    mockInstances[3]!.simulateError();
    act(() => {
      vi.advanceTimersByTime(8000);
    });
    expect(mockInstances).toHaveLength(5);
  });

  it("resets backoff on successful connection", () => {
    global.fetch = vi.fn(() => new Promise(() => {}));

    renderHook(() => useProjectMemorySSE("session-1"));

    // Error → reconnect at 1s
    act(() => {
      mockInstances[0]!.simulateError();
    });
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(mockInstances).toHaveLength(2);

    // Successful connect — resets retry counter
    act(() => {
      mockInstances[1]!.simulateOpen();
    });

    // Next error should be back to 1s delay
    act(() => {
      mockInstances[1]!.simulateError();
    });
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(mockInstances).toHaveLength(3);
  });

  it("cleans up EventSource on unmount", () => {
    global.fetch = vi.fn(() => new Promise(() => {}));

    const { unmount } = renderHook(() => useProjectMemorySSE("session-1"));

    const es = mockInstances[0]!;
    expect(es.closed).toBe(false);

    unmount();

    expect(es.closed).toBe(true);
  });

  it("clears reconnect timer on unmount", () => {
    global.fetch = vi.fn(() => new Promise(() => {}));

    const { unmount } = renderHook(() => useProjectMemorySSE("session-1"));

    const es = mockInstances[0]!;
    es.simulateError();

    unmount();

    act(() => {
      vi.advanceTimersByTime(10000);
    });

    expect(mockInstances).toHaveLength(1); // No reconnect after unmount
  });

  it("does not update state after unmount", () => {
    global.fetch = vi.fn(() => new Promise(() => {}));

    const { result, unmount } = renderHook(() => useProjectMemorySSE("session-1"));

    const es = mockInstances[0]!;
    act(() => {
      es.simulateOpen();
    });

    unmount();

    act(() => {
      es.simulateNamedEvent("memory-update", {
        sessionId: "session-1",
        memory: SAMPLE_MEMORY,
        exists: true,
      });
    });

    expect(result.current.memory).toBeNull();
  });

  it("connects to correct SSE endpoint", () => {
    global.fetch = vi.fn(() => new Promise(() => {}));

    renderHook(() => useProjectMemorySSE("my-session-id"));

    expect(mockInstances[0]!.url).toBe("/api/session/my-session-id/memory/stream");
  });

  it("reconnects when sessionId changes", () => {
    global.fetch = vi.fn(() => new Promise(() => {}));

    const { rerender } = renderHook(({ id }) => useProjectMemorySSE(id), {
      initialProps: { id: "session-1" },
    });

    expect(mockInstances).toHaveLength(1);
    expect(mockInstances[0]!.url).toBe("/api/session/session-1/memory/stream");

    rerender({ id: "session-2" });

    expect(mockInstances[0]!.closed).toBe(true);
    expect(mockInstances).toHaveLength(2);
    expect(mockInstances[1]!.url).toBe("/api/session/session-2/memory/stream");
  });
});
