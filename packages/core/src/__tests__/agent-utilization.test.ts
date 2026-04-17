import { describe, it, expect } from "vitest";
import {
  computeAgentUtilization,
  computeProjectUtilization,
  computePoolUtilizationOverview,
} from "../agent-utilization.js";
import type { Session, AgentRegistry, OrchestratorConfig } from "../types.js";

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeSession(overrides: Partial<Session> & { id: string; projectId: string }): Session {
  return {
    id: overrides.id,
    projectId: overrides.projectId,
    status: overrides.status ?? "done",
    activity: overrides.activity ?? "active",
    branch: overrides.branch ?? null,
    issueId: overrides.issueId ?? null,
    pr: overrides.pr ?? null,
    workspacePath: overrides.workspacePath ?? null,
    runtimeHandle: overrides.runtimeHandle ?? null,
    agentInfo: overrides.agentInfo ?? null,
    createdAt: overrides.createdAt ?? new Date("2026-01-01T00:00:00Z"),
    lastActivityAt: overrides.lastActivityAt ?? new Date("2026-01-01T01:00:00Z"),
    metadata: overrides.metadata ?? {},
  };
}

function makeRegistry(assignments: Record<string, { storyId: string }> = {}): AgentRegistry {
  return {
    getByAgent: (agentId: string) => assignments[agentId] ?? null,
    getByStory: (_storyId: string) => null,
    register: () => {},
    unregister: () => {},
    list: () => [],
  } as unknown as AgentRegistry;
}

function makeConfig(
  poolProjects: Record<string, { eligibleProjects: string[]; reservedAgents?: string[] }> = {},
): OrchestratorConfig {
  const projects: Record<
    string,
    {
      name: string;
      path: string;
      sharedPool?: { enabled: boolean; eligibleProjects: string[]; reservedAgents?: string[] };
    }
  > = {};
  for (const [id, pool] of Object.entries(poolProjects)) {
    projects[id] = {
      name: id,
      path: `/tmp/${id}`,
      sharedPool: {
        enabled: true,
        eligibleProjects: pool.eligibleProjects,
        reservedAgents: pool.reservedAgents,
      },
    };
  }
  return {
    projects,
    configPath: "/tmp/test-config.yaml",
  } as unknown as OrchestratorConfig;
}

// ── computeAgentUtilization ───────────────────────────────────────────────────

describe("computeAgentUtilization", () => {
  it("returns empty array for no sessions", () => {
    const result = computeAgentUtilization([], makeRegistry(), makeConfig());
    expect(result).toEqual([]);
  });

  it("computes active agent utilization at 100%", () => {
    const sessions = [makeSession({ id: "a1", projectId: "p1", activity: "active" })];
    const result = computeAgentUtilization(sessions, makeRegistry(), makeConfig());
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      agentId: "a1",
      projectId: "p1",
      isActive: true,
      utilizationPercent: 100,
    });
  });

  it("computes idle agent utilization at 0%", () => {
    const sessions = [makeSession({ id: "a1", projectId: "p1", activity: "idle" })];
    const result = computeAgentUtilization(sessions, makeRegistry(), makeConfig());
    expect(result).toMatchObject([{ isActive: false, utilizationPercent: 0 }]);
  });

  it("treats status=working as active even when activity is idle", () => {
    const sessions = [
      makeSession({ id: "a1", projectId: "p1", activity: "idle", status: "working" }),
    ];
    const result = computeAgentUtilization(sessions, makeRegistry(), makeConfig());
    expect(result).toMatchObject([{ isActive: true, utilizationPercent: 100 }]);
  });

  it("deduplicates sessions by agent ID", () => {
    const sessions = [
      makeSession({ id: "a1", projectId: "p1", activity: "active" }),
      makeSession({ id: "a1", projectId: "p1", activity: "idle" }),
    ];
    const result = computeAgentUtilization(sessions, makeRegistry(), makeConfig());
    expect(result).toHaveLength(1);
  });

  it("tracks stories worked from registry", () => {
    const sessions = [makeSession({ id: "a1", projectId: "p1", activity: "active" })];
    const registry = makeRegistry({ a1: { storyId: "s1" } });
    const result = computeAgentUtilization(sessions, registry, makeConfig());
    expect(result[0].storiesWorked).toBe(1);
  });

  it("tracks cross-project assignments from metadata", () => {
    const sessions = [
      makeSession({
        id: "a1",
        projectId: "p1",
        activity: "active",
        metadata: { sourceProjectId: "p2" },
      }),
    ];
    const result = computeAgentUtilization(sessions, makeRegistry(), makeConfig());
    expect(result[0].crossProjectAssignments).toBe(1);
  });

  it("identifies pool agents", () => {
    const sessions = [makeSession({ id: "a1", projectId: "p1", activity: "active" })];
    const config = makeConfig({ p1: { eligibleProjects: ["p2"] } });
    const result = computeAgentUtilization(sessions, makeRegistry(), config);
    expect(result[0].isPoolAgent).toBe(true);
  });

  it("identifies non-pool agents", () => {
    const sessions = [makeSession({ id: "a1", projectId: "p1", activity: "active" })];
    const result = computeAgentUtilization(sessions, makeRegistry(), makeConfig());
    expect(result[0].isPoolAgent).toBe(false);
  });

  it("computes session duration", () => {
    const sessions = [
      makeSession({
        id: "a1",
        projectId: "p1",
        activity: "active",
        createdAt: new Date("2026-01-01T00:00:00Z"),
        lastActivityAt: new Date("2026-01-01T01:00:00Z"),
      }),
    ];
    const result = computeAgentUtilization(sessions, makeRegistry(), makeConfig());
    expect(result[0].sessionDurationMs).toBe(3_600_000);
  });

  it("builds single-entry projectTimeBreakdown for local agent", () => {
    const sessions = [makeSession({ id: "a1", projectId: "p1", activity: "active" })];
    const result = computeAgentUtilization(sessions, makeRegistry(), makeConfig());
    expect(result[0].projectTimeBreakdown).toHaveLength(1);
    expect(result[0].projectTimeBreakdown[0]).toMatchObject({
      projectId: "p1",
      percent: 100,
      isLocal: true,
    });
  });

  it("builds two-entry projectTimeBreakdown for cross-project agent", () => {
    const sessions = [
      makeSession({
        id: "a1",
        projectId: "p1",
        activity: "active",
        metadata: { sourceProjectId: "p2" },
      }),
    ];
    const result = computeAgentUtilization(sessions, makeRegistry(), makeConfig());
    expect(result[0].projectTimeBreakdown).toHaveLength(2);
    expect(result[0].projectTimeBreakdown[0]).toMatchObject({
      projectId: "p1",
      isLocal: false,
    });
    expect(result[0].projectTimeBreakdown[1]).toMatchObject({
      projectId: "p2",
      durationMs: 0,
      percent: 0,
      isLocal: false,
    });
  });
});

// ── computeProjectUtilization ─────────────────────────────────────────────────

describe("computeProjectUtilization", () => {
  it("returns zero utilization for project with no sessions", () => {
    const result = computeProjectUtilization("p1", [], makeRegistry(), makeConfig());
    expect(result).toMatchObject({
      projectId: "p1",
      totalAgents: 0,
      activeAgents: 0,
      utilizationPercent: 0,
    });
  });

  it("computes utilization from mixed active/idle sessions", () => {
    const sessions = [
      makeSession({ id: "a1", projectId: "p1", activity: "active" }),
      makeSession({ id: "a2", projectId: "p1", activity: "active" }),
      makeSession({ id: "a3", projectId: "p1", activity: "idle" }),
      makeSession({ id: "a4", projectId: "p1", activity: "ready" }),
    ];
    const result = computeProjectUtilization("p1", sessions, makeRegistry(), makeConfig());
    expect(result.totalAgents).toBe(4);
    expect(result.activeAgents).toBe(2);
    expect(result.utilizationPercent).toBe(50);
  });

  it("filters sessions to specified project only", () => {
    const sessions = [
      makeSession({ id: "a1", projectId: "p1", activity: "active" }),
      makeSession({ id: "a2", projectId: "p2", activity: "active" }),
    ];
    const result = computeProjectUtilization("p1", sessions, makeRegistry(), makeConfig());
    expect(result.totalAgents).toBe(1);
  });

  it("computes 100% utilization when all agents active", () => {
    const sessions = [
      makeSession({ id: "a1", projectId: "p1", activity: "active" }),
      makeSession({ id: "a2", projectId: "p1", activity: "active" }),
    ];
    const result = computeProjectUtilization("p1", sessions, makeRegistry(), makeConfig());
    expect(result.utilizationPercent).toBe(100);
  });

  it("counts status=working as active even with idle activity", () => {
    const sessions = [
      makeSession({ id: "a1", projectId: "p1", activity: "idle", status: "working" }),
      makeSession({ id: "a2", projectId: "p1", activity: "idle" }),
    ];
    const result = computeProjectUtilization("p1", sessions, makeRegistry(), makeConfig());
    expect(result.activeAgents).toBe(1);
    expect(result.utilizationPercent).toBe(50);
  });

  it("includes per-agent breakdown", () => {
    const sessions = [
      makeSession({ id: "a1", projectId: "p1", activity: "active" }),
      makeSession({ id: "a2", projectId: "p1", activity: "idle" }),
    ];
    const result = computeProjectUtilization("p1", sessions, makeRegistry(), makeConfig());
    expect(result.agentDetails).toHaveLength(2);
    expect(result.agentDetails.map((a) => a.agentId)).toEqual(["a1", "a2"]);
  });

  it("computes pool agent counts for pool-enabled project", () => {
    const sessions = [
      makeSession({ id: "a1", projectId: "p1", activity: "active" }),
      makeSession({ id: "a2", projectId: "p1", activity: "idle" }),
    ];
    const config = makeConfig({ p1: { eligibleProjects: ["p2"] } });
    const result = computeProjectUtilization("p1", sessions, makeRegistry(), config);
    expect(result.poolAgentsTotal).toBe(2);
    expect(result.poolAgentsActive).toBe(1);
  });

  it("returns zero pool counts for non-pool project", () => {
    const sessions = [makeSession({ id: "a1", projectId: "p1", activity: "active" })];
    const result = computeProjectUtilization("p1", sessions, makeRegistry(), makeConfig());
    expect(result.poolAgentsTotal).toBe(0);
    expect(result.poolAgentsActive).toBe(0);
  });

  it("computes totalActiveTimeMs and totalIdleTimeMs", () => {
    const sessions = [
      makeSession({
        id: "a1",
        projectId: "p1",
        activity: "active",
        createdAt: new Date("2026-01-01T00:00:00Z"),
        lastActivityAt: new Date("2026-01-01T02:00:00Z"),
      }),
      makeSession({
        id: "a2",
        projectId: "p1",
        activity: "idle",
        createdAt: new Date("2026-01-01T00:00:00Z"),
        lastActivityAt: new Date("2026-01-01T01:00:00Z"),
      }),
    ];
    const result = computeProjectUtilization("p1", sessions, makeRegistry(), makeConfig());
    // a1 active: 2h = 7,200,000ms, a2 idle: 1h = 3,600,000ms
    expect(result.totalActiveTimeMs).toBe(7_200_000);
    expect(result.totalIdleTimeMs).toBe(3_600_000);
  });
});

// ── computePoolUtilizationOverview ────────────────────────────────────────────

describe("computePoolUtilizationOverview", () => {
  it("returns undefined when no pool projects configured", () => {
    const result = computePoolUtilizationOverview(makeConfig(), [], makeRegistry());
    expect(result).toBeUndefined();
  });

  it("returns overview for single pool project", () => {
    const sessions = [
      makeSession({ id: "a1", projectId: "p1", activity: "active" }),
      makeSession({ id: "a2", projectId: "p1", activity: "idle" }),
    ];
    const config = makeConfig({ p1: { eligibleProjects: ["p2"] } });
    const result = computePoolUtilizationOverview(config, sessions, makeRegistry());
    expect(result).toMatchObject({
      totalPoolAgents: 2,
      activePoolAgents: 1,
      utilizationPercent: 50,
      poolProjectCount: 1,
    });
  });

  it("aggregates across multiple pool projects", () => {
    const sessions = [
      makeSession({ id: "a1", projectId: "p1", activity: "active" }),
      makeSession({ id: "a2", projectId: "p1", activity: "active" }),
      makeSession({ id: "a3", projectId: "p2", activity: "idle" }),
      makeSession({ id: "a4", projectId: "p2", activity: "idle" }),
      makeSession({ id: "a5", projectId: "p2", activity: "idle" }),
    ];
    const config = makeConfig({
      p1: { eligibleProjects: ["p2"] },
      p2: { eligibleProjects: ["p1"] },
    });
    const result = computePoolUtilizationOverview(config, sessions, makeRegistry());
    expect(result).toMatchObject({
      totalPoolAgents: 5,
      activePoolAgents: 2,
      utilizationPercent: 40,
      poolProjectCount: 2,
    });
  });

  it("counts reserved agents across pool projects", () => {
    const sessions = [makeSession({ id: "a1", projectId: "p1", activity: "active" })];
    const config = makeConfig({
      p1: { eligibleProjects: ["p2"], reservedAgents: ["r1", "r2"] },
      p2: { eligibleProjects: ["p1"], reservedAgents: ["r3"] },
    });
    const result = computePoolUtilizationOverview(config, sessions, makeRegistry());
    expect(result!.reservedAgentCount).toBe(3);
  });

  it("includes per-project breakdown", () => {
    const sessions = [
      makeSession({ id: "a1", projectId: "p1", activity: "active" }),
      makeSession({ id: "a2", projectId: "p2", activity: "idle" }),
    ];
    const config = makeConfig({
      p1: { eligibleProjects: ["p2"] },
      p2: { eligibleProjects: ["p1"] },
    });
    const result = computePoolUtilizationOverview(config, sessions, makeRegistry());
    expect(result!.projectBreakdown).toHaveLength(2);
    expect(result!.projectBreakdown.map((p) => p.projectId)).toEqual(["p1", "p2"]);
  });

  it("excludes non-pool project sessions from totals", () => {
    const sessions = [
      makeSession({ id: "a1", projectId: "p1", activity: "active" }),
      makeSession({ id: "a2", projectId: "p-no-pool", activity: "active" }),
    ];
    const config = makeConfig({ p1: { eligibleProjects: ["p-no-pool"] } });
    // p-no-pool has no sharedPool config so it's not a pool project
    const result = computePoolUtilizationOverview(config, sessions, makeRegistry());
    expect(result!.totalPoolAgents).toBe(1); // only p1 session
  });

  it("handles 100% pool utilization", () => {
    const sessions = [
      makeSession({ id: "a1", projectId: "p1", activity: "active" }),
      makeSession({ id: "a2", projectId: "p1", activity: "active" }),
    ];
    const config = makeConfig({ p1: { eligibleProjects: ["p2"] } });
    const result = computePoolUtilizationOverview(config, sessions, makeRegistry());
    expect(result!.utilizationPercent).toBe(100);
  });

  it("handles 0% pool utilization (all idle)", () => {
    const sessions = [
      makeSession({ id: "a1", projectId: "p1", activity: "idle" }),
      makeSession({ id: "a2", projectId: "p1", activity: "ready" }),
    ];
    const config = makeConfig({ p1: { eligibleProjects: ["p2"] } });
    const result = computePoolUtilizationOverview(config, sessions, makeRegistry());
    expect(result!.utilizationPercent).toBe(0);
  });
});
