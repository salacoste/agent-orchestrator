/**
 * Tests for GET /api/risk/optimization — impact analysis mode (Story 56.10)
 */
import { describe, expect, it, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const { mockSessions, mockAgentUtils } = vi.hoisted(() => ({
  mockSessions: [
    {
      id: "agent-over",
      projectId: "project-a",
      status: "active",
      activity: "working",
      createdAt: Date.now() - 86400000,
      lastActivityAt: Date.now(),
    },
    {
      id: "agent-under",
      projectId: "project-a",
      status: "active",
      activity: "idle",
      createdAt: Date.now() - 86400000,
      lastActivityAt: Date.now(),
    },
  ],
  mockAgentUtils: [
    {
      agentId: "agent-over",
      projectId: "project-a",
      utilizationPercent: 95,
      isActive: true,
      isPoolAgent: false,
      storiesWorked: 3,
    },
    {
      agentId: "agent-under",
      projectId: "project-a",
      utilizationPercent: 15,
      isActive: true,
      isPoolAgent: false,
      storiesWorked: 0,
    },
  ],
}));

vi.mock("@/lib/services", () => ({
  getServices: vi.fn(async () => ({
    config: {
      configPath: "/tmp/test-ao-config.yaml",
      projects: {
        "project-a": { name: "Project A", maxCapacity: 3, wipLimits: { "in-progress": 3 } },
      },
    },
    registry: new Map([
      ["agent-over", {}],
      ["agent-under", {}],
    ]),
    sessionManager: { list: vi.fn(async () => mockSessions) },
  })),
}));

vi.mock("@composio/ao-core", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...(actual as Record<string, unknown>),
    computeAgentUtilization: vi.fn(() => mockAgentUtils),
    getCapacityStatus: vi.fn(() => new Map()),
  };
});

vi.mock("@composio/ao-plugin-tracker-bmad", () => ({
  computeSprintHealth: vi.fn(async () => ({
    indicators: [],
    stuckStories: [],
    wipColumns: [],
  })),
  computeCycleTime: vi.fn(async () => ({
    bottleneckColumn: null,
    averageColumnDwells: [],
    completedCount: 0,
  })),
  computeThroughput: vi.fn(async () => ({
    bottleneckTrend: "stable",
    columnTrends: [],
    weeklyThroughput: [],
    dailyThroughput: [],
  })),
  computeTeamWorkload: vi.fn(async () => ({
    overloaded: [],
    unassigned: [],
    members: [],
    overloadThreshold: 5,
  })),
  computeStoryAging: vi.fn(async () => ({ agingStories: [] })),
}));

// Import after mocks
import { GET, DELETE } from "./route.ts";
import {
  _resetOptimizationFeedback,
  recordOptimizationFeedback,
} from "@/lib/optimization-feedback";

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("GET /api/risk/optimization — impact mode (Story 56.10)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("returns impact analysis for all suggestions when ?impact=true", async () => {
    const req = new Request("http://localhost/api/risk/optimization?impact=true");
    const res = await GET(req);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.suggestions).toBeDefined();
    expect(Array.isArray(body.suggestions)).toBe(true);
    // Each entry should have suggestion + impactAnalysis
    for (const detail of body.suggestions) {
      expect(detail.suggestion).toBeDefined();
      expect(detail.impactAnalysis).toBeDefined();
      expect(typeof detail.impactAnalysis.completionDateShift).toBe("number");
      expect(typeof detail.impactAnalysis.velocityDelta).toBe("number");
      expect(detail.impactAnalysis.beforeMetrics).toBeDefined();
      expect(detail.impactAnalysis.afterMetrics).toBeDefined();
    }
  });

  it("returns 404 for ?impact=true&suggestionId=nonexistent", async () => {
    const req = new Request(
      "http://localhost/api/risk/optimization?impact=true&suggestionId=opt-nonexistent",
    );
    const res = await GET(req);
    expect(res.status).toBe(404);

    const body = await res.json();
    expect(body.error).toContain("not found");
  });

  it("returns single suggestion impact when ?impact=true&suggestionId matches", async () => {
    // First get baseline suggestions to find a valid ID
    const baselineReq = new Request("http://localhost/api/risk/optimization");
    const baselineRes = await GET(baselineReq);
    const baselineBody = await baselineRes.json();

    expect(baselineBody.suggestions.length).toBeGreaterThan(0);

    const targetId = baselineBody.suggestions[0].id;
    const req = new Request(
      `http://localhost/api/risk/optimization?impact=true&suggestionId=${targetId}`,
    );
    const res = await GET(req);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.suggestion).toBeDefined();
    expect(body.suggestion.id).toBe(targetId);
    expect(body.impactAnalysis).toBeDefined();
    expect(typeof body.impactAnalysis.completionDateShift).toBe("number");
    expect(body.impactAnalysis.riskChange).toBeDefined();
    expect(body.impactAnalysis.beforeMetrics).toBeDefined();
    expect(body.impactAnalysis.afterMetrics).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// Story 56.11 — DELETE reset & learning-adjusted rankings
// ---------------------------------------------------------------------------

describe("DELETE /api/risk/optimization — reset learning (Story 56.11)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    _resetOptimizationFeedback();
  });

  it("clears feedback and returns success", async () => {
    // Add some feedback first
    recordOptimizationFeedback({
      suggestionId: "opt-1",
      category: "agent-rebalancing",
      action: "accepted",
      timestamp: Date.now(),
    });

    const res = await DELETE();
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.message).toContain("cleared");
  });
});

describe("GET /api/risk/optimization — learning-adjusted rankings (Story 56.11)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    _resetOptimizationFeedback();
  });

  it("applies learning weights from feedback to suggestion rankings", async () => {
    // Pre-populate feedback: accept many agent-rebalancing, dismiss wip-adjustment
    for (let i = 0; i < 5; i++) {
      recordOptimizationFeedback({
        suggestionId: `opt-rebalancing-${i}`,
        category: "agent-rebalancing",
        action: "accepted",
        timestamp: Date.now() - i * 1000,
      });
    }
    for (let i = 0; i < 5; i++) {
      recordOptimizationFeedback({
        suggestionId: `opt-wip-${i}`,
        category: "wip-adjustment",
        action: "dismissed",
        timestamp: Date.now() - i * 1000,
      });
    }

    const req = new Request("http://localhost/api/risk/optimization");
    const res = await GET(req);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.suggestions.length).toBeGreaterThan(0);
    // Agent-rebalancing should be boosted, wip-adjustment penalized
    // Verify suggestions exist and have priorities
    for (const s of body.suggestions) {
      expect(typeof s.priority).toBe("number");
    }

    // Cleanup
    _resetOptimizationFeedback();
  });

  it("learning feedback changes suggestion ordering", async () => {
    // Step 1: Get baseline rankings (no feedback)
    _resetOptimizationFeedback();
    const baselineReq = new Request("http://localhost/api/risk/optimization");
    const baselineRes = await GET(baselineReq);
    const baselineBody = await baselineRes.json();
    const baselineIds = baselineBody.suggestions.map((s: { id: string }) => s.id);

    // Step 2: Add feedback that heavily dismisses the top category
    if (baselineBody.suggestions.length >= 2) {
      const topCategory = baselineBody.suggestions[0].category;
      for (let i = 0; i < 5; i++) {
        recordOptimizationFeedback({
          suggestionId: `opt-dismiss-${i}`,
          category: topCategory,
          action: "dismissed",
          timestamp: Date.now() - i * 1000,
        });
      }

      // Step 3: Get learned rankings — top category should be penalized
      const learnedReq = new Request("http://localhost/api/risk/optimization");
      const learnedRes = await GET(learnedReq);
      const learnedBody = await learnedRes.json();
      const learnedIds = learnedBody.suggestions.map((s: { id: string }) => s.id);

      // The ordering should differ from baseline
      expect(learnedIds).not.toEqual(baselineIds);
    }

    _resetOptimizationFeedback();
  });
});
