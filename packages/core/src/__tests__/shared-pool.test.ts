import { describe, it, expect } from "vitest";
import {
  resolvePoolMemberships,
  validatePoolReferences,
  getEligibleProjects,
  getPoolProjects,
  canReceiveAgents,
  isAgentReserved,
  getReservedAgents,
  getAvailablePoolAgents,
} from "../shared-pool.js";
import type { OrchestratorConfig } from "../types.js";
import { validateConfig } from "../config.js";

function makeConfig(
  projects: Record<
    string,
    {
      sharedPool?: {
        enabled: boolean;
        eligibleProjects: string[];
        maxConcurrent?: number;
        reservedAgents?: string[];
      };
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

describe("resolvePoolMemberships", () => {
  it("returns memberships with enabled=false for projects without shared pool", () => {
    const config = makeConfig({
      "proj-a": {},
      "proj-b": {},
    });

    const memberships = resolvePoolMemberships(config);

    expect(memberships.get("proj-a")).toEqual({
      projectId: "proj-a",
      enabled: false,
      eligibleProjects: [],
    });
    expect(memberships.get("proj-b")).toEqual({
      projectId: "proj-b",
      enabled: false,
      eligibleProjects: [],
    });
  });

  it("returns enabled membership for projects with shared pool enabled", () => {
    const config = makeConfig({
      "proj-a": {
        sharedPool: { enabled: true, eligibleProjects: ["proj-b"] },
      },
      "proj-b": {},
    });

    const memberships = resolvePoolMemberships(config);

    expect(memberships.get("proj-a")).toEqual({
      projectId: "proj-a",
      enabled: true,
      eligibleProjects: ["proj-b"],
    });
  });

  it("expands wildcard * to all other project IDs", () => {
    const config = makeConfig({
      "proj-a": {
        sharedPool: { enabled: true, eligibleProjects: ["*"] },
      },
      "proj-b": {},
      "proj-c": {},
    });

    const memberships = resolvePoolMemberships(config);
    const membership = memberships.get("proj-a")!;

    expect(membership.enabled).toBe(true);
    expect(membership.eligibleProjects).toContain("proj-b");
    expect(membership.eligibleProjects).toContain("proj-c");
    expect(membership.eligibleProjects).not.toContain("proj-a");
  });

  it("preserves maxConcurrent when set", () => {
    const config = makeConfig({
      "proj-a": {
        sharedPool: { enabled: true, eligibleProjects: ["proj-b"], maxConcurrent: 3 },
      },
      "proj-b": {},
    });

    const memberships = resolvePoolMemberships(config);

    expect(memberships.get("proj-a")?.maxConcurrent).toBe(3);
  });

  it("returns undefined maxConcurrent when not set", () => {
    const config = makeConfig({
      "proj-a": {
        sharedPool: { enabled: true, eligibleProjects: ["proj-b"] },
      },
      "proj-b": {},
    });

    const memberships = resolvePoolMemberships(config);

    expect(memberships.get("proj-a")?.maxConcurrent).toBeUndefined();
  });

  it("treats disabled pool same as no pool", () => {
    const config = makeConfig({
      "proj-a": {
        sharedPool: { enabled: false, eligibleProjects: ["proj-b"] },
      },
    });

    const memberships = resolvePoolMemberships(config);

    expect(memberships.get("proj-a")?.enabled).toBe(false);
  });
});

describe("validatePoolReferences", () => {
  it("returns no warnings for valid references", () => {
    const config = makeConfig({
      "proj-a": {
        sharedPool: { enabled: true, eligibleProjects: ["proj-b"] },
      },
      "proj-b": {},
    });

    const warnings = validatePoolReferences(config);

    expect(warnings).toEqual([]);
  });

  it("returns warnings for invalid project references", () => {
    const config = makeConfig({
      "proj-a": {
        sharedPool: { enabled: true, eligibleProjects: ["proj-b", "nonexistent"] },
      },
      "proj-b": {},
    });

    const warnings = validatePoolReferences(config);

    expect(warnings).toHaveLength(1);
    expect(warnings[0].projectId).toBe("proj-a");
    expect(warnings[0].invalidReferences).toEqual(["nonexistent"]);
  });

  it("does not warn for wildcard * reference", () => {
    const config = makeConfig({
      "proj-a": {
        sharedPool: { enabled: true, eligibleProjects: ["*"] },
      },
    });

    const warnings = validatePoolReferences(config);

    expect(warnings).toEqual([]);
  });

  it("skips projects without shared pool", () => {
    const config = makeConfig({
      "proj-a": {},
      "proj-b": {},
    });

    const warnings = validatePoolReferences(config);

    expect(warnings).toEqual([]);
  });

  it("reports multiple invalid references", () => {
    const config = makeConfig({
      "proj-a": {
        sharedPool: { enabled: true, eligibleProjects: ["missing1", "missing2"] },
      },
    });

    const warnings = validatePoolReferences(config);

    expect(warnings[0].invalidReferences).toEqual(["missing1", "missing2"]);
  });
});

describe("getEligibleProjects", () => {
  it("returns eligible projects for a pool-enabled project", () => {
    const config = makeConfig({
      "proj-a": {
        sharedPool: { enabled: true, eligibleProjects: ["proj-b", "proj-c"] },
      },
      "proj-b": {},
      "proj-c": {},
    });

    const eligible = getEligibleProjects("proj-a", config);

    expect(eligible).toEqual(["proj-b", "proj-c"]);
  });

  it("expands wildcard to all other projects", () => {
    const config = makeConfig({
      "proj-a": {
        sharedPool: { enabled: true, eligibleProjects: ["*"] },
      },
      "proj-b": {},
      "proj-c": {},
    });

    const eligible = getEligibleProjects("proj-a", config);

    expect(eligible).toContain("proj-b");
    expect(eligible).toContain("proj-c");
    expect(eligible).not.toContain("proj-a");
  });

  it("returns empty array for non-existent project", () => {
    const config = makeConfig({ "proj-a": {} });

    expect(getEligibleProjects("nonexistent", config)).toEqual([]);
  });

  it("returns empty array for project without shared pool", () => {
    const config = makeConfig({ "proj-a": {} });

    expect(getEligibleProjects("proj-a", config)).toEqual([]);
  });

  it("filters out references to non-existent projects", () => {
    const config = makeConfig({
      "proj-a": {
        sharedPool: { enabled: true, eligibleProjects: ["proj-b", "ghost"] },
      },
      "proj-b": {},
    });

    const eligible = getEligibleProjects("proj-a", config);

    expect(eligible).toEqual(["proj-b"]);
  });
});

describe("getPoolProjects", () => {
  it("returns only pool-enabled project IDs", () => {
    const config = makeConfig({
      "proj-a": {
        sharedPool: { enabled: true, eligibleProjects: ["*"] },
      },
      "proj-b": {},
      "proj-c": {
        sharedPool: { enabled: true, eligibleProjects: ["proj-a"] },
      },
    });

    const poolProjects = getPoolProjects(config);

    expect(poolProjects).toContain("proj-a");
    expect(poolProjects).toContain("proj-c");
    expect(poolProjects).not.toContain("proj-b");
  });

  it("returns empty array when no projects have pool enabled", () => {
    const config = makeConfig({
      "proj-a": {},
      "proj-b": {},
    });

    expect(getPoolProjects(config)).toEqual([]);
  });
});

describe("canReceiveAgents", () => {
  it("returns true when target is eligible", () => {
    const config = makeConfig({
      "proj-a": {
        sharedPool: { enabled: true, eligibleProjects: ["proj-b"] },
      },
      "proj-b": {},
    });

    expect(canReceiveAgents("proj-a", "proj-b", config)).toBe(true);
  });

  it("returns false when target is not eligible", () => {
    const config = makeConfig({
      "proj-a": {
        sharedPool: { enabled: true, eligibleProjects: ["proj-b"] },
      },
      "proj-b": {},
      "proj-c": {},
    });

    expect(canReceiveAgents("proj-a", "proj-c", config)).toBe(false);
  });

  it("returns false when source has no pool", () => {
    const config = makeConfig({
      "proj-a": {},
      "proj-b": {},
    });

    expect(canReceiveAgents("proj-a", "proj-b", config)).toBe(false);
  });

  it("works with wildcard eligible projects", () => {
    const config = makeConfig({
      "proj-a": {
        sharedPool: { enabled: true, eligibleProjects: ["*"] },
      },
      "proj-b": {},
    });

    expect(canReceiveAgents("proj-a", "proj-b", config)).toBe(true);
  });
});

describe("SharedPoolConfig Zod schema validation", () => {
  function makeRawConfig(sharedPool?: Record<string, unknown>) {
    return {
      dataDir: "/tmp/test",
      worktreeDir: "/tmp/worktrees",
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

  it("parses valid shared pool config", () => {
    const raw = makeRawConfig({
      enabled: true,
      eligibleProjects: ["proj-b", "proj-c"],
      maxConcurrent: 3,
    });
    const config = validateConfig(raw);
    expect(config.projects["proj-a"].sharedPool).toEqual({
      enabled: true,
      eligibleProjects: ["proj-b", "proj-c"],
      maxConcurrent: 3,
    });
  });

  it("parses shared pool without maxConcurrent", () => {
    const raw = makeRawConfig({
      enabled: true,
      eligibleProjects: ["*"],
    });
    const config = validateConfig(raw);
    expect(config.projects["proj-a"].sharedPool?.enabled).toBe(true);
    expect(config.projects["proj-a"].sharedPool?.maxConcurrent).toBeUndefined();
  });

  it("rejects shared pool with missing enabled field", () => {
    const raw = makeRawConfig({
      eligibleProjects: ["proj-b"],
    });
    expect(() => validateConfig(raw)).toThrow();
  });

  it("rejects shared pool with non-boolean enabled", () => {
    const raw = makeRawConfig({
      enabled: "yes",
      eligibleProjects: ["proj-b"],
    });
    expect(() => validateConfig(raw)).toThrow();
  });

  it("rejects shared pool with non-array eligibleProjects", () => {
    const raw = makeRawConfig({
      enabled: true,
      eligibleProjects: "proj-b",
    });
    expect(() => validateConfig(raw)).toThrow();
  });

  it("rejects shared pool with negative maxConcurrent", () => {
    const raw = makeRawConfig({
      enabled: true,
      eligibleProjects: ["proj-b"],
      maxConcurrent: -1,
    });
    expect(() => validateConfig(raw)).toThrow();
  });

  it("rejects shared pool with zero maxConcurrent", () => {
    const raw = makeRawConfig({
      enabled: true,
      eligibleProjects: ["proj-b"],
      maxConcurrent: 0,
    });
    expect(() => validateConfig(raw)).toThrow();
  });

  it("rejects shared pool with non-integer maxConcurrent", () => {
    const raw = makeRawConfig({
      enabled: true,
      eligibleProjects: ["proj-b"],
      maxConcurrent: 2.5,
    });
    expect(() => validateConfig(raw)).toThrow();
  });

  it("allows project without sharedPool", () => {
    const raw = makeRawConfig();
    const config = validateConfig(raw);
    expect(config.projects["proj-a"].sharedPool).toBeUndefined();
  });

  it("parses shared pool with reservedAgents", () => {
    const raw = makeRawConfig({
      enabled: true,
      eligibleProjects: ["proj-b"],
      reservedAgents: ["critical-api-agent"],
    });
    const config = validateConfig(raw);
    expect(config.projects["proj-a"].sharedPool?.reservedAgents).toEqual(["critical-api-agent"]);
  });

  it("parses shared pool with empty reservedAgents", () => {
    const raw = makeRawConfig({
      enabled: true,
      eligibleProjects: ["proj-b"],
      reservedAgents: [],
    });
    const config = validateConfig(raw);
    expect(config.projects["proj-a"].sharedPool?.reservedAgents).toEqual([]);
  });

  it("parses shared pool without reservedAgents as undefined", () => {
    const raw = makeRawConfig({
      enabled: true,
      eligibleProjects: ["proj-b"],
    });
    const config = validateConfig(raw);
    expect(config.projects["proj-a"].sharedPool?.reservedAgents).toBeUndefined();
  });

  it("rejects non-array reservedAgents", () => {
    const raw = makeRawConfig({
      enabled: true,
      eligibleProjects: ["proj-b"],
      reservedAgents: "agent-1",
    });
    expect(() => validateConfig(raw)).toThrow();
  });
});

// =============================================================================
// AGENT RESERVATION TESTS (Story 50.2)
// =============================================================================

describe("isAgentReserved", () => {
  it("returns true when agent is reserved by any project", () => {
    const config = makeConfig({
      "proj-a": {
        sharedPool: {
          enabled: true,
          eligibleProjects: ["proj-b"],
          reservedAgents: ["critical-api-agent"],
        },
      },
      "proj-b": {},
    });

    expect(isAgentReserved("critical-api-agent", config)).toBe(true);
  });

  it("returns false when agent is not reserved by any project", () => {
    const config = makeConfig({
      "proj-a": {
        sharedPool: {
          enabled: true,
          eligibleProjects: ["proj-b"],
          reservedAgents: ["other-agent"],
        },
      },
      "proj-b": {},
    });

    expect(isAgentReserved("free-agent", config)).toBe(false);
  });

  it("returns false when no projects have reservedAgents", () => {
    const config = makeConfig({
      "proj-a": {
        sharedPool: { enabled: true, eligibleProjects: ["*"] },
      },
      "proj-b": {},
    });

    expect(isAgentReserved("any-agent", config)).toBe(false);
  });
});

describe("getReservedAgents", () => {
  it("returns reserved agents for a project", () => {
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

    expect(getReservedAgents("proj-a", config)).toEqual(["agent-1", "agent-2"]);
  });

  it("returns empty array for project with no reservations", () => {
    const config = makeConfig({
      "proj-a": {
        sharedPool: { enabled: true, eligibleProjects: ["proj-b"] },
      },
      "proj-b": {},
    });

    expect(getReservedAgents("proj-a", config)).toEqual([]);
  });

  it("returns empty array for project without shared pool", () => {
    const config = makeConfig({ "proj-a": {} });

    expect(getReservedAgents("proj-a", config)).toEqual([]);
  });

  it("returns empty array for non-existent project", () => {
    const config = makeConfig({ "proj-a": {} });

    expect(getReservedAgents("nonexistent", config)).toEqual([]);
  });
});

describe("getAvailablePoolAgents", () => {
  it("excludes reserved agents from available list", () => {
    const config = makeConfig({
      "proj-a": {
        sharedPool: {
          enabled: true,
          eligibleProjects: ["proj-b"],
          reservedAgents: ["reserved-1"],
        },
      },
      "proj-b": {},
    });

    const available = getAvailablePoolAgents(
      "proj-a",
      "proj-b",
      ["agent-1", "reserved-1", "agent-2"],
      config,
    );

    expect(available).toEqual(["agent-1", "agent-2"]);
  });

  it("returns all agents when none are reserved", () => {
    const config = makeConfig({
      "proj-a": {
        sharedPool: { enabled: true, eligibleProjects: ["proj-b"] },
      },
      "proj-b": {},
    });

    const available = getAvailablePoolAgents("proj-a", "proj-b", ["agent-1", "agent-2"], config);

    expect(available).toEqual(["agent-1", "agent-2"]);
  });

  it("returns empty array when target is not eligible", () => {
    const config = makeConfig({
      "proj-a": {
        sharedPool: { enabled: true, eligibleProjects: ["proj-b"] },
      },
      "proj-b": {},
      "proj-c": {},
    });

    const available = getAvailablePoolAgents("proj-a", "proj-c", ["agent-1"], config);

    expect(available).toEqual([]);
  });

  it("returns empty array when source has no pool", () => {
    const config = makeConfig({ "proj-a": {}, "proj-b": {} });

    const available = getAvailablePoolAgents("proj-a", "proj-b", ["agent-1"], config);

    expect(available).toEqual([]);
  });
});

describe("canReceiveAgents with agentId", () => {
  it("returns false for reserved agent", () => {
    const config = makeConfig({
      "proj-a": {
        sharedPool: {
          enabled: true,
          eligibleProjects: ["proj-b"],
          reservedAgents: ["critical-agent"],
        },
      },
      "proj-b": {},
    });

    expect(canReceiveAgents("proj-a", "proj-b", config, "critical-agent")).toBe(false);
  });

  it("returns true for non-reserved agent", () => {
    const config = makeConfig({
      "proj-a": {
        sharedPool: {
          enabled: true,
          eligibleProjects: ["proj-b"],
          reservedAgents: ["critical-agent"],
        },
      },
      "proj-b": {},
    });

    expect(canReceiveAgents("proj-a", "proj-b", config, "shareable-agent")).toBe(true);
  });

  it("returns true without agentId (backward compatible)", () => {
    const config = makeConfig({
      "proj-a": {
        sharedPool: {
          enabled: true,
          eligibleProjects: ["proj-b"],
          reservedAgents: ["critical-agent"],
        },
      },
      "proj-b": {},
    });

    expect(canReceiveAgents("proj-a", "proj-b", config)).toBe(true);
  });
});

describe("validatePoolReferences with reservedAgents", () => {
  it("warns on empty-string reserved agents", () => {
    const config = makeConfig({
      "proj-a": {
        sharedPool: {
          enabled: true,
          eligibleProjects: ["proj-b"],
          reservedAgents: ["", "valid-agent"],
        },
      },
      "proj-b": {},
    });

    const warnings = validatePoolReferences(config);

    expect(warnings).toHaveLength(1);
    expect(warnings[0].invalidReservedAgents).toContain("");
  });

  it("warns on duplicate reserved agents across projects", () => {
    const config = makeConfig({
      "proj-a": {
        sharedPool: {
          enabled: true,
          eligibleProjects: ["proj-b"],
          reservedAgents: ["shared-agent"],
        },
      },
      "proj-b": {
        sharedPool: {
          enabled: true,
          eligibleProjects: ["proj-a"],
          reservedAgents: ["shared-agent"],
        },
      },
    });

    const warnings = validatePoolReferences(config);

    // Both projects should have warnings about the duplicate
    expect(warnings.length).toBeGreaterThanOrEqual(1);
    const allInvalid = warnings.flatMap((w) => w.invalidReservedAgents ?? []);
    expect(allInvalid).toContain("shared-agent");
  });

  it("does not warn on valid unique reserved agents", () => {
    const config = makeConfig({
      "proj-a": {
        sharedPool: {
          enabled: true,
          eligibleProjects: ["proj-b"],
          reservedAgents: ["agent-a-1"],
        },
      },
      "proj-b": {
        sharedPool: {
          enabled: true,
          eligibleProjects: ["proj-a"],
          reservedAgents: ["agent-b-1"],
        },
      },
    });

    const warnings = validatePoolReferences(config);

    expect(warnings).toEqual([]);
  });

  it("warns when disabled pool has reservedAgents defined", () => {
    const config = makeConfig({
      "proj-a": {
        sharedPool: {
          enabled: false,
          eligibleProjects: ["proj-b"],
          reservedAgents: ["agent-x"],
        },
      },
      "proj-b": {},
    });

    const warnings = validatePoolReferences(config);

    expect(warnings).toHaveLength(1);
    expect(warnings[0].projectId).toBe("proj-a");
    expect(warnings[0].invalidReservedAgents).toContain("agent-x");
  });
});
