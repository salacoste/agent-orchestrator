/**
 * * Conflict Policy — types, resolution engine, config helpers (Epic 52, Story 52.4).
 *
 * Pure functions that analyze detected resource conflicts and generate auto-resolution
 * action plans based on configurable policies. Policies define what strategy to use
 * (priority-based, isolation, manual) for each resource type.
 *
 * * Config hierarchy: project override → global default → hardcoded "manual"
 *
 * * NFR-F4-1: Policy resolution adds <1ms overhead (config lookup)
 * * NFR-F4-2: Scales to 50 projects with per-project overrides — O(1) lookup
 * * NFR-P4: Policy API responds within 200ms
 */

import type { ResourceConflictType, ResourceConflict } from "./resource-conflict.js";
import type { OrchestratorConfig } from "./types.js";

// =============================================================================
// TYPES
// =============================================================================

/** Conflict resolution mode — determines how conflicts are auto-resolved. */
export type ConflictResolutionMode = "priority-based" | "manual" | "isolation";

/** Policy for a specific resource type. */
export interface ResourceConflictPolicy {
  /** Which resource type this policy applies to. */
  resourceType: ResourceConflictType;
  /** Resolution mode: priority-based, isolation, or manual. */
  resolutionMode: ConflictResolutionMode;
  /** Explicit priority order (higher priority first). Used for priority-based mode. */
  priorityOrder?: string[];
  /** Isolation config details. Used for isolation mode. */
  isolationConfig?: {
    /** Resource-type-specific isolation strategy (e.g., branch-per-project, separate-worktree, dedicated-agent). */
    strategy: string;
  };
  /** Where this policy was resolved from: "project-type", "project-default", "global", or "hardcoded". */
  source?: string;
}

/** Policy configuration for the conflict resolution system. */
export interface ResourceConflictPolicyConfig {
  /** Default resolution mode for unconfigured resource types. */
  default: ConflictResolutionMode;
  /** Per-resource-type policies. */
  policies?: Partial<Record<ResourceConflictType, ResourceConflictPolicy>>;
}

/** Global conflict resolution config at OrchestratorConfig level. */
export interface GlobalConflictResolutionConfig {
  /** Default resolution mode for all resource types. */
  default: ConflictResolutionMode;
}

/** Result of applying a conflict resolution policy. */
export interface PolicyResolutionResult {
  /** The conflict that was resolved. */
  conflictId: string;
  /** The policy that was applied. */
  policy: ResourceConflictPolicy;
  /** What action was taken. */
  actionTaken: "none" | "priority-awarded" | "isolated" | "deferred";
  /** Details of the action taken. */
  details: {
    /** Winner project ID (priority-based mode). */
    winner?: string;
    /** Deferred project IDs (priority-based mode). */
    deferred?: string[];
    /** Isolation plan entries (isolation mode). */
    isolationPlan?: Array<{
      projectId: string;
      strategy: string;
    }>;
    /** All competing projects in this conflict. */
    resolvedBy: string[];
  };
}

// =============================================================================
// CONSTANTS
// =============================================================================

/** Hardcoded default resolution mode. */
const DEFAULT_RESOLUTION_MODE: ConflictResolutionMode = "manual";

// =============================================================================
// CONFIG RESOLUTION
// =============================================================================

/**
 * Resolve the effective policy for a resource type using the config hierarchy:
 * 1. project.conflictResolution.policies[resourceType].resolutionMode
 * 2. project.conflictResolution.default
 * 3. global conflictResolution.default
 * 4. "manual" (hardcoded default)
 *
 * @param resourceType - Resource type to resolve policy for
 * @param config - Orchestrator config
 * @param projectId - Optional project ID for project-level override lookup
 * @returns The effective policy for the resource type
 */
export function resolvePolicyForResource(
  resourceType: ResourceConflictType,
  config: OrchestratorConfig,
  projectId?: string,
): ResourceConflictPolicy {
  // 1. Project-level per-type override
  if (projectId) {
    const project = config.projects[projectId] as
      | { conflictResolution?: ResourceConflictPolicyConfig }
      | undefined;

    if (project?.conflictResolution?.policies?.[resourceType]) {
      return {
        resourceType,
        resolutionMode: project.conflictResolution.policies[resourceType].resolutionMode,
        priorityOrder: project.conflictResolution.policies[resourceType].priorityOrder,
        isolationConfig: project.conflictResolution.policies[resourceType].isolationConfig
          ? { strategy: project.conflictResolution.policies[resourceType].isolationConfig.strategy }
          : undefined,
        source: `project:${projectId}`,
      };
    }

    // 2. Project-level default
    if (project?.conflictResolution?.default) {
      return {
        resourceType,
        resolutionMode: project.conflictResolution.default,
        source: `project-default:${projectId}`,
      };
    }
  }

  // 3. Global default
  if (config.conflictResolution?.default) {
    return {
      resourceType,
      resolutionMode: config.conflictResolution.default,
      source: "global",
    };
  }

  // 4. Hardcoded default — manual (alert only, no auto-resolution)
  return {
    resourceType,
    resolutionMode: DEFAULT_RESOLUTION_MODE,
    source: "hardcoded",
  };
}

// =============================================================================
// POLICY APPLICATION
// =============================================================================

/**
 * Determine the winner project for priority-based resolution.
 * Uses priorityOrder array, shared pool priority, or alphabetical tiebreaker.
 */
function determinePriorityWinner(
  competingProjects: string[],
  priorityOrder?: string[],
  config?: OrchestratorConfig,
): string {
  // Explicit priority order
  if (priorityOrder && priorityOrder.length > 0) {
    for (const projectId of priorityOrder) {
      if (competingProjects.includes(projectId)) {
        return projectId;
      }
    }
  }

  // Shared pool priority from config
  const projectsByPriority: Array<{ id: string; priority: number }> = [];
  for (const projectId of competingProjects) {
    const project = config?.projects[projectId] as
      | { sharedPool?: { priority?: number } }
      | undefined;
    const poolPriority = project?.sharedPool?.priority ?? 0;
    projectsByPriority.push({ id: projectId, priority: poolPriority });
  }

  // Sort by priority descending
  projectsByPriority.sort((a, b) => b.priority - a.priority);
  if (projectsByPriority.length > 0 && projectsByPriority[0].priority > 0) {
    return projectsByPriority[0].id;
  }

  // Alphabetical tiebreaker
  return [...competingProjects].sort()[0];
}

/**
 * Build an isolation plan for a conflict based on resource type.
 */
function buildIsolationPlan(
  conflict: ResourceConflict,
  policy: ResourceConflictPolicy,
): Array<{ projectId: string; strategy: string }> {
  const strategy = policy.isolationConfig?.strategy ?? "default";
  const defaultStrategies: Record<ResourceConflictType, string> = {
    repository: "branch-per-project",
    "file-path": "separate-worktree",
    agent: "dedicated-agent",
    "external-service": "isolated",
  };

  const effectiveStrategy =
    strategy === "default" ? (defaultStrategies[conflict.resourceType] ?? "isolated") : strategy;

  return conflict.competingProjects.map((projectId) => ({
    projectId,
    strategy: effectiveStrategy,
  }));
}

/**
 * Apply a conflict resolution policy to a detected conflict.
 *
 * For manual mode: returns result with no action taken.
 * For priority-based: determines winner, emits policy:applied event.
 * For isolation: generates isolation plan, emits policy:applied event.
 *
 * @param conflict - The detected conflict
 * @param policy - The effective policy for the conflict's resource type
 * @param config - Orchestrator config for priority determination
 * @returns Policy resolution result
 */
export function applyPolicy(
  conflict: ResourceConflict,
  policy: ResourceConflictPolicy,
  config?: OrchestratorConfig,
): PolicyResolutionResult {
  switch (policy.resolutionMode) {
    case "manual":
      return {
        conflictId: conflict.id,
        policy,
        actionTaken: "none",
        details: { resolvedBy: conflict.competingProjects },
      };

    case "priority-based": {
      const winner = determinePriorityWinner(
        conflict.competingProjects,
        policy.priorityOrder,
        config,
      );
      const deferred = conflict.competingProjects.filter((p) => p !== winner);

      return {
        conflictId: conflict.id,
        policy,
        actionTaken: "priority-awarded",
        details: {
          winner,
          deferred,
          resolvedBy: conflict.competingProjects,
        },
      };
    }

    case "isolation": {
      const isolationPlan = buildIsolationPlan(conflict, policy);

      return {
        conflictId: conflict.id,
        policy,
        actionTaken: "isolated",
        details: {
          isolationPlan,
          resolvedBy: conflict.competingProjects,
        },
      };
    }

    default:
      // Unknown mode — treat as manual
      return {
        conflictId: conflict.id,
        policy,
        actionTaken: "none",
        details: { resolvedBy: conflict.competingProjects },
      };
  }
}
