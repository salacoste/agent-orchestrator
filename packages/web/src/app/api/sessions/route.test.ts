/**
 * Sessions API Route Tests (Story 10.3)
 *
 * Tests for GET /api/sessions endpoint.
 */

import { describe, expect, it, vi, beforeEach } from "vitest";

// Mock dependencies
const mockList = vi.fn();

vi.mock("@/lib/services", () => ({
  getServices: vi.fn(async () => ({
    config: {
      projects: {
        "test-project": { name: "Test", repo: "test/repo", path: "/tmp/test" },
      },
    },
    registry: {},
    sessionManager: { list: mockList },
  })),
  getSCM: vi.fn(() => null),
}));

vi.mock("@/lib/serialize", () => ({
  sessionToDashboard: vi.fn((s: Record<string, unknown>) => ({
    id: s.id,
    projectId: "test-project",
    status: s.status || "working",
    activity: s.activity || "active",
    branch: null,
    issueId: null,
    issueUrl: null,
    issueLabel: null,
    issueTitle: null,
    summary: null,
    summaryIsFallback: false,
    createdAt: "2026-03-18T10:00:00Z",
    lastActivityAt: "2026-03-18T12:00:00Z",
    pr: null,
    metadata: {},
  })),
  resolveProject: vi.fn(() => "test-project"),
  enrichSessionPR: vi.fn(async (s: unknown) => s),
  enrichSessionsMetadata: vi.fn(async (sessions: unknown[]) => sessions),
  computeStats: vi.fn((sessions: unknown[]) => ({
    totalSessions: (sessions as unknown[]).length,
    workingSessions: (sessions as unknown[]).length,
    openPRs: 0,
    needsReview: 0,
  })),
}));

import { GET } from "./route";

function makeRequest(query = ""): Request {
  return new Request(`http://localhost:5000/api/sessions${query}`);
}

describe("GET /api/sessions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns sessions array with stats", async () => {
    mockList.mockResolvedValue([
      { id: "ao-agent-1", status: "working", activity: "active" },
      { id: "ao-agent-2", status: "working", activity: "idle" },
    ]);

    const response = await GET(makeRequest());
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.sessions).toHaveLength(2);
    expect(data.stats).toBeDefined();
    expect(data.stats.totalSessions).toBe(2);
  });

  it("returns empty array when no sessions", async () => {
    mockList.mockResolvedValue([]);

    const response = await GET(makeRequest());
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.sessions).toHaveLength(0);
    expect(data.stats.totalSessions).toBe(0);
  });

  it("returns orchestratorId when orchestrator session exists", async () => {
    mockList.mockResolvedValue([
      { id: "ao-agent-1", status: "working", activity: "active" },
      { id: "test-orchestrator", status: "working", activity: "active" },
    ]);

    const response = await GET(makeRequest());
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.orchestratorId).toBe("test-orchestrator");
    // Orchestrator session should be filtered out from sessions list
    expect(data.sessions).toHaveLength(1);
    expect(data.sessions[0].id).toBe("ao-agent-1");
  });

  it("returns null orchestratorId when no orchestrator", async () => {
    mockList.mockResolvedValue([{ id: "ao-agent-1", status: "working", activity: "active" }]);

    const response = await GET(makeRequest());
    const data = await response.json();

    expect(data.orchestratorId).toBeNull();
  });

  it("filters exited sessions with ?active=true", async () => {
    mockList.mockResolvedValue([
      { id: "ao-agent-1", status: "working", activity: "active" },
      { id: "ao-agent-2", status: "done", activity: "exited" },
    ]);

    const response = await GET(makeRequest("?active=true"));
    const data = await response.json();

    expect(response.status).toBe(200);
    // Exited session should be filtered out
    expect(data.sessions).toHaveLength(1);
    expect(data.sessions[0].id).toBe("ao-agent-1");
  });
});
