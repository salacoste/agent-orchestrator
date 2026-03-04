/**
 * Story detail analytics — provides per-story transition history,
 * column dwell times, and cycle time for a single story.
 */

import type { ProjectConfig } from "@composio/ao-core";
import { readHistory } from "./history.js";
import { readSprintStatus } from "./sprint-status-reader.js";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface StoryTransition {
  timestamp: string; // ISO-8601
  fromStatus: string;
  toStatus: string;
  dwellMs: number | null; // time spent in fromStatus before this transition (null for first)
}

export interface StoryDetail {
  storyId: string;
  currentStatus: string;
  epic: string | null;
  transitions: StoryTransition[];
  columnDwells: Array<{ column: string; totalDwellMs: number }>;
  totalCycleTimeMs: number | null; // null if not yet done
  startedAt: string | null; // first non-backlog transition timestamp
  completedAt: string | null; // done transition timestamp
  isCompleted: boolean;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const BACKLOG = "backlog";
const DONE = "done";
const UNKNOWN = "unknown";

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export function getStoryDetail(storyId: string, project: ProjectConfig): StoryDetail {
  // 1. Read sprint status to get current status and epic
  let currentStatus = UNKNOWN;
  let epic: string | null = null;

  try {
    const sprint = readSprintStatus(project);
    const entry = sprint.development_status[storyId];
    if (entry) {
      currentStatus = typeof entry.status === "string" ? entry.status : BACKLOG;
      epic = typeof entry.epic === "string" ? entry.epic : null;
    }
  } catch {
    // sprint-status.yaml missing or unreadable — treat as unknown
  }

  // 10. Story not found in sprint status
  if (currentStatus === UNKNOWN) {
    return {
      storyId,
      currentStatus: UNKNOWN,
      epic: null,
      transitions: [],
      columnDwells: [],
      totalCycleTimeMs: null,
      startedAt: null,
      completedAt: null,
      isCompleted: false,
    };
  }

  // 2. Read history and filter entries for this story
  const allHistory = readHistory(project);
  const storyEntries = allHistory.filter((e) => e.storyId === storyId);

  // 11. Story exists but has no history
  if (storyEntries.length === 0) {
    return {
      storyId,
      currentStatus,
      epic,
      transitions: [],
      columnDwells: [],
      totalCycleTimeMs: null,
      startedAt: null,
      completedAt: null,
      isCompleted: currentStatus === DONE,
    };
  }

  // 3. Sort by timestamp ascending
  storyEntries.sort((a, b) => a.timestamp.localeCompare(b.timestamp));

  // 4. Build transitions array
  const transitions: StoryTransition[] = [];
  for (let i = 0; i < storyEntries.length; i++) {
    const entry = storyEntries[i]!;
    let dwellMs: number | null = null;

    if (i > 0) {
      const prev = storyEntries[i - 1]!;
      dwellMs = new Date(entry.timestamp).getTime() - new Date(prev.timestamp).getTime();
    }

    transitions.push({
      timestamp: entry.timestamp,
      fromStatus: entry.fromStatus,
      toStatus: entry.toStatus,
      dwellMs,
    });
  }

  // 5. Build columnDwells — aggregate total time in each column
  const dwellMap = new Map<string, number>();
  for (let i = 0; i < storyEntries.length - 1; i++) {
    const current = storyEntries[i]!;
    const next = storyEntries[i + 1]!;
    const dwell = new Date(next.timestamp).getTime() - new Date(current.timestamp).getTime();
    if (dwell >= 0) {
      const column = current.toStatus;
      dwellMap.set(column, (dwellMap.get(column) ?? 0) + dwell);
    }
  }

  const columnDwells: Array<{ column: string; totalDwellMs: number }> = [];
  for (const [column, totalDwellMs] of dwellMap) {
    columnDwells.push({ column, totalDwellMs });
  }
  // Sort by total dwell time descending
  columnDwells.sort((a, b) => b.totalDwellMs - a.totalDwellMs);

  // 6. startedAt: first transition where fromStatus is "backlog", or first transition overall
  const firstNonBacklog = storyEntries.find((e) => e.fromStatus === BACKLOG);
  const startEntry = firstNonBacklog ?? storyEntries[0]!;
  const startedAt = startEntry.timestamp;

  // 7. completedAt: timestamp of last transition where toStatus is "done" (or null)
  let completedAt: string | null = null;
  for (let i = storyEntries.length - 1; i >= 0; i--) {
    if (storyEntries[i]!.toStatus === DONE) {
      completedAt = storyEntries[i]!.timestamp;
      break;
    }
  }

  // 8. totalCycleTimeMs
  let totalCycleTimeMs: number | null = null;
  if (completedAt !== null) {
    totalCycleTimeMs = new Date(completedAt).getTime() - new Date(startedAt).getTime();
    totalCycleTimeMs = Math.max(0, totalCycleTimeMs);
  }

  // 9. isCompleted
  const isCompleted = currentStatus === DONE;

  return {
    storyId,
    currentStatus,
    epic,
    transitions,
    columnDwells,
    totalCycleTimeMs,
    startedAt,
    completedAt,
    isCompleted,
  };
}
