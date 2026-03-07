/**
 * Auto-status transitions for BMad tracker stories.
 *
 * When a PR merges, the associated story should automatically transition
 * to "done". This module provides the logic for detecting which story
 * a branch belongs to and performing the status transition.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { parse as parseYaml, stringify as stringifyYaml } from "yaml";
import type { ProjectConfig } from "@composio/ao-core";
import { readSprintStatus, sprintStatusPath, type SprintStatus } from "./sprint-status-reader.js";
import { appendHistory } from "./history.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AutoTransitionEvent {
  type: "tracker.story_done";
  storyId: string;
  timestamp: string; // ISO-8601
  previousStatus: string;
  prUrl?: string;
}

export interface AutoTransitionResult {
  transitioned: boolean;
  storyId: string;
  previousStatus: string;
  newStatus: string;
  event: AutoTransitionEvent | null;
  reason: string; // "transitioned" | "already_done" | "story_not_found"
}

// ---------------------------------------------------------------------------
// Functions
// ---------------------------------------------------------------------------

/**
 * Write an updated status for a story in sprint-status.yaml.
 *
 * Reads the current YAML, updates the story's status field, and writes
 * the full document back. Uses the `yaml` package for round-trip parsing.
 *
 * When transitioning to "done", the assignedSession is automatically cleared.
 */
export function writeStoryStatus(project: ProjectConfig, storyId: string, newStatus: string): void {
  const filePath = sprintStatusPath(project);
  const content = readFileSync(filePath, "utf-8");
  const sprint: unknown = parseYaml(content);

  if (!sprint || typeof sprint !== "object" || !("development_status" in sprint)) {
    throw new Error("sprint-status.yaml missing 'development_status' key");
  }

  const typed = sprint as SprintStatus;
  const entry = typed.development_status[storyId];
  if (!entry) {
    throw new Error(`Story '${storyId}' not found in sprint-status.yaml`);
  }

  entry.status = newStatus;
  // Clear assignment when story is completed
  if (newStatus === "done") {
    delete entry.assignedSession;
  }
  writeFileSync(filePath, stringifyYaml(typed), "utf-8");
}

/**
 * Write or clear the assigned session for a story in sprint-status.yaml.
 *
 * Used to track which agent session is working on a story.
 * Pass `null` to clear the assignment.
 */
export function writeStoryAssignment(
  project: ProjectConfig,
  storyId: string,
  sessionId: string | null,
): void {
  const filePath = sprintStatusPath(project);
  const content = readFileSync(filePath, "utf-8");
  const sprint: unknown = parseYaml(content);

  if (!sprint || typeof sprint !== "object" || !("development_status" in sprint)) {
    throw new Error("sprint-status.yaml missing 'development_status' key");
  }

  const typed = sprint as SprintStatus;
  const entry = typed.development_status[storyId];
  if (!entry) {
    throw new Error(`Story '${storyId}' not found in sprint-status.yaml`);
  }

  if (sessionId === null) {
    delete entry.assignedSession;
  } else {
    entry.assignedSession = sessionId;
  }
  writeFileSync(filePath, stringifyYaml(typed), "utf-8");
}

/**
 * Write story points for a story in sprint-status.yaml.
 *
 * Reads the current YAML, sets the story's points field, and writes
 * the full document back. Validates that points is a positive integer.
 */
export function writeStoryPoints(project: ProjectConfig, storyId: string, points: number): void {
  if (!Number.isInteger(points) || points < 0) {
    throw new Error("Points must be a non-negative integer");
  }

  const filePath = sprintStatusPath(project);
  const content = readFileSync(filePath, "utf-8");
  const sprint: unknown = parseYaml(content);

  if (!sprint || typeof sprint !== "object" || !("development_status" in sprint)) {
    throw new Error("sprint-status.yaml missing 'development_status' key");
  }

  const typed = sprint as SprintStatus;
  const entry = typed.development_status[storyId];
  if (!entry) {
    throw new Error(`Story '${storyId}' not found in sprint-status.yaml`);
  }

  entry.points = points;
  writeFileSync(filePath, stringifyYaml(typed), "utf-8");
}

/**
 * Transition a story to "done" when its PR merges.
 *
 * - If the story is not found, returns reason "story_not_found".
 * - If the story is already "done", returns reason "already_done".
 * - Otherwise transitions to "done", appends history, and returns an event.
 */
export function transitionOnMerge(
  project: ProjectConfig,
  storyId: string,
  prUrl?: string,
): AutoTransitionResult {
  const sprint = readSprintStatus(project);
  const entry = sprint.development_status[storyId];

  if (!entry) {
    return {
      transitioned: false,
      storyId,
      previousStatus: "",
      newStatus: "",
      event: null,
      reason: "story_not_found",
    };
  }

  const currentStatus = typeof entry.status === "string" ? entry.status : "backlog";

  if (currentStatus === "done") {
    return {
      transitioned: false,
      storyId,
      previousStatus: "done",
      newStatus: "done",
      event: null,
      reason: "already_done",
    };
  }

  writeStoryStatus(project, storyId, "done");
  appendHistory(project, storyId, currentStatus, "done");

  const event: AutoTransitionEvent = {
    type: "tracker.story_done",
    storyId,
    timestamp: new Date().toISOString(),
    previousStatus: currentStatus,
    prUrl,
  };

  return {
    transitioned: true,
    storyId,
    previousStatus: currentStatus,
    newStatus: "done",
    event,
    reason: "transitioned",
  };
}

/**
 * Batch-update statuses for multiple stories in a single YAML read/write cycle.
 *
 * Returns the list of story IDs that were successfully updated.
 * Throws if sprint-status.yaml is missing or malformed.
 * Skips stories that don't exist (does not throw).
 */
export function batchWriteStoryStatus(
  project: ProjectConfig,
  updates: Array<{ storyId: string; newStatus: string }>,
): string[] {
  if (updates.length === 0) return [];

  const filePath = sprintStatusPath(project);
  const content = readFileSync(filePath, "utf-8");
  const sprint: unknown = parseYaml(content);

  if (!sprint || typeof sprint !== "object" || !("development_status" in sprint)) {
    throw new Error("sprint-status.yaml missing 'development_status' key");
  }

  const typed = sprint as SprintStatus;
  const updated: string[] = [];

  for (const { storyId, newStatus } of updates) {
    const entry = typed.development_status[storyId];
    if (!entry) continue;

    const oldStatus = typeof entry.status === "string" ? entry.status : "backlog";
    entry.status = newStatus;
    if (newStatus === "done") {
      delete entry.assignedSession;
    }
    updated.push(storyId);
    appendHistory(project, storyId, oldStatus, newStatus);
  }

  if (updated.length > 0) {
    writeFileSync(filePath, stringifyYaml(typed), "utf-8");
  }

  return updated;
}

/**
 * Find the story ID associated with a branch name.
 *
 * BMad convention: branch names contain the story ID, e.g.
 * "feat/story-1-add-auth" contains story ID "story-1".
 *
 * Checks all story IDs from the sprint status and returns the one
 * that appears in the branch name. Returns null if no match.
 */
export function findStoryForPR(project: ProjectConfig, branchName: string): string | null {
  const sprint = readSprintStatus(project);
  const storyIds = Object.keys(sprint.development_status);

  // Sort by ID length descending so longer (more specific) IDs match first.
  // e.g. "story-1-2" should match before "story-1" in branch "feat/story-1-2-feature".
  const sorted = [...storyIds].sort((a, b) => b.length - a.length);

  for (const id of sorted) {
    if (branchName.includes(id)) {
      return id;
    }
  }

  return null;
}
