/**
 * Cumulative Flow Diagram (CFD) — computes daily story counts per column
 * over a time range for stacked area chart visualization.
 */

import type { ProjectConfig } from "@composio/ao-core";
import { readHistory, type HistoryEntry } from "./history.js";
import { readSprintStatus, getEpicStoryIds } from "./sprint-status-reader.js";
import { getColumns } from "./workflow-columns.js";
const DEFAULT_DAYS = 30;

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface CfdDataPoint {
  date: string; // YYYY-MM-DD
  columns: Record<string, number>; // column → cumulative count
}

export interface CfdResult {
  dataPoints: CfdDataPoint[];
  columns: string[]; // ordered column names
  dateRange: { from: string; to: string };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function dateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function addDays(d: Date, n: number): Date {
  const result = new Date(d);
  result.setUTCDate(result.getUTCDate() + n);
  return result;
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export function computeCfd(
  project: ProjectConfig,
  opts?: { epicFilter?: string; days?: number },
): CfdResult {
  const days = opts?.days ?? DEFAULT_DAYS;
  const columns = [...getColumns(project)];

  // Read current sprint status
  let storyIds: string[];
  let currentStatuses: Record<string, string>;
  try {
    const sprint = readSprintStatus(project);
    const epicStoryIds = opts?.epicFilter ? getEpicStoryIds(sprint, opts.epicFilter) : null;

    // Collect all story IDs (skip epic-level entries)
    storyIds = [];
    currentStatuses = {};
    for (const [id, entry] of Object.entries(sprint.development_status)) {
      const status = typeof entry.status === "string" ? entry.status : "backlog";
      if (id.startsWith("epic-") || status.startsWith("epic-")) continue;
      if (epicStoryIds && !epicStoryIds.has(id)) continue;
      storyIds.push(id);
      currentStatuses[id] = status;
    }
  } catch {
    return { dataPoints: [], columns, dateRange: { from: "", to: "" } };
  }

  if (storyIds.length === 0) {
    return { dataPoints: [], columns, dateRange: { from: "", to: "" } };
  }

  // Read history
  let history = readHistory(project);
  const epicStorySet = new Set(storyIds);
  history = history.filter((e) => epicStorySet.has(e.storyId));

  // Sort history chronologically
  history.sort((a, b) => a.timestamp.localeCompare(b.timestamp));

  // Build date range
  const today = new Date();
  const from = addDays(today, -days + 1);
  const fromStr = dateStr(from);
  const toStr = dateStr(today);

  // Initialize story statuses — walk history to find initial state before range
  const storyState: Record<string, string> = {};
  for (const id of storyIds) {
    storyState[id] = "backlog"; // default
  }

  // Index history entries by date for efficient lookup
  const historyByDate = new Map<string, HistoryEntry[]>();
  for (const entry of history) {
    const day = entry.timestamp.slice(0, 10);
    if (day < fromStr) {
      // Pre-range: update initial state
      storyState[entry.storyId] = entry.toStatus;
    } else {
      const list = historyByDate.get(day) ?? [];
      list.push(entry);
      historyByDate.set(day, list);
    }
  }

  // Walk through each day in range, applying transitions
  const dataPoints: CfdDataPoint[] = [];
  let current = new Date(from);

  while (current <= today) {
    const day = dateStr(current);

    // Apply transitions for this day
    const dayEntries = historyByDate.get(day);
    if (dayEntries) {
      for (const entry of dayEntries) {
        if (storyState[entry.storyId] !== undefined) {
          storyState[entry.storyId] = entry.toStatus;
        }
      }
    }

    // Snapshot counts per column
    const counts: Record<string, number> = {};
    for (const col of columns) {
      counts[col] = 0;
    }

    for (const id of storyIds) {
      const status = storyState[id] ?? "backlog";
      if (counts[status] !== undefined) {
        counts[status]++;
      } else {
        // Unknown column — put in backlog
        counts["backlog"] = (counts["backlog"] ?? 0) + 1;
      }
    }

    dataPoints.push({ date: day, columns: counts });
    current = addDays(current, 1);
  }

  return { dataPoints, columns, dateRange: { from: fromStr, to: toStr } };
}
