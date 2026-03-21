/**
 * Assignment Service — priority-based story assignment for multi-agent orchestration.
 *
 * Provides:
 * - Priority-based story selection from sprint-status.yaml
 * - FIFO tiebreaking for equal-priority stories
 * - Dependency resolution (only assign stories whose prereqs are done)
 * - Exclusion of stories already assigned to active agents
 *
 * Architecture:
 * - In-memory only (Redis sorted set deferred to Epic 2)
 * - Reads sprint-status.yaml on each call (no caching)
 * - Uses AgentRegistry for active assignment checks
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parse } from "yaml";
import type { AgentRegistry } from "./types.js";

/**
 * A story candidate eligible for assignment.
 */
export interface StoryCandidate {
  /** Story ID from sprint-status.yaml (e.g., "1-5-multi-agent-assignment") */
  storyId: string;
  /** Assignment priority (higher = assigned first). From priorities map or 0. */
  priority: number;
  /** Epic ID (e.g., "epic-1") */
  epicId: string;
  /** Ordinal position in development_status for FIFO tiebreaking (0-based) */
  position: number;
}

/**
 * Result of dependency resolution for a story.
 */
export interface DependencyResult {
  /** True if all dependencies are satisfied (status === "done") */
  resolved: boolean;
  /** List of dependency story IDs that are NOT yet done */
  unresolved: string[];
}

/**
 * Minimal sprint-status.yaml shape needed for assignment logic.
 * @see packages/cli/src/lib/story-context.ts SprintStatus for the full CLI shape
 */
export interface SprintStatusData {
  development_status: Record<string, string>;
  /** Story-level dependencies (preferred key) */
  story_dependencies?: Record<string, string[]>;
  /** Legacy dependencies key (backward compat) */
  dependencies?: Record<string, string[]>;
  priorities?: Record<string, number>;
}

/**
 * Read and parse sprint-status.yaml from a project path.
 * The path should be the directory containing sprint-status.yaml.
 */
function readSprintData(projectPath: string): SprintStatusData | null {
  const statusPath = join(projectPath, "sprint-status.yaml");

  if (!existsSync(statusPath)) {
    return null;
  }

  try {
    const content = readFileSync(statusPath, "utf-8");
    const parsed = parse(content) as unknown;

    if (!parsed || typeof parsed !== "object") {
      return null;
    }

    const record = parsed as Record<string, unknown>;
    if (!record["development_status"] || typeof record["development_status"] !== "object") {
      return null;
    }

    return {
      development_status: record["development_status"] as Record<string, string>,
      story_dependencies: record["story_dependencies"] as Record<string, string[]> | undefined,
      dependencies: record["dependencies"] as Record<string, string[]> | undefined,
      priorities: record["priorities"] as Record<string, number> | undefined,
    };
  } catch {
    return null;
  }
}

const STORY_KEY_PATTERN = /^(\d+)-\d+-/;

/**
 * Check if a key is a story (not an epic or retrospective).
 */
function isStoryKey(key: string): boolean {
  return STORY_KEY_PATTERN.test(key) && !key.startsWith("epic-") && !key.includes("retrospective");
}

/**
 * Extract epic ID from a story key (e.g., "1-5-multi-agent" -> "epic-1").
 */
function extractEpicId(storyId: string): string {
  const match = storyId.match(/^(\d+)-/);
  return match ? `epic-${match[1]}` : "unknown";
}

/**
 * Resolve dependencies for a story.
 * Returns whether all dependencies are satisfied and which ones are not.
 */
export function resolveDependencies(
  storyId: string,
  sprintData: SprintStatusData,
): DependencyResult {
  // Prefer story_dependencies, fall back to dependencies for backward compat
  const deps = sprintData.story_dependencies?.[storyId] ?? sprintData.dependencies?.[storyId];

  if (!deps || deps.length === 0) {
    return { resolved: true, unresolved: [] };
  }

  const unresolved: string[] = [];
  for (const depId of deps) {
    const depStatus = sprintData.development_status[depId];
    if (depStatus !== "done") {
      unresolved.push(depId);
    }
  }

  return { resolved: unresolved.length === 0, unresolved };
}

/**
 * Get all assignable stories sorted by priority (descending) then FIFO position.
 *
 * A story is assignable if:
 * 1. Status is "ready-for-dev" (backlog stories are excluded — not yet contexted)
 * 2. No active agent assignment exists (via registry.findActiveByStory)
 * 3. All dependencies are resolved (status === "done")
 */
export function getAssignableStories(
  projectPath: string,
  registry: AgentRegistry,
): StoryCandidate[] {
  const sprintData = readSprintData(projectPath);
  if (!sprintData) {
    return [];
  }

  const candidates: StoryCandidate[] = [];
  let storyPosition = 0;

  for (const [key, status] of Object.entries(sprintData.development_status)) {
    if (!isStoryKey(key)) {
      continue;
    }

    const currentPosition = storyPosition++;

    // Only consider ready-for-dev stories (backlog stories haven't been contexted yet)
    if (status !== "ready-for-dev") {
      continue;
    }

    // Skip stories that already have an active assignment
    const activeAssignment = registry.findActiveByStory(key);
    if (activeAssignment) {
      continue;
    }

    // Skip stories with unresolved dependencies
    const depResult = resolveDependencies(key, sprintData);
    if (!depResult.resolved) {
      continue;
    }

    const priority = sprintData.priorities?.[key] ?? 0;

    candidates.push({
      storyId: key,
      priority,
      epicId: extractEpicId(key),
      position: currentPosition,
    });
  }

  // Sort by priority descending, then by position ascending (FIFO)
  candidates.sort((a, b) => {
    if (b.priority !== a.priority) {
      return b.priority - a.priority;
    }
    return a.position - b.position;
  });

  return candidates;
}

/**
 * Select the next story to assign to an agent.
 * Returns the highest-priority assignable story, or null if none are available.
 */
export function selectNextStory(
  projectPath: string,
  registry: AgentRegistry,
): StoryCandidate | null {
  const candidates = getAssignableStories(projectPath, registry);
  return candidates.length > 0 ? candidates[0] : null;
}
