import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import type { TimelineEntry } from "@composio/ao-core";
import { useTimelineSSE } from "../useTimelineSSE";

// Mock EventSource matching existing test pattern
class MockEventSource {
  url: string;
  readyState: number = 0;
  onopen: ((event: Event) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  CONNECTING = 0;
  OPEN = 1;
  CLOSED = 2;
  closed = false;

  constructor(url: string) {
    this.url = url;
    mockInstances.push(this);
  }

  close() {
    this.readyState = this.CLOSED;
    this.closed = true;
  }

  simulateOpen() {
    this.readyState = this.OPEN;
    this.onopen?.(new Event("open"));
  }

  simulateError() {
    this.readyState = this.CLOSED;
    this.onerror?.(new Event("error"));
  }

  simulateMessage(data: unknown) {
    this.onmessage?.(new MessageEvent("message", { data: JSON.stringify(data) }));
  }
}

let mockInstances: MockEventSource[] = [];

const SAMPLE_ENTRIES: TimelineEntry[] = [
  {
    agent: "planner",
    agentType: "planner",
    action: "Agent planner started",
    event: "agent_start",
    timestamp: 1.0,
    model: "claude-sonnet-4-6",
  },
  {
    agent: "planner",
    agentType: "planner",
    action: "Called Read",
    event: "tool_start",
    timestamp: 5.0,
    tool: "Read",
  },
  {
    agent: "executor",
    agentType: "executor",
    action: "Modified src/main.ts",
    event: "file_touch",
    timestamp: 20.0,
    file: "src/main.ts",
  },
];

describe("useTimelineSSE", () => {
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

  // Returns initial empty state before fetch completes
  it("returns initial empty state before fetch completes", () => {
    global.fetch = vi.fn(() => new Promise(() => {}));
    const { result } = renderHook(() => useTimelineSSE("session-1"));

    expect(result.current.timeline).toEqual([]);
    expect(result.current.connected).toBe(false);
  });

  // Fetches initial data from REST endpoint
  it("fetches initial data from REST endpoint", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          sessionId: "session-1",
          timeline: SAMPLE_ENTRIES,
          totalEntries: 3,
        }),
    });

    const { result } = renderHook(() => useTimelineSSE("session-1"));

    await act(async () => {
      await vi.runAllTimersAsync();
    });

    expect(global.fetch).toHaveBeenCalledWith("/api/session/session-1/timeline");
    expect(result.current.timeline).toEqual(SAMPLE_ENTRIES);
  });

  // Handles REST fetch failure gracefully
  it("handles REST fetch failure gracefully", async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error("Network error"));

    const { result } = renderHook(() => useTimelineSSE("session-1"));

    await act(async () => {
      await vi.runAllTimersAsync();
    });

    expect(result.current.timeline).toEqual([]);
  });

  // Updates state on SSE timeline-update event
  it("updates state on SSE timeline-update event", () => {
    global.fetch = vi.fn(() => new Promise(() => {}));

    const { result } = renderHook(() => useTimelineSSE("session-1"));

    const es = mockInstances[0]!;
    act(() => {
      es.simulateOpen();
    });

    expect(result.current.connected).toBe(true);

    const updatedEntries: TimelineEntry[] = [
      ...SAMPLE_ENTRIES,
      {
        agent: "verifier",
        agentType: "verifier",
        action: "Agent verifier started",
        event: "agent_start",
        timestamp: 25.0,
      },
    ];

    act(() => {
      es.simulateMessage({
        type: "timeline-update",
        sessionId: "session-1",
        timeline: updatedEntries,
        totalEntries: 4,
      });
    });

    expect(result.current.timeline).toEqual(updatedEntries);
    expect(result.current.timeline).toHaveLength(4);
  });

  // Ignores non-timeline-update events
  it("ignores non-timeline-update events", () => {
    global.fetch = vi.fn(() => new Promise(() => {}));

    const { result } = renderHook(() => useTimelineSSE("session-1"));

    const es = mockInstances[0]!;
    act(() => {
      es.simulateOpen();
    });

    act(() => {
      es.simulateMessage({ type: "heartbeat" });
      es.simulateMessage({ type: "other-event" });
    });

    expect(result.current.timeline).toEqual([]);
  });

  // Ignores malformed messages
  it("ignores malformed messages", () => {
    global.fetch = vi.fn(() => new Promise(() => {}));

    const { result } = renderHook(() => useTimelineSSE("session-1"));

    const es = mockInstances[0]!;
    act(() => {
      es.simulateOpen();
    });

    act(() => {
      es.onmessage?.(new MessageEvent("message", { data: "not json" }));
    });

    expect(result.current.timeline).toEqual([]);
  });

  // Sets connected=true on SSE open
  it("sets connected=true on SSE open", () => {
    global.fetch = vi.fn(() => new Promise(() => {}));

    const { result } = renderHook(() => useTimelineSSE("session-1"));

    expect(result.current.connected).toBe(false);

    const es = mockInstances[0]!;
    act(() => {
      es.simulateOpen();
    });

    expect(result.current.connected).toBe(true);
  });

  // Sets connected=false on SSE error
  it("sets connected=false on SSE error", () => {
    global.fetch = vi.fn(() => new Promise(() => {}));

    const { result } = renderHook(() => useTimelineSSE("session-1"));

    const es = mockInstances[0]!;
    act(() => {
      es.simulateOpen();
    });
    expect(result.current.connected).toBe(true);

    act(() => {
      es.simulateError();
    });
    expect(result.current.connected).toBe(false);
  });

  // Reconnects with exponential backoff
  it("reconnects with exponential backoff on error", () => {
    global.fetch = vi.fn(() => new Promise(() => {}));

    renderHook(() => useTimelineSSE("session-1"));

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

  // Resets backoff on successful connection
  it("resets backoff on successful connection", () => {
    global.fetch = vi.fn(() => new Promise(() => {}));

    renderHook(() => useTimelineSSE("session-1"));

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

  // Cleans up EventSource on unmount
  it("cleans up EventSource on unmount", () => {
    global.fetch = vi.fn(() => new Promise(() => {}));

    const { unmount } = renderHook(() => useTimelineSSE("session-1"));

    const es = mockInstances[0]!;
    expect(es.closed).toBe(false);

    unmount();

    expect(es.closed).toBe(true);
  });

  // Clears reconnect timer on unmount
  it("clears reconnect timer on unmount", () => {
    global.fetch = vi.fn(() => new Promise(() => {}));

    const { unmount } = renderHook(() => useTimelineSSE("session-1"));

    const es = mockInstances[0]!;
    es.simulateError();

    unmount();

    act(() => {
      vi.advanceTimersByTime(10000);
    });

    expect(mockInstances).toHaveLength(1); // No reconnect after unmount
  });

  // Does not update state after unmount
  it("does not update state after unmount", () => {
    global.fetch = vi.fn(() => new Promise(() => {}));

    const { result, unmount } = renderHook(() => useTimelineSSE("session-1"));

    const es = mockInstances[0]!;
    act(() => {
      es.simulateOpen();
    });

    unmount();

    act(() => {
      es.simulateMessage({
        type: "timeline-update",
        sessionId: "session-1",
        timeline: SAMPLE_ENTRIES,
        totalEntries: 3,
      });
    });

    expect(result.current.timeline).toEqual([]);
  });

  // Connects to correct SSE endpoint
  it("connects to correct SSE endpoint", () => {
    global.fetch = vi.fn(() => new Promise(() => {}));

    renderHook(() => useTimelineSSE("my-session-id"));

    expect(mockInstances[0]!.url).toBe("/api/session/my-session-id/timeline/stream");
  });

  // Reconnects when sessionId changes
  it("reconnects when sessionId changes", () => {
    global.fetch = vi.fn(() => new Promise(() => {}));

    const { rerender } = renderHook(({ id }) => useTimelineSSE(id), {
      initialProps: { id: "session-1" },
    });

    expect(mockInstances).toHaveLength(1);
    expect(mockInstances[0]!.url).toBe("/api/session/session-1/timeline/stream");

    rerender({ id: "session-2" });

    expect(mockInstances[0]!.closed).toBe(true);
    expect(mockInstances).toHaveLength(2);
    expect(mockInstances[1]!.url).toBe("/api/session/session-2/timeline/stream");
  });
});
