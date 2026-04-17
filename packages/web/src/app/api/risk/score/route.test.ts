import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock dependencies — must come before route import
vi.mock("@/lib/services", () => ({
  getServices: vi.fn(),
}));

vi.mock("@/lib/emerging-risk-detection.js", () => ({
  detectEmergingRisks: vi.fn(() => []),
}));

vi.mock("@composio/ao-plugin-tracker-bmad", () => ({
  computeSprintHealth: vi.fn(() => ({
    overall: "ok",
    indicators: [],
    stuckStories: [],
    wipColumns: [],
  })),
  computeCycleTime: vi.fn(() => ({
    stories: [],
    averageCycleTimeMs: 0,
    medianCycleTimeMs: 0,
    averageColumnDwells: [],
    bottleneckColumn: null,
    throughputPerDay: 0,
    throughputPerWeek: 0,
    completedCount: 0,
  })),
  computeThroughput: vi.fn(() => ({
    dailyThroughput: [],
    weeklyThroughput: [],
    columnTrends: [],
    bottleneckTrend: null,
    leadTimes: [],
    averageLeadTimeMs: 0,
    medianLeadTimeMs: 0,
    averageCycleTimeMs: 0,
    medianCycleTimeMs: 0,
    flowEfficiency: 0,
  })),
  computeTeamWorkload: vi.fn(() => ({
    overloaded: [],
    unassigned: [],
    members: [],
    overloadThreshold: 0,
  })),
  computeStoryAging: vi.fn(() => ({
    columns: {},
    agingStories: [],
    totalActive: 0,
  })),
}));

vi.mock("@composio/ao-core", () => ({
  computeAgentUtilization: vi.fn(() => []),
  getCapacityStatus: vi.fn(() => new Map()),
  runConflictDetection: vi.fn(() => ({
    conflicts: [],
    scanDurationMs: 1,
  })),
}));

import { GET } from "./route.js";
import { getServices } from "@/lib/services";
import { computeSprintHealth } from "@composio/ao-plugin-tracker-bmad";

function makeRequest(url: string) {
  return new Request(new URL(url, "http://localhost:3000"));
}

const mockConfig = {
  projects: {
    "project-a": {
      name: "Project A",
      tracker: { plugin: "bmad" },
    },
    "project-b": {
      name: "Project B",
    },
  },
};

const mockSessionManager = {
  list: vi.fn(() => Promise.resolve([])),
};

const mockRegistry = {};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getServices).mockResolvedValue({
    config: mockConfig,
    registry: mockRegistry,
    sessionManager: mockSessionManager,
  } as never);
});

describe("GET /api/risk/score", () => {
  it("returns 200 with risk score for all projects", async () => {
    const res = await GET(makeRequest("/api/risk/score"));
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data).toHaveProperty("scores");
    expect(data).toHaveProperty("portfolioScore");
    expect(data).toHaveProperty("portfolioSeverityLabel");
    expect(data).toHaveProperty("lastUpdated");
    expect(Array.isArray(data.scores)).toBe(true);
  });

  it("returns 404 for unknown project", async () => {
    const res = await GET(makeRequest("/api/risk/score?project=nonexistent"));
    expect(res.status).toBe(404);

    const data = await res.json();
    expect(data.error).toBe("Project not found");
  });

  it("returns single project score when ?project= provided", async () => {
    const res = await GET(makeRequest("/api/risk/score?project=project-a"));
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data).toHaveProperty("score");
    expect(data).toHaveProperty("severityLabel");
    expect(data).not.toHaveProperty("contributors");
    expect(data).toHaveProperty("factorCount");
    expect(data).toHaveProperty("bottleneckCount");
    expect(data.projectId).toBe("project-a");
  });

  it("includes breakdown when ?breakdown=true", async () => {
    const res = await GET(makeRequest("/api/risk/score?project=project-a&breakdown=true"));
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data).toHaveProperty("contributors");
    expect(Array.isArray(data.contributors)).toBe(true);
  });

  it("skips contributors when breakdown is not requested", async () => {
    const res = await GET(makeRequest("/api/risk/score?project=project-a"));
    expect(res.status).toBe(200);

    const data = await res.json();
    // Without breakdown, contributors should be omitted entirely
    expect(data.contributors).toBeUndefined();
  });

  it("produces non-zero score from sprint health indicators", async () => {
    vi.mocked(computeSprintHealth).mockReturnValue({
      overall: "warning",
      indicators: [
        {
          id: "stuck-stories",
          severity: "critical",
          message: "3 stories stuck",
          details: ["S-1 blocked 96h"],
        },
      ],
      stuckStories: ["S-1", "S-2", "S-3"],
      wipColumns: [],
    });

    const res = await GET(makeRequest("/api/risk/score?project=project-a&breakdown=true"));
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.score).toBeGreaterThan(0);
    expect(data.contributors.length).toBeGreaterThan(0);
  });

  it("returns 0 score for project with no risk data", async () => {
    const res = await GET(makeRequest("/api/risk/score?project=project-b"));
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.score).toBe(0);
    expect(data.factorCount).toBe(0);
  });

  it("returns empty scores when no projects configured", async () => {
    vi.mocked(getServices).mockResolvedValue({
      config: { projects: {} },
      registry: mockRegistry,
      sessionManager: mockSessionManager,
    } as never);

    const res = await GET(makeRequest("/api/risk/score"));
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.scores).toEqual([]);
    expect(data.portfolioScore).toBe(0);
  });

  it("handles service errors gracefully", async () => {
    vi.mocked(getServices).mockRejectedValue(new Error("Config not found"));

    const res = await GET(makeRequest("/api/risk/score"));
    expect(res.status).toBe(500);

    const data = await res.json();
    expect(data.error).toBe("Config not found");
  });

  it("includes empty emergingRisks array in single project response", async () => {
    const res = await GET(makeRequest("/api/risk/score?project=project-a"));
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data).toHaveProperty("emergingRisks");
    expect(Array.isArray(data.emergingRisks)).toBe(true);
  });

  it("includes empty emergingRisks on each score in portfolio response", async () => {
    const res = await GET(makeRequest("/api/risk/score"));
    expect(res.status).toBe(200);

    const data = await res.json();
    for (const score of data.scores) {
      expect(score).toHaveProperty("emergingRisks");
      expect(Array.isArray(score.emergingRisks)).toBe(true);
    }
  });
});
