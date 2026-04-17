/**
 * Forecast calibration — compares past forecasts against actual outcomes to
 * measure prediction accuracy. Requires at least 2 completed forecasts.
 */

import type { ProjectConfig } from "@composio/ao-core";
import { readForecastLog } from "./forecast-log.js";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface CalibrationResult {
  /** Total completed forecasts (with actualCompletionDate set) */
  totalForecasts: number;
  /** Count where actual date was on or before P50 */
  withinP50: number;
  /** Count where actual date was on or before P80 */
  withinP80: number;
  /** Count where actual date was on or before P95 */
  withinP95: number;
  /** Percentage of actuals within P50 range */
  p50Accuracy: number;
  /** Percentage of actuals within P80 range */
  p80Accuracy: number;
  /** Percentage of actuals within P95 range */
  p95Accuracy: number;
  /** Bias: fraction of actuals that fell AFTER P50 (>0.5 = optimistic bias) */
  bias: number;
  /** Not enough data for meaningful calibration */
  insufficientData: boolean;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function daysBetween(dateStrA: string, dateStrB: string): number {
  const a = new Date(dateStrA);
  const b = new Date(dateStrB);
  return Math.round((b.getTime() - a.getTime()) / MS_PER_DAY);
}

// ---------------------------------------------------------------------------
// Public export
// ---------------------------------------------------------------------------

/**
 * Compute calibration score from forecast history.
 * Returns `insufficientData: true` when fewer than 2 completed forecasts exist.
 */
export function computeCalibration(project: ProjectConfig, epicFilter?: string): CalibrationResult {
  const allEntries = readForecastLog(project);

  // Filter to completed forecasts (those with actualCompletionDate set)
  const completed = allEntries.filter(
    (e) =>
      e.actualCompletionDate !== undefined &&
      e.actualCompletionDate !== "" &&
      (epicFilter === undefined || e.epicFilter === epicFilter),
  );

  if (completed.length < 2) {
    return {
      totalForecasts: completed.length,
      withinP50: 0,
      withinP80: 0,
      withinP95: 0,
      p50Accuracy: 0,
      p80Accuracy: 0,
      p95Accuracy: 0,
      bias: 0,
      insufficientData: true,
    };
  }

  let withinP50 = 0;
  let withinP80 = 0;
  let withinP95 = 0;
  let afterP50 = 0;

  for (const entry of completed) {
    const actual = entry.actualCompletionDate!;

    // "Within P50" means actual <= predicted (forecast was conservative enough)
    if (daysBetween(actual, entry.percentiles.p50) >= 0) withinP50++;
    if (daysBetween(actual, entry.percentiles.p80) >= 0) withinP80++;
    if (daysBetween(actual, entry.percentiles.p95) >= 0) withinP95++;

    // Check if actual was after P50 (forecast was optimistic)
    if (daysBetween(entry.percentiles.p50, actual) > 0) afterP50++;
  }

  const total = completed.length;
  const p50Accuracy = (withinP50 / total) * 100;
  const p80Accuracy = (withinP80 / total) * 100;
  const p95Accuracy = (withinP95 / total) * 100;
  const bias = afterP50 / total; // >0.5 = optimistic, <0.5 = pessimistic

  return {
    totalForecasts: total,
    withinP50,
    withinP80,
    withinP95,
    p50Accuracy,
    p80Accuracy,
    p95Accuracy,
    bias,
    insufficientData: false,
  };
}
