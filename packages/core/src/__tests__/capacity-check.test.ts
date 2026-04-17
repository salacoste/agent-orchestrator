import { describe, it, expect } from "vitest";
import {
  checkCapacity,
  isAtCapacity,
  getCapacityStatus,
  resolveMaxCapacity,
  guardAssignment,
  CapacityExceededError,
} from "../capacity-check.js";
import type { OrchestratorConfig } from "../types.js";

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeConfig(
  options: {
    globalMax?: number;
    projects?: Record<
      string,
      {
        sharedPool?: { enabled: boolean; eligibleProjects: string[]; maxConcurrent?: number };
      }
    >;
  } = {},
): OrchestratorConfig {
  return {
    projects: (options.projects ?? {}) as OrchestratorConfig["projects"],
    configPath: "/tmp/test-config.yaml",
    maxConcurrentAgents: options.globalMax,
  } as unknown as OrchestratorConfig;
}

// ── resolveMaxCapacity ────────────────────────────────────────────────────────

describe("resolveMaxCapacity", () => {
  it("uses project-level maxConcurrent when pool enabled", () => {
    const config = makeConfig({
      projects: {
        p1: {
          sharedPool: { enabled: true, eligibleProjects: ["p2"], maxConcurrent: 5 },
        },
      },
    });
    expect(resolveMaxCapacity(config, "p1")).toBe(5);
  });

  it("falls back to global maxConcurrentAgents when no project config", () => {
    const config = makeConfig({ globalMax: 8 });
    expect(resolveMaxCapacity(config, "p1")).toBe(8);
  });

  it("falls back to DEFAULT_MAX_CONCURRENT (10) when no config", () => {
    const config = makeConfig();
    expect(resolveMaxCapacity(config)).toBe(10);
  });

  it("ignores project-level maxConcurrent when pool not enabled", () => {
    const config = makeConfig({
      projects: {
        p1: {
          sharedPool: { enabled: false, eligibleProjects: [], maxConcurrent: 3 },
        },
      },
    });
    expect(resolveMaxCapacity(config, "p1")).toBe(10); // Falls to default
  });

  it("ignores project-level when projectId is undefined", () => {
    const config = makeConfig({
      projects: {
        p1: {
          sharedPool: { enabled: true, eligibleProjects: ["p2"], maxConcurrent: 3 },
        },
      },
    });
    expect(resolveMaxCapacity(config)).toBe(10); // No project specified
  });
});

// ── checkCapacity ─────────────────────────────────────────────────────────────

describe("checkCapacity", () => {
  const config = makeConfig({
    projects: {
      p1: {
        sharedPool: { enabled: true, eligibleProjects: ["p2"], maxConcurrent: 5 },
      },
    },
  });

  it("returns correct capacity for agent under limit", () => {
    const result = checkCapacity("a1", 2, config, "p1");
    expect(result).toMatchObject({
      agentId: "a1",
      currentWorkload: 2,
      maxCapacity: 5,
      utilizationPercent: 40,
      availableSlots: 3,
      isAtCapacity: false,
      isNearCapacity: false,
    });
  });

  it("returns at-capacity when workload equals max", () => {
    const result = checkCapacity("a1", 5, config, "p1");
    expect(result).toMatchObject({
      isAtCapacity: true,
      isNearCapacity: false,
      availableSlots: 0,
      utilizationPercent: 100,
    });
  });

  it("returns at-capacity when workload exceeds max", () => {
    const result = checkCapacity("a1", 7, config, "p1");
    expect(result).toMatchObject({
      isAtCapacity: true,
      currentWorkload: 7,
      maxCapacity: 5,
      availableSlots: 0,
    });
  });

  it("returns near-capacity at 80% threshold", () => {
    // maxConcurrent=5, workload=4 → 80% → near capacity
    const result = checkCapacity("a1", 4, config, "p1");
    expect(result).toMatchObject({
      isNearCapacity: true,
      isAtCapacity: false,
      utilizationPercent: 80,
      availableSlots: 1,
    });
  });

  it("returns not near-capacity below 80%", () => {
    const result = checkCapacity("a1", 3, config, "p1");
    expect(result.utilizationPercent).toBe(60);
    expect(result.isNearCapacity).toBe(false);
  });

  it("handles zero workload", () => {
    const result = checkCapacity("a1", 0, config, "p1");
    expect(result).toMatchObject({
      currentWorkload: 0,
      utilizationPercent: 0,
      availableSlots: 5,
      isAtCapacity: false,
      isNearCapacity: false,
    });
  });

  it("uses global config when no project specified", () => {
    const globalConfig = makeConfig({ globalMax: 3 });
    const result = checkCapacity("a1", 2, globalConfig);
    expect(result.maxCapacity).toBe(3);
    expect(result.utilizationPercent).toBe(67);
  });

  it("uses default when no config at all", () => {
    const result = checkCapacity("a1", 5, makeConfig());
    expect(result.maxCapacity).toBe(10);
    expect(result.utilizationPercent).toBe(50);
  });

  it("clamps negative workload to 0", () => {
    const result = checkCapacity("a1", -3, config, "p1");
    expect(result.currentWorkload).toBe(0);
    expect(result.utilizationPercent).toBe(0);
    expect(result.availableSlots).toBe(5);
    expect(result.isAtCapacity).toBe(false);
  });

  it("treats maxConcurrent=0 as permanently at capacity", () => {
    const zeroConfig = makeConfig({
      projects: {
        p1: {
          sharedPool: { enabled: true, eligibleProjects: ["p2"], maxConcurrent: 0 },
        },
      },
    });
    const result = checkCapacity("a1", 0, zeroConfig, "p1");
    expect(result.maxCapacity).toBe(0);
    expect(result.isAtCapacity).toBe(true);
    expect(result.availableSlots).toBe(0);
  });
});

// ── isAtCapacity ──────────────────────────────────────────────────────────────

describe("isAtCapacity", () => {
  const config = makeConfig({
    projects: {
      p1: {
        sharedPool: { enabled: true, eligibleProjects: ["p2"], maxConcurrent: 3 },
      },
    },
  });

  it("returns true when at capacity", () => {
    expect(isAtCapacity("a1", 3, config, "p1")).toBe(true);
  });

  it("returns true when over capacity", () => {
    expect(isAtCapacity("a1", 5, config, "p1")).toBe(true);
  });

  it("returns false when under capacity", () => {
    expect(isAtCapacity("a1", 2, config, "p1")).toBe(false);
  });

  it("returns false when at zero workload", () => {
    expect(isAtCapacity("a1", 0, config, "p1")).toBe(false);
  });
});

// ── getCapacityStatus ─────────────────────────────────────────────────────────

describe("getCapacityStatus", () => {
  it("returns capacity results for all agents in map", () => {
    const config = makeConfig({ globalMax: 5 });
    const workload = new Map<string, number>([
      ["a1", 3],
      ["a2", 5],
      ["a3", 0],
    ]);

    const results = getCapacityStatus(workload, config);

    expect(results.size).toBe(3);
    expect(results.get("a1")?.isNearCapacity).toBe(false); // 3/5=60%, below 80% threshold
    expect(results.get("a2")?.isAtCapacity).toBe(true); // 5/5=100%
    expect(results.get("a3")?.availableSlots).toBe(5); // 0/5=0%
  });

  it("handles empty workload map", () => {
    const config = makeConfig();
    const results = getCapacityStatus(new Map(), config);
    expect(results.size).toBe(0);
  });

  it("uses project-specific limits when agentProjectMap provided", () => {
    const config = makeConfig({
      projects: {
        p1: {
          sharedPool: { enabled: true, eligibleProjects: ["p2"], maxConcurrent: 2 },
        },
        p2: {
          sharedPool: { enabled: false, eligibleProjects: [] },
        },
      },
    });

    const workload = new Map<string, number>([
      ["a1", 1],
      ["a2", 1],
    ]);
    const agentProjectMap = new Map<string, string>([
      ["a1", "p1"],
      ["a2", "p2"],
    ]);

    const results = getCapacityStatus(workload, config, agentProjectMap);

    // a1 is in pool project with maxConcurrent=2, workload=1 → 50%
    expect(results.get("a1")?.maxCapacity).toBe(2);
    // a2 is in non-pool project → default 10
    expect(results.get("a2")?.maxCapacity).toBe(10);
  });
});

// ── guardAssignment ───────────────────────────────────────────────────────────

describe("guardAssignment", () => {
  const config = makeConfig({
    projects: {
      p1: {
        sharedPool: { enabled: true, eligibleProjects: ["p2"], maxConcurrent: 3 },
      },
    },
  });

  it("allows assignment when under capacity", () => {
    const result = guardAssignment("a1", 2, config, { projectId: "p1" });
    expect(result.allowed).toBe(true);
    expect(result.forced).toBe(false);
    expect(result.reason).toBe("");
  });

  it("denies assignment when at capacity", () => {
    const result = guardAssignment("a1", 3, config, { projectId: "p1" });
    expect(result.allowed).toBe(false);
    expect(result.forced).toBe(false);
    expect(result.reason).toContain("at capacity");
    expect(result.capacity.isAtCapacity).toBe(true);
  });

  it("allows with forced flag when at capacity", () => {
    const result = guardAssignment("a1", 3, config, {
      force: true,
      projectId: "p1",
    });
    expect(result.allowed).toBe(true);
    expect(result.forced).toBe(true);
    expect(result.reason).toContain("force override");
  });

  it("includes capacity details in denial", () => {
    const result = guardAssignment("a1", 3, config, { projectId: "p1" });
    expect(result.capacity.currentWorkload).toBe(3);
    expect(result.capacity.maxCapacity).toBe(3);
    expect(result.capacity.availableSlots).toBe(0);
  });

  it("works without project context", () => {
    const globalConfig = makeConfig({ globalMax: 2 });
    const result = guardAssignment("a1", 2, globalConfig);
    expect(result.allowed).toBe(false);
    expect(result.capacity.maxCapacity).toBe(2);
  });
});

// ── CapacityExceededError ──────────────────────────────────────────────────────

describe("CapacityExceededError", () => {
  const config = makeConfig({
    projects: {
      p1: {
        sharedPool: { enabled: true, eligibleProjects: ["p2"], maxConcurrent: 3 },
      },
    },
  });

  it("includes agentId, workload, and capacity in message", () => {
    const capacity = checkCapacity("a1", 3, config, "p1");
    const error = new CapacityExceededError(capacity);
    expect(error.name).toBe("CapacityExceededError");
    expect(error.message).toContain("a1");
    expect(error.message).toContain("at capacity");
    expect(error.agentId).toBe("a1");
    expect(error.currentWorkload).toBe(3);
    expect(error.maxCapacity).toBe(3);
    expect(error.availableSlots).toBe(0);
  });

  it("is an instance of Error", () => {
    const capacity = checkCapacity("a1", 5, config, "p1");
    const error = new CapacityExceededError(capacity);
    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(CapacityExceededError);
  });

  it("can be caught in try/catch", () => {
    const capacity = checkCapacity("a1", 3, config, "p1");
    try {
      throw new CapacityExceededError(capacity);
    } catch (err) {
      expect(err).toBeInstanceOf(CapacityExceededError);
      if (err instanceof CapacityExceededError) {
        expect(err.agentId).toBe("a1");
        expect(err.maxCapacity).toBe(3);
      }
    }
  });
});
