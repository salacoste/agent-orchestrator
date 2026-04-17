/**
 * GET /api/session/[id]/state — Route Tests
 *
 * Epic 60, Story 60-7 (AC8).
 */

import { describe, expect, it, vi, beforeEach } from "vitest";

// ── Mocks (must be before route imports) ──────────────────────────────────────

const { mockSessionManager, mockReadSessionState } = vi.hoisted(() => ({
  mockSessionManager: { get: vi.fn() },
  mockReadSessionState: vi.fn(),
}));

vi.mock("@/lib/services", () => ({
  getServices: vi.fn(async () => ({
    sessionManager: mockSessionManager,
  })),
}));

vi.mock("@composio/ao-core/session-state", () => ({
  readSessionState: mockReadSessionState,
  emptySessionState: () =>
    Object.freeze({
      executionMode: null,
      activeAgents: [],
      configured: false,
      activeModes: [],
      health: null,
    }),
}));

// Import after mocks
import { GET } from "./route";

function makeRequest(sessionId: string) {
  return new Request(`http://localhost/api/session/${sessionId}/state`) as never;
}

const MOCK_STATE = {
  executionMode: "standard",
  activeAgents: ["omc", "explore"],
  configured: true,
  activeModes: [{ mode: "ralph", active: true, iteration: 3, maxIterations: 10 }],
  health: null,
};

describe("GET /api/session/[id]/state", () => {
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

  it("returns empty state with exists: false for session without workspace", async () => {
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
    expect(data.state.executionMode).toBeNull();
    expect(data.state.activeAgents).toEqual([]);
    expect(data.state.configured).toBe(false);
    expect(data.state.activeModes).toEqual([]);
    expect(data.state.health).toBeNull();
    expect(mockReadSessionState).not.toHaveBeenCalled();
  });

  it("returns full state for session with workspace and state files", async () => {
    mockSessionManager.get.mockResolvedValue({
      id: "session-2",
      workspacePath: "/tmp/worktree-2",
      metadata: {
        "omc:executionMode": "standard",
        "omc:agents": '["omc","explore"]',
        "omc:configured": "true",
      },
    });
    mockReadSessionState.mockResolvedValue(MOCK_STATE);

    const response = await GET(makeRequest("session-2"), {
      params: Promise.resolve({ id: "session-2" }),
    });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.sessionId).toBe("session-2");
    expect(data.exists).toBe(true);
    expect(data.state.executionMode).toBe("standard");
    expect(data.state.activeAgents).toEqual(["omc", "explore"]);
    expect(data.state.configured).toBe(true);
    expect(data.state.activeModes).toHaveLength(1);
    expect(data.state.activeModes[0].mode).toBe("ralph");
    expect(mockReadSessionState).toHaveBeenCalledWith("/tmp/worktree-2", {
      "omc:executionMode": "standard",
      "omc:agents": '["omc","explore"]',
      "omc:configured": "true",
    });
  });

  it("handles missing state files gracefully", async () => {
    mockSessionManager.get.mockResolvedValue({
      id: "session-3",
      workspacePath: "/tmp/worktree-3",
      metadata: {},
    });
    mockReadSessionState.mockRejectedValue(new Error("ENOENT"));

    const response = await GET(makeRequest("session-3"), {
      params: Promise.resolve({ id: "session-3" }),
    });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.sessionId).toBe("session-3");
    expect(data.exists).toBe(false);
    expect(data.readError).toBe(true);
    expect(data.state.activeModes).toEqual([]);
  });

  it("verifies response headers (Cache-Control, Content-Type)", async () => {
    mockSessionManager.get.mockResolvedValue({
      id: "session-4",
      workspacePath: "/tmp/worktree-4",
      metadata: {},
    });
    mockReadSessionState.mockResolvedValue(MOCK_STATE);

    const response = await GET(makeRequest("session-4"), {
      params: Promise.resolve({ id: "session-4" }),
    });

    expect(response.headers.get("Cache-Control")).toBe("no-cache, no-store, must-revalidate");
    expect(response.headers.get("Content-Type")).toBe("application/json");
  });

  it("returns 500 when getServices throws", async () => {
    const { getServices } = await import("@/lib/services");
    (getServices as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error("Config missing"));

    const response = await GET(makeRequest("session-5"), {
      params: Promise.resolve({ id: "session-5" }),
    });
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe("Internal server error");
  });
});
