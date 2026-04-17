import { describe, it, expect } from "vitest";
import {
  collectSnapshot,
  computeRollingAverage,
  computeTrend,
  buildTimeSeries,
  buildProjectSummary,
  buildPortfolioOverview,
  type SnapshotInput,
} from "../utilization-snapshot.js";
import type { ProjectUtilizationSummary } from "../utilization-metrics-types.js";

describe("collectSnapshot", () => {
  it("maps agent utilizations and capacity to snapshots", () => {
    const input: SnapshotInput = {
      agentUtilizations: [
        {
          agentId: "a1",
          utilizationPercent: 80,
          isActive: true,
          storiesWorked: 3,
          isPoolAgent: false,
          projectId: "p1",
        },
        {
          agentId: "a2",
          utilizationPercent: 20,
          isActive: false,
          storiesWorked: 0,
          isPoolAgent: true,
          projectId: "p1",
        },
      ],
      capacityResults: [
        { agentId: "a1", utilizationPercent: 80, isAtCapacity: true, isNearCapacity: false },
        { agentId: "a2", utilizationPercent: 20, isAtCapacity: false, isNearCapacity: false },
      ],
      projectId: "p1",
    };

    const snapshots = collectSnapshot(input);
    expect(snapshots).toHaveLength(2);

    expect(snapshots[0].agentId).toBe("a1");
    expect(snapshots[0].projectId).toBe("p1");
    expect(snapshots[0].utilizationPercent).toBe(80);
    expect(snapshots[0].isActive).toBe(true);
    expect(snapshots[0].storiesWorked).toBe(3);
    expect(snapshots[0].isPoolAgent).toBe(false);
    expect(snapshots[0].isAtCapacity).toBe(true);

    expect(snapshots[1].agentId).toBe("a2");
    expect(snapshots[1].isPoolAgent).toBe(true);
    expect(snapshots[1].storiesWorked).toBe(0);
  });

  it("defaults capacity flags to false when no capacity result", () => {
    const input: SnapshotInput = {
      agentUtilizations: [
        { agentId: "a1", utilizationPercent: 50, isActive: true, projectId: "p1" },
      ],
      capacityResults: [],
      projectId: "p1",
    };

    const snapshots = collectSnapshot(input);
    expect(snapshots[0].isAtCapacity).toBe(false);
    expect(snapshots[0].isNearCapacity).toBe(false);
    expect(snapshots[0].isPoolAgent).toBe(false);
    expect(snapshots[0].storiesWorked).toBe(0);
  });
});

describe("computeRollingAverage", () => {
  it("returns 0 for empty snapshots", () => {
    expect(computeRollingAverage([], 3600_000, 100_000)).toBe(0);
  });

  it("returns 0 when all snapshots are outside the window", () => {
    const points = [{ timestamp: 10_000, value: 80 }];
    expect(computeRollingAverage(points, 1000, 100_000)).toBe(0);
  });

  it("computes average of in-window points", () => {
    const now = 100_000;
    const points = [
      { timestamp: 99_000, value: 60 },
      { timestamp: 99_500, value: 80 },
    ];
    expect(computeRollingAverage(points, 2000, now)).toBe(70);
  });
});

describe("computeTrend", () => {
  it("returns stable for fewer than 2 snapshots", () => {
    expect(computeTrend([{ timestamp: 1, value: 50 }], 100)).toBe("stable");
    expect(computeTrend([], 100)).toBe("stable");
  });

  it("returns declining when newer values are higher (>5pp diff)", () => {
    const points = [
      { timestamp: 1, value: 40 },
      { timestamp: 2, value: 50 },
      { timestamp: 3, value: 70 },
      { timestamp: 4, value: 80 },
    ];
    expect(computeTrend(points, 100)).toBe("declining");
  });

  it("returns improving when newer values are lower (>5pp diff)", () => {
    const points = [
      { timestamp: 1, value: 80 },
      { timestamp: 2, value: 70 },
      { timestamp: 3, value: 50 },
      { timestamp: 4, value: 40 },
    ];
    expect(computeTrend(points, 100)).toBe("improving");
  });

  it("returns stable when diff is within ±5pp", () => {
    const points = [
      { timestamp: 1, value: 50 },
      { timestamp: 2, value: 52 },
      { timestamp: 3, value: 53 },
      { timestamp: 4, value: 54 },
    ];
    expect(computeTrend(points, 100)).toBe("stable");
  });
});

describe("buildTimeSeries", () => {
  it("builds time series with rolling averages", () => {
    const history = [
      {
        agentId: "a1",
        projectId: "p1",
        timestamp: 90_000,
        utilizationPercent: 60,
        isActive: true,
        storiesWorked: 1,
        isPoolAgent: false,
        isAtCapacity: false,
        isNearCapacity: false,
      },
      {
        agentId: "a1",
        projectId: "p1",
        timestamp: 95_000,
        utilizationPercent: 80,
        isActive: true,
        storiesWorked: 2,
        isPoolAgent: false,
        isAtCapacity: false,
        isNearCapacity: false,
      },
      {
        agentId: "a2",
        projectId: "p1",
        timestamp: 95_000,
        utilizationPercent: 50,
        isActive: true,
        storiesWorked: 1,
        isPoolAgent: false,
        isAtCapacity: false,
        isNearCapacity: false,
      },
    ];

    const ts = buildTimeSeries("a1", history, 100_000);
    expect(ts.agentId).toBe("a1");
    expect(ts.rollingAvg1h).toBe(70); // avg of 60, 80
    expect(ts.trend).toBeDefined();
  });
});

describe("buildProjectSummary", () => {
  it("returns empty summary for no snapshots", () => {
    const summary = buildProjectSummary("p1", []);
    expect(summary.projectId).toBe("p1");
    expect(summary.avgUtilization).toBe(0);
    expect(summary.agentCount).toBe(0);
    expect(summary.overutilizedCount).toBe(0);
    expect(summary.underutilizedCount).toBe(0);
  });

  it("computes avg utilization and counts", () => {
    const snapshots = [
      {
        agentId: "a1",
        projectId: "p1",
        timestamp: 100,
        utilizationPercent: 95,
        isActive: true,
        storiesWorked: 1,
        isPoolAgent: false,
        isAtCapacity: true,
        isNearCapacity: false,
      },
      {
        agentId: "a2",
        projectId: "p1",
        timestamp: 100,
        utilizationPercent: 20,
        isActive: true,
        storiesWorked: 0,
        isPoolAgent: true,
        isAtCapacity: false,
        isNearCapacity: false,
      },
      {
        agentId: "a3",
        projectId: "p1",
        timestamp: 100,
        utilizationPercent: 50,
        isActive: false,
        storiesWorked: 0,
        isPoolAgent: false,
        isAtCapacity: false,
        isNearCapacity: false,
      },
    ];

    const summary = buildProjectSummary("p1", snapshots);
    expect(summary.avgUtilization).toBe(55);
    expect(summary.overutilizedCount).toBe(1);
    expect(summary.underutilizedCount).toBe(1); // a2 is active + <30%
    expect(summary.agentCount).toBe(3);
    expect(summary.poolBreakdown).toBeDefined();
    expect(summary.poolBreakdown?.totalPoolAgents).toBe(1);
    expect(summary.poolBreakdown?.activePoolAgents).toBe(1);
  });

  it("filters by projectId", () => {
    const snapshots = [
      {
        agentId: "a1",
        projectId: "p1",
        timestamp: 100,
        utilizationPercent: 50,
        isActive: true,
        storiesWorked: 0,
        isPoolAgent: false,
        isAtCapacity: false,
        isNearCapacity: false,
      },
      {
        agentId: "a2",
        projectId: "p2",
        timestamp: 100,
        utilizationPercent: 80,
        isActive: true,
        storiesWorked: 0,
        isPoolAgent: false,
        isAtCapacity: false,
        isNearCapacity: false,
      },
    ];

    const summary = buildProjectSummary("p1", snapshots);
    expect(summary.agentCount).toBe(1);
  });
});

describe("buildPortfolioOverview", () => {
  it("aggregates across projects", () => {
    const summaries = [
      {
        projectId: "p1",
        avgUtilization: 60,
        overutilizedCount: 1,
        underutilizedCount: 0,
        agentCount: 2,
        agentSnapshots: [],
      },
      {
        projectId: "p2",
        avgUtilization: 40,
        overutilizedCount: 0,
        underutilizedCount: 1,
        agentCount: 3,
        agentSnapshots: [],
      },
    ] as ProjectUtilizationSummary[];

    const overview = buildPortfolioOverview(summaries);
    expect(overview.totalAgents).toBe(5);
    expect(overview.avgUtilization).toBe(Math.round((60 * 2 + 40 * 3) / 5));
    expect(overview.overutilizedAgents).toBe(1);
    expect(overview.underutilizedAgents).toBe(1);
  });

  it("handles empty summaries", () => {
    const overview = buildPortfolioOverview([]);
    expect(overview.totalAgents).toBe(0);
    expect(overview.avgUtilization).toBe(0);
  });
});
