/**
 * GET /api/session/[id]/notepad — Route Tests
 *
 * Epic 60, Story 60-1 (AC8).
 */

import { describe, expect, it, vi, beforeEach } from "vitest";

// ── Mocks (must be before route imports) ──────────────────────────────────────
// Use vi.hoisted() so mock references are available in hoisted vi.mock factories.

const { mockSessionManager, mockReadNotepad } = vi.hoisted(() => ({
  mockSessionManager: { get: vi.fn() },
  mockReadNotepad: vi.fn(),
}));

vi.mock("@/lib/services", () => ({
  getServices: vi.fn(async () => ({
    sessionManager: mockSessionManager,
  })),
}));

vi.mock("@composio/ao-core", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...(actual as Record<string, unknown>),
    readNotepad: mockReadNotepad,
  };
});

// Import after mocks
import { GET } from "./route";

function makeRequest(sessionId: string) {
  return new Request(`http://localhost/api/session/${sessionId}/notepad`) as never;
}

describe("GET /api/session/[id]/notepad", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns notepad content for valid session with existing notepad", async () => {
    mockSessionManager.get.mockResolvedValue({
      id: "session-1",
      workspacePath: "/tmp/worktree-1",
    });
    mockReadNotepad.mockResolvedValue({
      priority: "Story: 60-1",
      working: "Sprint: cycle-11",
      manual: "Some notes",
    });

    const response = await GET(makeRequest("session-1"), {
      params: Promise.resolve({ id: "session-1" }),
    });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.sessionId).toBe("session-1");
    expect(data.exists).toBe(true);
    expect(data.notepad.priority).toBe("Story: 60-1");
    expect(data.notepad.working).toBe("Sprint: cycle-11");
    expect(data.notepad.manual).toBe("Some notes");
    expect(mockReadNotepad).toHaveBeenCalledWith("/tmp/worktree-1");
  });

  it("returns exists: false for valid session without notepad", async () => {
    mockSessionManager.get.mockResolvedValue({
      id: "session-2",
      workspacePath: "/tmp/worktree-2",
    });
    mockReadNotepad.mockResolvedValue({
      priority: "",
      working: "",
      manual: "",
    });

    const response = await GET(makeRequest("session-2"), {
      params: Promise.resolve({ id: "session-2" }),
    });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.sessionId).toBe("session-2");
    expect(data.exists).toBe(false);
    expect(data.notepad.priority).toBe("");
    expect(data.notepad.working).toBe("");
    expect(data.notepad.manual).toBe("");
  });

  it("returns 404 for non-existent session", async () => {
    mockSessionManager.get.mockResolvedValue(null);

    const response = await GET(makeRequest("nonexistent"), {
      params: Promise.resolve({ id: "nonexistent" }),
    });
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toBe("Session not found");
  });

  it("returns exists: false for session without workspace path", async () => {
    mockSessionManager.get.mockResolvedValue({
      id: "session-3",
      workspacePath: null,
    });

    const response = await GET(makeRequest("session-3"), {
      params: Promise.resolve({ id: "session-3" }),
    });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.sessionId).toBe("session-3");
    expect(data.exists).toBe(false);
    expect(data.notepad.priority).toBe("");
    expect(mockReadNotepad).not.toHaveBeenCalled();
  });

  it("handles notepad read failure gracefully", async () => {
    mockSessionManager.get.mockResolvedValue({
      id: "session-4",
      workspacePath: "/tmp/worktree-4",
    });
    mockReadNotepad.mockRejectedValue(new Error("Permission denied"));

    const response = await GET(makeRequest("session-4"), {
      params: Promise.resolve({ id: "session-4" }),
    });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.sessionId).toBe("session-4");
    expect(data.exists).toBe(false);
    expect(data.notepad.priority).toBe("");
  });

  it("returns exists: true when only one section has content", async () => {
    mockSessionManager.get.mockResolvedValue({
      id: "session-5",
      workspacePath: "/tmp/worktree-5",
    });
    mockReadNotepad.mockResolvedValue({
      priority: "",
      working: "Some working notes",
      manual: "",
    });

    const response = await GET(makeRequest("session-5"), {
      params: Promise.resolve({ id: "session-5" }),
    });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.exists).toBe(true);
    expect(data.notepad.working).toBe("Some working notes");
  });

  it("returns 500 when getServices throws", async () => {
    const { getServices } = await import("@/lib/services");
    (getServices as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error("Config missing"));

    const response = await GET(makeRequest("session-6"), {
      params: Promise.resolve({ id: "session-6" }),
    });
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe("Internal server error");
  });
});
