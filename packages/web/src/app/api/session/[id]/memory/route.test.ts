/**
 * GET+PUT /api/session/[id]/memory — Route Tests
 *
 * Story 60-9, AC #11.
 */

import { describe, expect, it, vi, beforeEach } from "vitest";

// ── Mocks (must be before route imports) ──────────────────────────────────────

const { mockSessionManager, mockReadProjectMemory, mockWriteProjectMemory } = vi.hoisted(() => ({
  mockSessionManager: { get: vi.fn() },
  mockReadProjectMemory: vi.fn(),
  mockWriteProjectMemory: vi.fn(),
}));

vi.mock("@/lib/services", () => ({
  getServices: vi.fn(async () => ({
    sessionManager: mockSessionManager,
  })),
}));

vi.mock("@composio/ao-core/project-memory", () => ({
  readProjectMemory: mockReadProjectMemory,
  writeProjectMemory: mockWriteProjectMemory,
  emptyProjectMemory: () => Object.freeze({ entries: [] }),
}));

// Import after mocks
import { GET, PUT } from "./route";

function makeRequest(sessionId: string) {
  return new Request(`http://localhost/api/session/${sessionId}/memory`) as never;
}

function makePutRequest(sessionId: string, body: unknown) {
  return new Request(`http://localhost/api/session/${sessionId}/memory`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }) as never;
}

const SAMPLE_MEMORY = {
  entries: [
    {
      id: "e1",
      type: "convention",
      content: "Use kebab-case",
      source: "session-1",
      timestamp: "2026-04-17T00:00:00Z",
    },
  ],
};

describe("GET /api/session/[id]/memory", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 404 for unknown session", async () => {
    mockSessionManager.get.mockResolvedValue(null);

    const response = await GET(makeRequest("unknown"), {
      params: Promise.resolve({ id: "unknown" }),
    });
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toBe("Session not found");
  });

  it("returns empty memory with exists: false for session without workspace", async () => {
    mockSessionManager.get.mockResolvedValue({
      id: "session-1",
      workspacePath: null,
    });

    const response = await GET(makeRequest("session-1"), {
      params: Promise.resolve({ id: "session-1" }),
    });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.sessionId).toBe("session-1");
    expect(data.exists).toBe(false);
    expect(data.memory.entries).toEqual([]);
    expect(mockReadProjectMemory).not.toHaveBeenCalled();
  });

  it("returns memory for session with workspace", async () => {
    mockSessionManager.get.mockResolvedValue({
      id: "session-2",
      workspacePath: "/tmp/worktree-2",
    });
    mockReadProjectMemory.mockResolvedValue(SAMPLE_MEMORY);

    const response = await GET(makeRequest("session-2"), {
      params: Promise.resolve({ id: "session-2" }),
    });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.sessionId).toBe("session-2");
    expect(data.exists).toBe(true);
    expect(data.memory.entries).toHaveLength(1);
    expect(data.memory.entries[0].type).toBe("convention");
    expect(mockReadProjectMemory).toHaveBeenCalledWith("/tmp/worktree-2");
  });

  it("handles read error gracefully", async () => {
    mockSessionManager.get.mockResolvedValue({
      id: "session-3",
      workspacePath: "/tmp/worktree-3",
    });
    mockReadProjectMemory.mockRejectedValue(new Error("ENOENT"));

    const response = await GET(makeRequest("session-3"), {
      params: Promise.resolve({ id: "session-3" }),
    });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.sessionId).toBe("session-3");
    expect(data.exists).toBe(false);
    expect(data.readError).toBe(true);
  });

  it("includes no-cache headers", async () => {
    mockSessionManager.get.mockResolvedValue({
      id: "session-4",
      workspacePath: "/tmp/worktree-4",
    });
    mockReadProjectMemory.mockResolvedValue(SAMPLE_MEMORY);

    const response = await GET(makeRequest("session-4"), {
      params: Promise.resolve({ id: "session-4" }),
    });

    expect(response.headers.get("Cache-Control")).toBe("no-cache, no-store, must-revalidate");
  });

  it("returns 500 when getServices throws", async () => {
    const { getServices } = await import("@/lib/services");
    vi.mocked(getServices).mockRejectedValueOnce(new Error("Service unavailable"));

    const response = await GET(makeRequest("session-5"), {
      params: Promise.resolve({ id: "session-5" }),
    });
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe("Internal server error");
  });
});

describe("PUT /api/session/[id]/memory", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("persists valid entries and returns updated memory", async () => {
    mockSessionManager.get.mockResolvedValue({
      id: "session-1",
      workspacePath: "/tmp/worktree-1",
    });
    mockWriteProjectMemory.mockResolvedValue(undefined);
    mockReadProjectMemory.mockResolvedValue(SAMPLE_MEMORY);

    const response = await PUT(
      makePutRequest("session-1", {
        entries: [{ id: "e1", type: "convention", content: "Use kebab-case" }],
      }),
      { params: Promise.resolve({ id: "session-1" }) },
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.sessionId).toBe("session-1");
    expect(data.exists).toBe(true);
    expect(data.memory.entries).toHaveLength(1);
    expect(mockWriteProjectMemory).toHaveBeenCalledWith(
      "/tmp/worktree-1",
      expect.objectContaining({
        entries: expect.arrayContaining([expect.objectContaining({ type: "convention" })]),
      }),
    );
  });

  it("returns 400 for missing entries array", async () => {
    const response = await PUT(makePutRequest("session-1", { notEntries: [] }), {
      params: Promise.resolve({ id: "session-1" }),
    });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain("entries array required");
  });

  it("returns 400 for entry missing type", async () => {
    const response = await PUT(
      makePutRequest("session-1", {
        entries: [{ id: "e1", content: "some content" }],
      }),
      { params: Promise.resolve({ id: "session-1" }) },
    );
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain("type and content");
  });

  it("returns 400 for entry missing content", async () => {
    const response = await PUT(
      makePutRequest("session-1", {
        entries: [{ id: "e1", type: "convention" }],
      }),
      { params: Promise.resolve({ id: "session-1" }) },
    );
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain("type and content");
  });

  it("returns 404 for session without workspace", async () => {
    mockSessionManager.get.mockResolvedValue({
      id: "session-2",
      workspacePath: null,
    });

    const response = await PUT(
      makePutRequest("session-2", {
        entries: [{ id: "e1", type: "convention", content: "test" }],
      }),
      { params: Promise.resolve({ id: "session-2" }) },
    );
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toContain("not found");
  });

  it("returns 400 for invalid JSON body", async () => {
    const response = await PUT(
      new Request(`http://localhost/api/session/s1/memory`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: "not json{{{",
      }) as never,
      { params: Promise.resolve({ id: "s1" }) },
    );
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain("Invalid JSON");
  });

  it("returns 500 when getServices throws on PUT", async () => {
    const { getServices } = await import("@/lib/services");
    vi.mocked(getServices).mockRejectedValueOnce(new Error("Service unavailable"));

    const response = await PUT(
      makePutRequest("session-1", {
        entries: [{ id: "e1", type: "convention", content: "test" }],
      }),
      { params: Promise.resolve({ id: "session-1" }) },
    );
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe("Internal server error");
  });
});
