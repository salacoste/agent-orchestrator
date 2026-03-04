/**
 * Velocity comparison — weekly throughput analysis with trend detection
 * and linear regression forecasting.
 */

import type { ProjectConfig } from "@composio/ao-core";
import { readHistory } from "./history.js";
import { readSprintStatus } from "./sprint-status-reader.js";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface WeeklyVelocity {
  weekStart: string;
  weekEnd: string;
  completedCount: number;
  storyIds: string[];
}

export interface VelocityComparisonResult {
  weeks: WeeklyVelocity[];
  averageVelocity: number;
  stdDeviation: number;
  trend: "improving" | "stable" | "declining";
  trendSlope: number;
  trendConfidence: number;
  nextWeekEstimate: number;
  currentWeekSoFar: number;
  completionWeeks: number | null;
  remainingStories: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Get the Monday 00:00:00 UTC of the ISO week containing `date`. */
function getWeekStart(date: Date): Date {
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  const day = d.getUTCDay();
  // JS: 0=Sun, 1=Mon … 6=Sat → shift so Mon=0
  const diff = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + diff);
  return d;
}

/** Get the Sunday 23:59:59 of the same ISO week. */
function getWeekEnd(weekStart: Date): Date {
  const d = new Date(weekStart);
  d.setUTCDate(d.getUTCDate() + 6);
  return d;
}

/** ISO date string (YYYY-MM-DD). */
function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * Simple linear regression: y = slope * x + intercept.
 * Returns slope, intercept, and R-squared (coefficient of determination).
 */
function linearRegression(points: Array<{ x: number; y: number }>): {
  slope: number;
  intercept: number;
  rSquared: number;
} {
  const n = points.length;
  if (n < 2) return { slope: 0, intercept: points[0]?.y ?? 0, rSquared: 0 };

  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumXX = 0;
  for (const p of points) {
    sumX += p.x;
    sumY += p.y;
    sumXY += p.x * p.y;
    sumXX += p.x * p.x;
  }

  const denom = n * sumXX - sumX * sumX;
  if (denom === 0) return { slope: 0, intercept: sumY / n, rSquared: 0 };

  const slope = (n * sumXY - sumX * sumY) / denom;
  const intercept = (sumY - slope * sumX) / n;

  // R-squared
  const yMean = sumY / n;
  let ssRes = 0;
  let ssTot = 0;
  for (const p of points) {
    const predicted = slope * p.x + intercept;
    ssRes += (p.y - predicted) ** 2;
    ssTot += (p.y - yMean) ** 2;
  }
  const rSquared = ssTot === 0 ? 0 : 1 - ssRes / ssTot;

  return { slope, intercept, rSquared };
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export function computeVelocityComparison(project: ProjectConfig): VelocityComparisonResult {
  const history = readHistory(project);

  // Collect done-transitions with timestamps
  const completions: Array<{ storyId: string; date: Date }> = [];
  for (const entry of history) {
    if (entry.toStatus === "done") {
      const d = new Date(entry.timestamp);
      if (!isNaN(d.getTime())) {
        completions.push({ storyId: entry.storyId, date: d });
      }
    }
  }

  // Group by ISO week
  const weekMap = new Map<string, { start: Date; end: Date; storyIds: string[] }>();
  for (const c of completions) {
    const ws = getWeekStart(c.date);
    const key = isoDate(ws);
    const existing = weekMap.get(key);
    if (existing) {
      if (!existing.storyIds.includes(c.storyId)) {
        existing.storyIds.push(c.storyId);
      }
    } else {
      weekMap.set(key, { start: ws, end: getWeekEnd(ws), storyIds: [c.storyId] });
    }
  }

  // Sort weeks chronologically
  const sortedKeys = [...weekMap.keys()].sort();
  const weeks: WeeklyVelocity[] = sortedKeys.map((key) => {
    const w = weekMap.get(key)!;
    return {
      weekStart: isoDate(w.start),
      weekEnd: isoDate(w.end),
      completedCount: w.storyIds.length,
      storyIds: w.storyIds,
    };
  });

  if (weeks.length === 0) {
    const remaining = countRemaining(project);
    return {
      weeks: [],
      averageVelocity: 0,
      stdDeviation: 0,
      trend: "stable",
      trendSlope: 0,
      trendConfidence: 0,
      nextWeekEstimate: 0,
      currentWeekSoFar: 0,
      completionWeeks: null,
      remainingStories: remaining,
    };
  }

  // Compute stats
  const counts = weeks.map((w) => w.completedCount);
  const sum = counts.reduce((a, b) => a + b, 0);
  const avg = sum / counts.length;

  const variance =
    counts.length > 1 ? counts.reduce((a, c) => a + (c - avg) ** 2, 0) / counts.length : 0;
  const stdDev = Math.sqrt(variance);

  // Linear regression
  const points = counts.map((y, i) => ({ x: i, y }));
  const { slope, intercept, rSquared } = linearRegression(points);

  // Trend classification
  let trend: "improving" | "stable" | "declining" = "stable";
  if (slope > 0.3) trend = "improving";
  else if (slope < -0.3) trend = "declining";

  // Forecast
  const nextWeekEstimate = Math.max(0, slope * counts.length + intercept);

  // Current partial week
  const now = new Date();
  const currentWeekStart = getWeekStart(now);
  const currentWeekKey = isoDate(currentWeekStart);
  const currentWeekData = weekMap.get(currentWeekKey);
  const currentWeekSoFar = currentWeekData ? currentWeekData.storyIds.length : 0;

  // Remaining stories / completion estimate
  const remaining = countRemaining(project);
  const completionWeeks = avg > 0 ? remaining / avg : null;

  return {
    weeks,
    averageVelocity: avg,
    stdDeviation: stdDev,
    trend,
    trendSlope: slope,
    trendConfidence: rSquared,
    nextWeekEstimate,
    currentWeekSoFar,
    completionWeeks,
    remainingStories: remaining,
  };
}

function countRemaining(project: ProjectConfig): number {
  try {
    const sprint = readSprintStatus(project);
    return Object.values(sprint.development_status).filter((e) => {
      const s = typeof e.status === "string" ? e.status : "backlog";
      return s !== "done" && !s.startsWith("epic-");
    }).length;
  } catch {
    return 0;
  }
}
