/**
 * Pool Allocation — Intelligent allocation algorithm for shared agent pool (Epic 50, Story 50.3).
 *
 * Pure functions that score and rank (story, agent) pairs across projects based on:
 * - Story urgency (critical > high > normal > low)
 * - Project priority (config-level, higher = preferred)
 * - Agent affinity (reuses scoreAffinity from assignment-scorer.ts)
 * - Agent workload (fewer active assignments = higher score)
 *
 * NFR-F2-1: Allocation decision completes within 500ms.
 * NFR-F2-2: Supports up to 100 agents across 50 projects.
 */

import type { OrchestratorConfig, UrgencyLevel, AllocationWeights } from "./types.js";
import { canReceiveAgents, getAvailablePoolAgents, getPoolProjects } from "./shared-pool.js";
import { isAtCapacity } from "./capacity-check.js";

// =============================================================================
// TYPES
// =============================================================================

/** Request to allocate agents to stories across the shared pool. */
export interface AllocationRequest {
  /** Full orchestrator config (for pool membership, priorities, weights). */
  config: OrchestratorConfig;
  /** Story IDs that need agents, with urgency info. */
  stories: AllocationStory[];
  /** Current agent workload: agentId → count of active assignments. */
  agentWorkload: Map<string, number>;
  /** Pre-computed affinity scores (optional — falls back to neutral 0.5). */
  affinityScores?: Map<string, number>; // key: `${agentId}:${storyId}`
  /** Known agent IDs per project: projectId → agent IDs. */
  projectAgents: Map<string, string[]>;
  /**
   * Callback invoked when an agent is skipped due to capacity.
   * Use this to emit events or log capacity warnings.
   * Non-breaking: if omitted, capacity skips are silently handled as before.
   */
  onCapacitySkip?: (skip: CapacitySkip) => void;
}

/** Record of an agent being skipped during allocation due to capacity limits. */
export interface CapacitySkip {
  /** Agent that was at capacity. */
  agentId: string;
  /** Story that could not be assigned. */
  storyId: string;
  /** Source project of the agent. */
  sourceProjectId: string;
  /** Current workload at time of check. */
  currentWorkload: number;
  /** Maximum concurrent capacity. */
  maxCapacity: number;
}

/** A story needing allocation in the shared pool. */
export interface AllocationStory {
  /** Story ID (e.g., "1-5-multi-agent-assignment"). */
  storyId: string;
  /** The project this story belongs to. */
  projectId: string;
  /** Story urgency level. Defaults to "normal" if undefined. */
  urgency?: UrgencyLevel;
  /** Sprint priority (higher = more important). From priorities map or 0. */
  priority: number;
  /** Ordinal position for FIFO tiebreaking (0-based, lower = earlier in queue). */
  position: number;
}

/** A single allocation decision: which agent should work on which story. */
export interface AllocationDecision {
  /** Story being assigned. */
  storyId: string;
  /** Agent assigned to the story. */
  agentId: string;
  /** Source project the agent belongs to. */
  sourceProjectId: string;
  /** Target project the story belongs to. */
  targetProjectId: string;
  /** Overall allocation score (0-1, higher = better match). */
  score: number;
  /** Breakdown of scoring factors. */
  factors: AllocationFactors;
}

/** Breakdown of scoring factors for a single allocation decision. */
export interface AllocationFactors {
  urgency: number;
  priority: number;
  affinity: number;
  workload: number;
}

// =============================================================================
// DEFAULTS
// =============================================================================

const DEFAULT_WEIGHTS: Required<AllocationWeights> = {
  urgency: 0.3,
  priority: 0.3,
  affinity: 0.25,
  workload: 0.15,
};

const URGENCY_SCORES: Record<UrgencyLevel, number> = {
  critical: 1.0,
  high: 0.75,
  normal: 0.5,
  low: 0.25,
};

export const DEFAULT_MAX_CONCURRENT = 10;

// =============================================================================
// SCORING FUNCTIONS
// =============================================================================

/**
 * Map urgency level to a 0-1 score.
 * Undefined urgency defaults to "normal" (0.5).
 */
export function computeUrgencyScore(urgency?: UrgencyLevel): number {
  return URGENCY_SCORES[urgency ?? "normal"];
}

/**
 * Normalize project priority to 0-1 score.
 * Uses maxPriority across all pool projects for normalization.
 * Undefined priority defaults to 0.5 (neutral).
 */
export function computePriorityScore(
  projectPriority: number | undefined,
  maxPriority: number,
): number {
  if (projectPriority === undefined) return 0.5;
  if (maxPriority <= 0) return 0.5;
  return Math.min(projectPriority / maxPriority, 1);
}

/**
 * Compute workload score (0-1) based on current assignments vs capacity.
 * Idle agents score 1.0; agents at max capacity score 0.
 */
export function computeWorkloadScore(
  activeAssignments: number,
  maxConcurrent: number | undefined,
): number {
  const capacity = maxConcurrent ?? DEFAULT_MAX_CONCURRENT;
  if (capacity <= 0) return 0;
  const load = Math.max(activeAssignments, 0);
  if (load >= capacity) return 0;
  return 1 - load / capacity;
}

/**
 * Compute weighted allocation score from all factors.
 * Each factor should be 0-1; weights are normalized to sum to 1.
 */
export function computeAllocationScore(
  factors: AllocationFactors,
  weights?: AllocationWeights,
): number {
  const w: Required<AllocationWeights> = {
    urgency: weights?.urgency ?? DEFAULT_WEIGHTS.urgency,
    priority: weights?.priority ?? DEFAULT_WEIGHTS.priority,
    affinity: weights?.affinity ?? DEFAULT_WEIGHTS.affinity,
    workload: weights?.workload ?? DEFAULT_WEIGHTS.workload,
  };

  // Normalize weights to sum to 1
  const total = w.urgency + w.priority + w.affinity + w.workload;
  if (total <= 0) return 0;

  return (
    (w.urgency / total) * factors.urgency +
    (w.priority / total) * factors.priority +
    (w.affinity / total) * factors.affinity +
    (w.workload / total) * factors.workload
  );
}

// =============================================================================
// MAIN ALLOCATION ALGORITHM
// =============================================================================

/**
 * Allocate agents to stories across the shared pool.
 *
 * Returns a ranked list of (story, agent) decisions sorted by score descending.
 * Ties are broken by story priority, then FIFO position.
 *
 * Excludes:
 * - Reserved agents from cross-project allocation
 * - Agents at max concurrent capacity
 * - Agents not eligible for the story's project
 */
export function allocateAgents(request: AllocationRequest): AllocationDecision[] {
  const { config, stories, agentWorkload, affinityScores, projectAgents } = request;
  const poolProjects = getPoolProjects(config);

  if (poolProjects.length === 0 || stories.length === 0) return [];

  // Compute max priority across all pool projects for normalization
  let maxPriority = 0;
  for (const projectId of poolProjects) {
    const p = config.projects[projectId]?.sharedPool?.priority;
    if (p !== undefined && p > maxPriority) maxPriority = p;
  }
  if (maxPriority === 0) maxPriority = 1; // Avoid division by zero

  // Resolve weights: uses the first pool project with custom allocationWeights.
  // This ensures a single consistent weights config across the entire allocation run.
  // Projects without explicit weights fall back to defaults.
  let weights: AllocationWeights | undefined;
  for (const projectId of poolProjects) {
    const w = config.projects[projectId]?.sharedPool?.allocationWeights;
    if (w) {
      weights = w;
      break;
    }
  }

  const candidates: AllocationDecision[] = [];

  for (const story of stories) {
    const storyProjectConfig = config.projects[story.projectId];
    const storyProjectPriority = storyProjectConfig?.sharedPool?.priority;

    for (const sourceProjectId of poolProjects) {
      const sourceProject = config.projects[sourceProjectId];
      if (!sourceProject?.sharedPool) continue;

      const maxConcurrent = sourceProject.sharedPool.maxConcurrent;

      // Get agents from this source project
      const agentIds = projectAgents.get(sourceProjectId) ?? [];
      if (agentIds.length === 0) continue;

      // Same-project: agents work on own project's stories directly (no pool eligibility check)
      // Cross-project: use pool eligibility (excludes reserved agents)
      const isSameProject = sourceProjectId === story.projectId;
      const availableAgents = isSameProject
        ? agentIds
        : getAvailablePoolAgents(sourceProjectId, story.projectId, agentIds, config);

      for (const agentId of availableAgents) {
        // Check if agent is at capacity using the unified capacity-check module
        const workload = agentWorkload.get(agentId) ?? 0;
        if (isAtCapacity(agentId, workload, config, sourceProjectId)) {
          // At max capacity — notify caller via callback (non-breaking)
          try {
            request.onCapacitySkip?.({
              agentId,
              storyId: story.storyId,
              sourceProjectId,
              currentWorkload: workload,
              maxCapacity: maxConcurrent ?? DEFAULT_MAX_CONCURRENT,
            });
          } catch {
            // Fire-and-forget callback — never disrupt allocation loop
          }
          continue;
        }
        const workloadScore = computeWorkloadScore(workload, maxConcurrent);

        // Cross-project: verify agent can be sent to target project
        if (sourceProjectId !== story.projectId) {
          if (!canReceiveAgents(sourceProjectId, story.projectId, config, agentId)) continue;
        }

        const factors: AllocationFactors = {
          urgency: computeUrgencyScore(story.urgency),
          priority: computePriorityScore(storyProjectPriority, maxPriority),
          affinity: affinityScores?.get(`${agentId}:${story.storyId}`) ?? 0.5,
          workload: workloadScore,
        };

        const score = computeAllocationScore(factors, weights);

        candidates.push({
          storyId: story.storyId,
          agentId,
          sourceProjectId,
          targetProjectId: story.projectId,
          score,
          factors,
        });
      }
    }
  }

  // Pre-build story lookup for O(1) access during sort tiebreaking
  const storyById = new Map(stories.map((s) => [s.storyId, s]));

  // Sort by score desc, then story priority desc, then FIFO position asc
  candidates.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    const storyA = storyById.get(a.storyId);
    const storyB = storyById.get(b.storyId);
    if (storyA && storyB) {
      if (storyB.priority !== storyA.priority) return storyB.priority - storyA.priority;
      return storyA.position - storyB.position;
    }
    return 0;
  });

  // Deduplicate: each story gets at most one agent, each agent gets at most one story
  const assignedStories = new Set<string>();
  const assignedAgents = new Set<string>();
  const results: AllocationDecision[] = [];

  for (const candidate of candidates) {
    if (assignedStories.has(candidate.storyId)) continue;
    if (assignedAgents.has(candidate.agentId)) continue;
    assignedStories.add(candidate.storyId);
    assignedAgents.add(candidate.agentId);
    results.push(candidate);
  }

  return results;
}
