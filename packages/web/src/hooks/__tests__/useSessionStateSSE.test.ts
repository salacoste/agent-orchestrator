import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import type { SessionState } from "@composio/ao-core";
import { useSessionStateSSE } from "../useSessionStateSSE";

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

  /** Simulate a named SSE event (e.g. "state-update") */
  simulateNamedEvent(eventType: string, data: unknown) {
    const listeners = this.listeners.get(eventType);
    if (!listeners) return;
    const event = new MessageEvent(eventType, { data: JSON.stringify(data) });
    for (const listener of listeners) {
      listener(event);
    }
  }
}

let mockInstances: MockEventSource[] = [];

const SAMPLE_STATE: SessionState = {
  executionMode: "standard",
  activeAgents: ["omc"],
  configured: true,
  activeModes: [{ mode: "ralph", active: true }],
  health: null,
};

describe("useSessionStateSSE", () => {
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

  // AC9.1 — Returns initial null state
  it("returns initial null state", () => {
    global.fetch = vi.fn(() => new Promise(() => {}));
    const { result } = renderHook(() => useSessionStateSSE("session-1"));

    expect(result.current.state).toBeNull();
    expect(result.current.exists).toBe(false);
    expect(result.current.connected).toBe(false);
  });

  // AC9.2 — Fetches initial data via REST
  it("fetches initial data via REST", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          sessionId: "session-1",
          state: SAMPLE_STATE,
          exists: true,
        }),
    });

    const { result } = renderHook(() => useSessionStateSSE("session-1"));

    await act(async () => {
      await vi.runAllTimersAsync();
    });

    expect(global.fetch).toHaveBeenCalledWith("/api/session/session-1/state");
    expect(result.current.state).toEqual(SAMPLE_STATE);
    expect(result.current.exists).toBe(true);
  });

  // AC9.2b — Handles REST fetch failure gracefully
  it("handles REST fetch failure gracefully", async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error("Network error"));

    const { result } = renderHook(() => useSessionStateSSE("session-1"));

    await act(async () => {
      await vi.runAllTimersAsync();
    });

    expect(result.current.state).toBeNull();
    expect(result.current.exists).toBe(false);
  });

  // AC9.3 — Subscribes to SSE with addEventListener("state-update", ...)
  it("subscribes to SSE with named event listener", () => {
    global.fetch = vi.fn(() => new Promise(() => {}));

    renderHook(() => useSessionStateSSE("session-1"));

    const es = mockInstances[0]!;
    expect(es.listeners.has("state-update")).toBe(true);
    expect(es.listeners.get("state-update")!.size).toBeGreaterThan(0);
  });

  // AC9.4 — Updates state on SSE message
  it("updates state on SSE message", () => {
    global.fetch = vi.fn(() => new Promise(() => {}));

    const { result } = renderHook(() => useSessionStateSSE("session-1"));

    const es = mockInstances[0]!;
    act(() => {
      es.simulateOpen();
    });

    expect(result.current.connected).toBe(true);

    const updatedState: SessionState = {
      executionMode: "autopilot",
      activeAgents: ["omc", "explore"],
      configured: true,
      activeModes: [
        { mode: "autopilot", active: true, iteration: 3, maxIterations: 10, phase: "executing" },
      ],
      health: null,
    };

    act(() => {
      es.simulateNamedEvent("state-update", {
        sessionId: "session-1",
        state: updatedState,
        exists: true,
      });
    });

    expect(result.current.state).toEqual(updatedState);
    expect(result.current.exists).toBe(true);
  });

  // AC9.4b — Ignores malformed SSE messages
  it("ignores malformed SSE messages", () => {
    global.fetch = vi.fn(() => new Promise(() => {}));

    const { result } = renderHook(() => useSessionStateSSE("session-1"));

    const es = mockInstances[0]!;
    act(() => {
      es.simulateOpen();
    });

    // Send malformed data via the named event listener
    const listeners = es.listeners.get("state-update")!;
    act(() => {
      for (const listener of listeners) {
        listener(new MessageEvent("state-update", { data: "not json" }));
      }
    });

    expect(result.current.state).toBeNull();
  });

  // AC9.5 — Reconnects on error with exponential backoff
  it("reconnects with exponential backoff on error", () => {
    global.fetch = vi.fn(() => new Promise(() => {}));

    renderHook(() => useSessionStateSSE("session-1"));

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
      vi.advanceTimersByTime(1000);
    });
    expect(mockInstances).toHaveLength(2); // Not yet
    act(() => {
      vi.advanceTimersByTime(1000);
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

  // AC9.5b — Resets backoff on successful connection
  it("resets backoff on successful connection", () => {
    global.fetch = vi.fn(() => new Promise(() => {}));

    renderHook(() => useSessionStateSSE("session-1"));

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
    expect(mockInstances).toHaveLength(3); // Reconnected at 1s (reset)
  });

  // AC9.6 — Cleans up on unmount
  it("cleans up EventSource on unmount", () => {
    global.fetch = vi.fn(() => new Promise(() => {}));

    const { unmount } = renderHook(() => useSessionStateSSE("session-1"));

    const es = mockInstances[0]!;
    expect(es.closed).toBe(false);

    unmount();

    expect(es.closed).toBe(true);
  });

  // AC9.6b — Clears reconnect timer on unmount
  it("clears reconnect timer on unmount", () => {
    global.fetch = vi.fn(() => new Promise(() => {}));

    const { unmount } = renderHook(() => useSessionStateSSE("session-1"));

    const es = mockInstances[0]!;
    es.simulateError();

    unmount();

    act(() => {
      vi.advanceTimersByTime(10000);
    });

    expect(mockInstances).toHaveLength(1); // No reconnect after unmount
  });

  // AC9.6c — Does not update state after unmount
  it("does not update state after unmount", () => {
    global.fetch = vi.fn(() => new Promise(() => {}));

    const { result, unmount } = renderHook(() => useSessionStateSSE("session-1"));

    const es = mockInstances[0]!;
    act(() => {
      es.simulateOpen();
    });

    unmount();

    act(() => {
      es.simulateNamedEvent("state-update", {
        sessionId: "session-1",
        state: SAMPLE_STATE,
        exists: true,
      });
    });

    expect(result.current.state).toBeNull();
  });

  // Verifies SSE endpoint URL
  it("connects to correct SSE endpoint", () => {
    global.fetch = vi.fn(() => new Promise(() => {}));

    renderHook(() => useSessionStateSSE("my-session-id"));

    expect(mockInstances[0]!.url).toBe("/api/session/my-session-id/state/stream");
  });

  // Reconnects when sessionId changes
  it("reconnects when sessionId changes", () => {
    global.fetch = vi.fn(() => new Promise(() => {}));

    const { rerender } = renderHook(({ id }) => useSessionStateSSE(id), {
      initialProps: { id: "session-1" },
    });

    expect(mockInstances).toHaveLength(1);
    expect(mockInstances[0]!.url).toBe("/api/session/session-1/state/stream");

    rerender({ id: "session-2" });

    expect(mockInstances[0]!.closed).toBe(true);
    expect(mockInstances).toHaveLength(2);
    expect(mockInstances[1]!.url).toBe("/api/session/session-2/state/stream");
  });
});
