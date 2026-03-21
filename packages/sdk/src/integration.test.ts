/**
 * SDK integration tests (Story 34.2).
 *
 * Mock fetch to verify SDK calls correct API endpoints with correct params.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createOrchestrator } from "./index.js";

const mockFetch = vi.fn();

beforeEach(() => {
  vi.stubGlobal("fetch", mockFetch);
});

afterEach(() => {
  vi.restoreAllMocks();
});

function mockJsonResponse(data: unknown, status = 200) {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? "OK" : "Error",
    json: async () => data,
  });
}

describe("SDK spawn", () => {
  it("POSTs to /api/sessions with story config", async () => {
    mockFetch.mockReturnValueOnce(mockJsonResponse({ sessionId: "ao-session-1" }));

    const ao = createOrchestrator({ baseUrl: "http://localhost:5000" });
    const result = await ao.spawn({ storyId: "1-3-auth" });

    expect(result.sessionId).toBe("ao-session-1");
    expect(mockFetch).toHaveBeenCalledWith(
      "http://localhost:5000/api/sessions",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ storyId: "1-3-auth" }),
      }),
    );
  });

  it("includes agent profile when provided", async () => {
    mockFetch.mockReturnValueOnce(mockJsonResponse({ sessionId: "ao-2" }));

    const ao = createOrchestrator({ baseUrl: "http://localhost:5000" });
    await ao.spawn({ storyId: "1-3", agentProfile: "careful" });

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.agentProfile).toBe("careful");
  });
});

describe("SDK kill", () => {
  it("POSTs to /api/agent/:id/reassign", async () => {
    mockFetch.mockReturnValueOnce(mockJsonResponse({ success: true }));

    const ao = createOrchestrator({ baseUrl: "http://localhost:5000" });
    await ao.kill("ao-session-1");

    expect(mockFetch).toHaveBeenCalledWith(
      "http://localhost:5000/api/agent/ao-session-1/reassign",
      expect.objectContaining({ method: "POST" }),
    );
  });
});

describe("SDK recommend", () => {
  it("GETs /api/workflow/:projectId and returns recommendation", async () => {
    mockFetch.mockReturnValueOnce(
      mockJsonResponse({
        recommendation: { phase: "planning", observation: "No PRD", implication: "Create PRD" },
      }),
    );

    const ao = createOrchestrator({ baseUrl: "http://localhost:5000" });
    const rec = await ao.recommend("my-project");

    expect(rec?.phase).toBe("planning");
    expect(mockFetch).toHaveBeenCalledWith(
      "http://localhost:5000/api/workflow/my-project",
      expect.anything(),
    );
  });

  it("returns null when no recommendation", async () => {
    mockFetch.mockReturnValueOnce(mockJsonResponse({ recommendation: null }));

    const ao = createOrchestrator({ baseUrl: "http://localhost:5000" });
    expect(await ao.recommend("done-project")).toBeNull();
  });
});

describe("SDK listSessions", () => {
  it("GETs /api/sessions and returns session list", async () => {
    mockFetch.mockReturnValueOnce(
      mockJsonResponse({ sessions: [{ id: "s1", status: "working" }] }),
    );

    const ao = createOrchestrator({ baseUrl: "http://localhost:5000" });
    const sessions = await ao.listSessions();

    expect(sessions).toHaveLength(1);
    expect(sessions[0].id).toBe("s1");
  });

  it("returns empty array when no sessions", async () => {
    mockFetch.mockReturnValueOnce(mockJsonResponse({ sessions: [] }));

    const ao = createOrchestrator({ baseUrl: "http://localhost:5000" });
    expect(await ao.listSessions()).toHaveLength(0);
  });
});

describe("SDK auth", () => {
  it("includes Authorization header when apiKey provided", async () => {
    mockFetch.mockReturnValueOnce(mockJsonResponse({ sessions: [] }));

    const ao = createOrchestrator({ baseUrl: "http://localhost:5000", apiKey: "sk-test-123" });
    await ao.listSessions();

    const headers = mockFetch.mock.calls[0][1].headers;
    expect(headers.Authorization).toBe("Bearer sk-test-123");
  });

  it("omits Authorization when no apiKey", async () => {
    mockFetch.mockReturnValueOnce(mockJsonResponse({ sessions: [] }));

    const ao = createOrchestrator({ baseUrl: "http://localhost:5000" });
    await ao.listSessions();

    const headers = mockFetch.mock.calls[0][1].headers;
    expect(headers.Authorization).toBeUndefined();
  });
});

describe("SDK error handling", () => {
  it("throws on HTTP error", async () => {
    mockFetch.mockReturnValueOnce(
      Promise.resolve({ ok: false, status: 404, statusText: "Not Found", json: async () => ({}) }),
    );

    const ao = createOrchestrator({ baseUrl: "http://localhost:5000" });
    await expect(ao.recommend("missing")).rejects.toThrow("HTTP 404");
  });
});
