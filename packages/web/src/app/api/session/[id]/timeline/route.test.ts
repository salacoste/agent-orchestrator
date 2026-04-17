import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// Mock getServices and readTimeline before importing the route
const { mockSessionManager, mockReadTimeline } = vi.hoisted(() => ({
  mockSessionManager: { get: vi.fn() },
  mockReadTimeline: vi.fn(),
}));

vi.mock("@/lib/services", () => ({
  getServices: vi.fn(() => Promise.resolve({ sessionManager: mockSessionManager })),
}));

vi.mock("@composio/ao-core", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...(actual as Record<string, unknown>),
    readTimeline: mockReadTimeline,
  };
});

// Import after mocks
const { GET } = await import("./route.js");

function makeRequest(id: string, search = "") {
  const url = `http://localhost/api/session/${id}/timeline${search}`;
  return new NextRequest(url);
}

const SAMPLE_ENTRIES = [
  {
    agent: "planner",
    agentType: "planner",
    action: "Agent planner started",
    event: "agent_start",
    timestamp: 1.0,
    model: "claude-sonnet-4-6",
  },
  {
    agent: "planner",
    agentType: "planner",
    action: "Called Read",
    event: "tool_start",
    timestamp: 5.0,
    tool: "Read",
  },
  {
    agent: "executor",
    agentType: "executor",
    action: "Modified src/main.ts",
    event: "file_touch",
    timestamp: 20.0,
    file: "src/main.ts",
  },
];

describe("GET /api/session/[id]/timeline", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Returns timeline for valid session with data
  it("returns timeline for valid session with data", async () => {
    mockSessionManager.get.mockResolvedValue({
      id: "session-1",
      workspacePath: "/path/to/worktree",
    });
    mockReadTimeline.mockResolvedValue(SAMPLE_ENTRIES);

    const response = await GET(makeRequest("session-1"), {
      params: Promise.resolve({ id: "session-1" }),
    });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.sessionId).toBe("session-1");
    expect(data.timeline).toHaveLength(3);
    expect(data.totalEntries).toBe(3);
    expect(mockReadTimeline).toHaveBeenCalledWith("/path/to/worktree", "session-1");
  });

  // Returns empty timeline for session without data
  it("returns empty timeline for session without data", async () => {
    mockSessionManager.get.mockResolvedValue({
      id: "session-2",
      workspacePath: "/path/to/worktree",
    });
    mockReadTimeline.mockResolvedValue([]);

    const response = await GET(makeRequest("session-2"), {
      params: Promise.resolve({ id: "session-2" }),
    });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.timeline).toEqual([]);
    expect(data.totalEntries).toBe(0);
  });

  // Returns 404 for non-existent session
  it("returns 404 for non-existent session", async () => {
    mockSessionManager.get.mockResolvedValue(null);

    const response = await GET(makeRequest("missing"), {
      params: Promise.resolve({ id: "missing" }),
    });
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toBe("Session not found");
  });

  // Returns empty for session without workspacePath
  it("returns empty for session without workspacePath", async () => {
    mockSessionManager.get.mockResolvedValue({ id: "no-ws" });

    const response = await GET(makeRequest("no-ws"), {
      params: Promise.resolve({ id: "no-ws" }),
    });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.timeline).toEqual([]);
    expect(data.totalEntries).toBe(0);
    expect(mockReadTimeline).not.toHaveBeenCalled();
  });

  // Filters by ?agent= query param
  it("filters by agent query param", async () => {
    mockSessionManager.get.mockResolvedValue({
      id: "session-1",
      workspacePath: "/path",
    });
    mockReadTimeline.mockResolvedValue(SAMPLE_ENTRIES);

    const response = await GET(makeRequest("session-1", "?agent=planner"), {
      params: Promise.resolve({ id: "session-1" }),
    });
    const data = await response.json();

    expect(data.timeline).toHaveLength(2);
    expect(data.totalEntries).toBe(2);
    expect(data.timeline.every((e: { agent: string }) => e.agent === "planner")).toBe(true);
  });

  // Filters by ?agent= case-insensitive
  it("filters by agent case-insensitively", async () => {
    mockSessionManager.get.mockResolvedValue({
      id: "session-1",
      workspacePath: "/path",
    });
    mockReadTimeline.mockResolvedValue(SAMPLE_ENTRIES);

    const response = await GET(makeRequest("session-1", "?agent=EXECUTOR"), {
      params: Promise.resolve({ id: "session-1" }),
    });
    const data = await response.json();

    expect(data.timeline).toHaveLength(1);
    expect(data.totalEntries).toBe(1);
    expect(data.timeline[0].agent).toBe("executor");
  });

  // Filters by ?tool= query param
  it("filters by tool query param", async () => {
    mockSessionManager.get.mockResolvedValue({
      id: "session-1",
      workspacePath: "/path",
    });
    mockReadTimeline.mockResolvedValue(SAMPLE_ENTRIES);

    const response = await GET(makeRequest("session-1", "?tool=read"), {
      params: Promise.resolve({ id: "session-1" }),
    });
    const data = await response.json();

    expect(data.timeline).toHaveLength(1);
    expect(data.totalEntries).toBe(1);
    expect(data.timeline[0].tool).toBe("Read");
  });

  // Filters by ?from= time range
  it("filters by from time range", async () => {
    mockSessionManager.get.mockResolvedValue({
      id: "session-1",
      workspacePath: "/path",
    });
    mockReadTimeline.mockResolvedValue(SAMPLE_ENTRIES);

    const response = await GET(makeRequest("session-1", "?from=10"), {
      params: Promise.resolve({ id: "session-1" }),
    });
    const data = await response.json();

    expect(data.timeline).toHaveLength(1);
    expect(data.timeline[0].timestamp).toBe(20.0);
  });

  // Filters by ?to= time range
  it("filters by to time range", async () => {
    mockSessionManager.get.mockResolvedValue({
      id: "session-1",
      workspacePath: "/path",
    });
    mockReadTimeline.mockResolvedValue(SAMPLE_ENTRIES);

    const response = await GET(makeRequest("session-1", "?to=6"), {
      params: Promise.resolve({ id: "session-1" }),
    });
    const data = await response.json();

    expect(data.timeline).toHaveLength(2);
  });

  // Combines multiple filters (AND)
  it("combines multiple filters", async () => {
    mockSessionManager.get.mockResolvedValue({
      id: "session-1",
      workspacePath: "/path",
    });
    mockReadTimeline.mockResolvedValue(SAMPLE_ENTRIES);

    const response = await GET(makeRequest("session-1", "?agent=planner&from=3&to=10"), {
      params: Promise.resolve({ id: "session-1" }),
    });
    const data = await response.json();

    expect(data.timeline).toHaveLength(1);
    expect(data.timeline[0].timestamp).toBe(5.0);
    expect(data.timeline[0].agent).toBe("planner");
  });

  // Handles read failure gracefully
  it("handles read failure gracefully", async () => {
    mockSessionManager.get.mockResolvedValue({
      id: "session-1",
      workspacePath: "/path",
    });
    mockReadTimeline.mockRejectedValue(new Error("Permission denied"));

    const response = await GET(makeRequest("session-1"), {
      params: Promise.resolve({ id: "session-1" }),
    });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.timeline).toEqual([]);
    expect(data.totalEntries).toBe(0);
  });

  // Returns 500 for service init failure
  it("returns 500 for service init failure", async () => {
    const { getServices } = await import("@/lib/services");
    (getServices as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error("Config not found"));

    const response = await GET(makeRequest("session-1"), {
      params: Promise.resolve({ id: "session-1" }),
    });
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe("Internal server error");
  });

  // No matching entries after filter returns empty
  it("returns empty when no entries match filter", async () => {
    mockSessionManager.get.mockResolvedValue({
      id: "session-1",
      workspacePath: "/path",
    });
    mockReadTimeline.mockResolvedValue(SAMPLE_ENTRIES);

    const response = await GET(makeRequest("session-1", "?agent=nonexistent"), {
      params: Promise.resolve({ id: "session-1" }),
    });
    const data = await response.json();

    expect(data.timeline).toEqual([]);
    expect(data.totalEntries).toBe(0);
  });
});
