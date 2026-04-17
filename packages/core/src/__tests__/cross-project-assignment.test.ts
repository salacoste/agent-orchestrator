import { describe, it, expect, vi } from "vitest";
import {
  gatherPoolStories,
  buildAgentWorkloadMap,
  buildProjectAgentsMapFromSessions,
  buildAllocationRequest,
  getAssignableAgents,
  executeCrossProjectAssignment,
} from "../cross-project-assignment.js";
import type {
  OrchestratorConfig,
  SharedPoolConfig,
  Session,
  SessionManager,
  AgentRegistry,
} from "../types.js";
import type { AllocationDecision } from "../pool-allocation.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeConfig(
  projects: Record<string, { sharedPool?: SharedPoolConfig; path?: string }>,
): OrchestratorConfig {
  const result: Record<string, { sharedPool?: SharedPoolConfig; path: string }> = {};
  for (const [id, val] of Object.entries(projects)) {
    result[id] = {
      path: val.path ?? `/projects/${id}`,
      sharedPool: val.sharedPool,
    };
  }
  return { projects: result } as OrchestratorConfig;
}

// ---------------------------------------------------------------------------
// gatherPoolStories
// ---------------------------------------------------------------------------

describe("gatherPoolStories", () => {
  it("returns empty array when no pool projects configured", () => {
    const config = makeConfig({
      "project-1": {},
    });
    const result = gatherPoolStories(config, {
      readSprintData: () => null,
    });
    expect(result).toEqual([]);
  });

  it("returns stories from pool-enabled projects", () => {
    const config = makeConfig({
      "project-1": {
        sharedPool: { enabled: true, eligibleProjects: ["project-2"] },
      },
      "project-2": {
        sharedPool: { enabled: true, eligibleProjects: ["project-1"] },
      },
    });
    const sprintData = {
      development_status: {
        "1-1-story-alpha": "ready-for-dev",
        "1-2-story-beta": "done",
        "epic-1": "in-progress",
      },
      priorities: { "1-1-story-alpha": 5 },
    };

    const result = gatherPoolStories(config, {
      readSprintData: (projectId: string) => {
        if (projectId === "project-1") return sprintData;
        return { development_status: {} };
      },
    });

    expect(result).toHaveLength(1);
    expect(result[0].storyId).toBe("1-1-story-alpha");
    expect(result[0].projectId).toBe("project-1");
    expect(result[0].priority).toBe(5);
    expect(result[0].position).toBe(0);
  });

  it("skips projects with no sprint data", () => {
    const config = makeConfig({
      "project-1": {
        sharedPool: { enabled: true, eligibleProjects: ["*"] },
      },
    });
    const result = gatherPoolStories(config, {
      readSprintData: () => null,
    });
    expect(result).toEqual([]);
  });

  it("only includes ready-for-dev stories", () => {
    const config = makeConfig({
      "project-1": {
        sharedPool: { enabled: true, eligibleProjects: ["*"] },
      },
    });
    const sprintData = {
      development_status: {
        "1-1-ready": "ready-for-dev",
        "1-2-backlog": "backlog",
        "1-3-done": "done",
        "1-4-in-progress": "in-progress",
      },
    };
    const result = gatherPoolStories(config, {
      readSprintData: () => sprintData,
    });
    expect(result).toHaveLength(1);
    expect(result[0].storyId).toBe("1-1-ready");
  });

  it("gathers from multiple pool projects", () => {
    const config = makeConfig({
      "project-1": {
        sharedPool: { enabled: true, eligibleProjects: ["project-2"] },
      },
      "project-2": {
        sharedPool: { enabled: true, eligibleProjects: ["project-1"] },
      },
    });
    let callIdx = 0;
    const result = gatherPoolStories(config, {
      readSprintData: () => {
        callIdx++;
        // Use valid story key format: number-number-name
        const storyKey = callIdx === 1 ? "1-1-alpha" : "2-1-beta";
        return {
          development_status: {
            [storyKey]: "ready-for-dev",
          },
        };
      },
    });
    expect(result).toHaveLength(2);
    const projectIds = result.map((s) => s.projectId).sort();
    expect(projectIds).toEqual(["project-1", "project-2"]);
  });
});

// ---------------------------------------------------------------------------
// buildAgentWorkloadMap
// ---------------------------------------------------------------------------

describe("buildAgentWorkloadMap", () => {
  it("counts active assignments per agent", () => {
    const sessions: Partial<Session>[] = [
      {
        id: "agent-1",
        projectId: "project-1",
        status: "working",
      },
      {
        id: "agent-2",
        projectId: "project-1",
        status: "working",
      },
    ];

    const registry = {
      getByAgent: (agentId: string) => {
        if (agentId === "agent-1") {
          return { agentId: "agent-1", storyId: "s1", status: "active" };
        }
        return null;
      },
    } as unknown as AgentRegistry;

    const result = buildAgentWorkloadMap(sessions as Session[], registry);
    expect(result.get("agent-1")).toBe(1);
    expect(result.has("agent-2")).toBe(false); // No assignment → not in map
  });

  it("returns empty map for no sessions", () => {
    const registry = {
      getByAgent: () => null,
    } as unknown as AgentRegistry;

    const result = buildAgentWorkloadMap([] as Session[], registry);
    expect(result.size).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// buildProjectAgentsMapFromSessions
// ---------------------------------------------------------------------------

describe("buildProjectAgentsMapFromSessions", () => {
  it("groups agents by project for pool projects", () => {
    const config = makeConfig({
      "project-1": {
        sharedPool: { enabled: true, eligibleProjects: ["project-2"] },
      },
      "project-2": {
        sharedPool: { enabled: true, eligibleProjects: ["project-1"] },
      },
    });
    const sessions: Partial<Session>[] = [
      {
        id: "agent-1",
        projectId: "project-1",
        status: "working",
        activity: "idle",
      } as Partial<Session>,
      {
        id: "agent-2",
        projectId: "project-2",
        status: "working",
        activity: "idle",
      } as Partial<Session>,
      {
        id: "agent-3",
        projectId: "project-3",
        status: "working",
        activity: "idle",
      } as Partial<Session>, // not pool
    ];

    const result = buildProjectAgentsMapFromSessions(sessions as Session[], config);

    expect(result.get("project-1")).toEqual(["agent-1"]);
    expect(result.get("project-2")).toEqual(["agent-2"]);
    expect(result.has("project-3")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// buildAllocationRequest
// ---------------------------------------------------------------------------

describe("buildAllocationRequest", () => {
  it("orchestrates gathering into a complete AllocationRequest", async () => {
    const config = makeConfig({
      "project-1": {
        sharedPool: { enabled: true, eligibleProjects: ["project-2"] },
      },
      "project-2": {
        sharedPool: { enabled: true, eligibleProjects: ["project-1"] },
      },
    });
    const sessions: Partial<Session>[] = [
      {
        id: "agent-1",
        projectId: "project-1",
        status: "working",
        activity: "idle",
      },
    ];
    const sessionManager = {
      list: async () => sessions,
    } as unknown as SessionManager;
    const registry = {
      getByAgent: () => null,
    } as unknown as AgentRegistry;

    const result = await buildAllocationRequest(config, sessionManager, registry, {
      readSprintData: () => ({
        development_status: {
          "1-1-alpha": "ready-for-dev",
          "2-1-beta": "ready-for-dev",
        },
      }),
    });

    expect(result.config).toBe(config);
    expect(result.stories.length).toBeGreaterThanOrEqual(2);
    expect(result.agentWorkload).toBeDefined();
    expect(result.projectAgents).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// getAssignableAgents
// ---------------------------------------------------------------------------

describe("getAssignableAgents", () => {
  it("returns local agents when no pool configured", async () => {
    const config = makeConfig({
      "project-1": {},
    });
    const sessions: Partial<Session>[] = [
      { id: "local-agent", projectId: "project-1", status: "working", activity: "idle" },
    ];
    const sessionManager = {
      list: async () => sessions,
    } as unknown as SessionManager;
    const registry = {
      getByAgent: () => null,
    } as unknown as AgentRegistry;

    const result = await getAssignableAgents("project-1", config, sessionManager, registry);

    expect(result).toHaveLength(1);
    expect(result[0].agentId).toBe("local-agent");
    expect(result[0].isPoolAgent).toBe(false);
  });

  it("returns local + pool agents when pool enabled", async () => {
    const config = makeConfig({
      "project-1": {
        sharedPool: { enabled: true, eligibleProjects: ["project-2"] },
      },
      "project-2": {
        sharedPool: { enabled: true, eligibleProjects: ["project-1"] },
      },
    });
    const sessions: Partial<Session>[] = [
      { id: "local-agent", projectId: "project-1", status: "working", activity: "idle" },
      { id: "pool-agent", projectId: "project-2", status: "working", activity: "idle" },
    ];
    const sessionManager = {
      list: async () => sessions,
    } as unknown as SessionManager;
    const registry = {
      getByAgent: () => null,
    } as unknown as AgentRegistry;

    const result = await getAssignableAgents("project-1", config, sessionManager, registry);

    expect(result).toHaveLength(2);
    const local = result.find((a) => a.agentId === "local-agent");
    const pool = result.find((a) => a.agentId === "pool-agent");
    expect(local?.isPoolAgent).toBe(false);
    expect(pool?.isPoolAgent).toBe(true);
    expect(pool?.sourceProjectId).toBe("project-2");
  });

  it("excludes reserved agents from cross-project", async () => {
    const config = makeConfig({
      "project-1": {
        sharedPool: { enabled: true, eligibleProjects: ["project-2"] },
      },
      "project-2": {
        sharedPool: {
          enabled: true,
          eligibleProjects: ["project-1"],
          reservedAgents: ["reserved-agent"],
        },
      },
    });
    const sessions: Partial<Session>[] = [
      { id: "reserved-agent", projectId: "project-2", status: "working", activity: "idle" },
      { id: "free-agent", projectId: "project-2", status: "working", activity: "idle" },
    ];
    const sessionManager = {
      list: async () => sessions,
    } as unknown as SessionManager;
    const registry = {
      getByAgent: () => null,
    } as unknown as AgentRegistry;

    const result = await getAssignableAgents("project-1", config, sessionManager, registry);

    const agentIds = result.map((a) => a.agentId);
    expect(agentIds).not.toContain("reserved-agent");
    expect(agentIds).toContain("free-agent");
  });

  it("returns empty list for pool project with no idle agents", async () => {
    const config = makeConfig({
      "project-1": {
        sharedPool: { enabled: true, eligibleProjects: ["project-2"] },
      },
      "project-2": {
        sharedPool: { enabled: true, eligibleProjects: ["project-1"] },
      },
    });
    const sessions: Partial<Session>[] = [
      { id: "busy-agent", projectId: "project-2", status: "working", activity: "active" },
    ];
    const sessionManager = {
      list: async () => sessions,
    } as unknown as SessionManager;
    const registry = {
      getByAgent: () => null,
    } as unknown as AgentRegistry;

    const result = await getAssignableAgents("project-1", config, sessionManager, registry);
    expect(result).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// executeCrossProjectAssignment
// ---------------------------------------------------------------------------

describe("executeCrossProjectAssignment", () => {
  it("spawns session with target project config", async () => {
    const decision: AllocationDecision = {
      storyId: "1-1-story-alpha",
      agentId: "pool-agent",
      sourceProjectId: "project-2",
      targetProjectId: "project-1",
      score: 0.85,
      factors: { urgency: 0.5, priority: 0.7, affinity: 0.9, workload: 1.0 },
    };

    let spawnedConfig: Record<string, unknown> | null = null;
    const sessionManager = {
      spawn: async (config: Record<string, unknown>) => {
        spawnedConfig = config;
        return {
          id: "pool-agent",
          projectId: "project-1",
          status: "working",
          metadata: {},
        } as Session;
      },
    } as unknown as SessionManager;

    const registry = {
      register: vi.fn(),
    } as unknown as AgentRegistry;

    await executeCrossProjectAssignment(decision, sessionManager, registry, "story context");

    expect(spawnedConfig!.projectId).toBe("project-1");
    expect(spawnedConfig!.issueId).toBe("1-1-story-alpha");
    expect(registry.register).toHaveBeenCalled();
  });

  it("sets sourceProjectId in session metadata", async () => {
    const decision: AllocationDecision = {
      storyId: "1-1-alpha",
      agentId: "pool-agent",
      sourceProjectId: "project-2",
      targetProjectId: "project-1",
      score: 0.9,
      factors: { urgency: 0.5, priority: 0.7, affinity: 0.9, workload: 1.0 },
    };

    const sessionManager = {
      spawn: async () =>
        ({
          id: "pool-agent",
          projectId: "project-1",
          status: "working",
          metadata: {} as Record<string, string>,
        }) as Session,
    } as unknown as SessionManager;

    const registry = { register: vi.fn() } as unknown as AgentRegistry;

    const session = await executeCrossProjectAssignment(decision, sessionManager, registry);
    expect(session.metadata?.["sourceProjectId"]).toBe("project-2");
    expect(session.metadata?.["allocationScore"]).toBe("0.9");
  });

  it("warns but does not throw when session.metadata is undefined", async () => {
    const decision: AllocationDecision = {
      storyId: "1-1-alpha",
      agentId: "pool-agent",
      sourceProjectId: "project-2",
      targetProjectId: "project-1",
      score: 0.9,
      factors: { urgency: 0.5, priority: 0.7, affinity: 0.9, workload: 1.0 },
    };

    const sessionManager = {
      spawn: async () =>
        ({
          id: "pool-agent",
          projectId: "project-1",
          status: "working",
          // metadata intentionally omitted
        }) as Session,
    } as unknown as SessionManager;

    const registry = { register: vi.fn() } as unknown as AgentRegistry;

    // Should not throw
    const session = await executeCrossProjectAssignment(decision, sessionManager, registry);
    expect(session.metadata).toBeUndefined();
    expect(registry.register).toHaveBeenCalled();
  });

  it("propagates spawn errors", async () => {
    const decision: AllocationDecision = {
      storyId: "1-1-alpha",
      agentId: "pool-agent",
      sourceProjectId: "project-2",
      targetProjectId: "project-1",
      score: 0.9,
      factors: { urgency: 0.5, priority: 0.7, affinity: 0.9, workload: 1.0 },
    };

    const sessionManager = {
      spawn: async () => {
        throw new Error("Spawn failed: no available runtime");
      },
    } as unknown as SessionManager;

    const registry = { register: vi.fn() } as unknown as AgentRegistry;

    await expect(executeCrossProjectAssignment(decision, sessionManager, registry)).rejects.toThrow(
      "Spawn failed",
    );

    // Registry should not have been called if spawn failed
    expect(registry.register).not.toHaveBeenCalled();
  });
});
