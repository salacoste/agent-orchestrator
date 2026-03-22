/**
 * GET /api/agent/[id]/activity — Activity API tests (Story 38.2)
 */
import { describe, expect, it, vi, beforeEach } from "vitest";

const mockGet = vi.fn();

vi.mock("@/lib/services", () => ({
  getServices: vi.fn().mockResolvedValue({
    sessionManager: {
      get: (...args: unknown[]) => mockGet(...args),
    },
    config: { configPath: "/tmp/test-config.yaml" },
  }),
}));

const mockReadAgentEvents = vi.fn();

vi.mock("./read-events", () => ({
  readAgentEvents: (...args: unknown[]) => mockReadAgentEvents(...args),
}));

const { GET } = await import("./route");

function makeRequest(limit?: number): Request {
  const url = limit
    ? `http://localhost/api/agent/a1/activity?limit=${limit}`
    : "http://localhost/api/agent/a1/activity";
  return new Request(url, { method: "GET" });
}

function makeParams(id: string) {
  return { params: Promise.resolve({ id }) };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/agent/[id]/activity", () => {
  it("returns 404 for unknown agent", async () => {
    mockGet.mockResolvedValueOnce(null);

    const res = await GET(makeRequest() as never, makeParams("ghost"));
    expect(res.status).toBe(404);
  });

  it("returns empty events when no events exist", async () => {
    mockGet.mockResolvedValueOnce({ id: "agent-1", status: "working" });
    mockReadAgentEvents.mockResolvedValueOnce([]);

    const res = await GET(makeRequest() as never, makeParams("agent-1"));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.events).toEqual([]);
  });

  it("returns agent events sorted newest first", async () => {
    mockGet.mockResolvedValueOnce({ id: "agent-1", status: "working" });
    mockReadAgentEvents.mockResolvedValueOnce([
      {
        timestamp: "2026-03-22T03:00:00Z",
        type: "story.blocked",
        description: "Blocked on story S-1: CI failed",
        metadata: { storyId: "S-1", agentId: "agent-1", reason: "CI failed" },
      },
      {
        timestamp: "2026-03-22T01:00:00Z",
        type: "story.started",
        description: "Started working on story S-1",
        metadata: { storyId: "S-1", agentId: "agent-1" },
      },
    ]);

    const res = await GET(makeRequest() as never, makeParams("agent-1"));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.events).toHaveLength(2);
    expect(data.events[0].type).toBe("story.blocked");
    expect(data.events[1].type).toBe("story.started");
  });

  it("passes limit parameter to readAgentEvents", async () => {
    mockGet.mockResolvedValueOnce({ id: "agent-1", status: "working" });
    mockReadAgentEvents.mockResolvedValueOnce([]);

    await GET(makeRequest(50) as never, makeParams("agent-1"));

    expect(mockReadAgentEvents).toHaveBeenCalledWith("agent-1", "/tmp/test-config.yaml", 50);
  });

  it("caps limit at 500", async () => {
    mockGet.mockResolvedValueOnce({ id: "agent-1", status: "working" });
    mockReadAgentEvents.mockResolvedValueOnce([]);

    await GET(makeRequest(999) as never, makeParams("agent-1"));

    expect(mockReadAgentEvents).toHaveBeenCalledWith("agent-1", "/tmp/test-config.yaml", 500);
  });

  it("defaults to 100 when limit is NaN", async () => {
    mockGet.mockResolvedValueOnce({ id: "agent-1", status: "working" });
    mockReadAgentEvents.mockResolvedValueOnce([]);

    const req = new Request("http://localhost/api/agent/a1/activity?limit=abc", { method: "GET" });
    await GET(req as never, makeParams("agent-1"));

    expect(mockReadAgentEvents).toHaveBeenCalledWith("agent-1", "/tmp/test-config.yaml", 100);
  });

  it("clamps negative limit to 1", async () => {
    mockGet.mockResolvedValueOnce({ id: "agent-1", status: "working" });
    mockReadAgentEvents.mockResolvedValueOnce([]);

    await GET(makeRequest(-5) as never, makeParams("agent-1"));

    expect(mockReadAgentEvents).toHaveBeenCalledWith("agent-1", "/tmp/test-config.yaml", 1);
  });
});
