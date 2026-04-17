/**
 * Shared agent pool utilities for cross-project agent sharing (Epic 50).
 *
 * Provides pool membership resolution, validation, and eligible project lookup.
 */

import type { OrchestratorConfig } from "./types.js";

/** Resolved pool membership for a single project */
export interface PoolMembership {
  projectId: string;
  enabled: boolean;
  eligibleProjects: string[];
  maxConcurrent?: number;
  reservedAgents?: string[];
}

/** Validation warning for invalid pool references */
export interface PoolValidationWarning {
  projectId: string;
  invalidReferences: string[];
  /** Agent names in reservedAgents that don't correspond to any known agent */
  invalidReservedAgents?: string[];
}

/**
 * Resolve pool memberships for all projects in the config.
 * Returns a Map of projectId → PoolMembership.
 *
 * For projects without sharedPool configured, returns a membership with enabled=false.
 * Expands wildcard "*" to all project IDs in the config.
 */
export function resolvePoolMemberships(config: OrchestratorConfig): Map<string, PoolMembership> {
  const allProjectIds = Object.keys(config.projects);
  const memberships = new Map<string, PoolMembership>();

  for (const [projectId, project] of Object.entries(config.projects)) {
    if (project.sharedPool && project.sharedPool.enabled) {
      const eligible = project.sharedPool.eligibleProjects.includes("*")
        ? allProjectIds.filter((id) => id !== projectId)
        : project.sharedPool.eligibleProjects;

      memberships.set(projectId, {
        projectId,
        enabled: true,
        eligibleProjects: eligible,
        maxConcurrent: project.sharedPool.maxConcurrent,
        reservedAgents: project.sharedPool.reservedAgents,
      });
    } else {
      memberships.set(projectId, {
        projectId,
        enabled: false,
        eligibleProjects: [],
      });
    }
  }

  return memberships;
}

/**
 * Validate that all eligibleProjects references point to existing projects.
 * Returns warnings for any invalid references.
 */
export function validatePoolReferences(config: OrchestratorConfig): PoolValidationWarning[] {
  const validProjectIds = new Set(Object.keys(config.projects));
  const warnings: PoolValidationWarning[] = [];

  for (const [projectId, project] of Object.entries(config.projects)) {
    // Warn if reservedAgents is set on a disabled pool — it's a config mistake
    if (
      project.sharedPool &&
      !project.sharedPool.enabled &&
      project.sharedPool.reservedAgents?.length
    ) {
      warnings.push({
        projectId,
        invalidReferences: [],
        invalidReservedAgents: [...project.sharedPool.reservedAgents],
      });
      continue;
    }

    if (!project.sharedPool || !project.sharedPool.enabled) continue;

    const invalid = project.sharedPool.eligibleProjects.filter(
      (ref) => ref !== "*" && !validProjectIds.has(ref),
    );

    // Validate reservedAgents — check for empty strings and duplicates
    const reserved = project.sharedPool.reservedAgents ?? [];
    const invalidReserved = reserved.filter((agent) => !agent || agent.trim() === "");

    // Check for duplicate reserved agents across projects
    const duplicates: string[] = [];
    for (const agentId of reserved) {
      if (!agentId || agentId.trim() === "") continue;
      for (const [otherId, otherProject] of Object.entries(config.projects)) {
        if (otherId === projectId) continue;
        if (otherProject.sharedPool?.reservedAgents?.includes(agentId)) {
          duplicates.push(agentId);
          break;
        }
      }
    }

    const hasIssues = invalid.length > 0 || invalidReserved.length > 0 || duplicates.length > 0;
    if (hasIssues) {
      warnings.push({
        projectId,
        invalidReferences: invalid,
        invalidReservedAgents: [...new Set([...invalidReserved, ...duplicates])],
      });
    }
  }

  return warnings;
}

/**
 * Get the list of eligible projects for a given project's shared pool.
 * Returns empty array if the project has no shared pool or pool is disabled.
 */
export function getEligibleProjects(projectId: string, config: OrchestratorConfig): string[] {
  const project = config.projects[projectId];
  if (!project?.sharedPool?.enabled) return [];

  const allProjectIds = Object.keys(config.projects);

  if (project.sharedPool.eligibleProjects.includes("*")) {
    return allProjectIds.filter((id) => id !== projectId);
  }

  // Only return references to projects that actually exist
  return project.sharedPool.eligibleProjects.filter((ref) => allProjectIds.includes(ref));
}

/**
 * Get all projects that have shared pool enabled.
 */
export function getPoolProjects(config: OrchestratorConfig): string[] {
  return Object.entries(config.projects)
    .filter(([, project]) => project.sharedPool?.enabled)
    .map(([projectId]) => projectId);
}

/**
 * Check if a specific project can receive agents from another project's pool.
 * Returns true if sourceProject has sharedPool enabled and targetProject is eligible.
 *
 * When agentId is provided, also checks that the agent is not reserved by the source project.
 */
export function canReceiveAgents(
  sourceProjectId: string,
  targetProjectId: string,
  config: OrchestratorConfig,
  agentId?: string,
): boolean {
  const eligible = getEligibleProjects(sourceProjectId, config);
  if (!eligible.includes(targetProjectId)) return false;

  // If checking a specific agent, verify it's not reserved for exclusive use
  if (agentId !== undefined) {
    const sourceProject = config.projects[sourceProjectId];
    const reserved = sourceProject?.sharedPool?.reservedAgents ?? [];
    if (reserved.includes(agentId)) return false;
  }

  return true;
}

// =============================================================================
// AGENT RESERVATION (Story 50.2)
// =============================================================================

/**
 * Check if a specific agent is reserved for exclusive use by any project.
 * Returns true if the agent appears in any project's reservedAgents list.
 */
export function isAgentReserved(agentId: string, config: OrchestratorConfig): boolean {
  for (const project of Object.values(config.projects)) {
    if (project.sharedPool?.enabled && project.sharedPool.reservedAgents?.includes(agentId)) {
      return true;
    }
  }
  return false;
}

/**
 * Get the list of agents reserved for a specific project's exclusive use.
 * Returns empty array if the project has no reserved agents.
 */
export function getReservedAgents(projectId: string, config: OrchestratorConfig): string[] {
  const project = config.projects[projectId];
  if (!project?.sharedPool?.enabled) return [];
  return project.sharedPool.reservedAgents ?? [];
}

/**
 * Get available pool agents from a source project that can be shared with a target project.
 * Returns the full agent list minus any reserved agents.
 *
 * Note: This operates on config-declared agent identifiers, not runtime session IDs.
 * The caller provides the list of known agents; we filter out reserved ones.
 */
export function getAvailablePoolAgents(
  sourceProjectId: string,
  targetProjectId: string,
  knownAgents: string[],
  config: OrchestratorConfig,
): string[] {
  if (!canReceiveAgents(sourceProjectId, targetProjectId, config)) return [];

  const reserved = getReservedAgents(sourceProjectId, config);
  return knownAgents.filter((agent) => !reserved.includes(agent));
}
