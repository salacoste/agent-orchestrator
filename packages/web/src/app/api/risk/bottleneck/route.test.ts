import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock dependencies — must come before route import
vi.mock("@/lib/services", () => ({
  getServices: vi.fn(),
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
    leadTimes: [],
    averageLeadTimeMs: 0,
    medianLeadTimeMs: 0,
    averageCycleTimeMs: 0,
    medianCycleTimeMs: 0,
    flowEfficiency: 0,
    columnTrends: [],
    bottleneckTrend: null,
  })),
  computeTeamWorkload: vi.fn(() => ({
    members: [],
    overloaded: [],
    unassigned: [],
    overloadThreshold: 0,
  })),
  computeStoryAging: vi.fn(() => ({
    columns: {},
    agingStories: [],
    totalActive: 0,
  })),
}));

vi.mock("@composio/ao-core", () => ({
  getCapacityStatus: vi.fn(() => new Map()),
  runConflictDetection: vi.fn(() => ({
    conflicts: [],
    scanDurationMs: 1,
  })),
}));

import { GET } from "./route.js";
import { getServices } from "@/lib/services";
import {
  computeSprintHealth,
  computeCycleTime,
  computeThroughput,
  computeTeamWorkload,
  computeStoryAging,
} from "@composio/ao-plugin-tracker-bmad";

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

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getServices).mockResolvedValue({
    config: mockConfig,
    sessionManager: mockSessionManager,
  } as never);
});

describe("GET /api/risk/bottleneck", () => {
  it("returns 200 with bottlenecks and summary for all projects", async () => {
    const res = await GET(makeRequest("/api/risk/bottleneck"));
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data).toHaveProperty("bottlenecks");
    expect(data).toHaveProperty("summary");
    expect(data).toHaveProperty("lastUpdated");
    expect(data.summary).toHaveProperty("totalBottlenecks");
    expect(data.summary).toHaveProperty("stuckStories");
    expect(data.summary).toHaveProperty("wipViolations");
    expect(data.summary).toHaveProperty("agingStories");
    expect(data.summary).toHaveProperty("overloadedAgents");
    expect(data.summary).toHaveProperty("resourceConflicts");
  });

  it("returns 404 for unknown project", async () => {
    const res = await GET(makeRequest("/api/risk/bottleneck?project=nonexistent"));
    expect(res.status).toBe(404);

    const data = await res.json();
    expect(data.error).toBe("Project not found");
  });

  it("calls tracker functions only for bmad projects", async () => {
    await GET(makeRequest("/api/risk/bottleneck"));
    // project-a has tracker.plugin=bmad, project-b doesn't
    expect(computeSprintHealth).toHaveBeenCalledTimes(1);
    expect(computeCycleTime).toHaveBeenCalledTimes(1);
    expect(computeThroughput).toHaveBeenCalledTimes(1);
    expect(computeTeamWorkload).toHaveBeenCalledTimes(1);
    expect(computeStoryAging).toHaveBeenCalledTimes(1);
  });

  it("filters to single project when ?project= is provided", async () => {
    const res = await GET(makeRequest("/api/risk/bottleneck?project=project-a"));
    expect(res.status).toBe(200);

    // Only project-a should be processed
    expect(computeSprintHealth).toHaveBeenCalledTimes(1);
    expect(computeCycleTime).toHaveBeenCalledTimes(1);
  });

  it("skips tracker functions for non-bmad project filter", async () => {
    const res = await GET(makeRequest("/api/risk/bottleneck?project=project-b"));
    expect(res.status).toBe(200);

    // project-b has no tracker.plugin=bmad
    expect(computeSprintHealth).not.toHaveBeenCalled();
    expect(computeCycleTime).not.toHaveBeenCalled();

    const data = await res.json();
    expect(data.bottlenecks).toEqual([]);
    expect(data.summary.totalBottlenecks).toBe(0);
  });

  it("returns empty response when no projects configured", async () => {
    vi.mocked(getServices).mockResolvedValue({
      config: { projects: {} },
      sessionManager: mockSessionManager,
    } as never);

    const res = await GET(makeRequest("/api/risk/bottleneck"));
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.bottlenecks).toEqual([]);
    expect(data.summary.totalBottlenecks).toBe(0);
  });

  it("produces bottlenecks from sprint health indicators", async () => {
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

    const res = await GET(makeRequest("/api/risk/bottleneck?project=project-a"));
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.bottlenecks.length).toBeGreaterThan(0);
    const stuckBn = data.bottlenecks.find((b: { type: string }) => b.type === "stuck-stories");
    expect(stuckBn).toBeDefined();
  });

  it("produces column bottleneck from cycle time data", async () => {
    const MS_PER_DAY = 24 * 60 * 60 * 1000;
    vi.mocked(computeCycleTime).mockReturnValue({
      stories: [],
      averageCycleTimeMs: 0,
      medianCycleTimeMs: 0,
      averageColumnDwells: [
        { column: "review", dwellMs: 5 * MS_PER_DAY },
        { column: "in-progress", dwellMs: 1 * MS_PER_DAY },
      ],
      bottleneckColumn: "review",
      throughputPerDay: 0,
      throughputPerWeek: 0,
      completedCount: 10,
    });

    const res = await GET(makeRequest("/api/risk/bottleneck?project=project-a"));
    expect(res.status).toBe(200);

    const data = await res.json();
    const colBn = data.bottlenecks.find((b: { type: string }) => b.type === "column-bottleneck");
    expect(colBn).toBeDefined();
    expect(colBn.title).toContain("review");
  });

  it("handles service errors gracefully", async () => {
    vi.mocked(getServices).mockRejectedValue(new Error("Config not found"));

    const res = await GET(makeRequest("/api/risk/bottleneck"));
    expect(res.status).toBe(500);

    const data = await res.json();
    expect(data.error).toBe("Config not found");
  });

  it("sorts bottlenecks by impact score descending", async () => {
    vi.mocked(computeSprintHealth).mockReturnValue({
      overall: "warning",
      indicators: [
        { id: "wip-alert", severity: "warning", message: "WIP hit", details: [] },
        { id: "bottleneck", severity: "critical", message: "Col bottleneck", details: [] },
      ],
      stuckStories: [],
      wipColumns: ["in-progress"],
    });

    const res = await GET(makeRequest("/api/risk/bottleneck?project=project-a"));
    expect(res.status).toBe(200);

    const data = await res.json();
    const scores = data.bottlenecks.map(
      (b: { impact: { impactScore: number } }) => b.impact.impactScore,
    );
    for (let i = 1; i < scores.length; i++) {
      expect(scores[i]).toBeLessThanOrEqual(scores[i - 1]);
    }
  });

  it("handles conflict detection errors gracefully", async () => {
    const { runConflictDetection } = await import("@composio/ao-core");
    vi.mocked(runConflictDetection).mockImplementation(() => {
      throw new Error("Conflict detection failed");
    });

    const res = await GET(makeRequest("/api/risk/bottleneck?project=project-a"));
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.bottlenecks).toBeDefined();
  });

  it("merges bottlenecks across multiple projects", async () => {
    vi.mocked(computeSprintHealth).mockReturnValue({
      overall: "warning",
      indicators: [{ id: "stuck-stories", severity: "critical", message: "Stuck", details: [] }],
      stuckStories: ["S-1"],
      wipColumns: [],
    });

    const res = await GET(makeRequest("/api/risk/bottleneck"));
    expect(res.status).toBe(200);

    const data = await res.json();
    // project-a has bmad tracker, so it produces bottlenecks
    expect(data.bottlenecks.length).toBeGreaterThan(0);
    expect(data.summary.totalBottlenecks).toBe(data.bottlenecks.length);
  });
});
