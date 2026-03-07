/**
 * Sprint archival — archive completed sprint data and carry over unfinished stories.
 */

import type { ProjectConfig } from "@composio/ao-core";
import { readSprintStatus, sprintStatusPath } from "./sprint-status-reader.js";
import { archiveHistory } from "./history.js";
import { writeFileSync } from "node:fs";
import { stringify as stringifyYaml } from "yaml";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ArchiveResult {
  archivePath: string | null;
  archivedEntries: number;
  carriedOver: string[];
  removedDone: string[];
}

// ---------------------------------------------------------------------------
// Functions
// ---------------------------------------------------------------------------

/**
 * Archive the current sprint's history and optionally remove done stories.
 *
 * - Renames sprint-history.jsonl to sprint-history-{date}.jsonl
 * - Optionally removes done stories from sprint-status.yaml
 * - Returns the list of stories carried over (not done)
 */
export function archiveSprint(
  project: ProjectConfig,
  options?: { archiveDone?: boolean },
): ArchiveResult {
  const date = new Date().toISOString().slice(0, 10);
  const archivePath = archiveHistory(project, date);

  // Read current sprint status
  let sprint;
  try {
    sprint = readSprintStatus(project);
  } catch {
    return { archivePath, archivedEntries: 0, carriedOver: [], removedDone: [] };
  }

  const carriedOver: string[] = [];
  const removedDone: string[] = [];

  for (const [id, entry] of Object.entries(sprint.development_status)) {
    const status = typeof entry.status === "string" ? entry.status : "backlog";

    if (status === "done") {
      if (options?.archiveDone) {
        removedDone.push(id);
      }
    } else {
      carriedOver.push(id);
    }
  }

  // Remove done stories if requested — rebuild the map without them
  if (options?.archiveDone && removedDone.length > 0) {
    const removedSet = new Set(removedDone);
    const filtered: typeof sprint.development_status = {};
    for (const [id, entry] of Object.entries(sprint.development_status)) {
      if (!removedSet.has(id)) {
        filtered[id] = entry;
      }
    }
    sprint.development_status = filtered;
    const filePath = sprintStatusPath(project);
    writeFileSync(filePath, stringifyYaml(sprint), "utf-8");
  }

  return {
    archivePath,
    archivedEntries: carriedOver.length + removedDone.length,
    carriedOver,
    removedDone,
  };
}

/**
 * Get the list of unfinished story IDs from the current sprint.
 */
export function getUnfinishedStories(project: ProjectConfig): string[] {
  let sprint;
  try {
    sprint = readSprintStatus(project);
  } catch {
    return [];
  }

  const unfinished: string[] = [];
  for (const [id, entry] of Object.entries(sprint.development_status)) {
    const status = typeof entry.status === "string" ? entry.status : "backlog";
    if (status !== "done") {
      unfinished.push(id);
    }
  }
  return unfinished;
}
