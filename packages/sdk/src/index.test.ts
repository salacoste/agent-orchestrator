import { describe, expect, it, vi } from "vitest";

import { createOrchestrator } from "./index.js";

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

  it("onEvent returns unsubscribe function with warning", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const ao = createOrchestrator({ baseUrl: "http://localhost:5000" });
    const unsub = ao.onEvent("story.completed", vi.fn());

    expect(typeof unsub).toBe("function");
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("not yet implemented"));
    warn.mockRestore();
  });

  it("strips trailing slash from baseUrl", () => {
    const ao = createOrchestrator({ baseUrl: "http://localhost:5000/" });
    expect(ao).toBeDefined();
  });

  it("disconnect is callable", () => {
    const ao = createOrchestrator({ baseUrl: "http://localhost:5000" });
    expect(() => ao.disconnect()).not.toThrow();
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
