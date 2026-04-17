/**
 * Capacity Check — prevents over-allocation of shared agents (Epic 50, Story 50.6).
 *
 * Provides:
 * - Per-agent capacity check (current workload vs configured max)
 * - Batch capacity status for all agents
 * - Near-capacity (80%) and at-capacity (100%) thresholds
 *
 * FR-F2-6: Conflict detection prevents over-allocation of shared agents.
 *
 * Design: Pure sync functions accepting pre-fetched workload data (same pattern as
 * agent-utilization.ts and pool-allocation.ts). No I/O, fully testable.
 */

import type { OrchestratorConfig } from "./types.js";
import { getPoolProjects } from "./shared-pool.js";
import { DEFAULT_MAX_CONCURRENT } from "./pool-allocation.js";

// =============================================================================
// TYPES
// =============================================================================

/** Capacity check result for a single agent. */
export interface CapacityResult {
  /** Agent / session ID. */
  agentId: string;
  /** Current number of active assignments. */
  currentWorkload: number;
  /** Maximum concurrent assignments allowed. */
  maxCapacity: number;
  /** Utilization percentage: currentWorkload / maxCapacity * 100 (0-100+). */
  utilizationPercent: number;
  /** Slots remaining: maxCapacity - currentWorkload. */
  availableSlots: number;
  /** True when availableSlots <= 0. */
  isAtCapacity: boolean;
  /** True when utilizationPercent >= 80 (but not at capacity). */
  isNearCapacity: boolean;
}

/** Guard result for assignment flow. */
export interface GuardResult {
  /** Whether the assignment is allowed. */
  allowed: boolean;
  /** Reason for denial (empty string when allowed). */
  reason: string;
  /** Capacity result for the agent. */
  capacity: CapacityResult;
  /** Whether this was a force override (allowed despite at-capacity). */
  forced: boolean;
}

// =============================================================================
// CONSTANTS
// =============================================================================

/** Utilization percentage threshold for "near capacity" warning. */
const NEAR_CAPACITY_THRESHOLD = 80;

// =============================================================================
// CAPACITY RESOLUTION
// =============================================================================

/**
 * Resolve the maximum concurrent capacity for an agent.
 *
 * Resolution order:
 * 1. Project-level `sharedPool.maxConcurrent` (if agent belongs to pool-enabled project)
 * 2. Global `maxConcurrentAgents`
 * 3. `DEFAULT_MAX_CONCURRENT` (10)
 */
export function resolveMaxCapacity(config: OrchestratorConfig, projectId?: string): number {
  // Project-level override
  if (projectId) {
    const project = config.projects[projectId];
    if (project?.sharedPool?.enabled && project.sharedPool.maxConcurrent !== undefined) {
      return project.sharedPool.maxConcurrent;
    }
  }

  // Global override
  if (config.maxConcurrentAgents !== undefined) {
    return config.maxConcurrentAgents;
  }

  // Default
  return DEFAULT_MAX_CONCURRENT;
}

// =============================================================================
// SINGLE AGENT CAPACITY CHECK
// =============================================================================

/**
 * Check capacity for a single agent.
 *
 * Returns a CapacityResult with workload, capacity, thresholds, and available slots.
 */
export function checkCapacity(
  agentId: string,
  currentWorkload: number,
  config: OrchestratorConfig,
  projectId?: string,
): CapacityResult {
  // Guard against negative workload (bad data from upstream)
  const workload = Math.max(currentWorkload, 0);
  const maxCapacity = resolveMaxCapacity(config, projectId);
  const utilizationPercent = maxCapacity > 0 ? Math.round((workload / maxCapacity) * 100) : 0;
  const availableSlots = Math.max(maxCapacity - workload, 0);
  const isAtCapacity = maxCapacity <= 0 || workload >= maxCapacity;
  const isNearCapacity = !isAtCapacity && utilizationPercent >= NEAR_CAPACITY_THRESHOLD;

  return {
    agentId,
    currentWorkload: workload,
    maxCapacity,
    utilizationPercent,
    availableSlots,
    isAtCapacity,
    isNearCapacity,
  };
}

// =============================================================================
// CONVENIENCE WRAPPER
// =============================================================================

/**
 * Check if an agent is at maximum capacity.
 * Returns true when currentWorkload >= maxCapacity.
 */
export function isAtCapacity(
  agentId: string,
  currentWorkload: number,
  config: OrchestratorConfig,
  projectId?: string,
): boolean {
  return checkCapacity(agentId, currentWorkload, config, projectId).isAtCapacity;
}

// =============================================================================
// BATCH CAPACITY CHECK
// =============================================================================

/**
 * Check capacity for all agents in a workload map.
 *
 * Handles agents from different projects with different maxConcurrent limits.
 * Pool-enabled agents use project-level config; others use global/default.
 *
 * Returns a Map of agentId → CapacityResult.
 */
export function getCapacityStatus(
  agentWorkload: Map<string, number>,
  config: OrchestratorConfig,
  agentProjectMap?: Map<string, string>,
): Map<string, CapacityResult> {
  const poolProjectSet = new Set(getPoolProjects(config));
  const results = new Map<string, CapacityResult>();

  for (const [agentId, workload] of agentWorkload) {
    // Determine project for capacity config resolution
    let projectId: string | undefined;
    if (agentProjectMap) {
      const agentProject = agentProjectMap.get(agentId);
      if (agentProject && poolProjectSet.has(agentProject)) {
        projectId = agentProject;
      }
    }

    results.set(agentId, checkCapacity(agentId, workload, config, projectId));
  }

  return results;
}

// =============================================================================
// ASSIGNMENT GUARD
// =============================================================================

/**
 * Guard an assignment against capacity limits.
 *
 * Returns a GuardResult indicating whether the assignment is allowed.
 * When `force` is true, the assignment is allowed even at capacity
 * (with `forced: true` and the capacity result for logging).
 */
export function guardAssignment(
  agentId: string,
  currentWorkload: number,
  config: OrchestratorConfig,
  options?: { force?: boolean; projectId?: string },
): GuardResult {
  const { force = false, projectId } = options ?? {};
  const capacity = checkCapacity(agentId, currentWorkload, config, projectId);

  if (!capacity.isAtCapacity) {
    return { allowed: true, reason: "", capacity, forced: false };
  }

  // At capacity — deny unless forced
  if (force) {
    return {
      allowed: true,
      reason: `Agent ${agentId} at capacity (${currentWorkload}/${capacity.maxCapacity}) — force override applied`,
      capacity,
      forced: true,
    };
  }

  return {
    allowed: false,
    reason: `Agent ${agentId} is at capacity (${currentWorkload}/${capacity.maxCapacity}). Use force override to assign anyway.`,
    capacity,
    forced: false,
  };
}

// =============================================================================
// ERROR CLASS
// =============================================================================

/**
 * Error thrown when an assignment is blocked by capacity limits.
 *
 * Includes capacity details for upstream error reporting and logging.
 */
export class CapacityExceededError extends Error {
  /** Agent that was at capacity. */
  readonly agentId: string;
  /** Current workload at the time of the check. */
  readonly currentWorkload: number;
  /** Maximum allowed concurrent assignments. */
  readonly maxCapacity: number;
  /** Slots remaining (always 0 when this error is thrown). */
  readonly availableSlots: number;

  constructor(result: CapacityResult) {
    super(
      `Agent ${result.agentId} is at capacity ` +
        `(${result.currentWorkload}/${result.maxCapacity}). ` +
        `Use force override to assign anyway.`,
    );
    this.name = "CapacityExceededError";
    this.agentId = result.agentId;
    this.currentWorkload = result.currentWorkload;
    this.maxCapacity = result.maxCapacity;
    this.availableSlots = result.availableSlots;
  }
}
