import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useNotepadSSE, type NotepadData } from "../useNotepadSSE";

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

const SAMPLE_NOTEPAD: NotepadData = {
  priority: "## Priority\n- Fix login bug",
  working: "## Working Memory\n- Investigating auth flow",
  manual: "",
};

describe("useNotepadSSE", () => {
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

  // AC7.1 — Returns initial null state before fetch completes
  it("returns initial null state before fetch completes", () => {
    global.fetch = vi.fn(() => new Promise(() => {})); // Never resolves
    const { result } = renderHook(() => useNotepadSSE("session-1"));

    expect(result.current.notepad).toBeNull();
    expect(result.current.exists).toBe(false);
    expect(result.current.connected).toBe(false);
  });

  // AC7.2 — Fetches initial data from REST endpoint
  it("fetches initial data from REST endpoint", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          sessionId: "session-1",
          notepad: SAMPLE_NOTEPAD,
          exists: true,
        }),
    });

    const { result } = renderHook(() => useNotepadSSE("session-1"));

    // Wait for fetch to resolve
    await act(async () => {
      await vi.runAllTimersAsync();
    });

    expect(global.fetch).toHaveBeenCalledWith("/api/session/session-1/notepad");
    expect(result.current.notepad).toEqual(SAMPLE_NOTEPAD);
    expect(result.current.exists).toBe(true);
  });

  // AC7.2b — Handles REST fetch failure gracefully
  it("handles REST fetch failure gracefully", async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error("Network error"));

    const { result } = renderHook(() => useNotepadSSE("session-1"));

    await act(async () => {
      await vi.runAllTimersAsync();
    });

    // Should remain in default state — SSE will provide data
    expect(result.current.notepad).toBeNull();
    expect(result.current.exists).toBe(false);
  });

  // AC7.2c — Handles non-ok REST response gracefully
  it("handles non-ok REST response gracefully", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
    });

    const { result } = renderHook(() => useNotepadSSE("session-1"));

    await act(async () => {
      await vi.runAllTimersAsync();
    });

    expect(result.current.notepad).toBeNull();
    expect(result.current.exists).toBe(false);
  });

  // AC7.3 — Updates state on SSE notepad-update event
  it("updates state on SSE notepad-update event", () => {
    global.fetch = vi.fn(() => new Promise(() => {})); // Don't resolve

    const { result } = renderHook(() => useNotepadSSE("session-1"));

    const es = mockInstances[0]!;
    act(() => {
      es.simulateOpen();
    });

    expect(result.current.connected).toBe(true);

    const updatedNotepad: NotepadData = {
      priority: "## Updated Priority",
      working: "Updated working memory",
      manual: "Manual notes",
    };

    act(() => {
      es.simulateMessage({
        type: "notepad-update",
        sessionId: "session-1",
        notepad: updatedNotepad,
        exists: true,
      });
    });

    expect(result.current.notepad).toEqual(updatedNotepad);
    expect(result.current.exists).toBe(true);
  });

  // AC7.3b — Ignores non-notepad-update events
  it("ignores non-notepad-update events", () => {
    global.fetch = vi.fn(() => new Promise(() => {}));

    const { result } = renderHook(() => useNotepadSSE("session-1"));

    const es = mockInstances[0]!;
    act(() => {
      es.simulateOpen();
    });

    act(() => {
      es.simulateMessage({ type: "heartbeat" });
      es.simulateMessage({ type: "other-event" });
    });

    expect(result.current.notepad).toBeNull();
  });

  // AC7.3c — Ignores malformed messages
  it("ignores malformed messages", () => {
    global.fetch = vi.fn(() => new Promise(() => {}));

    const { result } = renderHook(() => useNotepadSSE("session-1"));

    const es = mockInstances[0]!;
    act(() => {
      es.simulateOpen();
    });

    act(() => {
      es.onmessage?.(new MessageEvent("message", { data: "not json" }));
    });

    expect(result.current.notepad).toBeNull();
  });

  // AC7.4 — Cleans up EventSource on unmount
  it("cleans up EventSource on unmount", () => {
    global.fetch = vi.fn(() => new Promise(() => {}));

    const { unmount } = renderHook(() => useNotepadSSE("session-1"));

    const es = mockInstances[0]!;
    expect(es.closed).toBe(false);

    unmount();

    expect(es.closed).toBe(true);
  });

  // AC7.4b — Clears reconnect timer on unmount
  it("clears reconnect timer on unmount", () => {
    global.fetch = vi.fn(() => new Promise(() => {}));

    const { unmount } = renderHook(() => useNotepadSSE("session-1"));

    const es = mockInstances[0]!;
    es.simulateError();

    unmount();

    act(() => {
      vi.advanceTimersByTime(10000);
    });

    expect(mockInstances).toHaveLength(1); // No reconnect after unmount
  });

  // AC7.4c — Does not update state after unmount
  it("does not update state after unmount", () => {
    global.fetch = vi.fn(() => new Promise(() => {}));

    const { result, unmount } = renderHook(() => useNotepadSSE("session-1"));

    const es = mockInstances[0]!;
    act(() => {
      es.simulateOpen();
    });

    unmount();
    act(() => {
      es.simulateMessage({
        type: "notepad-update",
        sessionId: "session-1",
        notepad: SAMPLE_NOTEPAD,
        exists: true,
      });
    });

    // State should remain at pre-unmount value
    expect(result.current.notepad).toBeNull();
  });

  // AC7.5 — Reconnects with exponential backoff on error
  it("reconnects with exponential backoff on error", () => {
    global.fetch = vi.fn(() => new Promise(() => {}));

    renderHook(() => useNotepadSSE("session-1"));

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
    expect(mockInstances).toHaveLength(2); // Not yet (needs 2s)
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

  // AC7.5b — Resets backoff on successful connection
  it("resets backoff on successful connection", () => {
    global.fetch = vi.fn(() => new Promise(() => {}));

    renderHook(() => useNotepadSSE("session-1"));

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

  // AC7.5c — Sets connected to false on error and true on open
  it("tracks connected state", () => {
    global.fetch = vi.fn(() => new Promise(() => {}));

    const { result } = renderHook(() => useNotepadSSE("session-1"));

    const es = mockInstances[0]!;
    expect(result.current.connected).toBe(false);

    act(() => {
      es.simulateOpen();
    });
    expect(result.current.connected).toBe(true);

    act(() => {
      es.simulateError();
    });
    expect(result.current.connected).toBe(false);
  });

  // AC7.6 — Handles missing notepad gracefully (exists: false)
  it("handles missing notepad gracefully", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          sessionId: "session-1",
          notepad: { priority: "", working: "", manual: "" },
          exists: false,
        }),
    });

    const { result } = renderHook(() => useNotepadSSE("session-1"));

    await act(async () => {
      await vi.runAllTimersAsync();
    });

    expect(result.current.exists).toBe(false);
    expect(result.current.notepad).toEqual({ priority: "", working: "", manual: "" });
  });

  // AC7.6b — SSE can update exists from false to true
  it("SSE can update exists from false to true", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          sessionId: "session-1",
          notepad: { priority: "", working: "", manual: "" },
          exists: false,
        }),
    });

    const { result } = renderHook(() => useNotepadSSE("session-1"));

    await act(async () => {
      await vi.runAllTimersAsync();
    });

    expect(result.current.exists).toBe(false);

    const es = mockInstances[0]!;
    act(() => {
      es.simulateOpen();
    });

    act(() => {
      es.simulateMessage({
        type: "notepad-update",
        sessionId: "session-1",
        notepad: SAMPLE_NOTEPAD,
        exists: true,
      });
    });

    expect(result.current.exists).toBe(true);
    expect(result.current.notepad).toEqual(SAMPLE_NOTEPAD);
  });

  // Verifies SSE endpoint URL
  it("connects to correct SSE endpoint", () => {
    global.fetch = vi.fn(() => new Promise(() => {}));

    renderHook(() => useNotepadSSE("my-session-id"));

    expect(mockInstances[0]!.url).toBe("/api/session/my-session-id/notepad/stream");
  });

  // Reconnects when sessionId changes
  it("reconnects when sessionId changes", () => {
    global.fetch = vi.fn(() => new Promise(() => {}));

    const { rerender } = renderHook(({ id }) => useNotepadSSE(id), {
      initialProps: { id: "session-1" },
    });

    expect(mockInstances).toHaveLength(1);
    expect(mockInstances[0]!.url).toBe("/api/session/session-1/notepad/stream");

    rerender({ id: "session-2" });

    // Old connection closed, new one created
    expect(mockInstances[0]!.closed).toBe(true);
    expect(mockInstances).toHaveLength(2);
    expect(mockInstances[1]!.url).toBe("/api/session/session-2/notepad/stream");
  });
});
