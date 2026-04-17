import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useConflictSSE } from "../useConflictSSE";
import type { ResourceConflict } from "@composio/ao-core";

// Mock EventSource
class MockEventSource {
  static instances: MockEventSource[] = [];
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: (() => void) | null = null;
  onopen: (() => void) | null = null;
  url: string;
  readyState = 0;

  constructor(url: string) {
    this.url = url;
    MockEventSource.instances.push(this);
  }

  close() {
    this.readyState = 2;
  }

  // Helper to simulate receiving a message
  simulateMessage(data: unknown) {
    if (this.onmessage) {
      this.onmessage(new MessageEvent("message", { data: JSON.stringify(data) }));
    }
  }
}

// Store the original global EventSource
const OriginalEventSource = globalThis.EventSource;

beforeEach(() => {
  MockEventSource.instances = [];
  globalThis.EventSource = MockEventSource as unknown as typeof EventSource;
});

afterEach(() => {
  globalThis.EventSource = OriginalEventSource;
  vi.restoreAllMocks();
});

describe("useConflictSSE", () => {
  it("creates EventSource connecting to /api/events", () => {
    const callback = vi.fn();
    renderHook(() => useConflictSSE(callback));

    expect(MockEventSource.instances.length).toBe(1);
    expect(MockEventSource.instances[0]!.url).toBe("/api/events");
  });

  it("calls callback when conflict-detected event arrives", () => {
    const callback = vi.fn();
    renderHook(() => useConflictSSE(callback));

    const mockConflict: ResourceConflict = {
      id: "conflict-new",
      resourceType: "repository",
      resourceIdentifier: "github.com/org/repo",
      competingProjects: ["proj-a", "proj-b"],
      severity: "high",
      detectedAt: new Date().toISOString(),
      metadata: {},
    };

    const es = MockEventSource.instances[0]!;
    act(() => {
      es.simulateMessage({
        type: "conflict-detected",
        conflicts: [mockConflict],
        timestamp: new Date().toISOString(),
      });
    });

    expect(callback).toHaveBeenCalledWith([mockConflict]);
  });

  it("ignores non-conflict events", () => {
    const callback = vi.fn();
    renderHook(() => useConflictSSE(callback));

    const es = MockEventSource.instances[0]!;
    act(() => {
      es.simulateMessage({ type: "snapshot", sessions: [] });
    });

    expect(callback).not.toHaveBeenCalled();
  });

  it("ignores malformed JSON messages", () => {
    const callback = vi.fn();
    renderHook(() => useConflictSSE(callback));

    const es = MockEventSource.instances[0]!;
    act(() => {
      if (es.onmessage) {
        es.onmessage(new MessageEvent("message", { data: "not-valid-json" }));
      }
    });

    expect(callback).not.toHaveBeenCalled();
  });

  it("closes EventSource on unmount", () => {
    const callback = vi.fn();
    const { unmount } = renderHook(() => useConflictSSE(callback));

    const es = MockEventSource.instances[0]!;
    const closeSpy = vi.spyOn(es, "close");

    unmount();

    expect(closeSpy).toHaveBeenCalled();
  });

  it("uses latest callback ref when called", () => {
    const callback1 = vi.fn();
    const callback2 = vi.fn();
    const { rerender } = renderHook(({ cb }) => useConflictSSE(cb), {
      initialProps: { cb: callback1 },
    });

    // Rerender with new callback
    rerender({ cb: callback2 });

    const es = MockEventSource.instances[0]!;
    const mockConflict: ResourceConflict = {
      id: "conflict-x",
      resourceType: "agent",
      resourceIdentifier: "shared-pool",
      competingProjects: ["proj-a"],
      severity: "critical",
      detectedAt: new Date().toISOString(),
      metadata: {},
    };

    act(() => {
      es.simulateMessage({
        type: "conflict-detected",
        conflicts: [mockConflict],
      });
    });

    // Should call the latest callback (callback2)
    expect(callback2).toHaveBeenCalledWith([mockConflict]);
    expect(callback1).not.toHaveBeenCalled();
  });
});
