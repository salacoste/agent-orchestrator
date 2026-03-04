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
  type: "bmad.story_done";
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
    type: "bmad.story_done",
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
