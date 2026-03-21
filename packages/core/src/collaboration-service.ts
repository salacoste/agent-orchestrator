/**
 * Collaboration Service — Multi-agent coordination for dependent stories
 *
 * Provides:
 * - Dependency-aware scheduling (block agents until prerequisites done)
 * - Cross-agent context sharing (what files were modified by predecessor)
 * - Handoff protocol (auto-unblock + notify on prerequisite completion)
 * - File conflict detection (advisory locking across worktrees)
 * - Collaboration graph (agent dependencies + handoff status)
 */

import type { SessionLearning } from "./types.js";

// =============================================================================
// Types
// =============================================================================

/** Dependency status for a story */
export interface StoryDependency {
  storyId: string;
  dependsOn: string[];
  status: "ready" | "waiting" | "completed";
  assignedAgent?: string;
  waitingOn?: string[];
}

/** Handoff record when a prerequisite story completes */
export interface HandoffRecord {
  fromStoryId: string;
  fromAgentId: string;
  toStoryId: string;
  toAgentId?: string;
  filesModified: string[];
  completedAt: string;
  handoffAt: string;
}

/** File conflict detected between agents */
export interface FileConflict {
  filePath: string;
  agentA: string;
  storyA: string;
  agentB: string;
  storyB: string;
  detectedAt: string;
}

/** Collaboration graph entry for display */
export interface CollabGraphEntry {
  agentId: string;
  storyId: string;
  status: "active" | "waiting" | "completed" | "blocked";
  waitingOn: string[];
  waitingDurationMs: number;
}

// =============================================================================
// Dependency Scheduling
// =============================================================================

/**
 * Determine which stories are ready for assignment based on dependency chains.
 * Stories whose prerequisites are all completed are "ready".
 */
export function getReadyStories(
  dependencies: StoryDependency[],
  completedStories: Set<string>,
): StoryDependency[] {
  return dependencies
    .filter((d) => d.status !== "completed")
    .map((d) => {
      const unmetDeps = d.dependsOn.filter((dep) => !completedStories.has(dep));
      return {
        ...d,
        status: unmetDeps.length === 0 ? ("ready" as const) : ("waiting" as const),
        waitingOn: unmetDeps,
      };
    })
    .filter((d) => d.status === "ready");
}

// =============================================================================
// Context Sharing
// =============================================================================

/**
 * Build context summary from predecessor's learning record.
 * Used to inject "what changed" into the next agent's prompt.
 */
export function buildHandoffContext(learning: SessionLearning): string {
  const files =
    learning.filesModified.length > 0
      ? learning.filesModified.slice(0, 10).join(", ")
      : "no files tracked";
  const domains = learning.domainTags.join(", ") || "general";
  return `Agent ${learning.agentId} completed ${learning.storyId} (${learning.outcome}). Modified: ${files}. Domains: ${domains}.`;
}

// =============================================================================
// File Conflict Detection
// =============================================================================

/**
 * Detect file conflicts between active agents.
 * Compares files modified by each agent's learning history.
 */
export function detectFileConflicts(activeLearnings: Map<string, SessionLearning>): FileConflict[] {
  const conflicts: FileConflict[] = [];
  const entries = [...activeLearnings.entries()];

  for (let i = 0; i < entries.length; i++) {
    for (let j = i + 1; j < entries.length; j++) {
      const [agentA, learningA] = entries[i];
      const [agentB, learningB] = entries[j];

      const filesA = new Set(learningA.filesModified);
      const overlapping = learningB.filesModified.filter((f) => filesA.has(f));

      for (const filePath of overlapping) {
        conflicts.push({
          filePath,
          agentA,
          storyA: learningA.storyId,
          agentB,
          storyB: learningB.storyId,
          detectedAt: new Date().toISOString(),
        });
      }
    }
  }

  return conflicts;
}

// =============================================================================
// Collaboration Graph
// =============================================================================

/**
 * Build collaboration graph from dependency data.
 */
export function buildCollabGraph(
  dependencies: StoryDependency[],
  completedStories: Set<string>,
): CollabGraphEntry[] {
  const now = Date.now();

  return dependencies.map((d) => {
    const unmetDeps = d.dependsOn.filter((dep) => !completedStories.has(dep));
    const isCompleted = completedStories.has(d.storyId);

    let status: CollabGraphEntry["status"];
    if (isCompleted) {
      status = "completed";
    } else if (unmetDeps.length > 0) {
      status = "waiting";
    } else if (d.assignedAgent) {
      status = "active";
    } else {
      status = "blocked";
    }

    return {
      agentId: d.assignedAgent ?? "unassigned",
      storyId: d.storyId,
      status,
      waitingOn: unmetDeps,
      waitingDurationMs: status === "waiting" ? now : 0,
    };
  });
}
