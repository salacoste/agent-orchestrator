/**
 * Agent recovery API endpoint tests (Stories 25a.1, 38.4, 38.5).
 */
import { describe, expect, it, vi, beforeEach } from "vitest";

// Mock getServices
const mockGet = vi.fn();
const mockKill = vi.fn();
const mockRestore = vi.fn();
const mockSend = vi.fn();

vi.mock("@/lib/services", () => ({
  getServices: vi.fn().mockResolvedValue({
    sessionManager: {
      get: (...args: unknown[]) => mockGet(...args),
      kill: (...args: unknown[]) => mockKill(...args),
      restore: (...args: unknown[]) => mockRestore(...args),
      send: (...args: unknown[]) => mockSend(...args),
    },
    config: {},
    registry: {},
  }),
}));

// Must import AFTER mocks
const { GET: pingHandler } = await import("./ping/route");
const { POST: restartHandler } = await import("./restart/route");
const { POST: reassignHandler } = await import("./reassign/route");
const { POST: resumeHandler } = await import("./resume/route");

function makeRequest(body?: unknown): Request {
  if (body) {
    return new Request("http://localhost/api/agent/test-agent/action", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  }
  return new Request("http://localhost/api/agent/test-agent/action", { method: "POST" });
}

function makeParams(id: string) {
  return { params: Promise.resolve({ id }) };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/agent/[id]/ping", () => {
  it("returns 200 with status for existing agent", async () => {
    mockGet.mockResolvedValueOnce({ status: "working", lastActivityAt: "2026-03-21T00:00:00Z" });

    const res = await pingHandler(makeRequest() as never, makeParams("agent-1"));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.status).toBe("working");
  });

  it("returns 404 for unknown agent", async () => {
    mockGet.mockResolvedValueOnce(null);

    const res = await pingHandler(makeRequest() as never, makeParams("ghost"));
    expect(res.status).toBe(404);
  });
});

describe("POST /api/agent/[id]/restart (Story 38.5)", () => {
  it("kills and restores agent successfully", async () => {
    mockGet.mockResolvedValueOnce({
      status: "blocked",
      issueId: "PROJ-1",
      branch: "feat/story-1",
    });
    mockKill.mockResolvedValueOnce(undefined);
    mockRestore.mockResolvedValueOnce({
      id: "agent-1-v2",
      status: "spawning",
    });

    const res = await restartHandler(makeRequest() as never, makeParams("agent-1"));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.previousStatus).toBe("blocked");
    expect(data.newStatus).toBe("spawning");
    expect(data.agentId).toBe("agent-1-v2");
    expect(mockKill).toHaveBeenCalledWith("agent-1");
    expect(mockRestore).toHaveBeenCalledWith("agent-1");
  });

  it("reports partial failure (207) when restore fails after kill", async () => {
    mockGet.mockResolvedValueOnce({
      status: "blocked",
      issueId: "PROJ-1",
      branch: "feat/story-1",
    });
    mockKill.mockResolvedValueOnce(undefined);
    mockRestore.mockRejectedValueOnce(new Error("Workspace missing"));

    const res = await restartHandler(makeRequest() as never, makeParams("agent-1"));
    const data = await res.json();

    expect(res.status).toBe(207);
    expect(data.success).toBe(false);
    expect(data.partial).toBe(true);
    expect(data.action).toBe("killed");
    expect(data.respawnFailed).toBe(true);
    expect(data.respawnError).toContain("Workspace missing");
  });

  it("returns 500 when kill() fails", async () => {
    mockGet.mockResolvedValueOnce({ status: "blocked" });
    mockKill.mockRejectedValueOnce(new Error("Runtime plugin timeout"));

    const res = await restartHandler(makeRequest() as never, makeParams("agent-1"));
    const data = await res.json();

    expect(res.status).toBe(500);
    expect(data.success).toBe(false);
    expect(data.error).toContain("Failed to terminate agent");
    expect(data.error).toContain("Runtime plugin timeout");
  });

  it("returns 404 for unknown agent", async () => {
    mockGet.mockResolvedValueOnce(null);

    const res = await restartHandler(makeRequest() as never, makeParams("ghost"));
    expect(res.status).toBe(404);
  });
});

describe("POST /api/agent/[id]/reassign", () => {
  it("kills agent and confirms reassignment", async () => {
    mockGet.mockResolvedValueOnce({ status: "stuck" });
    mockKill.mockResolvedValueOnce(undefined);

    const res = await reassignHandler(makeRequest() as never, makeParams("agent-1"));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(mockKill).toHaveBeenCalledWith("agent-1");
  });

  it("returns 404 for unknown agent", async () => {
    mockGet.mockResolvedValueOnce(null);

    const res = await reassignHandler(makeRequest() as never, makeParams("ghost"));
    expect(res.status).toBe(404);
  });
});

describe("POST /api/agent/[id]/resume (Story 38.4)", () => {
  it("resumes a blocked agent successfully", async () => {
    mockGet.mockResolvedValueOnce({ status: "blocked" });
    mockRestore.mockResolvedValueOnce({
      id: "agent-1",
      status: "working",
    });

    const res = await resumeHandler(makeRequest() as never, makeParams("agent-1"));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.previousStatus).toBe("blocked");
    expect(data.newStatus).toBe("working");
  });

  it("sends user message after resume", async () => {
    mockGet.mockResolvedValueOnce({ status: "blocked" });
    mockRestore.mockResolvedValueOnce({ id: "agent-1", status: "working" });
    mockSend.mockResolvedValueOnce(undefined);

    const res = await resumeHandler(
      makeRequest({ message: "Please fix the CI" }) as never,
      makeParams("agent-1"),
    );
    const data = await res.json();

    expect(data.success).toBe(true);
    expect(mockSend).toHaveBeenCalledWith("agent-1", "Please fix the CI");
  });

  it("returns 409 for non-resumable status", async () => {
    mockGet.mockResolvedValueOnce({ status: "working" });

    const res = await resumeHandler(makeRequest() as never, makeParams("agent-1"));
    expect(res.status).toBe(409);

    const data = await res.json();
    expect(data.error).toContain("not resumable");
  });

  it("returns 404 for unknown agent", async () => {
    mockGet.mockResolvedValueOnce(null);

    const res = await resumeHandler(makeRequest() as never, makeParams("ghost"));
    expect(res.status).toBe(404);
  });

  it("resumes ci_failed agent", async () => {
    mockGet.mockResolvedValueOnce({ status: "ci_failed" });
    mockRestore.mockResolvedValueOnce({ id: "agent-1", status: "working" });

    const res = await resumeHandler(makeRequest() as never, makeParams("agent-1"));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
  });

  it("resumes changes_requested agent", async () => {
    mockGet.mockResolvedValueOnce({ status: "changes_requested" });
    mockRestore.mockResolvedValueOnce({ id: "agent-1", status: "working" });

    const res = await resumeHandler(makeRequest() as never, makeParams("agent-1"));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.previousStatus).toBe("changes_requested");
  });

  it("handles restore failure with 409 via error.name", async () => {
    mockGet.mockResolvedValueOnce({ status: "blocked" });
    const err = new Error("Session agent-1 cannot be restored: status is merged");
    err.name = "SessionNotRestorableError";
    mockRestore.mockRejectedValueOnce(err);

    const res = await resumeHandler(makeRequest() as never, makeParams("agent-1"));
    expect(res.status).toBe(409);
  });

  it("handles workspace missing with 422 via error.name", async () => {
    mockGet.mockResolvedValueOnce({ status: "blocked" });
    const err = new Error("Workspace missing at /tmp/worktree");
    err.name = "WorkspaceMissingError";
    mockRestore.mockRejectedValueOnce(err);

    const res = await resumeHandler(makeRequest() as never, makeParams("agent-1"));
    expect(res.status).toBe(422);
  });
});
