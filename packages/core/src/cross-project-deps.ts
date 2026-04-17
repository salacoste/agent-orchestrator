/**
 * Cross-Project Dependency Management — type definitions, pure functions, file store (Epic 51.1).
 *
 * Provides types, pure functions, and file-based persistence for cross-project
 * dependencies between stories in different projects.
 *
 * Design: Pure sync functions accepting pre-fetched data (same pattern as
 * capacity-check.ts, agent-utilization.ts). File I/O in
 * separate store adapter.
 *
 * FR-F3-1: Users can define dependencies between stories in different projects.
 * FR-F3-2: The system tracks cross-project dependency status.
 */

import type { OrchestratorConfig } from "./types.js";
import { DEFAULT_MAX_CONCURRENT } from "./pool-allocation.js";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { parse, stringify } from "yaml";
import { randomBytes } from "node:crypto";

// =============================================================================
// CONSTANTS
// =============================================================================

/** Default filename for the cross-project deps file. */
export const CROSS_PROJECT_DEPS_FILENAME = "cross-project-deps.yaml";

// =============================================================================
// TYPES
// =============================================================================

/** A dependency between stories in different projects. */
export interface CrossProjectDependency {
  /** Unique dependency ID. */
  id: string;
  /** Project containing the dependent (blocked) story. */
  sourceProjectId: string;
  /** Story that depends on the target (blocked until target completes). */
  sourceStoryId: string;
  /** Project containing the prerequisite story. */
  targetProjectId: string;
  /** Story that must complete before source can proceed. */
  targetStoryId: string;
  /** ISO timestamp of when this dependency was created. */
  createdAt: string;
}

/** Story summary returned by cross-project search. */
export interface StorySummary {
  /** Story ID. */
  id: string;
  /** Story title (derived from story ID). */
  title: string;
  /** Current story status. */
  status: string;
  /** Project the story belongs to. */
  projectId: string;
}

/** Validation error for dependency reference validation. */
export interface DependencyValidationError {
  /** Which reference is invalid. */
  field: "sourceProjectId" | "sourceStoryId" | "targetProjectId" | "targetStoryId";
  /** Human-readable description of the problem. */
  message: string;
}

/** Result of validating dependency references. */
export interface ValidationResult {
  /** Whether validation passed. */
  valid: boolean;
  /** List of validation errors (empty when valid). */
  errors: DependencyValidationError[];
}

/**
 * Sprint data provider for cross-project dependency validation.
 * Maps projectId → { development_status: Record<storyId, status> }.
 * Callers build this from SprintDataReader by calling readSprintData for each project.
 */
export type SprintDataMap = Record<string, { development_status: Record<string, string> }>;

/** A dependency enriched with live target story status (view model, not persisted). */
export interface DependencyWithStatus extends CrossProjectDependency {
  /** Current status of the target story. */
  readonly targetStatus: string;
  /** Whether the dependency is resolved (target story status is "done"). */
  readonly isResolved: boolean;
}

/** Map of dependency IDs to the ISO timestamp when they first became blocking. */
export type BlockingStartTimeMap = Record<string, string>;

/** A node in a circular dependency cycle path. */
export interface CyclePathNode {
  readonly projectId: string;
  readonly storyId: string;
}

/**
 * Error thrown when a circular dependency is detected.
 * Preserves the structured cyclePath for API consumers.
 */
export class CircularDependencyError extends Error {
  /** The cycle path showing which stories form the loop. */
  readonly cyclePath: CyclePathNode[];

  constructor(cyclePath: CyclePathNode[]) {
    const pathStr = cyclePath.map((n) => `${n.projectId}/${n.storyId}`).join(" → ");
    super(`Circular dependency detected: ${pathStr}`);
    this.name = "CircularDependencyError";
    this.cyclePath = cyclePath;
  }
}

/** Result of circular dependency detection. */
export interface CircularDependencyResult {
  /** Whether a circular dependency was detected. */
  readonly cycleDetected: boolean;
  /** The path of stories forming the cycle (first and last entries are the same story). Undefined if no cycle. */
  readonly cyclePath?: CyclePathNode[];
}

/** An alert for a cross-project dependency blocking beyond a threshold (Story 51.5). */
export interface DependencyBlockingAlert {
  /** The enriched dependency that is blocking. */
  readonly dep: DependencyWithStatus;
  /** Story ID that is blocked (source story). */
  readonly blockedStoryId: string;
  /** Project ID of the blocked story. */
  readonly blockedProjectId: string;
  /** Story ID that is the blocking prerequisite (target story). */
  readonly blockingStoryId: string;
  /** Project ID of the blocking story. */
  readonly blockingProjectId: string;
  /** How long this dep has been blocking in milliseconds. */
  readonly blockingDurationMs: number;
  /** Human-readable blocking duration (e.g., "2h 30m"). */
  readonly blockingDurationLabel: string;
  /** Whether the blocking duration exceeds the notification threshold. */
  readonly thresholdExceeded: boolean;
}

// =============================================================================
// ID GENERATION
// =============================================================================

/**
 * Generate a unique dependency ID.
 * Format: `dep-<timestamp-base36>-<random-hex>`.
 */
export function generateDepId(): string {
  const timestamp = Date.now().toString(36);
  const random = randomBytes(4).toString("hex").padStart(8, "0");
  return `dep-${timestamp}-${random}`;
}

// =============================================================================
// PURE FUNCTIONS (no I/O — testable)
// =============================================================================

/**
 * Detect whether adding a new dependency would create a circular dependency.
 *
 * Dependencies form a directed graph: dep(source, target) = edge source → target
 * (source depends on target). A cycle exists if, after adding the proposed edge
 * newSource → newTarget, there is a path from newTarget back to newSource.
 *
 * Uses DFS with path tracking to detect cycles and reconstruct the cycle path.
 *
 * @param existingDeps - Current cross-project dependencies
 * @param newSourceProjectId - Project ID of the source (dependent) story in the proposed dep
 * @param newSourceStoryId - Story ID of the source story in the proposed dep
 * @param newTargetProjectId - Project ID of the target (prerequisite) story in the proposed dep
 * @param newTargetStoryId - Story ID of the target story in the proposed dep
 * @returns CircularDependencyResult with cycleDetected and cyclePath if a cycle is found
 */
export function detectCircularDependency(
  existingDeps: CrossProjectDependency[],
  newSourceProjectId: string,
  newSourceStoryId: string,
  newTargetProjectId: string,
  newTargetStoryId: string,
): CircularDependencyResult {
  // Self-reference check: source and target are the same story
  if (newSourceProjectId === newTargetProjectId && newSourceStoryId === newTargetStoryId) {
    return {
      cycleDetected: true,
      cyclePath: [
        { projectId: newSourceProjectId, storyId: newSourceStoryId },
        { projectId: newSourceProjectId, storyId: newSourceStoryId },
      ],
    };
  }

  // Build adjacency list: dep(A, B) = edge A → B
  // After adding newSource → newTarget, a cycle exists if newTarget can reach newSource
  const adjacency = new Map<string, CyclePathNode[]>();

  for (const dep of existingDeps) {
    const from = `${dep.sourceProjectId}::${dep.sourceStoryId}`;
    const to: CyclePathNode = { projectId: dep.targetProjectId, storyId: dep.targetStoryId };
    const existing = adjacency.get(from);
    if (existing) {
      existing.push(to);
    } else {
      adjacency.set(from, [to]);
    }
  }

  // DFS from newTarget following edges forward, looking for newSource
  const newSourceKey = `${newSourceProjectId}::${newSourceStoryId}`;
  const startKey = `${newTargetProjectId}::${newTargetStoryId}`;
  const visited = new Set<string>();

  function dfs(current: string): boolean {
    if (current === newSourceKey) return true;
    if (visited.has(current)) return false;
    visited.add(current);

    const neighbors = adjacency.get(current);
    if (!neighbors) return false;

    for (const neighbor of neighbors) {
      const neighborKey = `${neighbor.projectId}::${neighbor.storyId}`;
      if (dfs(neighborKey)) return true;
    }
    return false;
  }

  // Detect cycle via DFS, then reconstruct shortest path via BFS
  if (dfs(startKey)) {
    const cyclePath = buildCyclePath(
      adjacency,
      newSourceProjectId,
      newSourceStoryId,
      newTargetProjectId,
      newTargetStoryId,
    );
    return { cycleDetected: true, cyclePath };
  }

  return { cycleDetected: false };
}

/**
 * Build the cycle path for a detected circular dependency.
 * Reconstructs the shortest path: newSource → newTarget → ... → newSource
 * using BFS with the pre-built adjacency list.
 */
function buildCyclePath(
  adjacency: Map<string, CyclePathNode[]>,
  newSourceProjectId: string,
  newSourceStoryId: string,
  newTargetProjectId: string,
  newTargetStoryId: string,
): CyclePathNode[] {
  // BFS from newTarget to newSource, tracking parent pointers
  const newSourceKey = `${newSourceProjectId}::${newSourceStoryId}`;
  const startKey = `${newTargetProjectId}::${newTargetStoryId}`;
  const parent = new Map<string, { key: string; node: CyclePathNode }>();
  const queue: string[] = [startKey];
  const visited = new Set<string>([startKey]);

  while (queue.length > 0) {
    const current = queue.shift()!;
    const neighbors = adjacency.get(current) ?? [];

    for (const neighbor of neighbors) {
      const neighborKey = `${neighbor.projectId}::${neighbor.storyId}`;

      if (neighborKey === newSourceKey) {
        // Found cycle — reconstruct path
        const path: CyclePathNode[] = [
          { projectId: newSourceProjectId, storyId: newSourceStoryId },
          { projectId: newTargetProjectId, storyId: newTargetStoryId },
        ];

        // Trace back from current through parent pointers
        const trace: CyclePathNode[] = [];
        let traceKey: string | undefined = current;
        while (traceKey && traceKey !== startKey) {
          const p = parent.get(traceKey);
          if (p) {
            trace.unshift(p.node);
            traceKey = p.key;
          } else {
            break;
          }
        }

        path.push(...trace);
        path.push({ projectId: newSourceProjectId, storyId: newSourceStoryId });
        return path;
      }

      if (!visited.has(neighborKey)) {
        visited.add(neighborKey);
        parent.set(neighborKey, { key: current, node: neighbor });
        queue.push(neighborKey);
      }
    }
  }

  // Shouldn't reach here if detectCircularDependency already found a cycle
  return [
    { projectId: newSourceProjectId, storyId: newSourceStoryId },
    { projectId: newTargetProjectId, storyId: newTargetStoryId },
    { projectId: newSourceProjectId, storyId: newSourceStoryId },
  ];
}

/**
 * Check if a duplicate dependency already exists.
 * A duplicate is when the same source-target pair already has a dependency.
 */
export function isDuplicate(
  deps: CrossProjectDependency[],
  sourceProjectId: string,
  sourceStoryId: string,
  targetProjectId: string,
  targetStoryId: string,
): boolean {
  return deps.some(
    (d) =>
      d.sourceProjectId === sourceProjectId &&
      d.sourceStoryId === sourceStoryId &&
      d.targetProjectId === targetProjectId &&
      d.targetStoryId === targetStoryId,
  );
}

/**
 * Add a new cross-project dependency to the list.
 * Pure function — validates no duplicate, generates ID and timestamp.
 * Throws if a duplicate already exists.
 */
export function addCrossProjectDependency(
  deps: CrossProjectDependency[],
  sourceProjectId: string,
  sourceStoryId: string,
  targetProjectId: string,
  targetStoryId: string,
): { deps: CrossProjectDependency[]; added: CrossProjectDependency } {
  // Cycle detection — check BEFORE duplicate (AC: #1, #5)
  const cycleResult = detectCircularDependency(
    deps,
    sourceProjectId,
    sourceStoryId,
    targetProjectId,
    targetStoryId,
  );
  if (cycleResult.cycleDetected && cycleResult.cyclePath) {
    throw new CircularDependencyError(cycleResult.cyclePath);
  }

  if (isDuplicate(deps, sourceProjectId, sourceStoryId, targetProjectId, targetStoryId)) {
    throw new Error(
      `Duplicate dependency: ${sourceProjectId}/${sourceStoryId} → ${targetProjectId}/${targetStoryId} already exists`,
    );
  }

  const added: CrossProjectDependency = {
    id: generateDepId(),
    sourceProjectId,
    sourceStoryId,
    targetProjectId,
    targetStoryId,
    createdAt: new Date().toISOString(),
  };

  return { deps: [...deps, added], added };
}

/**
 * Remove a cross-project dependency by ID.
 * Pure function — returns new array without the removed dep.
 * Returns null if the dependency was not found.
 */
export function removeCrossProjectDependency(
  deps: CrossProjectDependency[],
  depId: string,
): { deps: CrossProjectDependency[]; removed: CrossProjectDependency | null } {
  const removed = deps.find((d) => d.id === depId) ?? null;
  if (!removed) {
    return { deps, removed: null };
  }
  return { deps: deps.filter((d) => d.id !== depId), removed };
}

/**
 * Get dependencies involving a specific story (as source or target).
 * Returns all deps where the story appears in either direction.
 */
export function getDependenciesForStory(
  deps: CrossProjectDependency[],
  projectId: string,
  storyId: string,
): CrossProjectDependency[] {
  return deps.filter(
    (d) =>
      (d.sourceProjectId === projectId && d.sourceStoryId === storyId) ||
      (d.targetProjectId === projectId && d.targetStoryId === storyId),
  );
}

/**
 * Validate that both project and story references exist.
 * Checks config for project existence and sprint data map for story existence.
 */
export function validateDependencyReferences(
  config: OrchestratorConfig,
  sourceProjectId: string,
  sourceStoryId: string,
  targetProjectId: string,
  targetStoryId: string,
  sprintData?: SprintDataMap,
): ValidationResult {
  const errors: DependencyValidationError[] = [];

  // Source project validation
  if (!(sourceProjectId in config.projects)) {
    errors.push({
      field: "sourceProjectId",
      message: `Source project "${sourceProjectId}" not found in config`,
    });
  } else if (sprintData && sprintData[sourceProjectId]) {
    const devStatus = sprintData[sourceProjectId].development_status;
    if (!(sourceStoryId in devStatus)) {
      errors.push({
        field: "sourceStoryId",
        message: `Source story "${sourceStoryId}" not found in project "${sourceProjectId}"`,
      });
    }
  }

  // Target project validation
  if (!(targetProjectId in config.projects)) {
    errors.push({
      field: "targetProjectId",
      message: `Target project "${targetProjectId}" not found in config`,
    });
  } else if (sprintData && sprintData[targetProjectId]) {
    const devStatus = sprintData[targetProjectId].development_status;
    if (!(targetStoryId in devStatus)) {
      errors.push({
        field: "targetStoryId",
        message: `Target story "${targetStoryId}" not found in project "${targetProjectId}"`,
      });
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * List all dependencies, optionally filtered by project.
 * Returns deps where the project appears as source OR target.
 */
export function listDependencies(
  deps: CrossProjectDependency[],
  filter?: { projectId?: string },
): CrossProjectDependency[] {
  if (!filter?.projectId) {
    return deps;
  }
  const pid = filter.projectId;
  return deps.filter((d) => d.sourceProjectId === pid || d.targetProjectId === pid);
}

/**
 * Derive a human-readable title from a story ID.
 * Strips the leading "epic-storyNumber-" prefix (e.g. "51-1-" or "49-3-"),
 * joins remaining parts with spaces.
 */
export function deriveStoryTitle(storyId: string): string {
  const parts = storyId.split("-");
  // Skip first two segments (epic number + story sub-number), e.g. "51-1-cross-project-deps" → "cross project deps"
  const titleParts = parts.length > 2 ? parts.slice(2) : parts.slice(1);
  return titleParts.length > 0 ? titleParts.join(" ") : storyId;
}

/**
 * Search for stories across all configured projects.
 * Matches by story ID substring or title (derived from story ID).
 * sprintData maps projectId → development_status.
 */
export function searchCrossProjectStories(
  config: OrchestratorConfig,
  sprintData: SprintDataMap,
  query: string,
): StorySummary[] {
  const results: StorySummary[] = [];
  const trimmed = query.trim();
  if (!trimmed) return results;
  const lowerQuery = trimmed.toLowerCase();

  for (const projectId of Object.keys(config.projects)) {
    const projectData = sprintData[projectId];
    if (!projectData) continue;

    for (const [storyId, status] of Object.entries(projectData.development_status)) {
      // Skip epics and retrospectives
      if (storyId.startsWith("epic-") || storyId.endsWith("-retrospective")) continue;

      const title = deriveStoryTitle(storyId);
      if (storyId.toLowerCase().includes(lowerQuery) || title.toLowerCase().includes(lowerQuery)) {
        results.push({ id: storyId, title, status, projectId });
      }
    }
  }

  return results;
}

/**
 * Resolve max concurrent capacity for a project.
 * Uses project-level sharedPool.maxConcurrent, global maxConcurrentAgents, or default.
 */
export function resolveDepMaxCapacity(config: OrchestratorConfig, projectId?: string): number {
  if (projectId) {
    const project = config.projects[projectId];
    if (project?.sharedPool?.enabled && project.sharedPool.maxConcurrent !== undefined) {
      return project.sharedPool.maxConcurrent;
    }
  }

  if (config.maxConcurrentAgents !== undefined) {
    return config.maxConcurrentAgents;
  }

  return DEFAULT_MAX_CONCURRENT;
}

// =============================================================================
// STATUS RESOLUTION (pure functions — no I/O)
// =============================================================================

/** Terminal status that satisfies a cross-project dependency. */
const DONE_STATUS = "done";

// =============================================================================
// GRAPH TYPES (Story 51.4 — Cross-Project Dependency Graph)
// =============================================================================

/** A node in the cross-project dependency graph representing a story. */
export interface CrossProjectGraphNode {
  /** Unique node ID: `${projectId}::${storyId}`. */
  readonly id: string;
  /** Story ID. */
  readonly storyId: string;
  /** Project ID the story belongs to. */
  readonly projectId: string;
  /** Human-readable project name. */
  readonly projectName: string;
  /** Current story status. */
  readonly status: string;
  /** Whether this story is blocked by unresolved cross-project deps. */
  readonly isBlocked: boolean;
}

/** An edge in the cross-project dependency graph representing a dependency. */
export interface CrossProjectGraphEdge {
  /** Dependency ID (from CrossProjectDependency.id). */
  readonly id: string;
  /** Node ID of the source (dependent/blocked) story. */
  readonly sourceNodeId: string;
  /** Node ID of the target (prerequisite) story. */
  readonly targetNodeId: string;
  /** Project ID of the source story. */
  readonly sourceProjectId: string;
  /** Project ID of the target story. */
  readonly targetProjectId: string;
  /** Whether this dependency is resolved (target story is done). */
  readonly isResolved: boolean;
}

/** A graph structure for cross-project dependency visualization. */
export interface CrossProjectGraph {
  /** All unique story nodes in the graph. */
  readonly nodes: CrossProjectGraphNode[];
  /** All dependency edges. */
  readonly edges: CrossProjectGraphEdge[];
  /** Stories grouped by project ID: projectId → node IDs. */
  readonly projectGroups: Record<string, string[]>;
}

// =============================================================================
// GRAPH BUILDER (pure function — no I/O, Story 51.4)
// =============================================================================

/**
 * Build a graph structure from enriched cross-project dependencies.
 * Transforms flat DependencyWithStatus[] into nodes, edges, and project groups.
 *
 * @param deps - Dependencies enriched with target status
 * @param projectNames - Map of projectId → human-readable project name
 * @param sprintData - Optional sprint data for determining blocked status of source stories
 */
export function buildCrossProjectGraph(
  deps: DependencyWithStatus[],
  projectNames: Record<string, string>,
  sprintData?: SprintDataMap,
): CrossProjectGraph {
  if (deps.length === 0) {
    return { nodes: [], edges: [], projectGroups: {} };
  }

  // Collect unique story nodes (deduplicate by projectId::storyId)
  const nodeMap = new Map<string, CrossProjectGraphNode>();
  const projectGroups: Record<string, string[]> = {};

  const ensureNode = (projectId: string, storyId: string, statusHint?: string): void => {
    const nodeId = `${projectId}::${storyId}`;
    if (nodeMap.has(nodeId)) return;

    const projectName = projectNames[projectId] ?? projectId;
    const sprintStatus = sprintData?.[projectId]?.development_status?.[storyId];
    // Use sprint data status first, then hint from DependencyWithStatus, then "unknown"
    const status = sprintStatus ?? statusHint ?? "unknown";
    // A story is "blocked" if it's a source story with status "blocked"
    const isBlocked = status === "blocked";

    nodeMap.set(nodeId, { id: nodeId, storyId, projectId, projectName, status, isBlocked });

    const group = projectGroups[projectId] ?? [];
    group.push(nodeId);
    projectGroups[projectId] = group;
  };

  // Build edges
  const edges: CrossProjectGraphEdge[] = [];

  for (const dep of deps) {
    ensureNode(dep.sourceProjectId, dep.sourceStoryId);
    ensureNode(dep.targetProjectId, dep.targetStoryId, dep.targetStatus);

    edges.push({
      id: dep.id,
      sourceNodeId: `${dep.sourceProjectId}::${dep.sourceStoryId}`,
      targetNodeId: `${dep.targetProjectId}::${dep.targetStoryId}`,
      sourceProjectId: dep.sourceProjectId,
      targetProjectId: dep.targetProjectId,
      isResolved: dep.isResolved,
    });
  }

  return {
    nodes: Array.from(nodeMap.values()),
    edges,
    projectGroups,
  };
}

/**
 * Resolve the status of a single dependency's target story.
 * Returns the dependency enriched with `targetStatus` and `isResolved`.
 * If the target project or story is not found in sprint data, status is "unknown".
 */
export function resolveDependencyStatus(
  dep: CrossProjectDependency,
  sprintDataMap: SprintDataMap,
): DependencyWithStatus {
  const projectData = sprintDataMap[dep.targetProjectId];
  const targetStatus = projectData?.development_status?.[dep.targetStoryId] ?? "unknown";
  return {
    ...dep,
    targetStatus,
    isResolved: targetStatus === DONE_STATUS,
  };
}

/**
 * Resolve status for all dependencies in the list.
 * Maps over deps, enriching each with live target story status.
 */
export function resolveAllDependencyStatuses(
  deps: CrossProjectDependency[],
  sprintDataMap: SprintDataMap,
): DependencyWithStatus[] {
  return deps.map((dep) => resolveDependencyStatus(dep, sprintDataMap));
}

/**
 * Check if all cross-project dependencies for a story are satisfied.
 * Returns `{ satisfied: true }` if the story has no cross-project deps
 * or all targets are "done". Otherwise returns `{ satisfied: false, outstanding }`.
 */
export function areCrossProjectDepsSatisfied(
  projectId: string,
  storyId: string,
  deps: CrossProjectDependency[],
  sprintDataMap: SprintDataMap,
): { satisfied: boolean; outstanding: DependencyWithStatus[] } {
  const sourceDeps = deps.filter(
    (d) => d.sourceProjectId === projectId && d.sourceStoryId === storyId,
  );

  if (sourceDeps.length === 0) {
    return { satisfied: true, outstanding: [] };
  }

  const enriched = resolveAllDependencyStatuses(sourceDeps, sprintDataMap);
  const outstanding = enriched.filter((d) => !d.isResolved);

  return {
    satisfied: outstanding.length === 0,
    outstanding,
  };
}

/**
 * Get all dependencies where the target story is NOT done (blocked deps).
 * Useful for dashboard alerts and notification triggers.
 */
export function getBlockedCrossProjectDeps(
  deps: CrossProjectDependency[],
  sprintDataMap: SprintDataMap,
): DependencyWithStatus[] {
  const enriched = resolveAllDependencyStatuses(deps, sprintDataMap);
  return enriched.filter((d) => !d.isResolved);
}

/**
 * Compute updated blocking start times for all cross-project dependencies.
 * Pure function — preserves existing start times for still-blocked deps,
 * adds new timestamps for newly blocked deps, and removes resolved deps.
 *
 * @param deps - All cross-project dependencies
 * @param sprintDataMap - Sprint data for status resolution
 * @param currentTimes - Existing blocking start times (depId → ISO timestamp)
 * @param now - Optional date override for testing (defaults to current time)
 */
export function computeBlockingStartTimes(
  deps: CrossProjectDependency[],
  sprintDataMap: SprintDataMap,
  currentTimes: BlockingStartTimeMap,
  now?: Date,
): BlockingStartTimeMap {
  if (deps.length === 0) return {};

  const blocked = getBlockedCrossProjectDeps(deps, sprintDataMap);
  const blockedIds = new Set(blocked.map((d) => d.id));
  const timestamp = (now ?? new Date()).toISOString();

  const result: BlockingStartTimeMap = {};

  // Keep existing start times for still-blocked deps
  for (const [depId, startTime] of Object.entries(currentTimes)) {
    if (blockedIds.has(depId)) {
      result[depId] = startTime;
    }
    // Resolved deps are simply omitted (cleared)
  }

  // Add new start times for newly blocked deps
  for (const dep of blocked) {
    if (!(dep.id in result)) {
      result[dep.id] = timestamp;
    }
  }

  return result;
}

/**
 * Get blocking alerts for dependencies that have been blocking beyond a threshold.
 * Pure function — filters blocked deps, computes duration, returns alerts.
 *
 * @param deps - All cross-project dependencies
 * @param sprintDataMap - Sprint data for status resolution
 * @param blockingStartTimes - Map of depId → when blocking started
 * @param thresholdMs - Minimum blocking duration to trigger alert (ms)
 * @param now - Optional date override for testing (defaults to current time)
 */
export function getBlockingAlerts(
  deps: CrossProjectDependency[],
  sprintDataMap: SprintDataMap,
  blockingStartTimes: BlockingStartTimeMap,
  thresholdMs: number,
  now?: Date,
): DependencyBlockingAlert[] {
  if (deps.length === 0 || Object.keys(blockingStartTimes).length === 0) return [];

  const blocked = getBlockedCrossProjectDeps(deps, sprintDataMap);
  const currentTime = (now ?? new Date()).getTime();

  const alerts: DependencyBlockingAlert[] = [];

  for (const dep of blocked) {
    const startTime = blockingStartTimes[dep.id];
    if (!startTime) continue;

    const startMs = new Date(startTime).getTime();
    if (isNaN(startMs)) continue;

    const durationMs = currentTime - startMs;
    if (durationMs < 0) continue;

    alerts.push({
      dep,
      blockedStoryId: dep.sourceStoryId,
      blockedProjectId: dep.sourceProjectId,
      blockingStoryId: dep.targetStoryId,
      blockingProjectId: dep.targetProjectId,
      blockingDurationMs: durationMs,
      blockingDurationLabel: formatDurationLabel(durationMs),
      thresholdExceeded: durationMs >= thresholdMs,
    });
  }

  return alerts;
}

/** Default blocking notification threshold: 1 hour in milliseconds. */
export const DEFAULT_BLOCKING_THRESHOLD_MS = 3_600_000;

/**
 * Format a duration in milliseconds to a human-readable label.
 * Examples: "<1m", "5m", "1h 30m", "2d 5h"
 */
export function formatDurationLabel(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return "<1m";
  if (ms < 60_000) return "<1m";

  const totalMinutes = Math.floor(ms / 60_000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const days = Math.floor(hours / 24);
  const remainingHours = hours % 24;

  if (days > 0) {
    return remainingHours > 0 ? `${days}d ${remainingHours}h` : `${days}d`;
  }
  if (hours > 0) {
    return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
  }
  return `${minutes}m`;
}

/**
 * Find dependencies where the completed story is the target.
 * Returns deps that have the given project/story as their target — i.e., deps
 * whose source stories are blocked by (depend on) the completed story.
 */
export function findCrossProjectDependents(
  completedProjectId: string,
  completedStoryId: string,
  deps: CrossProjectDependency[],
): CrossProjectDependency[] {
  return deps.filter(
    (d) => d.targetProjectId === completedProjectId && d.targetStoryId === completedStoryId,
  );
}

/** A source story eligible for auto-unblocking. */
export interface UnblockCandidate {
  readonly projectId: string;
  readonly storyId: string;
}

/**
 * Determine which source stories should be auto-unblocked after a story completes.
 * Pure function — finds dependents of the completed story, checks whether each
 * dependent's ALL cross-project deps are satisfied, and returns eligible candidates.
 *
 * Single-pass only (no cascading): only direct dependents of the completed story
 * are checked. If unblocking story B would also satisfy story A's deps, story A
 * is NOT returned here — it will be unblocked when story B is later marked done.
 */
export function autoUnblockCrossProjectDeps(
  completedProjectId: string,
  completedStoryId: string,
  deps: CrossProjectDependency[],
  sprintDataMap: SprintDataMap,
): UnblockCandidate[] {
  const dependents = findCrossProjectDependents(completedProjectId, completedStoryId, deps);
  if (dependents.length === 0) return [];

  // Group by unique (sourceProjectId, sourceStoryId) to avoid duplicate checks
  const seen = new Set<string>();
  const candidates: UnblockCandidate[] = [];

  for (const dep of dependents) {
    const key = `${dep.sourceProjectId}::${dep.sourceStoryId}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const { satisfied } = areCrossProjectDepsSatisfied(
      dep.sourceProjectId,
      dep.sourceStoryId,
      deps,
      sprintDataMap,
    );

    if (satisfied) {
      candidates.push({ projectId: dep.sourceProjectId, storyId: dep.sourceStoryId });
    }
  }

  return candidates;
}

// =============================================================================
// FILE-BASED STORE IMPLEMENTATION
// =============================================================================

/** Store interface for cross-project dependency persistence. */
export interface CrossProjectDepStore {
  /** Add a new dependency. */
  add(dep: Omit<CrossProjectDependency, "id" | "createdAt">): CrossProjectDependency;
  /** Remove a dependency by ID. */
  remove(depId: string): CrossProjectDependency | null;
  /** Get dependencies involving a specific story. */
  getForStory(projectId: string, storyId: string): CrossProjectDependency[];
  /** List all dependencies, optionally filtered by project. */
  list(filter?: { projectId?: string }): CrossProjectDependency[];
}

/**
 * File-based store for cross-project dependencies.
 * Persists to cross-project-deps.yaml alongside the orchestrator config.
 */
export class CrossProjectDepFileStore implements CrossProjectDepStore {
  readonly filePath: string;

  constructor(filePath: string) {
    this.filePath = filePath;
  }

  add(dep: Omit<CrossProjectDependency, "id" | "createdAt">): CrossProjectDependency {
    const existing = this.#loadDeps();
    const result = addCrossProjectDependency(
      existing,
      dep.sourceProjectId,
      dep.sourceStoryId,
      dep.targetProjectId,
      dep.targetStoryId,
    );
    this.#saveDeps(result.deps);
    return result.added;
  }

  remove(depId: string): CrossProjectDependency | null {
    const existing = this.#loadDeps();
    const result = removeCrossProjectDependency(existing, depId);
    this.#saveDeps(result.deps);
    return result.removed;
  }

  getForStory(projectId: string, storyId: string): CrossProjectDependency[] {
    return getDependenciesForStory(this.#loadDeps(), projectId, storyId);
  }

  list(filter?: { projectId?: string }): CrossProjectDependency[] {
    return listDependencies(this.#loadDeps(), filter);
  }

  #saveDeps(deps: CrossProjectDependency[]): void {
    writeFileSync(this.filePath, stringify({ dependencies: deps }));
  }

  #loadDeps(): CrossProjectDependency[] {
    if (!existsSync(this.filePath)) {
      return [];
    }
    try {
      const content = readFileSync(this.filePath, "utf-8");
      const data = parse(content);
      if (!Array.isArray(data.dependencies)) return [];

      // Validate each entry has required fields
      return data.dependencies.filter(
        (dep: unknown): dep is CrossProjectDependency =>
          typeof dep === "object" &&
          dep !== null &&
          typeof (dep as Record<string, unknown>).id === "string" &&
          typeof (dep as Record<string, unknown>).sourceProjectId === "string" &&
          typeof (dep as Record<string, unknown>).sourceStoryId === "string" &&
          typeof (dep as Record<string, unknown>).targetProjectId === "string" &&
          typeof (dep as Record<string, unknown>).targetStoryId === "string" &&
          typeof (dep as Record<string, unknown>).createdAt === "string",
      );
    } catch {
      return [];
    }
  }
}

/**
 * Create a CrossProjectDepFileStore from the config file path.
 * The deps file lives alongside the config file.
 */
export function createCrossProjectDepStore(configPath: string): CrossProjectDepFileStore {
  const dir = dirname(configPath);
  return new CrossProjectDepFileStore(join(dir, CROSS_PROJECT_DEPS_FILENAME));
}
