/**
 * GitHub Action unit tests (Story 41.3).
 *
 * Tests all 3 commands (spawn, status, recommend) with mocked ActionCore + fetch.
 */
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { run } from "./index.js";

// Mock fetch
const mockFetch = vi.fn();

beforeEach(() => {
  vi.stubGlobal("fetch", mockFetch);
  mockFetch.mockClear();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function createMockCore(inputs: Record<string, string> = {}) {
  return {
    getInput: vi.fn((name: string) => inputs[name] ?? ""),
    setOutput: vi.fn(),
    setFailed: vi.fn(),
    info: vi.fn(),
  };
}

function okResponse(data: unknown) {
  return Promise.resolve({
    ok: true,
    json: () => Promise.resolve(data),
  });
}

describe("GitHub Action run()", () => {
  describe("spawn command", () => {
    it("calls /api/sessions and sets session-id output", async () => {
      const core = createMockCore({
        command: "spawn",
        "ao-url": "http://localhost:5000",
        "story-id": "1-3-auth",
      });
      mockFetch.mockReturnValueOnce(okResponse({ sessionId: "agent-42" }));

      await run(core);

      expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:5000/api/sessions",
        expect.objectContaining({ method: "POST" }),
      );
      expect(core.setOutput).toHaveBeenCalledWith("session-id", "agent-42");
      expect(core.info).toHaveBeenCalledWith(expect.stringContaining("agent-42"));
      expect(core.setFailed).not.toHaveBeenCalled();
    });

    it("fails when story-id is missing", async () => {
      const core = createMockCore({
        command: "spawn",
        "ao-url": "http://localhost:5000",
      });

      await run(core);

      expect(core.setFailed).toHaveBeenCalledWith(expect.stringContaining("story-id"));
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  describe("status command", () => {
    it("calls /api/workflow/{project} and sets status output", async () => {
      const core = createMockCore({
        command: "status",
        "ao-url": "http://localhost:5000",
        "project-id": "my-project",
      });
      mockFetch.mockReturnValueOnce(okResponse({ phases: [{ id: "impl", state: "active" }] }));

      await run(core);

      expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:5000/api/workflow/my-project",
        expect.objectContaining({ headers: expect.any(Object) }),
      );
      expect(core.setOutput).toHaveBeenCalledWith("status", expect.any(String));
      expect(core.setFailed).not.toHaveBeenCalled();
    });
  });

  describe("recommend command", () => {
    it("calls /api/workflow/{project} and sets recommendation output", async () => {
      const core = createMockCore({
        command: "recommend",
        "ao-url": "http://localhost:5000",
        "project-id": "my-project",
      });
      mockFetch.mockReturnValueOnce(
        okResponse({ recommendation: { phase: "impl", observation: "On track" } }),
      );

      await run(core);

      expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:5000/api/workflow/my-project",
        expect.objectContaining({ headers: expect.any(Object) }),
      );
      expect(core.setOutput).toHaveBeenCalledWith("recommendation", expect.any(String));
      expect(core.setFailed).not.toHaveBeenCalled();
    });
  });

  describe("error handling", () => {
    it("fails on unknown command", async () => {
      const core = createMockCore({
        command: "invalid",
        "ao-url": "http://localhost:5000",
      });

      await run(core);

      expect(core.setFailed).toHaveBeenCalledWith(expect.stringContaining("Unknown command"));
    });

    it("fails on non-ok HTTP response", async () => {
      const core = createMockCore({
        command: "spawn",
        "ao-url": "http://localhost:5000",
        "story-id": "S-1",
      });
      mockFetch.mockReturnValueOnce(Promise.resolve({ ok: false, status: 500 }));

      await run(core);

      expect(core.setFailed).toHaveBeenCalledWith(expect.stringContaining("500"));
    });

    it("fails on API error", async () => {
      const core = createMockCore({
        command: "spawn",
        "ao-url": "http://localhost:5000",
        "story-id": "S-1",
      });
      mockFetch.mockRejectedValueOnce(new Error("Network timeout"));

      await run(core);

      expect(core.setFailed).toHaveBeenCalledWith(expect.stringContaining("Network timeout"));
    });

    it("includes api key in headers when provided", async () => {
      const core = createMockCore({
        command: "status",
        "ao-url": "http://localhost:5000",
        "project-id": "proj",
        "ao-api-key": "secret-key",
      });
      mockFetch.mockReturnValueOnce(okResponse({ phases: [] }));

      await run(core);

      const fetchCall = mockFetch.mock.calls[0];
      const headers = (fetchCall[1] as { headers: Record<string, string> }).headers;
      expect(headers["Authorization"]).toBe("Bearer secret-key");
    });
  });
});

describe("action.yml validation", () => {
  it("has required fields", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const content = readFileSync(join(__dirname, "..", "action.yml"), "utf-8");

    expect(content).toContain("name:");
    expect(content).toContain("inputs:");
    expect(content).toContain("outputs:");
    expect(content).toContain('using: "node20"');
    expect(content).toContain("main:");
  });
});
