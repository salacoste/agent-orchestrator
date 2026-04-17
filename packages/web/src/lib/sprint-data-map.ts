/**
 * Shared SprintDataMap builder for cross-project dependency resolution.
 *
 * readSprintStatus() returns SprintStatusEntry objects (with .status, .epic, etc.)
 * but SprintDataMap expects plain status strings. This module flattens each entry
 * to its `.status` field to avoid object-vs-string comparison bugs.
 */

import type { SprintDataMap, OrchestratorConfig } from "@composio/ao-core";

/**
 * Flatten a single SprintStatusEntry to a plain status string.
 * Handles both string entries (already flat) and object entries (with .status field).
 */
export function flattenEntry(entry: unknown): string {
  if (typeof entry === "string") return entry;
  return (entry as { status?: string })?.status ?? "unknown";
}

/**
 * Build a SprintDataMap from all configured projects.
 * Flattens SprintStatusEntry objects to plain status strings.
 */
export async function buildSprintDataMap(
  config: Pick<OrchestratorConfig, "projects">,
): Promise<SprintDataMap> {
  const tracker = await import("@composio/ao-plugin-tracker-bmad");
  const sprintData: SprintDataMap = {};
  for (const [projectId, project] of Object.entries(config.projects)) {
    try {
      const status = tracker.readSprintStatus(project);
      if (status?.development_status) {
        const flatStatus: Record<string, string> = {};
        for (const [storyId, entry] of Object.entries(status.development_status)) {
          flatStatus[storyId] = flattenEntry(entry);
        }
        sprintData[projectId] = { development_status: flatStatus };
      }
    } catch (err) {
      console.warn(
        `[buildSprintDataMap] Failed to read sprint status for project ${projectId}:`,
        err instanceof Error ? err.message : err,
      );
    }
  }
  return sprintData;
}
