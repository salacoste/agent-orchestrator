import { describe, it, expect } from "vitest";
import {
  computeUrgencyScore,
  computePriorityScore,
  computeWorkloadScore,
  computeAllocationScore,
  allocateAgents,
  type AllocationRequest,
  type AllocationStory,
  type AllocationFactors,
  type CapacitySkip,
} from "../pool-allocation.js";
import type { OrchestratorConfig, SharedPoolConfig } from "../types.js";
import { validateConfig } from "../config.js";

function makeConfig(
  projects: Record<
    string,
    {
      sharedPool?: SharedPoolConfig;
    }
  >,
): OrchestratorConfig {
  const result: OrchestratorConfig = {
    configPath: "/tmp/test/agent-orchestrator.yaml",
    port: 5000,
    readyThresholdMs: 300_000,
    defaults: { runtime: "tmux", agent: "claude-code", workspace: "worktree", notifiers: [] },
    projects: {},
    notifiers: {},
    notificationRouting: {
      urgent: ["desktop"],
      action: ["desktop"],
      warning: ["desktop"],
      info: ["desktop"],
    },
    reactions: {},
  };

  for (const [id, overrides] of Object.entries(projects)) {
    result.projects[id] = {
      name: id,
      repo: `org/${id}`,
      path: `/tmp/${id}`,
      defaultBranch: "main",
      sessionPrefix: id,
      sharedPool: overrides.sharedPool,
    };
  }

  return result;
}

function makeStory(
  overrides: Partial<AllocationStory> & { storyId: string; projectId: string },
): AllocationStory {
  return {
    priority: 0,
    position: 0,
    ...overrides,
  };
}

// =============================================================================
// SCORING FUNCTION TESTS
// =============================================================================

describe("computeUrgencyScore", () => {
  it("maps critical to 1.0", () => {
    expect(computeUrgencyScore("critical")).toBe(1.0);
  });

  it("maps high to 0.75", () => {
    expect(computeUrgencyScore("high")).toBe(0.75);
  });

  it("maps normal to 0.5", () => {
    expect(computeUrgencyScore("normal")).toBe(0.5);
  });

  it("maps low to 0.25", () => {
    expect(computeUrgencyScore("low")).toBe(0.25);
  });

  it("defaults to 0.5 for undefined", () => {
    expect(computeUrgencyScore(undefined)).toBe(0.5);
  });
});

describe("computePriorityScore", () => {
  it("returns 0.5 when project priority is undefined", () => {
    expect(computePriorityScore(undefined, 10)).toBe(0.5);
  });

  it("normalizes priority against max", () => {
    expect(computePriorityScore(5, 10)).toBe(0.5);
  });

  it("returns 1.0 for max priority", () => {
    expect(computePriorityScore(10, 10)).toBe(1);
  });

  it("returns 0.5 when maxPriority is 0", () => {
    expect(computePriorityScore(5, 0)).toBe(0.5);
  });

  it("clamps to 1.0 when priority exceeds max", () => {
    expect(computePriorityScore(15, 10)).toBe(1);
  });
});

describe("computeWorkloadScore", () => {
  it("returns 1.0 for idle agent", () => {
    expect(computeWorkloadScore(0, 5)).toBe(1);
  });

  it("returns 0.8 for 1 of 5 capacity", () => {
    expect(computeWorkloadScore(1, 5)).toBeCloseTo(0.8);
  });

  it("returns 0 for agent at max capacity", () => {
    expect(computeWorkloadScore(5, 5)).toBe(0);
  });

  it("returns 0 for agent over capacity", () => {
    expect(computeWorkloadScore(6, 5)).toBe(0);
  });

  it("uses default capacity when maxConcurrent is undefined", () => {
    expect(computeWorkloadScore(0, undefined)).toBe(1);
    expect(computeWorkloadScore(10, undefined)).toBe(0); // 10 >= 10 (DEFAULT_MAX_CONCURRENT)
  });

  it("clamps negative workload to 0 (guards against bad data)", () => {
    expect(computeWorkloadScore(-1, 5)).toBe(1); // treated as 0 active
    expect(computeWorkloadScore(-5, 5)).toBe(1); // treated as 0 active
  });
});

describe("computeAllocationScore", () => {
  it("computes weighted sum with default weights", () => {
    const factors: AllocationFactors = {
      urgency: 1.0,
      priority: 0.5,
      affinity: 0.5,
      workload: 1.0,
    };
    // Default weights: urgency=0.3, priority=0.3, affinity=0.25, workload=0.15
    // total=1.0, score = 0.3*1 + 0.3*0.5 + 0.25*0.5 + 0.15*1 = 0.3 + 0.15 + 0.125 + 0.15 = 0.725
    expect(computeAllocationScore(factors)).toBeCloseTo(0.725);
  });

  it("uses custom weights", () => {
    const factors: AllocationFactors = {
      urgency: 1.0,
      priority: 0.0,
      affinity: 0.0,
      workload: 0.0,
    };
    const score = computeAllocationScore(factors, {
      urgency: 1,
      priority: 0,
      affinity: 0,
      workload: 0,
    });
    expect(score).toBeCloseTo(1.0);
  });

  it("returns 0 when all weights are 0", () => {
    const factors: AllocationFactors = { urgency: 1, priority: 1, affinity: 1, workload: 1 };
    expect(
      computeAllocationScore(factors, { urgency: 0, priority: 0, affinity: 0, workload: 0 }),
    ).toBe(0);
  });
});

// =============================================================================
// ALLOCATION ALGORITHM TESTS
// =============================================================================

describe("allocateAgents", () => {
  it("returns empty for no pool projects", () => {
    const config = makeConfig({ "proj-a": {} });
    const request: AllocationRequest = {
      config,
      stories: [makeStory({ storyId: "s1", projectId: "proj-a" })],
      agentWorkload: new Map(),
      projectAgents: new Map([["proj-a", ["agent-1"]]]),
    };
    expect(allocateAgents(request)).toEqual([]);
  });

  it("returns empty for no stories", () => {
    const config = makeConfig({
      "proj-a": { sharedPool: { enabled: true, eligibleProjects: ["*"] } },
    });
    const request: AllocationRequest = {
      config,
      stories: [],
      agentWorkload: new Map(),
      projectAgents: new Map([["proj-a", ["agent-1"]]]),
    };
    expect(allocateAgents(request)).toEqual([]);
  });

  it("returns empty when no agents available", () => {
    const config = makeConfig({
      "proj-a": { sharedPool: { enabled: true, eligibleProjects: ["*"] } },
    });
    const request: AllocationRequest = {
      config,
      stories: [makeStory({ storyId: "s1", projectId: "proj-a" })],
      agentWorkload: new Map(),
      projectAgents: new Map([["proj-a", []]]),
    };
    expect(allocateAgents(request)).toEqual([]);
  });

  it("allocates agent to story within same project", () => {
    const config = makeConfig({
      "proj-a": { sharedPool: { enabled: true, eligibleProjects: ["*"] } },
    });
    const request: AllocationRequest = {
      config,
      stories: [makeStory({ storyId: "s1", projectId: "proj-a" })],
      agentWorkload: new Map(),
      projectAgents: new Map([["proj-a", ["agent-1"]]]),
    };
    const decisions = allocateAgents(request);
    expect(decisions).toHaveLength(1);
    expect(decisions[0].storyId).toBe("s1");
    expect(decisions[0].agentId).toBe("agent-1");
    expect(decisions[0].sourceProjectId).toBe("proj-a");
  });

  it("allocates agent across projects", () => {
    const config = makeConfig({
      "proj-a": { sharedPool: { enabled: true, eligibleProjects: ["proj-b"] } },
      "proj-b": {},
    });
    const request: AllocationRequest = {
      config,
      stories: [makeStory({ storyId: "s1", projectId: "proj-b" })],
      agentWorkload: new Map(),
      projectAgents: new Map([["proj-a", ["agent-1"]]]),
    };
    const decisions = allocateAgents(request);
    expect(decisions).toHaveLength(1);
    expect(decisions[0].sourceProjectId).toBe("proj-a");
    expect(decisions[0].targetProjectId).toBe("proj-b");
  });

  it("excludes reserved agents from cross-project allocation", () => {
    const config = makeConfig({
      "proj-a": {
        sharedPool: {
          enabled: true,
          eligibleProjects: ["proj-b"],
          reservedAgents: ["agent-1"],
        },
      },
      "proj-b": {},
    });
    const request: AllocationRequest = {
      config,
      stories: [makeStory({ storyId: "s1", projectId: "proj-b" })],
      agentWorkload: new Map(),
      projectAgents: new Map([["proj-a", ["agent-1", "agent-2"]]]),
    };
    const decisions = allocateAgents(request);
    expect(decisions).toHaveLength(1);
    expect(decisions[0].agentId).toBe("agent-2");
  });

  it("allows reserved agents on their own project's stories", () => {
    const config = makeConfig({
      "proj-a": {
        sharedPool: {
          enabled: true,
          eligibleProjects: ["proj-b"],
          reservedAgents: ["agent-1"],
        },
      },
      "proj-b": {},
    });
    const request: AllocationRequest = {
      config,
      stories: [makeStory({ storyId: "s1", projectId: "proj-a" })],
      agentWorkload: new Map(),
      projectAgents: new Map([["proj-a", ["agent-1"]]]),
    };
    const decisions = allocateAgents(request);
    expect(decisions).toHaveLength(1);
    expect(decisions[0].agentId).toBe("agent-1");
  });

  it("excludes agents at max concurrent capacity", () => {
    const config = makeConfig({
      "proj-a": { sharedPool: { enabled: true, eligibleProjects: ["*"], maxConcurrent: 2 } },
    });
    const request: AllocationRequest = {
      config,
      stories: [makeStory({ storyId: "s1", projectId: "proj-a" })],
      agentWorkload: new Map([["agent-1", 2]]), // At capacity
      projectAgents: new Map([["proj-a", ["agent-1"]]]),
    };
    expect(allocateAgents(request)).toEqual([]);
  });

  it("ranks higher-urgency stories first", () => {
    const config = makeConfig({
      "proj-a": { sharedPool: { enabled: true, eligibleProjects: ["*"] } },
    });
    const request: AllocationRequest = {
      config,
      stories: [
        makeStory({
          storyId: "s-low",
          projectId: "proj-a",
          urgency: "low",
          priority: 0,
          position: 0,
        }),
        makeStory({
          storyId: "s-critical",
          projectId: "proj-a",
          urgency: "critical",
          priority: 0,
          position: 1,
        }),
      ],
      agentWorkload: new Map(),
      projectAgents: new Map([["proj-a", ["agent-1", "agent-2"]]]),
    };
    const decisions = allocateAgents(request);
    // Critical story should get first pick of agents
    expect(decisions[0].storyId).toBe("s-critical");
  });

  it("deduplicates: each story gets at most one agent", () => {
    const config = makeConfig({
      "proj-a": { sharedPool: { enabled: true, eligibleProjects: ["*"] } },
    });
    const request: AllocationRequest = {
      config,
      stories: [
        makeStory({ storyId: "s1", projectId: "proj-a" }),
        makeStory({ storyId: "s2", projectId: "proj-a" }),
      ],
      agentWorkload: new Map(),
      projectAgents: new Map([["proj-a", ["agent-1"]]]),
    };
    // Only 1 agent, so only 1 story gets assigned
    const decisions = allocateAgents(request);
    expect(decisions).toHaveLength(1);
  });

  it("deduplicates: each agent gets at most one story", () => {
    const config = makeConfig({
      "proj-a": { sharedPool: { enabled: true, eligibleProjects: ["*"] } },
    });
    const request: AllocationRequest = {
      config,
      stories: [makeStory({ storyId: "s1", projectId: "proj-a" })],
      agentWorkload: new Map(),
      projectAgents: new Map([["proj-a", ["agent-1", "agent-2"]]]),
    };
    // 2 agents available for 1 story, only 1 should be assigned
    const decisions = allocateAgents(request);
    expect(decisions).toHaveLength(1);
  });

  it("breaks ties by story priority then FIFO position", () => {
    const config = makeConfig({
      "proj-a": { sharedPool: { enabled: true, eligibleProjects: ["*"] } },
    });
    const request: AllocationRequest = {
      config,
      stories: [
        makeStory({ storyId: "s-low-pri", projectId: "proj-a", priority: 1, position: 0 }),
        makeStory({ storyId: "s-high-pri", projectId: "proj-a", priority: 5, position: 1 }),
      ],
      agentWorkload: new Map(),
      projectAgents: new Map([["proj-a", ["agent-1", "agent-2"]]]),
    };
    const decisions = allocateAgents(request);
    // Both stories have same urgency (undefined=normal), but s-high-pri has higher sprint priority
    const storyIds = decisions.map((d) => d.storyId);
    expect(storyIds.indexOf("s-high-pri")).toBeLessThan(storyIds.indexOf("s-low-pri"));
  });

  it("handles all agents reserved (returns empty for cross-project)", () => {
    const config = makeConfig({
      "proj-a": {
        sharedPool: {
          enabled: true,
          eligibleProjects: ["proj-b"],
          reservedAgents: ["agent-1", "agent-2"],
        },
      },
      "proj-b": {},
    });
    const request: AllocationRequest = {
      config,
      stories: [makeStory({ storyId: "s1", projectId: "proj-b" })],
      agentWorkload: new Map(),
      projectAgents: new Map([["proj-a", ["agent-1", "agent-2"]]]),
    };
    expect(allocateAgents(request)).toEqual([]);
  });

  it("uses pre-computed affinity scores when provided", () => {
    const config = makeConfig({
      "proj-a": { sharedPool: { enabled: true, eligibleProjects: ["*"] } },
    });
    const affinityScores = new Map([
      ["agent-1:s1", 0.9],
      ["agent-2:s1", 0.2],
    ]);
    const request: AllocationRequest = {
      config,
      stories: [makeStory({ storyId: "s1", projectId: "proj-a" })],
      agentWorkload: new Map(),
      affinityScores,
      projectAgents: new Map([["proj-a", ["agent-1", "agent-2"]]]),
    };
    const decisions = allocateAgents(request);
    expect(decisions).toHaveLength(1);
    expect(decisions[0].agentId).toBe("agent-1"); // Higher affinity wins
    expect(decisions[0].factors.affinity).toBe(0.9);
  });

  it("defaults affinity to 0.5 when no scores provided", () => {
    const config = makeConfig({
      "proj-a": { sharedPool: { enabled: true, eligibleProjects: ["*"] } },
    });
    const request: AllocationRequest = {
      config,
      stories: [makeStory({ storyId: "s1", projectId: "proj-a" })],
      agentWorkload: new Map(),
      projectAgents: new Map([["proj-a", ["agent-1"]]]),
    };
    const decisions = allocateAgents(request);
    expect(decisions[0].factors.affinity).toBe(0.5);
  });

  it("respects custom allocation weights", () => {
    const config = makeConfig({
      "proj-a": {
        sharedPool: {
          enabled: true,
          eligibleProjects: ["*"],
          allocationWeights: { urgency: 1, priority: 0, affinity: 0, workload: 0 },
        },
      },
    });
    const request: AllocationRequest = {
      config,
      stories: [
        makeStory({ storyId: "s-critical", projectId: "proj-a", urgency: "critical" }),
        makeStory({ storyId: "s-low", projectId: "proj-a", urgency: "low" }),
      ],
      agentWorkload: new Map(),
      projectAgents: new Map([["proj-a", ["agent-1"]]]),
    };
    const decisions = allocateAgents(request);
    // Only urgency matters → critical should always win
    expect(decisions[0].storyId).toBe("s-critical");
    expect(decisions[0].score).toBeCloseTo(1.0);
  });

  it("allocates agents from multiple source projects to same story", () => {
    const config = makeConfig({
      "proj-a": { sharedPool: { enabled: true, eligibleProjects: ["proj-c"] } },
      "proj-b": { sharedPool: { enabled: true, eligibleProjects: ["proj-c"] } },
      "proj-c": {},
    });
    const request: AllocationRequest = {
      config,
      stories: [makeStory({ storyId: "s1", projectId: "proj-c" })],
      agentWorkload: new Map(),
      affinityScores: new Map([
        ["agent-a:s1", 0.9],
        ["agent-b:s1", 0.3],
      ]),
      projectAgents: new Map([
        ["proj-a", ["agent-a"]],
        ["proj-b", ["agent-b"]],
      ]),
    };
    const decisions = allocateAgents(request);
    expect(decisions).toHaveLength(1);
    expect(decisions[0].agentId).toBe("agent-a"); // Higher affinity wins
    expect(decisions[0].targetProjectId).toBe("proj-c");
  });

  it("returns empty when story belongs to non-pool project and no cross-project path", () => {
    const config = makeConfig({
      "proj-a": { sharedPool: { enabled: true, eligibleProjects: ["proj-b"] } },
      "proj-b": {},
      "proj-c": {}, // Non-pool project with a story
    });
    const request: AllocationRequest = {
      config,
      stories: [makeStory({ storyId: "s1", projectId: "proj-c" })],
      agentWorkload: new Map(),
      projectAgents: new Map([["proj-c", ["agent-1"]]]),
    };
    // proj-c has no sharedPool, so its agents aren't pool agents
    // proj-a only sends to proj-b, not proj-c
    expect(allocateAgents(request)).toEqual([]);
  });

  it("calls onCapacitySkip when agent is at capacity", () => {
    const config = makeConfig({
      "proj-a": {
        sharedPool: { enabled: true, eligibleProjects: ["*"], maxConcurrent: 2 },
      },
    });
    const skips: CapacitySkip[] = [];
    const request: AllocationRequest = {
      config,
      stories: [makeStory({ storyId: "s1", projectId: "proj-a" })],
      agentWorkload: new Map([["agent-1", 2]]), // At capacity
      projectAgents: new Map([["proj-a", ["agent-1"]]]),
      onCapacitySkip: (skip) => skips.push(skip),
    };
    expect(allocateAgents(request)).toEqual([]);
    expect(skips).toHaveLength(1);
    expect(skips[0]).toMatchObject({
      agentId: "agent-1",
      storyId: "s1",
      sourceProjectId: "proj-a",
      currentWorkload: 2,
      maxCapacity: 2,
    });
  });
});

// =============================================================================
// PERFORMANCE TEST
// =============================================================================

describe("allocateAgents performance", () => {
  it("completes within 500ms for 100 agents across 50 projects", () => {
    // Build config with 50 projects, each with pool enabled
    const projects: Record<
      string,
      { sharedPool: { enabled: boolean; eligibleProjects: string[]; priority?: number } }
    > = {};
    for (let i = 0; i < 50; i++) {
      projects[`proj-${i}`] = {
        sharedPool: { enabled: true, eligibleProjects: ["*"], priority: i },
      };
    }
    const config = makeConfig(projects);

    // 100 agents spread across projects (2 per project)
    const projectAgents = new Map<string, string[]>();
    for (let i = 0; i < 50; i++) {
      projectAgents.set(`proj-${i}`, [`agent-${i * 2}`, `agent-${i * 2 + 1}`]);
    }

    // 100 stories across 50 projects
    const stories: AllocationStory[] = [];
    for (let i = 0; i < 50; i++) {
      stories.push(
        makeStory({
          storyId: `story-${i * 2}`,
          projectId: `proj-${i}`,
          priority: i,
          position: i * 2,
        }),
      );
      stories.push(
        makeStory({
          storyId: `story-${i * 2 + 1}`,
          projectId: `proj-${i}`,
          priority: i,
          position: i * 2 + 1,
        }),
      );
    }

    const request: AllocationRequest = {
      config,
      stories,
      agentWorkload: new Map(),
      projectAgents,
    };

    const start = performance.now();
    const decisions = allocateAgents(request);
    const elapsed = performance.now() - start;

    expect(elapsed).toBeLessThan(500);
    expect(decisions.length).toBeGreaterThan(0);
  });
});

// =============================================================================
// ZOD SCHEMA TESTS
// =============================================================================

describe("SharedPoolConfig Zod schema — allocation fields", () => {
  function makeRawConfig(sharedPool?: Record<string, unknown>) {
    return {
      port: 5000,
      defaults: { runtime: "tmux", agent: "claude-code", workspace: "worktree", notifiers: [] },
      projects: {
        "proj-a": {
          name: "Project A",
          repo: "org/proj-a",
          path: "/tmp/proj-a",
          defaultBranch: "main",
          ...(sharedPool ? { sharedPool } : {}),
        },
      },
      notifiers: {},
      notificationRouting: {},
      reactions: {},
      autopilot: "off",
    };
  }

  it("parses shared pool with priority", () => {
    const raw = makeRawConfig({
      enabled: true,
      eligibleProjects: ["proj-b"],
      priority: 10,
    });
    const config = validateConfig(raw);
    expect(config.projects["proj-a"].sharedPool?.priority).toBe(10);
  });

  it("parses shared pool with allocationWeights", () => {
    const raw = makeRawConfig({
      enabled: true,
      eligibleProjects: ["proj-b"],
      allocationWeights: { urgency: 0.5, priority: 0.3, affinity: 0.1, workload: 0.1 },
    });
    const config = validateConfig(raw);
    expect(config.projects["proj-a"].sharedPool?.allocationWeights).toEqual({
      urgency: 0.5,
      priority: 0.3,
      affinity: 0.1,
      workload: 0.1,
    });
  });

  it("parses shared pool without priority or allocationWeights", () => {
    const raw = makeRawConfig({
      enabled: true,
      eligibleProjects: ["proj-b"],
    });
    const config = validateConfig(raw);
    expect(config.projects["proj-a"].sharedPool?.priority).toBeUndefined();
    expect(config.projects["proj-a"].sharedPool?.allocationWeights).toBeUndefined();
  });

  it("rejects negative priority", () => {
    const raw = makeRawConfig({
      enabled: true,
      eligibleProjects: ["proj-b"],
      priority: -1,
    });
    expect(() => validateConfig(raw)).toThrow();
  });

  it("rejects allocationWeights with values outside 0-1", () => {
    const raw = makeRawConfig({
      enabled: true,
      eligibleProjects: ["proj-b"],
      allocationWeights: { urgency: 1.5 },
    });
    expect(() => validateConfig(raw)).toThrow();
  });
});
