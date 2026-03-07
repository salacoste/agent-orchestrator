/**
 * Shared sprint-status.yaml reader — extracted to avoid circular imports.
 *
 * Both sprint-health.ts and forecast.ts need to read sprint status,
 * but importing from ./index.js would create circular dependencies.
 */

import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { parse as parseYaml } from "yaml";
import type { ProjectConfig } from "@composio/ao-core";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SprintStatusEntry {
  status: string;
  epic?: string;
  points?: number;
  assignedSession?: string;
  [key: string]: unknown;
}

export interface SprintStatus {
  development_status: Record<string, SprintStatusEntry>;
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function getOutputDir(project: ProjectConfig): string {
  const v = project.tracker?.["outputDir"];
  return typeof v === "string" ? v : "_bmad-output";
}

export function sprintStatusPath(project: ProjectConfig): string {
  return join(project.path, getOutputDir(project), "sprint-status.yaml");
}

export function readSprintStatus(project: ProjectConfig): SprintStatus {
  const filePath = sprintStatusPath(project);
  if (!existsSync(filePath)) {
    throw new Error(`sprint-status.yaml not found at ${filePath}`);
  }
  try {
    const content = readFileSync(filePath, "utf-8");
    const parsed: unknown = parseYaml(content);
    if (!parsed || typeof parsed !== "object" || !("development_status" in parsed)) {
      throw new Error("sprint-status.yaml missing 'development_status' key");
    }
    const devStatus = (parsed as SprintStatus).development_status;
    if (!devStatus || typeof devStatus !== "object" || Array.isArray(devStatus)) {
      throw new Error("sprint-status.yaml 'development_status' must be a mapping");
    }
    // Coerce non-string field values (YAML numbers, booleans) to strings
    // so downstream code can safely call .startsWith() etc.
    for (const entry of Object.values(devStatus)) {
      if (entry.status !== undefined && typeof entry.status !== "string") {
        entry.status = String(entry.status);
      }
      if (entry.epic !== undefined && typeof entry.epic !== "string") {
        entry.epic = String(entry.epic);
      }
      // Coerce points to number if present
      if (entry.points !== undefined) {
        const parsed = Number(entry.points);
        entry.points = isNaN(parsed) ? undefined : parsed;
      }
      // Coerce assignedSession to string if present
      if (entry.assignedSession !== undefined && typeof entry.assignedSession !== "string") {
        entry.assignedSession = String(entry.assignedSession);
      }
    }

    return parsed as SprintStatus;
  } catch (err) {
    if (err instanceof Error && err.message.includes("sprint-status.yaml")) {
      throw err;
    }
    throw new Error(
      `Failed to parse sprint-status.yaml: ${err instanceof Error ? err.message : String(err)}`,
      { cause: err },
    );
  }
}

// ---------------------------------------------------------------------------
// Points helpers
// ---------------------------------------------------------------------------

/** True if any story entry in the sprint has a numeric `points` value > 0. */
export function hasPointsData(sprint: SprintStatus): boolean {
  for (const entry of Object.values(sprint.development_status)) {
    if (typeof entry.points === "number" && entry.points > 0) return true;
  }
  return false;
}

/** Get the points for a sprint entry — returns entry.points if defined, else 1. */
export function getPoints(entry: SprintStatusEntry): number {
  return typeof entry.points === "number" ? entry.points : 1;
}

// ---------------------------------------------------------------------------
// Epic filter helpers
// ---------------------------------------------------------------------------

/** Get the set of story IDs belonging to a given epic. */
export function getEpicStoryIds(sprint: SprintStatus, epicId: string): Set<string> {
  const ids = new Set<string>();
  for (const [id, entry] of Object.entries(sprint.development_status)) {
    if (entry.epic === epicId) {
      ids.add(id);
    }
  }
  return ids;
}
