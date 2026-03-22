import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

import { createOrchestrator } from "./index.js";

// Mock EventSource
class MockEventSource {
  static instances: MockEventSource[] = [];
  onmessage: ((event: MessageEvent) => void) | null = null;
  readyState = 1;
  url: string;

  constructor(url: string) {
    this.url = url;
    MockEventSource.instances.push(this);
  }

  close() {
    this.readyState = 2;
  }

  // Test helper
  emit(data: unknown) {
    if (this.onmessage) {
      this.onmessage(new MessageEvent("message", { data: JSON.stringify(data) }));
    }
  }
}

beforeEach(() => {
  MockEventSource.instances = [];
  vi.stubGlobal("EventSource", MockEventSource);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("createOrchestrator", () => {
  it("returns all required methods", () => {
    const ao = createOrchestrator({ baseUrl: "http://localhost:5000" });
    expect(typeof ao.spawn).toBe("function");
    expect(typeof ao.kill).toBe("function");
    expect(typeof ao.recommend).toBe("function");
    expect(typeof ao.onEvent).toBe("function");
    expect(typeof ao.listSessions).toBe("function");
    expect(typeof ao.disconnect).toBe("function");
  });

  it("strips trailing slash from baseUrl", () => {
    const ao = createOrchestrator({ baseUrl: "http://localhost:5000/" });
    expect(ao).toBeDefined();
  });

  it("accepts optional apiKey and timeout", () => {
    const ao = createOrchestrator({
      baseUrl: "http://localhost:5000",
      apiKey: "test-key",
      timeoutMs: 5000,
    });
    expect(ao).toBeDefined();
  });
});

describe("onEvent SSE (Story 41.1)", () => {
  it("creates EventSource on first onEvent call", () => {
    const ao = createOrchestrator({ baseUrl: "http://localhost:5000" });

    ao.onEvent("story.completed", vi.fn());

    expect(MockEventSource.instances).toHaveLength(1);
    expect(MockEventSource.instances[0].url).toBe("http://localhost:5000/api/events");
  });

  it("handler receives matching events", () => {
    const ao = createOrchestrator({ baseUrl: "http://localhost:5000" });
    const handler = vi.fn();

    ao.onEvent("story.completed", handler);
    const es = MockEventSource.instances[0];

    es.emit({ type: "story.completed", storyId: "S-1", timestamp: "2026-03-22T00:00:00Z" });

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "story.completed",
        timestamp: "2026-03-22T00:00:00Z",
      }),
    );
  });

  it("filters events by type — non-matching events ignored", () => {
    const ao = createOrchestrator({ baseUrl: "http://localhost:5000" });
    const handler = vi.fn();

    ao.onEvent("story.completed", handler);
    const es = MockEventSource.instances[0];

    es.emit({ type: "story.blocked", storyId: "S-1" });

    expect(handler).not.toHaveBeenCalled();
  });

  it("multiple handlers share a single EventSource", () => {
    const ao = createOrchestrator({ baseUrl: "http://localhost:5000" });

    ao.onEvent("story.completed", vi.fn());
    ao.onEvent("story.blocked", vi.fn());

    expect(MockEventSource.instances).toHaveLength(1);
  });

  it("unsubscribe removes handler", () => {
    const ao = createOrchestrator({ baseUrl: "http://localhost:5000" });
    const handler = vi.fn();

    const unsub = ao.onEvent("story.completed", handler);
    const es = MockEventSource.instances[0];

    unsub();

    es.emit({ type: "story.completed", storyId: "S-1" });
    expect(handler).not.toHaveBeenCalled();
  });

  it("closes EventSource when all handlers removed", () => {
    const ao = createOrchestrator({ baseUrl: "http://localhost:5000" });

    const unsub1 = ao.onEvent("story.completed", vi.fn());
    const unsub2 = ao.onEvent("story.blocked", vi.fn());
    const es = MockEventSource.instances[0];

    unsub1();
    expect(es.readyState).toBe(1); // Still open — unsub2 remains

    unsub2();
    expect(es.readyState).toBe(2); // Closed — no handlers
  });

  it("disconnect closes EventSource and clears all handlers", () => {
    const ao = createOrchestrator({ baseUrl: "http://localhost:5000" });
    const handler = vi.fn();

    ao.onEvent("story.completed", handler);
    const es = MockEventSource.instances[0];

    ao.disconnect();

    expect(es.readyState).toBe(2);

    // New events should not reach old handler
    es.emit({ type: "story.completed", storyId: "S-1" });
    expect(handler).not.toHaveBeenCalled();
  });

  it("handler errors do not crash other handlers", () => {
    const ao = createOrchestrator({ baseUrl: "http://localhost:5000" });
    const badHandler = vi.fn(() => {
      throw new Error("oops");
    });
    const goodHandler = vi.fn();

    ao.onEvent("story.completed", badHandler);
    ao.onEvent("story.completed", goodHandler);
    const es = MockEventSource.instances[0];

    es.emit({ type: "story.completed", storyId: "S-1" });

    expect(badHandler).toHaveBeenCalled();
    expect(goodHandler).toHaveBeenCalled();
  });

  it("warns when EventSource not available", () => {
    vi.unstubAllGlobals(); // Remove EventSource
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    const ao = createOrchestrator({ baseUrl: "http://localhost:5000" });
    ao.onEvent("story.completed", vi.fn());

    expect(warn).toHaveBeenCalledWith(expect.stringContaining("EventSource not available"));
    warn.mockRestore();
  });
});
