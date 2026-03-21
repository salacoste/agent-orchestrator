/**
 * BMADTracker adapter — bridges flat sprint-status.yaml format to the
 * structured BMADTracker interface required by SyncService.
 *
 * Converts between:
 *   - Flat YAML: `{ status: "in-progress", assignedSession: "abc" }`
 *   - StoryState: `{ id, status, title, version, updatedAt, assignedAgent }`
 *
 * Preserves the flat YAML format on disk — conversion happens in memory only.
 */

import { existsSync, statSync } from "node:fs";
import type { BMADTracker, StoryState, StoryStatus, ProjectConfig } from "@composio/ao-core";
import { readSprintStatus, sprintStatusPath } from "./sprint-status-reader.js";
import { writeStoryStatus, writeStoryAssignment } from "./auto-transition.js";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const VALID_STATUSES: ReadonlySet<string> = new Set<StoryStatus>([
  "backlog",
  "ready-for-dev",
  "in-progress",
  "review",
  "done",
  "blocked",
]);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** True if the key represents an epic (e.g. "epic-1", "epic-2"). */
function isEpicKey(key: string): boolean {
  return /^epic-\d+$/.test(key);
}

/** True if the key represents a retrospective (e.g. "epic-1-retrospective"). */
function isRetrospectiveKey(key: string): boolean {
  return key.endsWith("-retrospective");
}

/** True if the key is a story (not an epic, not a retrospective). */
function isStoryKey(key: string): boolean {
  return !isEpicKey(key) && !isRetrospectiveKey(key);
}

/** Coerce a raw status string to a valid StoryStatus, defaulting to "backlog". */
function toStoryStatus(raw: string | undefined): StoryStatus {
  if (raw && VALID_STATUSES.has(raw)) {
    return raw as StoryStatus;
  }
  return "backlog";
}

/** Generate a synthetic version stamp from the file's mtime. */
function syntheticVersion(filePath: string): string {
  try {
    const stats = statSync(filePath);
    return `v${Math.floor(stats.mtimeMs)}-flat`;
  } catch {
    return `v${Date.now()}-flat`;
  }
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Create a BMADTracker adapter that reads/writes sprint-status.yaml
 * through the existing tracker-bmad helpers.
 */
export function createBMADTrackerAdapter(project: ProjectConfig): BMADTracker {
  const filePath = sprintStatusPath(project);

  return {
    name: "bmad-tracker",

    async getStory(storyId: string): Promise<StoryState | null> {
      if (!isStoryKey(storyId)) return null;

      const sprint = readSprintStatus(project);
      const entry = sprint.development_status[storyId];
      if (!entry) return null;

      const version = syntheticVersion(filePath);
      return {
        id: storyId,
        status: toStoryStatus(entry.status),
        title: storyId, // flat format has no title — use ID
        assignedAgent: entry.assignedSession,
        version,
        updatedAt: new Date().toISOString(),
      };
    },

    async updateStory(storyId: string, state: StoryState): Promise<void> {
      writeStoryStatus(project, storyId, state.status);

      // Sync assignedAgent ↔ assignedSession
      if (state.assignedAgent !== undefined) {
        writeStoryAssignment(project, storyId, state.assignedAgent ?? null);
      }
    },

    async listStories(): Promise<Map<string, StoryState>> {
      const result = new Map<string, StoryState>();

      if (!existsSync(filePath)) return result;

      const sprint = readSprintStatus(project);
      const version = syntheticVersion(filePath);
      const now = new Date().toISOString();

      for (const [id, entry] of Object.entries(sprint.development_status)) {
        if (!isStoryKey(id)) continue;

        result.set(id, {
          id,
          status: toStoryStatus(entry.status),
          title: id,
          assignedAgent: entry.assignedSession,
          version,
          updatedAt: now,
        });
      }

      return result;
    },

    async isAvailable(): Promise<boolean> {
      try {
        return existsSync(filePath);
      } catch {
        return false;
      }
    },
  };
}
