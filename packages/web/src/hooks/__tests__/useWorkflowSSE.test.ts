import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useWorkflowSSE } from "../useWorkflowSSE";

// Mock EventSource matching existing useSSEConnection test pattern
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
    // Store reference so tests can access
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

describe("useWorkflowSSE", () => {
  let originalEventSource: typeof EventSource;

  beforeEach(() => {
    vi.useFakeTimers();
    mockInstances = [];
    originalEventSource = global.EventSource;
    global.EventSource = MockEventSource as unknown as typeof EventSource;
  });

  afterEach(() => {
    global.EventSource = originalEventSource;
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it("fires callback on workflow-change event", () => {
    const cb = vi.fn();
    renderHook(() => useWorkflowSSE(cb));

    const es = mockInstances[0]!;
    es.simulateOpen();
    es.simulateMessage({ type: "workflow-change" });

    expect(cb).toHaveBeenCalledTimes(1);
  });

  it("ignores non-workflow-change events", () => {
    const cb = vi.fn();
    renderHook(() => useWorkflowSSE(cb));

    const es = mockInstances[0]!;
    es.simulateOpen();
    es.simulateMessage({ type: "snapshot", sessions: [] });
    es.simulateMessage({ type: "session.activity", sessionId: "x" });

    expect(cb).not.toHaveBeenCalled();
  });

  it("ignores malformed messages", () => {
    const cb = vi.fn();
    renderHook(() => useWorkflowSSE(cb));

    const es = mockInstances[0]!;
    es.simulateOpen();
    // Send raw invalid JSON
    es.onmessage?.(new MessageEvent("message", { data: "not json" }));

    expect(cb).not.toHaveBeenCalled();
  });

  it("reconnects automatically on error with exponential backoff", () => {
    const cb = vi.fn();
    renderHook(() => useWorkflowSSE(cb));

    expect(mockInstances).toHaveLength(1);

    // Simulate error — should schedule reconnect at 1s
    const es1 = mockInstances[0]!;
    es1.simulateError();
    expect(mockInstances).toHaveLength(1); // Not yet reconnected

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(mockInstances).toHaveLength(2); // First reconnect at 1s

    // Second error — should schedule at 2s
    mockInstances[1]!.simulateError();
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(mockInstances).toHaveLength(2); // Not yet (only 1s elapsed, needs 2s)
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(mockInstances).toHaveLength(3); // Second reconnect at 2s

    // Third error — should schedule at 4s
    mockInstances[2]!.simulateError();
    act(() => {
      vi.advanceTimersByTime(4000);
    });
    expect(mockInstances).toHaveLength(4); // Third reconnect at 4s

    // Fourth error — capped at 8s
    mockInstances[3]!.simulateError();
    act(() => {
      vi.advanceTimersByTime(8000);
    });
    expect(mockInstances).toHaveLength(5); // Fourth reconnect at 8s (cap)
  });

  it("fires callback on reconnect to catch missed events", () => {
    const cb = vi.fn();
    renderHook(() => useWorkflowSSE(cb));

    const es1 = mockInstances[0]!;
    es1.simulateOpen(); // Initial connect — no callback (not a reconnect)
    expect(cb).not.toHaveBeenCalled();

    // Disconnect and reconnect
    es1.simulateError();
    act(() => {
      vi.advanceTimersByTime(1000);
    });

    const es2 = mockInstances[1]!;
    es2.simulateOpen(); // Reconnect — should fire callback
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it("resets reconnect attempts on successful reconnect", () => {
    const cb = vi.fn();
    renderHook(() => useWorkflowSSE(cb));

    // First error → reconnect at 1s
    mockInstances[0]!.simulateError();
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(mockInstances).toHaveLength(2);

    // Successful reconnect — resets attempts
    mockInstances[1]!.simulateOpen();

    // Another error — should be back to 1s delay (not 2s)
    mockInstances[1]!.simulateError();
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(mockInstances).toHaveLength(3); // Reconnected at 1s (reset)
  });

  it("cleans up EventSource on unmount", () => {
    const cb = vi.fn();
    const { unmount } = renderHook(() => useWorkflowSSE(cb));

    const es = mockInstances[0]!;
    expect(es.closed).toBe(false);

    unmount();
    expect(es.closed).toBe(true);
  });

  it("clears reconnect timer on unmount", () => {
    const cb = vi.fn();
    const { unmount } = renderHook(() => useWorkflowSSE(cb));

    // Trigger error to schedule reconnect
    mockInstances[0]!.simulateError();

    unmount();

    // Advancing timers should NOT create new instances (timer was cleared)
    act(() => {
      vi.advanceTimersByTime(10000);
    });
    expect(mockInstances).toHaveLength(1); // No reconnect after unmount
  });

  it("does not fire callback after unmount", () => {
    const cb = vi.fn();
    const { unmount } = renderHook(() => useWorkflowSSE(cb));

    const es = mockInstances[0]!;
    es.simulateOpen();

    unmount();

    // Simulate event after unmount — callback should NOT fire
    es.simulateMessage({ type: "workflow-change" });
    expect(cb).not.toHaveBeenCalled();
  });

  it("does not fire reconnect callback after unmount", () => {
    const cb = vi.fn();
    const { unmount } = renderHook(() => useWorkflowSSE(cb));

    // Error and schedule reconnect
    mockInstances[0]!.simulateError();

    unmount();

    // Advance timers — reconnect should NOT happen
    act(() => {
      vi.advanceTimersByTime(2000);
    });

    // No new instances should be created
    expect(mockInstances).toHaveLength(1);
    expect(cb).not.toHaveBeenCalled();
  });

  it("uses latest callback ref without reconnecting", () => {
    const cb1 = vi.fn();
    const cb2 = vi.fn();
    const { rerender } = renderHook(({ cb }) => useWorkflowSSE(cb), {
      initialProps: { cb: cb1 },
    });

    const es = mockInstances[0]!;
    es.simulateOpen();

    // Re-render with new callback
    rerender({ cb: cb2 });

    // Should still be same EventSource (no reconnect)
    expect(mockInstances).toHaveLength(1);

    // New event should use updated callback
    es.simulateMessage({ type: "workflow-change" });
    expect(cb1).not.toHaveBeenCalled();
    expect(cb2).toHaveBeenCalledTimes(1);
  });

  it("connects to /api/events endpoint", () => {
    renderHook(() => useWorkflowSSE(() => {}));

    expect(mockInstances[0]!.url).toBe("/api/events");
  });
});
