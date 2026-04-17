/**
 * Scenario Snapshot — capture current story state for a what-if scenario (Epic 54, Story 54.1).
 *
 * Pure functions: no I/O, deterministic output from input.
 * The API route handles reading sprint data and calling these functions.
 */

import type { ScenarioStorySnapshot, WhatIfScenario } from "./types";

/** Story keys match pattern X-Y-name or Xa-Y-name. Epics/retros never match. */
const STORY_KEY_PATTERN = /^\d+[a-z]*-\d+-/;

/**
 * Flatten a single SprintStatusEntry to a plain status string.
 * Handles both string entries and object entries with `.status` field.
 */
function flattenStatus(entry: unknown): string {
  if (typeof entry === "string") return entry;
  return (entry as { status?: string })?.status ?? "unknown";
}

/**
 * Extract domain tags from a sprint status entry.
 * Looks for `.domainTags` array on object entries.
 */
function extractDomainTags(entry: unknown): string[] {
  if (typeof entry === "object" && entry !== null) {
    const tags = (entry as { domainTags?: unknown }).domainTags;
    if (Array.isArray(tags)) return tags.filter((t): t is string => typeof t === "string");
  }
  return [];
}

/**
 * Capture a snapshot of story state from the raw development_status data.
 *
 * Filters development_status entries to only those matching selected project IDs,
 * then maps each story entry to a ScenarioStorySnapshot.
 *
 * @param projectData - Map of projectId → development_status record
 * @param projectIds - Projects to include in the snapshot
 * @returns Array of story snapshots
 */
export function captureScenarioSnapshot(
  projectData: Record<string, Record<string, unknown>>,
  projectIds: string[],
): ScenarioStorySnapshot[] {
  const snapshots: ScenarioStorySnapshot[] = [];

  for (const projectId of projectIds) {
    const devStatus = projectData[projectId];
    if (!devStatus) continue;

    for (const [storyId, entry] of Object.entries(devStatus)) {
      // Only capture story keys (X-Y-name pattern), skip epics and retros
      if (!STORY_KEY_PATTERN.test(storyId)) continue;

      snapshots.push({
        id: storyId,
        projectId,
        status: flattenStatus(entry),
        domainTags: extractDomainTags(entry),
      });
    }
  }

  return snapshots;
}

/**
 * Create a new WhatIfScenario with the given parameters.
 *
 * Generates a UUID, sets createdAt to now, and initial status to "draft".
 * Validates that name is non-empty and at least one projectId is provided.
 *
 * @param name - User-provided scenario name
 * @param projectIds - Projects included in the scenario
 * @param stories - Captured story snapshots
 * @returns A new WhatIfScenario
 * @throws Error if name is empty/whitespace or projectIds is empty
 */
export function createScenario(
  name: string,
  projectIds: string[],
  stories: ScenarioStorySnapshot[],
): WhatIfScenario {
  const trimmedName = name.trim();
  if (!trimmedName) {
    throw new Error("Scenario name is required");
  }
  if (projectIds.length === 0) {
    throw new Error("At least one project must be selected");
  }

  return {
    id: crypto.randomUUID(),
    name: trimmedName,
    createdAt: new Date().toISOString(),
    projectIds,
    stories,
    status: "draft",
  };
}
