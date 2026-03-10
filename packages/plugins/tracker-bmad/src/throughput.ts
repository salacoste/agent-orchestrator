/**
 * Throughput analytics — daily/weekly throughput, lead/cycle time distributions,
 * flow efficiency, and column trend analysis.
 *
 * Extends beyond cycle-time.ts by providing time-series throughput data,
 * lead time (vs cycle time), flow efficiency metrics, and trend detection.
 */

import type { ProjectConfig } from "@composio/ao-core";
import { readHistory, type HistoryEntry } from "./history.js";
import { readSprintStatus, getEpicStoryIds, getPoints } from "./sprint-status-reader.js";
import { getDoneColumn, getActiveColumns } from "./workflow-columns.js";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const BACKLOG = "backlog";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface DailyThroughput {
  date: string;
  count: number;
  points: number;
}

export interface LeadTimeStat {
  storyId: string;
  leadTimeMs: number;
  cycleTimeMs: number;
}

export interface ColumnTrend {
  column: string;
  weeklyAvgMs: number[];
  trend: string;
  slope: number;
}

export interface ThroughputResult {
  dailyThroughput: DailyThroughput[];
  weeklyThroughput: Array<{ weekStart: string; count: number; points: number }>;
  leadTimes: LeadTimeStat[];
  averageLeadTimeMs: number;
  medianLeadTimeMs: number;
  averageCycleTimeMs: number;
  medianCycleTimeMs: number;
  flowEfficiency: number;
  columnTrends: ColumnTrend[];
  bottleneckTrend: string | null;
}

// ---------------------------------------------------------------------------
// Helpers
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

/** Simple linear regression slope. */
function linearSlope(values: number[]): number {
  if (values.length < 2) return 0;
  const n = values.length;
  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumX2 = 0;
  for (let i = 0; i < n; i++) {
    sumX += i;
    sumY += values[i] ?? 0;
    sumXY += i * (values[i] ?? 0);
    sumX2 += i * i;
  }
  const denom = n * sumX2 - sumX * sumX;
  if (denom === 0) return 0;
  return (n * sumXY - sumX * sumY) / denom;
}

function trendLabel(slope: number): string {
  if (slope > 0.05) return "increasing";
  if (slope < -0.05) return "decreasing";
  return "stable";
}

/** Get Monday of the week for a given date string. */
function weekStart(dateStr: string): string {
  const d = new Date(dateStr);
  const day = d.getUTCDay();
  const diff = d.getUTCDate() - day + (day === 0 ? -6 : 1);
  d.setUTCDate(diff);
  return d.toISOString().slice(0, 10);
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

const EMPTY_RESULT: ThroughputResult = {
  dailyThroughput: [],
  weeklyThroughput: [],
  leadTimes: [],
  averageLeadTimeMs: 0,
  medianLeadTimeMs: 0,
  averageCycleTimeMs: 0,
  medianCycleTimeMs: 0,
  flowEfficiency: 0,
  columnTrends: [],
  bottleneckTrend: null,
};

export function computeThroughput(project: ProjectConfig, epicFilter?: string): ThroughputResult {
  let history = readHistory(project);
  if (history.length === 0) return { ...EMPTY_RESULT };

  const DONE = getDoneColumn(project);
  const ACTIVE_COLUMNS = getActiveColumns(project);

  // Load sprint status for points data
  const pointsMap: Record<string, number> = {};
  try {
    const sprint = readSprintStatus(project);

    // Filter by epic if requested
    if (epicFilter) {
      const epicStoryIds = getEpicStoryIds(sprint, epicFilter);
      history = history.filter((e) => epicStoryIds.has(e.storyId));
    }

    // Build points map
    for (const [id, entry] of Object.entries(sprint.development_status)) {
      pointsMap[id] = getPoints(entry);
    }
  } catch {
    // Sprint status unavailable — use count-based metrics only
  }

  if (history.length === 0) return { ...EMPTY_RESULT };

  // Group entries by storyId
  const byStory = new Map<string, HistoryEntry[]>();
  for (const entry of history) {
    const list = byStory.get(entry.storyId) ?? [];
    list.push(entry);
    byStory.set(entry.storyId, list);
  }

  // Sort each story's entries by timestamp
  for (const entries of byStory.values()) {
    entries.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  }

  // --- Daily throughput ---
  const dailyMap = new Map<string, { count: number; points: number }>();
  // Track which stories completed on which day (deduplicate bouncing)
  const dailyStorySet = new Map<string, Set<string>>();

  for (const [storyId, entries] of byStory) {
    // Find last done transition
    for (let i = entries.length - 1; i >= 0; i--) {
      const doneEntry = entries[i];
      if (doneEntry?.toStatus === DONE) {
        const day = doneEntry.timestamp.slice(0, 10);
        const dayStories = dailyStorySet.get(day) ?? new Set();
        if (!dayStories.has(storyId)) {
          dayStories.add(storyId);
          dailyStorySet.set(day, dayStories);
          const existing = dailyMap.get(day) ?? { count: 0, points: 0 };
          existing.count++;
          existing.points += pointsMap[storyId] ?? 1;
          dailyMap.set(day, existing);
        }
        break;
      }
    }
  }

  const dailyThroughput: DailyThroughput[] = Array.from(dailyMap.entries())
    .map(([date, { count, points }]) => ({ date, count, points }))
    .sort((a, b) => a.date.localeCompare(b.date));

  // --- Weekly throughput ---
  const weeklyMap = new Map<string, { count: number; points: number }>();
  for (const day of dailyThroughput) {
    const ws = weekStart(day.date);
    const existing = weeklyMap.get(ws) ?? { count: 0, points: 0 };
    existing.count += day.count;
    existing.points += day.points;
    weeklyMap.set(ws, existing);
  }

  const weeklyThroughput = Array.from(weeklyMap.entries())
    .map(([weekStart, { count, points }]) => ({ weekStart, count, points }))
    .sort((a, b) => a.weekStart.localeCompare(b.weekStart));

  // --- Lead time and cycle time ---
  const leadTimes: LeadTimeStat[] = [];

  for (const [storyId, entries] of byStory) {
    // Find last done transition
    let lastDoneIdx = -1;
    for (let i = entries.length - 1; i >= 0; i--) {
      if (entries[i]?.toStatus === DONE) {
        lastDoneIdx = i;
        break;
      }
    }
    if (lastDoneIdx === -1) continue;

    const doneEntry = entries[lastDoneIdx];
    if (!doneEntry) continue;
    const completedAt = new Date(doneEntry.timestamp).getTime();

    // Lead time: first entry → done
    const firstEntry = entries[0];
    if (!firstEntry) continue;
    const leadTimeMs = Math.max(0, completedAt - new Date(firstEntry.timestamp).getTime());

    // Cycle time: first non-backlog entry → done
    const firstNonBacklog = entries.find((e) => e.fromStatus === BACKLOG);
    const cycleStart = firstNonBacklog ?? firstEntry;
    const cycleTimeMs = Math.max(0, completedAt - new Date(cycleStart.timestamp).getTime());

    leadTimes.push({ storyId, leadTimeMs, cycleTimeMs });
  }

  const leadTimeValues = leadTimes.map((l) => l.leadTimeMs);
  const cycleTimeValues = leadTimes.map((l) => l.cycleTimeMs);

  const averageLeadTimeMs =
    leadTimeValues.length > 0
      ? leadTimeValues.reduce((sum, v) => sum + v, 0) / leadTimeValues.length
      : 0;
  const medianLeadTimeMs = median(leadTimeValues);
  const averageCycleTimeMs =
    cycleTimeValues.length > 0
      ? cycleTimeValues.reduce((sum, v) => sum + v, 0) / cycleTimeValues.length
      : 0;
  const medianCycleTimeMs = median(cycleTimeValues);

  // --- Flow efficiency ---
  // (active column dwell) / (total dwell) for completed stories
  let totalActiveDwell = 0;
  let totalDwell = 0;

  for (const [_storyId, entries] of byStory) {
    let lastDoneIdx = -1;
    for (let i = entries.length - 1; i >= 0; i--) {
      if (entries[i]?.toStatus === DONE) {
        lastDoneIdx = i;
        break;
      }
    }
    if (lastDoneIdx === -1) continue;

    for (let i = 0; i < lastDoneIdx; i++) {
      const current = entries[i];
      const next = entries[i + 1];
      if (!current || !next) continue;
      const dwell = new Date(next.timestamp).getTime() - new Date(current.timestamp).getTime();
      if (dwell >= 0) {
        totalDwell += dwell;
        if (ACTIVE_COLUMNS.has(current.toStatus)) {
          totalActiveDwell += dwell;
        }
      }
    }
  }

  const flowEfficiency = totalDwell > 0 ? totalActiveDwell / totalDwell : 0;

  // --- Column trends ---
  // Group column dwells by week for completed stories
  const columnWeekDwells = new Map<string, Map<string, number[]>>();

  for (const [_storyId, entries] of byStory) {
    let lastDoneIdx = -1;
    for (let i = entries.length - 1; i >= 0; i--) {
      if (entries[i]?.toStatus === DONE) {
        lastDoneIdx = i;
        break;
      }
    }
    if (lastDoneIdx === -1) continue;

    for (let i = 0; i < lastDoneIdx; i++) {
      const current = entries[i];
      const next = entries[i + 1];
      if (!current || !next) continue;
      const dwell = new Date(next.timestamp).getTime() - new Date(current.timestamp).getTime();
      if (dwell >= 0) {
        const col = current.toStatus;
        const ws = weekStart(current.timestamp);
        if (!columnWeekDwells.has(col)) columnWeekDwells.set(col, new Map());
        const colMap = columnWeekDwells.get(col);
        if (!colMap) continue;
        const weekDwells = colMap.get(ws) ?? [];
        weekDwells.push(dwell);
        colMap.set(ws, weekDwells);
      }
    }
  }

  const columnTrends: ColumnTrend[] = [];
  for (const [column, weekMap] of columnWeekDwells) {
    const sortedWeeks = Array.from(weekMap.entries()).sort(([a], [b]) => a.localeCompare(b));
    const weeklyAvgMs = sortedWeeks.map(([, dwells]) => {
      const sum = dwells.reduce((s, d) => s + d, 0);
      return Math.round(sum / dwells.length);
    });
    const slope = linearSlope(weeklyAvgMs);
    columnTrends.push({
      column,
      weeklyAvgMs,
      trend: trendLabel(slope),
      slope,
    });
  }

  // Bottleneck trend: column with highest positive slope
  const bottleneckTrend =
    columnTrends.filter((t) => t.slope > 0).sort((a, b) => b.slope - a.slope)[0]?.column ?? null;

  return {
    dailyThroughput,
    weeklyThroughput,
    leadTimes,
    averageLeadTimeMs,
    medianLeadTimeMs,
    averageCycleTimeMs,
    medianCycleTimeMs,
    flowEfficiency,
    columnTrends,
    bottleneckTrend,
  };
}
