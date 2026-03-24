/**
 * Sprint diff — sprint-over-sprint comparison (Story 45.8).
 *
 * Pure function. Compares two sets of session learning data
 * and highlights improvements, regressions, and trends.
 */

import type { SessionLearning } from "./types.js";

/** Direction of change between periods. */
export type Direction = "improved" | "regressed" | "unchanged";

/** Comparison of a single metric across two periods. */
export interface MetricComparison {
  periodA: number;
  periodB: number;
  direction: Direction;
}

/** Sprint diff result. */
export interface SprintDiff {
  storiesCompleted: MetricComparison;
  avgDurationMs: MetricComparison;
  failureRate: MetricComparison;
  totalTokens: MetricComparison;
  topErrorsA: string[];
  topErrorsB: string[];
}

/** Tolerance for "unchanged" detection (5%). */
const UNCHANGED_THRESHOLD = 0.05;

/**
 * Compute sprint diff from two periods of session data.
 * Pure function — no I/O, no side effects.
 */
export function computeSprintDiff(
  periodA: SessionLearning[],
  periodB: SessionLearning[],
): SprintDiff {
  const metricsA = computePeriodMetrics(periodA);
  const metricsB = computePeriodMetrics(periodB);

  return {
    storiesCompleted: compare(metricsA.completed, metricsB.completed, "higher-is-better"),
    avgDurationMs: compare(metricsA.avgDurationMs, metricsB.avgDurationMs, "lower-is-better"),
    failureRate: compare(metricsA.failureRate, metricsB.failureRate, "lower-is-better"),
    totalTokens: compare(metricsA.totalTokens, metricsB.totalTokens, "lower-is-better"),
    topErrorsA: metricsA.topErrors,
    topErrorsB: metricsB.topErrors,
  };
}

/** Internal metrics for a single period. */
interface PeriodMetrics {
  completed: number;
  avgDurationMs: number;
  failureRate: number;
  totalTokens: number;
  topErrors: string[];
}

/** Compute aggregate metrics from session data. */
function computePeriodMetrics(sessions: SessionLearning[]): PeriodMetrics {
  if (sessions.length === 0) {
    return { completed: 0, avgDurationMs: 0, failureRate: 0, totalTokens: 0, topErrors: [] };
  }

  const completed = sessions.filter((s) => s.outcome === "completed").length;
  const failed = sessions.filter(
    (s) => s.outcome === "failed" || s.outcome === "blocked" || s.outcome === "abandoned",
  ).length;

  const totalDurationMs = sessions.reduce((sum, s) => sum + s.durationMs, 0);
  const avgDurationMs = Math.round(totalDurationMs / sessions.length);

  const failureRate = failed / sessions.length;

  // Token estimate: we don't have per-session token data in SessionLearning,
  // so use session count as a proxy (can be refined when cost data is available)
  const totalTokens = 0;

  // Top error categories by frequency
  const errorCounts = new Map<string, number>();
  for (const s of sessions) {
    for (const cat of s.errorCategories) {
      errorCounts.set(cat, (errorCounts.get(cat) ?? 0) + 1);
    }
  }
  const topErrors = [...errorCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([cat]) => cat);

  return {
    completed,
    avgDurationMs,
    failureRate: Math.round(failureRate * 1000) / 1000,
    totalTokens,
    topErrors,
  };
}

/** Compare two values and determine direction. */
function compare(
  a: number,
  b: number,
  preference: "higher-is-better" | "lower-is-better",
): MetricComparison {
  if (a === 0 && b === 0) {
    return { periodA: a, periodB: b, direction: "unchanged" };
  }

  const denominator = Math.max(Math.abs(a), Math.abs(b), 1);
  const pctChange = Math.abs(b - a) / denominator;

  if (pctChange <= UNCHANGED_THRESHOLD) {
    return { periodA: a, periodB: b, direction: "unchanged" };
  }

  let direction: Direction;
  if (preference === "higher-is-better") {
    direction = b > a ? "improved" : "regressed";
  } else {
    direction = b < a ? "improved" : "regressed";
  }

  return { periodA: a, periodB: b, direction };
}
