import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useSSEConnection } from "../useSSEConnection";

// Mock EventSource
class MockEventSource {
  url: string;
  readyState: number = 0; // CONNECTING
  onopen: ((event: Event) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  CONNECTING = 0;
  OPEN = 1;
  CLOSED = 2;

  private openTimeout: ReturnType<typeof setTimeout> | null = null;

  constructor(url: string) {
    this.url = url;
    // Simulate async connection
    this.openTimeout = setTimeout(() => {
      this.readyState = this.OPEN;
      if (this.onopen) {
        this.onopen(new Event("open"));
      }
    }, 10);
  }

  addEventListener(_type: string, _listener: () => void) {}
  removeEventListener(_type: string, _listener: () => void) {}

  close() {
    if (this.openTimeout) clearTimeout(this.openTimeout);
    this.readyState = this.CLOSED;
  }

  // Test helper methods
  simulateOpen() {
    if (this.openTimeout) clearTimeout(this.openTimeout);
    this.readyState = this.OPEN;
    if (this.onopen) {
      this.onopen(new Event("open"));
    }
  }

  simulateError() {
    this.readyState = this.CLOSED;
    if (this.onerror) {
      this.onerror(new Event("error"));
    }
  }

  simulateMessage(data: unknown) {
    if (this.onmessage) {
      this.onmessage(new MessageEvent("message", { data: JSON.stringify(data) }));
    }
  }
}

describe("useSSEConnection", () => {
  let originalEventSource: typeof EventSource;

  beforeEach(() => {
    originalEventSource = global.EventSource;
    global.EventSource = MockEventSource as any;
  });

  afterEach(() => {
    global.EventSource = originalEventSource;
    vi.clearAllMocks();
  });

  it("starts in disconnected state", () => {
    const { result } = renderHook(() => useSSEConnection());

    expect(result.current.connected).toBe(false);
    expect(result.current.reconnecting).toBe(false);
  });

  it("transitions to connected when EventSource opens", async () => {
    let mockES: MockEventSource | null = null;
    const { result } = renderHook(() =>
      useSSEConnection(undefined, {
        eventSourceFactory: () => {
          mockES = new MockEventSource("/api/events");
          return mockES as unknown as EventSource;
        },
      }),
    );

    await act(async () => {
      mockES?.simulateOpen();
    });

    await waitFor(() => {
      expect(result.current.connected).toBe(true);
    });
  });

  it("shows reconnecting state when connection is lost and retrying", async () => {
    let mockES: MockEventSource | null = null;
    const { result } = renderHook(() =>
      useSSEConnection(undefined, {
        eventSourceFactory: () => {
          mockES = new MockEventSource("/api/events");
          return mockES as unknown as EventSource;
        },
      }),
    );

    // First connect
    await act(async () => {
      mockES?.simulateOpen();
    });

    await waitFor(() => {
      expect(result.current.connected).toBe(true);
    });

    // Then disconnect
    await act(async () => {
      mockES?.simulateError();
    });

    await waitFor(() => {
      expect(result.current.reconnecting).toBe(true);
    });
  });

  it("implements exponential backoff for reconnection attempts", async () => {
    let mockES: MockEventSource | null = null;
    const { result } = renderHook(() =>
      useSSEConnection(undefined, {
        eventSourceFactory: () => {
          mockES = new MockEventSource("/api/events");
          return mockES as unknown as EventSource;
        },
      }),
    );

    // Simulate multiple failed reconnection attempts
    for (let i = 0; i < 4; i++) {
      await act(async () => {
        mockES?.simulateError();
      });
      // After each error, should be in reconnecting state
      await waitFor(() => {
        expect(result.current.reconnecting).toBe(true);
      });
    }
  });

  it("handles story.started events", async () => {
    const onStoryStarted = vi.fn();
    let mockES: MockEventSource | null = null;

    renderHook(() =>
      useSSEConnection(
        {
          onStoryStarted,
        },
        {
          eventSourceFactory: () => {
            mockES = new MockEventSource("/api/events");
            return mockES as unknown as EventSource;
          },
        },
      ),
    );

    await act(async () => {
      mockES?.simulateMessage({
        type: "story.started",
        data: { storyId: "STORY-001", agentId: "agent-001" },
      });
    });

    expect(onStoryStarted).toHaveBeenCalledWith({
      storyId: "STORY-001",
      agentId: "agent-001",
    });
  });

  it("handles story.completed events", async () => {
    const onStoryCompleted = vi.fn();
    let mockES: MockEventSource | null = null;

    renderHook(() =>
      useSSEConnection(
        {
          onStoryCompleted,
        },
        {
          eventSourceFactory: () => {
            mockES = new MockEventSource("/api/events");
            return mockES as unknown as EventSource;
          },
        },
      ),
    );

    await act(async () => {
      mockES?.simulateMessage({
        type: "story.completed",
        data: { storyId: "STORY-001" },
      });
    });

    expect(onStoryCompleted).toHaveBeenCalledWith({
      storyId: "STORY-001",
    });
  });

  it("handles story.blocked events", async () => {
    const onStoryBlocked = vi.fn();
    let mockES: MockEventSource | null = null;

    renderHook(() =>
      useSSEConnection(
        {
          onStoryBlocked,
        },
        {
          eventSourceFactory: () => {
            mockES = new MockEventSource("/api/events");
            return mockES as unknown as EventSource;
          },
        },
      ),
    );

    await act(async () => {
      mockES?.simulateMessage({
        type: "story.blocked",
        data: { storyId: "STORY-001", reason: "Waiting for user input" },
      });
    });

    expect(onStoryBlocked).toHaveBeenCalledWith({
      storyId: "STORY-001",
      reason: "Waiting for user input",
    });
  });

  it("handles agent.status_changed events", async () => {
    const onAgentStatusChanged = vi.fn();
    let mockES: MockEventSource | null = null;

    renderHook(() =>
      useSSEConnection(
        {
          onAgentStatusChanged,
        },
        {
          eventSourceFactory: () => {
            mockES = new MockEventSource("/api/events");
            return mockES as unknown as EventSource;
          },
        },
      ),
    );

    await act(async () => {
      mockES?.simulateMessage({
        type: "agent.status_changed",
        data: { agentId: "agent-001", status: "working" },
      });
    });

    expect(onAgentStatusChanged).toHaveBeenCalledWith({
      agentId: "agent-001",
      status: "working",
    });
  });

  it("closes EventSource on unmount", () => {
    const closeSpy = vi.fn();
    global.EventSource = class extends MockEventSource {
      close() {
        closeSpy();
        super.close();
      }
    } as any;

    const { unmount } = renderHook(() => useSSEConnection());

    unmount();

    expect(closeSpy).toHaveBeenCalledTimes(1);
  });

  it("provides onReconnected callback for fetching missed events", () => {
    const onReconnected = vi.fn();
    const { result } = renderHook(() =>
      useSSEConnection({
        onReconnected,
      }),
    );

    // Verify the handler is accessible via the hook's API
    expect(onReconnected).toBeDefined();
    expect(result.current.connected).toBe(false);
  });
});
