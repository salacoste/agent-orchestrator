/**
 * GET /api/agent/[id] — Agent data API tests (Story 38.1)
 */
import { describe, expect, it, vi, beforeEach } from "vitest";

const mockGet = vi.fn();

vi.mock("@/lib/services", () => ({
  getServices: vi.fn().mockResolvedValue({
    sessionManager: {
      get: (...args: unknown[]) => mockGet(...args),
    },
  }),
}));

const { GET } = await import("./route");

beforeEach(() => {
  vi.clearAllMocks();
});

function makeRequest(): Request {
  return new Request("http://localhost/api/agent/test-1", { method: "GET" });
}

function makeParams(id: string) {
  return { params: Promise.resolve({ id }) };
}

describe("GET /api/agent/[id]", () => {
  it("returns full session data for existing agent", async () => {
    mockGet.mockResolvedValueOnce({
      id: "agent-1",
      projectId: "my-project",
      status: "working",
      activity: null,
      branch: "feat/story-1",
      issueId: "PROJ-1",
      pr: { number: 42, url: "https://github.com/org/repo/pull/42", title: "feat: story 1" },
      workspacePath: "/tmp/worktree-1",
      agentInfo: { summary: "Working on story 1", agentSessionId: null },
      createdAt: new Date("2026-03-22T00:00:00Z"),
      lastActivityAt: new Date("2026-03-22T01:00:00Z"),
      restoredAt: undefined,
      metadata: { agent: "claude-code", summary: "Working on story 1" },
    });

    const res = await GET(makeRequest() as never, makeParams("agent-1"));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.id).toBe("agent-1");
    expect(data.projectId).toBe("my-project");
    expect(data.status).toBe("working");
    expect(data.branch).toBe("feat/story-1");
    expect(data.issueId).toBe("PROJ-1");
    expect(data.pr.number).toBe(42);
    expect(data.createdAt).toBe("2026-03-22T00:00:00.000Z");
    expect(data.lastActivityAt).toBe("2026-03-22T01:00:00.000Z");
    expect(data.metadata.agent).toBe("claude-code");
  });

  it("returns 404 for unknown agent", async () => {
    mockGet.mockResolvedValueOnce(null);

    const res = await GET(makeRequest() as never, makeParams("ghost"));
    expect(res.status).toBe(404);

    const data = await res.json();
    expect(data.error).toContain("ghost");
  });

  it("handles agent with no PR", async () => {
    mockGet.mockResolvedValueOnce({
      id: "agent-2",
      projectId: "proj",
      status: "spawning",
      activity: null,
      branch: null,
      issueId: null,
      pr: null,
      workspacePath: null,
      agentInfo: null,
      createdAt: new Date("2026-03-22T00:00:00Z"),
      lastActivityAt: new Date("2026-03-22T00:00:00Z"),
      restoredAt: undefined,
      metadata: {},
    });

    const res = await GET(makeRequest() as never, makeParams("agent-2"));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.pr).toBeNull();
    expect(data.restoredAt).toBeNull();
  });
});
