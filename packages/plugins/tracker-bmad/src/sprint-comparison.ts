/**
 * Sprint comparison — multi-metric comparison across weekly periods.
 *
 * Compares velocity, cycle time, flow efficiency, WIP, bottleneck,
 * and carry-over across ISO weeks.
 */

import type { ProjectConfig } from "@composio/ao-core";
import { readHistory, type HistoryEntry } from "./history.js";
import {
  readSprintStatus,
  getEpicStoryIds,
  getPoints,
  hasPointsData,
} from "./sprint-status-reader.js";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ACTIVE_COLUMNS = new Set(["in-progress", "review"]);
const DEFAULT_WEEKS = 4;

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type MetricTrend = "improving" | "stable" | "declining";

export interface PeriodMetrics {
  weekStart: string;
  completedCount: number;
  completedPoints?: number;
  avgCycleTimeMs: number;
  flowEfficiency: number; // 0-1
  bottleneckColumn: string | null;
  carryOverCount: number;
  avgWip: number;
}

export interface SprintComparisonResult {
  periods: PeriodMetrics[];
  trends: {
    velocity: MetricTrend;
    cycleTime: MetricTrend; // decreasing = improving
    flowEfficiency: MetricTrend;
    wip: MetricTrend; // decreasing = improving
  };
  hasPoints: boolean;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Get Monday of the week for a given date string. */
function weekStart(dateStr: string): string {
  const d = new Date(dateStr);
  const day = d.getUTCDay();
  const diff = d.getUTCDate() - day + (day === 0 ? -6 : 1);
  d.setUTCDate(diff);
  return d.toISOString().slice(0, 10);
}

function weekEnd(mondayStr: string): Date {
  const d = new Date(mondayStr);
  d.setUTCDate(d.getUTCDate() + 6);
  d.setUTCHours(23, 59, 59, 999);
  return d;
}

function computeTrend(values: number[], invertBetter: boolean = false): MetricTrend {
  if (values.length < 2) return "stable";
  const avg = values.reduce((s, v) => s + v, 0) / values.length;
  const last = values[values.length - 1] ?? 0;
  if (avg === 0) return "stable";
  const change = (last - avg) / avg;
  const threshold = 0.1;

  if (invertBetter) {
    // For metrics where decrease is good (cycle time, wip)
    if (change < -threshold) return "improving";
    if (change > threshold) return "declining";
  } else {
    // For metrics where increase is good (velocity, flow efficiency)
    if (change > threshold) return "improving";
    if (change < -threshold) return "declining";
  }
  return "stable";
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export function computeSprintComparison(
  project: ProjectConfig,
  opts?: { weeks?: number; epicFilter?: string },
): SprintComparisonResult {
  const numWeeks = opts?.weeks ?? DEFAULT_WEEKS;
  let history = readHistory(project);

  if (history.length === 0) {
    return {
      periods: [],
      trends: { velocity: "stable", cycleTime: "stable", flowEfficiency: "stable", wip: "stable" },
      hasPoints: false,
    };
  }

  // Load sprint status for points
  const pointsMap: Record<string, number> = {};
  let pointsPresent = false;
  try {
    const sprint = readSprintStatus(project);
    pointsPresent = hasPointsData(sprint);

    if (opts?.epicFilter) {
      const epicStoryIds = getEpicStoryIds(sprint, opts.epicFilter);
      history = history.filter((e) => epicStoryIds.has(e.storyId));
    }

    for (const [id, entry] of Object.entries(sprint.development_status)) {
      pointsMap[id] = getPoints(entry);
    }
  } catch {
    // Continue without points
  }

  if (history.length === 0) {
    return {
      periods: [],
      trends: { velocity: "stable", cycleTime: "stable", flowEfficiency: "stable", wip: "stable" },
      hasPoints: false,
    };
  }

  // Sort chronologically
  history.sort((a, b) => a.timestamp.localeCompare(b.timestamp));

  // Group entries by story
  const byStory = new Map<string, HistoryEntry[]>();
  for (const entry of history) {
    const list = byStory.get(entry.storyId) ?? [];
    list.push(entry);
    byStory.set(entry.storyId, list);
  }

  // Determine the weeks to analyze
  const today = new Date();
  const currentWeekStart = weekStart(today.toISOString());
  const weeks: string[] = [];
  const d = new Date(currentWeekStart);
  for (let i = 0; i < numWeeks; i++) {
    weeks.unshift(d.toISOString().slice(0, 10));
    d.setUTCDate(d.getUTCDate() - 7);
  }

  // Compute per-week metrics
  const periods: PeriodMetrics[] = [];

  for (const ws of weeks) {
    const we = weekEnd(ws);
    const wsTime = new Date(ws).getTime();
    const weTime = we.getTime();

    // Completed stories this week
    let completedCount = 0;
    let completedPoints = 0;
    const cycleTimes: number[] = [];

    // Flow efficiency per story
    let totalActiveDwell = 0;
    let totalDwell = 0;

    // Track in-flight stories at any point during the week
    const inFlightStories = new Set<string>();

    // Column dwell times for bottleneck
    const columnDwells = new Map<string, number[]>();

    for (const [storyId, entries] of byStory) {
      // Find last done transition in this week
      let completedInWeek = false;
      for (let i = entries.length - 1; i >= 0; i--) {
        const e = entries[i];
        if (!e) continue;
        const ts = new Date(e.timestamp).getTime();
        if (e.toStatus === "done" && ts >= wsTime && ts <= weTime) {
          completedInWeek = true;
          break;
        }
      }

      if (completedInWeek) {
        completedCount++;
        completedPoints += pointsMap[storyId] ?? 1;

        // Compute cycle time for this story
        const firstActive = entries.find(
          (e) => e.toStatus === "in-progress" || e.toStatus === "review",
        );
        const lastDone = [...entries].reverse().find((e) => e.toStatus === "done");
        if (firstActive && lastDone) {
          const ct =
            new Date(lastDone.timestamp).getTime() - new Date(firstActive.timestamp).getTime();
          cycleTimes.push(Math.max(0, ct));
        }
      }

      // Flow efficiency — compute dwells for transitions in this week
      for (let i = 0; i < entries.length - 1; i++) {
        const current = entries[i];
        const next = entries[i + 1];
        if (!current || !next) continue;
        const currentTs = new Date(current.timestamp).getTime();
        const nextTs = new Date(next.timestamp).getTime();

        // Only count dwells that overlap with this week
        const overlapStart = Math.max(currentTs, wsTime);
        const overlapEnd = Math.min(nextTs, weTime);
        if (overlapStart < overlapEnd) {
          const dwell = overlapEnd - overlapStart;
          totalDwell += dwell;
          if (ACTIVE_COLUMNS.has(current.toStatus)) {
            totalActiveDwell += dwell;
          }

          // Track in-flight
          if (ACTIVE_COLUMNS.has(current.toStatus)) {
            inFlightStories.add(storyId);
          }

          // Column dwells for bottleneck
          const col = current.toStatus;
          const list = columnDwells.get(col) ?? [];
          list.push(dwell);
          columnDwells.set(col, list);
        }
      }

      // Check if story was active at any point during the week
      for (const e of entries) {
        const ts = new Date(e.timestamp).getTime();
        if (ts >= wsTime && ts <= weTime && ACTIVE_COLUMNS.has(e.toStatus)) {
          inFlightStories.add(storyId);
        }
      }
    }

    const avgCycleTimeMs =
      cycleTimes.length > 0 ? cycleTimes.reduce((s, v) => s + v, 0) / cycleTimes.length : 0;

    const flowEfficiency = totalDwell > 0 ? totalActiveDwell / totalDwell : 0;

    // Bottleneck: column with highest avg dwell
    let bottleneckColumn: string | null = null;
    let maxAvgDwell = 0;
    for (const [col, dwells] of columnDwells) {
      const avg = dwells.reduce((s, d) => s + d, 0) / dwells.length;
      if (avg > maxAvgDwell) {
        maxAvgDwell = avg;
        bottleneckColumn = col;
      }
    }

    // Carry-over: stories in active columns at end of week but not done
    let carryOverCount = 0;
    for (const [_storyId, entries] of byStory) {
      // Find the status at end of week
      let lastStatus: string | null = null;
      for (const e of entries) {
        const ts = new Date(e.timestamp).getTime();
        if (ts <= weTime) {
          lastStatus = e.toStatus;
        }
      }
      if (lastStatus && ACTIVE_COLUMNS.has(lastStatus)) {
        carryOverCount++;
      }
    }

    const period: PeriodMetrics = {
      weekStart: ws,
      completedCount,
      avgCycleTimeMs,
      flowEfficiency,
      bottleneckColumn,
      carryOverCount,
      avgWip: inFlightStories.size,
    };

    if (pointsPresent) {
      period.completedPoints = completedPoints;
    }

    periods.push(period);
  }

  // Compute trends
  const velocities = periods.map((p) => p.completedCount);
  const cycleTimesAll = periods.map((p) => p.avgCycleTimeMs);
  const efficiencies = periods.map((p) => p.flowEfficiency);
  const wips = periods.map((p) => p.avgWip);

  return {
    periods,
    trends: {
      velocity: computeTrend(velocities),
      cycleTime: computeTrend(cycleTimesAll, true),
      flowEfficiency: computeTrend(efficiencies),
      wip: computeTrend(wips, true),
    },
    hasPoints: pointsPresent,
  };
}
