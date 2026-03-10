/**
 * Cycle time analytics — transforms JSONL history into actionable metrics.
 *
 * Computes per-story cycle times, column dwell times, throughput, and
 * bottleneck detection from the sprint-history.jsonl event log.
 */

import type { ProjectConfig } from "@composio/ao-core";
import { readHistory, type HistoryEntry } from "./history.js";
import { readSprintStatus, getEpicStoryIds } from "./sprint-status-reader.js";
import { getDoneColumn } from "./workflow-columns.js";

const BACKLOG = "backlog";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface ColumnDwell {
  column: string;
  dwellMs: number;
}

export interface StoryCycleTime {
  storyId: string;
  startedAt: string;
  completedAt: string;
  cycleTimeMs: number;
  columnDwells: ColumnDwell[];
}

export interface CycleTimeStats {
  stories: StoryCycleTime[];
  averageCycleTimeMs: number;
  medianCycleTimeMs: number;
  averageColumnDwells: ColumnDwell[];
  bottleneckColumn: string | null;
  throughputPerDay: number;
  throughputPerWeek: number;
  completedCount: number;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return ((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2;
  }
  return sorted[mid] ?? 0;
}

function computeColumnDwells(entries: HistoryEntry[]): ColumnDwell[] {
  if (entries.length < 2) return [];

  const dwells: ColumnDwell[] = [];
  for (let i = 0; i < entries.length - 1; i++) {
    const current = entries[i];
    const next = entries[i + 1];
    if (!current || !next) continue;
    const dwellMs = new Date(next.timestamp).getTime() - new Date(current.timestamp).getTime();
    if (dwellMs >= 0) {
      dwells.push({ column: current.toStatus, dwellMs });
    }
  }
  return dwells;
}

function computeThroughput(stories: StoryCycleTime[], windowMs: number): number {
  if (stories.length === 0) return 0;
  const now = Date.now();
  const cutoff = now - windowMs;
  const inWindow = stories.filter((s) => new Date(s.completedAt).getTime() >= cutoff);
  const windowDays = windowMs / (1000 * 60 * 60 * 24);
  return inWindow.length / windowDays;
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

const EMPTY_STATS: CycleTimeStats = {
  stories: [],
  averageCycleTimeMs: 0,
  medianCycleTimeMs: 0,
  averageColumnDwells: [],
  bottleneckColumn: null,
  throughputPerDay: 0,
  throughputPerWeek: 0,
  completedCount: 0,
};

export function computeCycleTime(project: ProjectConfig, epicFilter?: string): CycleTimeStats {
  const DONE = getDoneColumn(project);

  let history = readHistory(project);
  if (history.length === 0) return { ...EMPTY_STATS };

  // Filter by epic if requested
  if (epicFilter) {
    try {
      const sprint = readSprintStatus(project);
      const epicIds = getEpicStoryIds(sprint, epicFilter);
      history = history.filter((e) => epicIds.has(e.storyId));
    } catch {
      // Sprint status unavailable — skip filtering
    }
  }

  if (history.length === 0) return { ...EMPTY_STATS };

  // Group entries by storyId, preserving chronological order
  const byStory = new Map<string, HistoryEntry[]>();
  for (const entry of history) {
    const list = byStory.get(entry.storyId) ?? [];
    list.push(entry);
    byStory.set(entry.storyId, list);
  }

  const completedStories: StoryCycleTime[] = [];

  for (const [storyId, entries] of byStory) {
    // Sort by timestamp (should already be ordered, but be safe)
    entries.sort((a, b) => a.timestamp.localeCompare(b.timestamp));

    // Find last completion — handles bouncing (done→in-progress→done)
    let lastDoneIdx = -1;
    for (let i = entries.length - 1; i >= 0; i--) {
      if (entries[i]?.toStatus === DONE) {
        lastDoneIdx = i;
        break;
      }
    }
    if (lastDoneIdx === -1) continue; // Never reached done

    // startedAt: first entry where story leaves backlog, or first entry overall
    const firstNonBacklog = entries.find((e) => e.fromStatus === BACKLOG);
    const startEntry = firstNonBacklog ?? entries[0];
    const completionEntry = entries[lastDoneIdx];
    if (!startEntry || !completionEntry) continue;

    const startedAt = startEntry.timestamp;
    const completedAt = completionEntry.timestamp;
    const cycleTimeMs = new Date(completedAt).getTime() - new Date(startedAt).getTime();

    // Compute column dwells up to and including the last done transition
    const relevantEntries = entries.slice(0, lastDoneIdx + 1);
    const columnDwells = computeColumnDwells(relevantEntries);

    completedStories.push({
      storyId,
      startedAt,
      completedAt,
      cycleTimeMs: Math.max(0, cycleTimeMs),
      columnDwells,
    });
  }

  if (completedStories.length === 0) return { ...EMPTY_STATS };

  // Aggregate cycle times
  const cycleTimes = completedStories.map((s) => s.cycleTimeMs);
  const averageCycleTimeMs = cycleTimes.reduce((sum, t) => sum + t, 0) / cycleTimes.length;
  const medianCycleTimeMs = median(cycleTimes);

  // Aggregate per-column average dwell times
  const columnTotals = new Map<string, { totalMs: number; count: number }>();
  for (const story of completedStories) {
    for (const dwell of story.columnDwells) {
      const existing = columnTotals.get(dwell.column) ?? {
        totalMs: 0,
        count: 0,
      };
      existing.totalMs += dwell.dwellMs;
      existing.count += 1;
      columnTotals.set(dwell.column, existing);
    }
  }

  const averageColumnDwells: ColumnDwell[] = [];
  for (const [column, { totalMs, count }] of columnTotals) {
    averageColumnDwells.push({ column, dwellMs: Math.round(totalMs / count) });
  }
  // Sort by dwell time descending for easy bottleneck identification
  averageColumnDwells.sort((a, b) => b.dwellMs - a.dwellMs);

  const bottleneckColumn =
    averageColumnDwells.length > 0 ? (averageColumnDwells[0]?.column ?? null) : null;

  // Throughput — trailing 7 days and 4 weeks
  const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
  const FOUR_WEEKS_MS = 28 * 24 * 60 * 60 * 1000;
  const throughputPerDay = computeThroughput(completedStories, SEVEN_DAYS_MS);
  const throughputPerWeek = computeThroughput(completedStories, FOUR_WEEKS_MS) * 7;

  return {
    stories: completedStories,
    averageCycleTimeMs,
    medianCycleTimeMs,
    averageColumnDwells,
    bottleneckColumn,
    throughputPerDay,
    throughputPerWeek,
    completedCount: completedStories.length,
  };
}
