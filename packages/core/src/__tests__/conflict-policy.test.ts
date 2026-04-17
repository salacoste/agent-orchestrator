/**
 * Tests for conflict-policy.ts — Story 52.4
 *
 * Covers: resolvePolicyForResource, applyPolicy, config hierarchy,
 * priority-based resolution, isolation mode, manual mode.
 */

import { describe, it, expect } from "vitest";
import {
  resolvePolicyForResource,
  applyPolicy,
  type ResourceConflictPolicy,
} from "../conflict-policy.js";
import type { ResourceConflict } from "../resource-conflict.js";
import type { OrchestratorConfig } from "../types.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeConfig(
  overrides?: Partial<Pick<OrchestratorConfig, "conflictResolution" | "projects">>,
): OrchestratorConfig {
  return {
    configPath: "/tmp/test.yaml",
    readyThresholdMs: 300_000,
    defaults: { runtime: "tmux", agent: "claude-code", workspace: "worktree", notifiers: [] },
    projects: {},
    notifiers: {},
    notificationRouting: { urgent: [], action: [], warning: [], info: [] },
    reactions: {},
    ...overrides,
  } as OrchestratorConfig;
}

function makeConflict(overrides?: Partial<ResourceConflict>): ResourceConflict {
  return {
    id: "conflict-test-001",
    resourceType: "repository",
    resourceIdentifier: "org/repo",
    competingProjects: ["proj-a", "proj-b"],
    severity: "high",
    detectedAt: new Date().toISOString(),
    metadata: { competingCount: 2 },
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// resolvePolicyForResource — config hierarchy
// ---------------------------------------------------------------------------

describe("resolvePolicyForResource", () => {
  it("returns manual (hardcoded default) when no config is set", () => {
    const config = makeConfig();
    const policy = resolvePolicyForResource("repository", config);
    expect(policy.resolutionMode).toBe("manual");
    expect(policy.resourceType).toBe("repository");
  });

  it("uses global conflictResolution.default when set", () => {
    const config = makeConfig({
      conflictResolution: { default: "priority-based" },
    });
    const policy = resolvePolicyForResource("repository", config);
    expect(policy.resolutionMode).toBe("priority-based");
  });

  it("uses global conflictResolution.default for all resource types", () => {
    const config = makeConfig({
      conflictResolution: { default: "isolation" },
    });
    expect(resolvePolicyForResource("repository", config).resolutionMode).toBe("isolation");
    expect(resolvePolicyForResource("file-path", config).resolutionMode).toBe("isolation");
    expect(resolvePolicyForResource("agent", config).resolutionMode).toBe("isolation");
    expect(resolvePolicyForResource("external-service", config).resolutionMode).toBe("isolation");
  });

  it("uses project-level default when global is not set", () => {
    const config = makeConfig({
      projects: {
        "proj-a": {
          conflictResolution: { default: "isolation" },
        } as unknown as OrchestratorConfig["projects"][string],
      },
    });
    const policy = resolvePolicyForResource("repository", config, "proj-a");
    expect(policy.resolutionMode).toBe("isolation");
  });

  it("project per-type override takes highest priority", () => {
    const config = makeConfig({
      conflictResolution: { default: "isolation" },
      projects: {
        "proj-a": {
          conflictResolution: {
            default: "priority-based",
            policies: {
              repository: {
                resolutionMode: "manual",
                priorityOrder: ["proj-a", "proj-b"],
              },
            },
          },
        } as unknown as OrchestratorConfig["projects"][string],
      },
    });

    // Project-level per-type override
    const policy = resolvePolicyForResource("repository", config, "proj-a");
    expect(policy.resolutionMode).toBe("manual");
    expect(policy.priorityOrder).toEqual(["proj-a", "proj-b"]);

    // Without projectId, falls back to global default
    const globalPolicy = resolvePolicyForResource("repository", config);
    expect(globalPolicy.resolutionMode).toBe("isolation");
  });

  it("falls back through project default → global → hardcoded", () => {
    // No project-level per-type override → falls to project default
    const config = makeConfig({
      conflictResolution: { default: "isolation" },
      projects: {
        "proj-a": {
          conflictResolution: { default: "priority-based" },
        } as unknown as OrchestratorConfig["projects"][string],
      },
    });

    const policy = resolvePolicyForResource("file-path", config, "proj-a");
    expect(policy.resolutionMode).toBe("priority-based");
  });
});

// ---------------------------------------------------------------------------
// applyPolicy — manual mode
// ---------------------------------------------------------------------------

describe("applyPolicy", () => {
  it("returns 'none' action for manual mode", () => {
    const conflict = makeConflict();
    const policy: ResourceConflictPolicy = {
      resourceType: "repository",
      resolutionMode: "manual",
    };

    const result = applyPolicy(conflict, policy);
    expect(result.actionTaken).toBe("none");
    expect(result.conflictId).toBe("conflict-test-001");
    expect(result.details.resolvedBy).toEqual(["proj-a", "proj-b"]);
  });

  // ---------------------------------------------------------------------------
  // applyPolicy — priority-based mode
  // ---------------------------------------------------------------------------

  it("determines winner from priorityOrder", () => {
    const conflict = makeConflict({
      competingProjects: ["proj-b", "proj-a"],
    });
    const policy: ResourceConflictPolicy = {
      resourceType: "repository",
      resolutionMode: "priority-based",
      priorityOrder: ["proj-a", "proj-b"],
    };

    const result = applyPolicy(conflict, policy);
    expect(result.actionTaken).toBe("priority-awarded");
    expect(result.details.winner).toBe("proj-a");
    expect(result.details.deferred).toEqual(["proj-b"]);
  });

  it("uses shared pool priority when no priorityOrder", () => {
    const conflict = makeConflict({
      competingProjects: ["proj-a", "proj-b"],
    });
    const policy: ResourceConflictPolicy = {
      resourceType: "agent",
      resolutionMode: "priority-based",
    };
    const config = makeConfig({
      projects: {
        "proj-a": {
          sharedPool: { enabled: true, eligibleProjects: ["*"], priority: 5 },
        } as unknown as OrchestratorConfig["projects"][string],
        "proj-b": {
          sharedPool: { enabled: true, eligibleProjects: ["*"], priority: 2 },
        } as unknown as OrchestratorConfig["projects"][string],
      },
    });

    const result = applyPolicy(conflict, policy, config);
    expect(result.actionTaken).toBe("priority-awarded");
    expect(result.details.winner).toBe("proj-a");
  });

  it("falls back to alphabetical tiebreaker", () => {
    const conflict = makeConflict({
      competingProjects: ["proj-z", "proj-a"],
    });
    const policy: ResourceConflictPolicy = {
      resourceType: "repository",
      resolutionMode: "priority-based",
    };
    // No priorityOrder, no sharedPool priority → alphabetical
    const result = applyPolicy(conflict, policy);
    expect(result.details.winner).toBe("proj-a");
    expect(result.details.deferred).toEqual(["proj-z"]);
  });

  // ---------------------------------------------------------------------------
  // applyPolicy — isolation mode
  // ---------------------------------------------------------------------------

  it("generates isolation plan for isolation mode", () => {
    const conflict = makeConflict({
      resourceType: "repository",
      competingProjects: ["proj-a", "proj-b"],
    });
    const policy: ResourceConflictPolicy = {
      resourceType: "repository",
      resolutionMode: "isolation",
    };

    const result = applyPolicy(conflict, policy);
    expect(result.actionTaken).toBe("isolated");
    expect(result.details.isolationPlan).toEqual([
      { projectId: "proj-a", strategy: "branch-per-project" },
      { projectId: "proj-b", strategy: "branch-per-project" },
    ]);
  });

  it("uses custom isolation strategy when provided", () => {
    const conflict = makeConflict({
      resourceType: "file-path",
      competingProjects: ["proj-a", "proj-b"],
    });
    const policy: ResourceConflictPolicy = {
      resourceType: "file-path",
      resolutionMode: "isolation",
      isolationConfig: { strategy: "separate-worktree" },
    };

    const result = applyPolicy(conflict, policy);
    expect(result.details.isolationPlan).toEqual([
      { projectId: "proj-a", strategy: "separate-worktree" },
      { projectId: "proj-b", strategy: "separate-worktree" },
    ]);
  });

  it("uses default strategies per resource type when strategy is 'default'", () => {
    const agentConflict = makeConflict({
      resourceType: "agent",
      competingProjects: ["proj-a", "proj-b"],
    });
    const policy: ResourceConflictPolicy = {
      resourceType: "agent",
      resolutionMode: "isolation",
      isolationConfig: { strategy: "default" },
    };

    const result = applyPolicy(agentConflict, policy);
    expect(result.details.isolationPlan).toEqual([
      { projectId: "proj-a", strategy: "dedicated-agent" },
      { projectId: "proj-b", strategy: "dedicated-agent" },
    ]);

    const extConflict = makeConflict({
      resourceType: "external-service",
      competingProjects: ["proj-a", "proj-b"],
    });
    const extPolicy: ResourceConflictPolicy = {
      resourceType: "external-service",
      resolutionMode: "isolation",
      isolationConfig: { strategy: "default" },
    };
    const extResult = applyPolicy(extConflict, extPolicy);
    expect(extResult.details.isolationPlan).toEqual([
      { projectId: "proj-a", strategy: "isolated" },
      { projectId: "proj-b", strategy: "isolated" },
    ]);
  });
});
