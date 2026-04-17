import { describe, it, expect } from "vitest";
import {
  calculatePortfolioMetrics,
  getHealthScoreColor,
  getHealthStatusLabel,
} from "../portfolio-metrics.js";
import type { PortfolioProject } from "../types.js";

describe("calculatePortfolioMetrics", () => {
  it("handles empty state with all zeros", () => {
    const metrics = calculatePortfolioMetrics([]);
    expect(metrics.totalAgents).toBe(0);
    expect(metrics.totalConfiguredAgents).toBe(0);
    expect(metrics.stories.backlog).toBe(0);
    expect(metrics.stories.inProgress).toBe(0);
    expect(metrics.stories.done).toBe(0);
    expect(metrics.stories.blocked).toBe(0);
    expect(metrics.stories.total).toBe(0);
    expect(metrics.sprintHealthScore).toBe(0);
    expect(metrics.utilizationPercent).toBe(0);
  });

  it("calculates total agents from projects", () => {
    const projects: PortfolioProject[] = [
      {
        id: "p1",
        name: "Project 1",
        status: "active",
        activeAgents: 3,
        totalAgents: 3,
        stories: { backlog: 2, inProgress: 1, done: 5, blocked: 0 },
      },
      {
        id: "p2",
        name: "Project 2",
        status: "active",
        activeAgents: 2,
        totalAgents: 2,
        stories: { backlog: 1, inProgress: 2, done: 3, blocked: 1 },
      },
    ];
    const metrics = calculatePortfolioMetrics(projects);
    expect(metrics.totalAgents).toBe(5);
  });

  it("aggregates story counts from all projects", () => {
    const projects: PortfolioProject[] = [
      {
        id: "p1",
        name: "Project 1",
        status: "active",
        activeAgents: 1,
        totalAgents: 1,
        stories: { backlog: 2, inProgress: 3, done: 5, blocked: 0 },
      },
      {
        id: "p2",
        name: "Project 2",
        status: "active",
        activeAgents: 1,
        totalAgents: 1,
        stories: { backlog: 1, inProgress: 1, done: 3, blocked: 1 },
      },
    ];
    const metrics = calculatePortfolioMetrics(projects);
    expect(metrics.stories.backlog).toBe(3);
    expect(metrics.stories.inProgress).toBe(4);
    expect(metrics.stories.done).toBe(8);
    expect(metrics.stories.blocked).toBe(1);
    expect(metrics.stories.total).toBe(16);
  });

  it("calculates sprint health score correctly", () => {
    // 8 done / 16 total = 50% completion
    // 1 blocked * 5 = 5 penalty
    // Expected: 50 - 5 = 45
    const projects: PortfolioProject[] = [
      {
        id: "p1",
        name: "Project 1",
        status: "active",
        activeAgents: 1,
        totalAgents: 1,
        stories: { backlog: 2, inProgress: 3, done: 5, blocked: 0 },
      },
      {
        id: "p2",
        name: "Project 2",
        status: "active",
        activeAgents: 1,
        totalAgents: 1,
        stories: { backlog: 1, inProgress: 1, done: 3, blocked: 1 },
      },
    ];
    const metrics = calculatePortfolioMetrics(projects);
    expect(metrics.sprintHealthScore).toBe(45);
  });

  it("clamps sprint health score to 0 minimum", () => {
    // 2 done / 12 total = ~17% - (10 blocked * 5) = -33, clamped to 0
    const projects: PortfolioProject[] = [
      {
        id: "p1",
        name: "Project 1",
        status: "active",
        activeAgents: 1,
        totalAgents: 1,
        stories: { backlog: 0, inProgress: 0, done: 2, blocked: 10 },
      },
    ];
    const metrics = calculatePortfolioMetrics(projects);
    expect(metrics.sprintHealthScore).toBe(0);
  });

  it("clamps sprint health score to 100 maximum", () => {
    // 10 done / 10 total = 100% - 0 blocked = 100
    const projects: PortfolioProject[] = [
      {
        id: "p1",
        name: "Project 1",
        status: "active",
        activeAgents: 1,
        totalAgents: 1,
        stories: { backlog: 0, inProgress: 0, done: 10, blocked: 0 },
      },
    ];
    const metrics = calculatePortfolioMetrics(projects);
    expect(metrics.sprintHealthScore).toBe(100);
  });

  it("calculates utilization percentage from agent counts", () => {
    const projects: PortfolioProject[] = [
      {
        id: "p1",
        name: "Project 1",
        status: "active",
        activeAgents: 2,
        totalAgents: 3,
        stories: { backlog: 1, inProgress: 1, done: 1, blocked: 0 },
      },
      {
        id: "p2",
        name: "Project 2",
        status: "active",
        activeAgents: 1,
        totalAgents: 2,
        stories: { backlog: 1, inProgress: 1, done: 1, blocked: 0 },
      },
      {
        id: "p3",
        name: "Project 3",
        status: "idle",
        activeAgents: 0,
        totalAgents: 1,
        stories: { backlog: 1, inProgress: 0, done: 0, blocked: 0 },
      },
    ];
    const metrics = calculatePortfolioMetrics(projects);
    // 3 active / 6 total agents = 50%
    expect(metrics.utilizationPercent).toBe(50);
  });

  it("handles single project correctly", () => {
    const projects: PortfolioProject[] = [
      {
        id: "solo",
        name: "Solo Project",
        status: "active",
        activeAgents: 5,
        totalAgents: 5,
        stories: { backlog: 10, inProgress: 3, done: 7, blocked: 2 },
      },
    ];
    const metrics = calculatePortfolioMetrics(projects);
    expect(metrics.totalAgents).toBe(5);
    expect(metrics.stories.total).toBe(22);
    // 7/22 = ~32% - 10 = ~22
    expect(metrics.sprintHealthScore).toBe(22);
    expect(metrics.utilizationPercent).toBe(100);
  });

  it("returns undefined poolUtilization when no pool projects", () => {
    const projects: PortfolioProject[] = [
      {
        id: "p1",
        name: "Project 1",
        status: "active",
        activeAgents: 2,
        totalAgents: 2,
        stories: { backlog: 1, inProgress: 1, done: 1, blocked: 0 },
      },
    ];
    const metrics = calculatePortfolioMetrics(projects);
    expect(metrics.poolUtilization).toBeUndefined();
  });

  it("computes poolUtilization from pool-enabled projects", () => {
    const projects: PortfolioProject[] = [
      {
        id: "p1",
        name: "Pool Project",
        status: "active",
        activeAgents: 4,
        totalAgents: 4,
        stories: { backlog: 0, inProgress: 0, done: 1, blocked: 0 },
        sharedPool: {
          enabled: true,
          eligibleProjects: ["p2"],
          reservedAgents: ["agent-a", "agent-b"],
        },
      },
      {
        id: "p2",
        name: "Pool Project 2",
        status: "active",
        activeAgents: 3,
        totalAgents: 3,
        stories: { backlog: 0, inProgress: 0, done: 1, blocked: 0 },
        sharedPool: {
          enabled: true,
          eligibleProjects: ["p1"],
        },
      },
      {
        id: "p3",
        name: "No Pool",
        status: "idle",
        activeAgents: 0,
        totalAgents: 1,
        stories: { backlog: 1, inProgress: 0, done: 0, blocked: 0 },
      },
    ];
    const metrics = calculatePortfolioMetrics(projects);
    expect(metrics.poolUtilization).toEqual({
      totalPoolAgents: 7, // 4 + 3 from pool-enabled projects
      activePoolAgents: 7, // 4 + 3 active
      totalReservedAgents: 2, // agent-a, agent-b from p1
      poolProjectCount: 2,
    });
  });

  it("counts pool agents but zero reserved when no reservedAgents configured", () => {
    const projects: PortfolioProject[] = [
      {
        id: "p1",
        name: "Pool Project",
        status: "active",
        activeAgents: 3,
        totalAgents: 3,
        stories: { backlog: 0, inProgress: 0, done: 1, blocked: 0 },
        sharedPool: {
          enabled: true,
          eligibleProjects: ["p2"],
        },
      },
    ];
    const metrics = calculatePortfolioMetrics(projects);
    expect(metrics.poolUtilization).toEqual({
      totalPoolAgents: 3,
      activePoolAgents: 3,
      totalReservedAgents: 0,
      poolProjectCount: 1,
    });
  });
});

describe("getHealthScoreColor", () => {
  it("returns success color for healthy score (80+)", () => {
    expect(getHealthScoreColor(80)).toBe("var(--color-success)");
    expect(getHealthScoreColor(100)).toBe("var(--color-success)");
    expect(getHealthScoreColor(95)).toBe("var(--color-success)");
  });

  it("returns warning color for moderate score (60-79)", () => {
    expect(getHealthScoreColor(60)).toBe("var(--color-warning)");
    expect(getHealthScoreColor(70)).toBe("var(--color-warning)");
    expect(getHealthScoreColor(79)).toBe("var(--color-warning)");
  });

  it("returns error color for at-risk score (<60)", () => {
    expect(getHealthScoreColor(59)).toBe("var(--color-error)");
    expect(getHealthScoreColor(0)).toBe("var(--color-error)");
    expect(getHealthScoreColor(30)).toBe("var(--color-error)");
  });
});

describe("getHealthStatusLabel", () => {
  it("returns 'Healthy' for score 80+", () => {
    expect(getHealthStatusLabel(80)).toBe("Healthy");
    expect(getHealthStatusLabel(100)).toBe("Healthy");
  });

  it("returns 'Moderate' for score 60-79", () => {
    expect(getHealthStatusLabel(60)).toBe("Moderate");
    expect(getHealthStatusLabel(75)).toBe("Moderate");
  });

  it("returns 'At Risk' for score below 60", () => {
    expect(getHealthStatusLabel(59)).toBe("At Risk");
    expect(getHealthStatusLabel(0)).toBe("At Risk");
  });
});
