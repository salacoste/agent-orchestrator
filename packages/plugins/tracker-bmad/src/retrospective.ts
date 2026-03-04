/**
 * Sprint retrospective analytics — groups completed stories by calendar week
 * and computes velocity trends, carry-over counts, and cycle time averages.
 */

import type { ProjectConfig } from "@composio/ao-core";
import { readHistory, type HistoryEntry } from "./history.js";
import { readSprintStatus } from "./sprint-status-reader.js";

// Local constants — avoid importing from ./index.js to prevent circular deps
const DONE = "done";
const BACKLOG = "backlog";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface SprintPeriod {
  startDate: string; // ISO date (Monday of the week)
  endDate: string; // ISO date (Sunday of the week)
  completedCount: number;
  averageCycleTimeMs: number;
  carryOverCount: number; // stories in-progress at period end but not done
  storyIds: string[]; // completed story IDs in this period
}

export interface RetrospectiveResult {
  periods: SprintPeriod[];
  velocityTrend: number[]; // completedCount per period
  averageVelocity: number; // mean of velocityTrend
  velocityChange: number; // % change: last period vs average (-100 to +inf)
  totalCompleted: number;
  overallAverageCycleTimeMs: number;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

const EMPTY_RESULT: RetrospectiveResult = {
  periods: [],
  velocityTrend: [],
  averageVelocity: 0,
  velocityChange: 0,
  totalCompleted: 0,
  overallAverageCycleTimeMs: 0,
};

/**
 * Get the Monday (start of ISO week) for a given date.
 * ISO weeks start on Monday.
 */
function getMonday(date: Date): Date {
  const d = new Date(date);
  const day = d.getUTCDay(); // 0=Sun, 1=Mon, ..., 6=Sat
  const diff = day === 0 ? -6 : 1 - day; // shift to Monday
  d.setUTCDate(d.getUTCDate() + diff);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

/**
 * Format a Date as an ISO date string (YYYY-MM-DD).
 */
function toISODate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * Get Sunday from a Monday start date.
 */
function getSunday(monday: Date): Date {
  const sun = new Date(monday);
  sun.setUTCDate(sun.getUTCDate() + 6);
  return sun;
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export function computeRetrospective(project: ProjectConfig): RetrospectiveResult {
  let history: HistoryEntry[];
  try {
    history = readHistory(project);
  } catch {
    return { ...EMPTY_RESULT };
  }

  if (history.length === 0) return { ...EMPTY_RESULT };

  // Also read sprint status for carry-over detection (best-effort)
  let _sprintStatus: ReturnType<typeof readSprintStatus> | null = null;
  try {
    _sprintStatus = readSprintStatus(project);
  } catch {
    // Sprint status may not exist; carry-over detection degrades gracefully
  }

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

  // Find done transitions and group by week
  // Key = Monday ISO date string, Value = { storyIds, cycleTimes }
  const weekData = new Map<
    string,
    { storyIds: Set<string>; cycleTimes: number[]; activeStoryIds: Set<string> }
  >();

  // Track all story activity by week for carry-over detection
  const weekActivity = new Map<string, Set<string>>();

  // Record which week each entry falls in
  for (const [storyId, entries] of byStory) {
    for (const entry of entries) {
      const ts = new Date(entry.timestamp);
      const monday = getMonday(ts);
      const weekKey = toISODate(monday);

      // Track activity
      const active = weekActivity.get(weekKey) ?? new Set<string>();
      active.add(storyId);
      weekActivity.set(weekKey, active);
    }
  }

  // Find done transitions and compute cycle times
  for (const [storyId, entries] of byStory) {
    // Find all done transitions
    for (const entry of entries) {
      if (entry.toStatus !== DONE) continue;

      const doneTs = new Date(entry.timestamp);
      const monday = getMonday(doneTs);
      const weekKey = toISODate(monday);

      // Compute cycle time: first non-backlog transition to this done transition
      const firstNonBacklog = entries.find((e) => e.fromStatus === BACKLOG);
      const startEntry = firstNonBacklog ?? entries[0]!;
      const cycleTimeMs = Math.max(0, doneTs.getTime() - new Date(startEntry.timestamp).getTime());

      const data = weekData.get(weekKey) ?? {
        storyIds: new Set<string>(),
        cycleTimes: [],
        activeStoryIds: new Set<string>(),
      };

      // Only count each story once per week (even with multiple done transitions)
      if (!data.storyIds.has(storyId)) {
        data.storyIds.add(storyId);
        data.cycleTimes.push(cycleTimeMs);
      }

      weekData.set(weekKey, data);
    }
  }

  if (weekData.size === 0) return { ...EMPTY_RESULT };

  // Build periods sorted by startDate
  const sortedWeeks = [...weekData.keys()].sort();
  const periods: SprintPeriod[] = [];

  for (const weekKey of sortedWeeks) {
    const data = weekData.get(weekKey)!;
    const monday = new Date(weekKey + "T00:00:00.000Z");
    const sunday = getSunday(monday);

    const completedIds = [...data.storyIds];
    const completedCount = completedIds.length;

    // Average cycle time for this period
    const avgCycleTimeMs =
      data.cycleTimes.length > 0
        ? data.cycleTimes.reduce((sum, t) => sum + t, 0) / data.cycleTimes.length
        : 0;

    // Carry-over: stories active this week but NOT completed this week
    const activeThisWeek = weekActivity.get(weekKey) ?? new Set<string>();
    let carryOverCount = 0;
    for (const sid of activeThisWeek) {
      if (!data.storyIds.has(sid)) {
        carryOverCount++;
      }
    }

    periods.push({
      startDate: toISODate(monday),
      endDate: toISODate(sunday),
      completedCount,
      averageCycleTimeMs: avgCycleTimeMs,
      carryOverCount,
      storyIds: completedIds,
    });
  }

  // Velocity trend
  const velocityTrend = periods.map((p) => p.completedCount);

  // Average velocity
  const averageVelocity =
    velocityTrend.length > 0
      ? velocityTrend.reduce((sum, v) => sum + v, 0) / velocityTrend.length
      : 0;

  // Velocity change: last period vs average
  let velocityChange = 0;
  if (velocityTrend.length >= 2 && averageVelocity > 0) {
    const lastVelocity = velocityTrend[velocityTrend.length - 1]!;
    velocityChange = ((lastVelocity - averageVelocity) / averageVelocity) * 100;
  }

  // Total completed
  const totalCompleted = velocityTrend.reduce((sum, v) => sum + v, 0);

  // Overall average cycle time (weighted by period count)
  let totalCycleTimeMs = 0;
  let totalStories = 0;
  for (const period of periods) {
    totalCycleTimeMs += period.averageCycleTimeMs * period.completedCount;
    totalStories += period.completedCount;
  }
  const overallAverageCycleTimeMs = totalStories > 0 ? totalCycleTimeMs / totalStories : 0;

  return {
    periods,
    velocityTrend,
    averageVelocity,
    velocityChange,
    totalCompleted,
    overallAverageCycleTimeMs,
  };
}
