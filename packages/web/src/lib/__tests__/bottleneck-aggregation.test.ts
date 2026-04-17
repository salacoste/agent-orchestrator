import { describe, it, expect } from "vitest";
import {
  aggregateBottlenecks,
  type BottleneckAggregationInput,
} from "../bottleneck-aggregation.js";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

const baseInput: BottleneckAggregationInput = {
  projectId: "test-project",
  projectName: "Test Project",
  sprintHealth: { indicators: [], stuckStories: [], wipColumns: [] },
  cycleTime: { bottleneckColumn: null, averageColumnDwells: [], completedCount: 0 },
  throughput: { bottleneckTrend: null, columnTrends: [] },
  teamWorkload: { overloaded: [], unassigned: [], members: [], overloadThreshold: 3 },
  storyAging: { agingStories: [] },
  capacityResults: [],
  conflicts: [],
};

describe("aggregateBottlenecks", () => {
  it("returns empty bottlenecks when no issues present", () => {
    const result = aggregateBottlenecks(baseInput);
    expect(result.bottlenecks).toHaveLength(0);
    expect(result.summary.totalBottlenecks).toBe(0);
    expect(result.summary.stuckStories).toBe(0);
    expect(result.lastUpdated).toBeTruthy();
  });

  it("skips sprint health indicators with severity 'ok'", () => {
    const result = aggregateBottlenecks({
      ...baseInput,
      sprintHealth: {
        indicators: [{ id: "some-ok", severity: "ok", message: "All good", details: [] }],
        stuckStories: [],
        wipColumns: [],
      },
    });
    expect(result.bottlenecks).toHaveLength(0);
  });

  it("creates bottleneck from critical sprint health indicator", () => {
    const result = aggregateBottlenecks({
      ...baseInput,
      sprintHealth: {
        indicators: [
          {
            id: "bottleneck",
            severity: "critical",
            message: "Review is a bottleneck",
            details: ["3.2x ratio"],
          },
        ],
        stuckStories: [],
        wipColumns: [],
      },
    });
    expect(result.bottlenecks).toHaveLength(1);
    expect(result.bottlenecks[0].severity).toBe(80);
    expect(result.bottlenecks[0].severityLabel).toBe("critical");
    expect(result.bottlenecks[0].type).toBe("column-bottleneck");
    expect(result.bottlenecks[0].affectedProjects).toContain("test-project");
  });

  it("creates stuck-stories bottleneck from indicator", () => {
    const result = aggregateBottlenecks({
      ...baseInput,
      sprintHealth: {
        indicators: [
          {
            id: "stuck-stories",
            severity: "warning",
            message: "3 stories stuck",
            details: [],
          },
        ],
        stuckStories: ["S-1", "S-2", "S-3"],
        wipColumns: [],
      },
    });
    const bn = result.bottlenecks.find((b) => b.type === "stuck-stories");
    expect(bn).toBeDefined();
    expect(bn!.affectedStories).toEqual(["S-1", "S-2", "S-3"]);
    expect(bn!.impact.storiesAffected).toBe(3);
  });

  it("creates wip-violation bottleneck from wip indicator", () => {
    const result = aggregateBottlenecks({
      ...baseInput,
      sprintHealth: {
        indicators: [
          {
            id: "wip-alert",
            severity: "warning",
            message: "WIP limit exceeded",
            details: ["in-progress at 8/6"],
          },
        ],
        stuckStories: [],
        wipColumns: ["in-progress", "review"],
      },
    });
    const bn = result.bottlenecks.find((b) => b.type === "wip-violation");
    expect(bn).toBeDefined();
    expect(bn!.contributingFactors).toContain("in-progress at 8/6");
  });

  it("creates column-bottleneck from cycle time when ratio >= 2", () => {
    const result = aggregateBottlenecks({
      ...baseInput,
      cycleTime: {
        bottleneckColumn: "review",
        averageColumnDwells: [
          { column: "review", dwellMs: 5 * MS_PER_DAY },
          { column: "in-progress", dwellMs: 1 * MS_PER_DAY },
        ],
        completedCount: 10,
      },
    });
    const bn = result.bottlenecks.find((b) => b.id === "test-project-bn-column-review");
    expect(bn).toBeDefined();
    expect(bn!.type).toBe("column-bottleneck");
    expect(bn!.title).toContain("review");
    expect(bn!.title).toContain("5.0x");
  });

  it("skips cycle time bottleneck when ratio < 2", () => {
    const result = aggregateBottlenecks({
      ...baseInput,
      cycleTime: {
        bottleneckColumn: "review",
        averageColumnDwells: [
          { column: "review", dwellMs: 1.5 * MS_PER_DAY },
          { column: "in-progress", dwellMs: 1 * MS_PER_DAY },
        ],
        completedCount: 10,
      },
    });
    expect(result.bottlenecks).toHaveLength(0);
  });

  it("skips cycle time bottleneck when no bottleneckColumn", () => {
    const result = aggregateBottlenecks({
      ...baseInput,
      cycleTime: {
        bottleneckColumn: null,
        averageColumnDwells: [{ column: "review", dwellMs: 5 * MS_PER_DAY }],
        completedCount: 10,
      },
    });
    const bn = result.bottlenecks.find((b) => b.type === "column-bottleneck");
    expect(bn).toBeUndefined();
  });

  it("creates bottleneck-trend from throughput", () => {
    const result = aggregateBottlenecks({
      ...baseInput,
      throughput: {
        bottleneckTrend: "review",
        columnTrends: [
          {
            column: "review",
            weeklyAvgMs: [1 * MS_PER_DAY, 2 * MS_PER_DAY, 3 * MS_PER_DAY],
            trend: "increasing",
            slope: 0.5,
          },
        ],
      },
    });
    const bn = result.bottlenecks.find((b) => b.type === "bottleneck-trend");
    expect(bn).toBeDefined();
    expect(bn!.trend).toBe("worsening");
    expect(bn!.title).toContain("review");
  });

  it("creates agent-overload bottleneck from team workload", () => {
    const result = aggregateBottlenecks({
      ...baseInput,
      teamWorkload: {
        overloaded: ["agent-1"],
        unassigned: [],
        members: [
          {
            sessionId: "agent-1",
            storiesByColumn: { "in-progress": ["S-1", "S-2", "S-3", "S-4"] },
            totalInFlight: 4,
            isOverloaded: true,
          },
        ],
        overloadThreshold: 3,
      },
    });
    const bn = result.bottlenecks.find((b) => b.type === "agent-overload");
    expect(bn).toBeDefined();
    expect(bn!.title).toContain("agent-1");
    expect(bn!.affectedStories).toEqual(["S-1", "S-2", "S-3", "S-4"]);
  });

  it("creates unassigned-stories bottleneck", () => {
    const result = aggregateBottlenecks({
      ...baseInput,
      teamWorkload: {
        overloaded: [],
        unassigned: [
          { storyId: "S-10", column: "backlog" },
          { storyId: "S-11", column: "backlog" },
        ],
        members: [],
        overloadThreshold: 3,
      },
    });
    const bn = result.bottlenecks.find((b) => b.type === "unassigned-stories");
    expect(bn).toBeDefined();
    expect(bn!.impact.storiesAffected).toBe(2);
    expect(bn!.affectedStories).toEqual(["S-10", "S-11"]);
  });

  it("creates aging-stories bottleneck from story aging data", () => {
    const result = aggregateBottlenecks({
      ...baseInput,
      storyAging: {
        agingStories: [
          {
            storyId: "S-50",
            column: "review",
            ageMs: 5 * MS_PER_DAY,
            isAging: true,
          },
          {
            storyId: "S-51",
            column: "in-progress",
            ageMs: 7 * MS_PER_DAY,
            isAging: true,
          },
        ],
      },
    });
    const bn = result.bottlenecks.find((b) => b.type === "aging-stories");
    expect(bn).toBeDefined();
    expect(bn!.impact.storiesAffected).toBe(2);
    expect(bn!.affectedStories).toEqual(["S-50", "S-51"]);
  });

  it("skips non-aging stories", () => {
    const result = aggregateBottlenecks({
      ...baseInput,
      storyAging: {
        agingStories: [
          {
            storyId: "S-60",
            column: "in-progress",
            ageMs: 1 * MS_PER_DAY,
            isAging: false,
          },
        ],
      },
    });
    const bn = result.bottlenecks.find((b) => b.type === "aging-stories");
    expect(bn).toBeUndefined();
  });

  it("creates capacity-bottleneck from at-capacity agents", () => {
    const result = aggregateBottlenecks({
      ...baseInput,
      capacityResults: [
        {
          agentId: "agent-x",
          utilizationPercent: 100,
          isAtCapacity: true,
          isNearCapacity: false,
          availableSlots: 0,
        },
      ],
    });
    const bn = result.bottlenecks.find((b) => b.type === "capacity-bottleneck");
    expect(bn).toBeDefined();
    expect(bn!.severity).toBe(80);
    expect(bn!.title).toContain("agent-x");
  });

  it("creates capacity-bottleneck for near-capacity agents", () => {
    const result = aggregateBottlenecks({
      ...baseInput,
      capacityResults: [
        {
          agentId: "agent-y",
          utilizationPercent: 85,
          isAtCapacity: false,
          isNearCapacity: true,
          availableSlots: 1,
        },
      ],
    });
    const bn = result.bottlenecks.find((b) => b.type === "capacity-bottleneck");
    expect(bn).toBeDefined();
    expect(bn!.severity).toBe(50);
  });

  it("skips capacity results that are neither at nor near capacity", () => {
    const result = aggregateBottlenecks({
      ...baseInput,
      capacityResults: [
        {
          agentId: "agent-z",
          utilizationPercent: 40,
          isAtCapacity: false,
          isNearCapacity: false,
          availableSlots: 5,
        },
      ],
    });
    expect(result.bottlenecks).toHaveLength(0);
  });

  it("creates resource-conflict bottleneck from conflicts", () => {
    const result = aggregateBottlenecks({
      ...baseInput,
      conflicts: [
        {
          id: "conflict-1",
          resourceType: "agent",
          resourceIdentifier: "agent-shared",
          competingProjects: ["proj-a", "proj-b"],
          severity: "critical",
        },
      ],
    });
    const bn = result.bottlenecks.find((b) => b.type === "resource-conflict");
    expect(bn).toBeDefined();
    expect(bn!.severity).toBe(90);
    expect(bn!.affectedProjects).toEqual(["proj-a", "proj-b"]);
  });

  it("sorts bottlenecks by impact score descending", () => {
    const result = aggregateBottlenecks({
      ...baseInput,
      sprintHealth: {
        indicators: [
          {
            id: "some-warning",
            severity: "warning",
            message: "Mild issue",
            details: [],
          },
          {
            id: "some-critical",
            severity: "critical",
            message: "Big problem",
            details: [],
          },
        ],
        stuckStories: [],
        wipColumns: [],
      },
      conflicts: [
        {
          id: "conflict-1",
          resourceType: "agent",
          resourceIdentifier: "shared",
          competingProjects: ["a", "b"],
          severity: "critical",
        },
      ],
    });
    const scores = result.bottlenecks.map((b) => b.impact.impactScore);
    for (let i = 1; i < scores.length; i++) {
      expect(scores[i]).toBeLessThanOrEqual(scores[i - 1]);
    }
  });

  it("summary counts match categorized bottlenecks", () => {
    const result = aggregateBottlenecks({
      ...baseInput,
      sprintHealth: {
        indicators: [
          { id: "stuck-stories", severity: "critical", message: "Stuck", details: [] },
          { id: "wip-alert", severity: "warning", message: "WIP", details: [] },
        ],
        stuckStories: ["S-1"],
        wipColumns: ["in-progress"],
      },
      teamWorkload: {
        overloaded: ["agent-a"],
        unassigned: [{ storyId: "S-99", column: "backlog" }],
        members: [
          {
            sessionId: "agent-a",
            storiesByColumn: { "in-progress": ["S-5"] },
            totalInFlight: 5,
            isOverloaded: true,
          },
        ],
        overloadThreshold: 3,
      },
      conflicts: [
        {
          id: "c1",
          resourceType: "agent",
          resourceIdentifier: "shared",
          competingProjects: ["a", "b"],
          severity: "high",
        },
      ],
    });
    expect(result.summary.stuckStories).toBe(1);
    expect(result.summary.wipViolations).toBe(1);
    expect(result.summary.resourceConflicts).toBe(1);
    expect(result.summary.totalBottlenecks).toBe(result.bottlenecks.length);
  });

  it("includes all affected projects from conflicts", () => {
    const result = aggregateBottlenecks({
      ...baseInput,
      conflicts: [
        {
          id: "c1",
          resourceType: "repository",
          resourceIdentifier: "shared-repo",
          competingProjects: ["proj-1", "proj-2", "proj-3"],
          severity: "medium",
        },
      ],
    });
    const bn = result.bottlenecks[0];
    expect(bn.affectedProjects).toEqual(["proj-1", "proj-2", "proj-3"]);
  });
});
