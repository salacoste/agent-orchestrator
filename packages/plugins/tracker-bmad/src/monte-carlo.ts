/**
 * Monte Carlo forecast — simulates completion dates using historical
 * throughput distribution, providing probabilistic P50/P85/P95 estimates.
 */

import type { ProjectConfig } from "@composio/ao-core";
import { readHistory } from "./history.js";
import { readSprintStatus, getEpicStoryIds } from "./sprint-status-reader.js";
import { getDoneColumn } from "./workflow-columns.js";
import { computeForecast } from "./forecast.js";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface MonteCarloConfig {
  simulations?: number; // default 10000
  excludeWeekends?: boolean; // default true
  randomFn?: () => number; // for deterministic testing
}

export interface PercentileResult {
  p50: string;
  p85: string;
  p95: string;
}

export interface HistogramBucket {
  date: string;
  probability: number;
  cumulative: number;
}

export interface MonteCarloResult {
  percentiles: PercentileResult;
  histogram: HistogramBucket[];
  remainingStories: number;
  simulationCount: number;
  sampleSize: number;
  averageDailyRate: number;
  linearCompletionDate: string | null;
  linearConfidence: number; // % simulations within linear date
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const EMPTY_RESULT: MonteCarloResult = {
  percentiles: { p50: "", p85: "", p95: "" },
  histogram: [],
  remainingStories: 0,
  simulationCount: 0,
  sampleSize: 0,
  averageDailyRate: 0,
  linearCompletionDate: null,
  linearConfidence: 0,
};

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const MAX_DAYS = 365;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isWeekend(date: Date): boolean {
  const day = date.getUTCDay();
  return day === 0 || day === 6;
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * MS_PER_DAY);
}

function toDateStr(date: Date): string {
  return date.toISOString().slice(0, 10);
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export function computeMonteCarloForecast(
  project: ProjectConfig,
  epicFilter?: string,
  config?: MonteCarloConfig,
): MonteCarloResult {
  const simulations = config?.simulations ?? 10000;
  const excludeWeekends = config?.excludeWeekends ?? true;
  const randomFn = config?.randomFn ?? Math.random;

  // Read sprint status to count remaining stories
  let sprint;
  try {
    sprint = readSprintStatus(project);
  } catch {
    return { ...EMPTY_RESULT };
  }

  const doneColumn = getDoneColumn(project);
  const epicStoryIds = epicFilter ? getEpicStoryIds(sprint, epicFilter) : null;

  let totalStories = 0;
  let completedStories = 0;

  for (const [id, entry] of Object.entries(sprint.development_status)) {
    const status = typeof entry.status === "string" ? entry.status : "backlog";
    if (id.startsWith("epic-") || status.startsWith("epic-")) continue;
    if (epicStoryIds && !epicStoryIds.has(id)) continue;
    totalStories++;
    if (status === doneColumn) {
      completedStories++;
    }
  }

  const remainingStories = totalStories - completedStories;

  // If no remaining stories, return today for all percentiles
  if (remainingStories === 0 && totalStories > 0) {
    const today = toDateStr(new Date());
    return {
      percentiles: { p50: today, p85: today, p95: today },
      histogram: [{ date: today, probability: 1.0, cumulative: 1.0 }],
      remainingStories: 0,
      simulationCount: simulations,
      sampleSize: 0,
      averageDailyRate: 0,
      linearCompletionDate: today,
      linearConfidence: 1,
    };
  }

  // Build daily throughput distribution from history
  const history = readHistory(project);
  const completionsByDate = new Map<string, number>();

  for (const entry of history) {
    if (entry.toStatus === doneColumn) {
      if (epicStoryIds && !epicStoryIds.has(entry.storyId)) continue;
      const date = entry.timestamp.slice(0, 10);
      completionsByDate.set(date, (completionsByDate.get(date) ?? 0) + 1);
    }
  }

  if (completionsByDate.size === 0) {
    return { ...EMPTY_RESULT, remainingStories };
  }

  // Build the full date range to include zero-throughput weekdays
  const sortedDates = [...completionsByDate.keys()].sort();
  const firstDateStr = sortedDates[0]!;
  const lastDateStr = sortedDates[sortedDates.length - 1]!;
  const firstDate = new Date(firstDateStr);
  const lastDate = new Date(lastDateStr);

  // Build throughput array for the entire date range
  const throughput: number[] = [];
  let cursor = new Date(firstDate);

  while (cursor <= lastDate) {
    const dateStr = toDateStr(cursor);
    const isWe = isWeekend(cursor);

    if (excludeWeekends && isWe) {
      // Skip weekends entirely
      cursor = addDays(cursor, 1);
      continue;
    }

    const count = completionsByDate.get(dateStr) ?? 0;
    throughput.push(count);
    cursor = addDays(cursor, 1);
  }

  if (throughput.length === 0) {
    return { ...EMPTY_RESULT, remainingStories };
  }

  // Compute average daily rate
  const totalThroughput = throughput.reduce((sum, v) => sum + v, 0);
  const averageDailyRate = totalThroughput / throughput.length;

  // Run simulations
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  const completionDates: Date[] = [];

  for (let sim = 0; sim < simulations; sim++) {
    let storiesLeft = remainingStories;
    let day = 0;
    let currentDate = new Date(today);

    while (storiesLeft > 0 && day < MAX_DAYS) {
      currentDate = addDays(today, day + 1);

      // Skip weekends in simulation if configured
      if (excludeWeekends && isWeekend(currentDate)) {
        day++;
        continue;
      }

      // Sample from the throughput distribution
      const idx = Math.floor(randomFn() * throughput.length);
      const dailyRate = throughput[idx]!;
      storiesLeft -= dailyRate;
      day++;
    }

    completionDates.push(currentDate);
  }

  // Sort completion dates
  completionDates.sort((a, b) => a.getTime() - b.getTime());

  // Extract percentiles
  const p50Idx = Math.floor(simulations * 0.5);
  const p85Idx = Math.floor(simulations * 0.85);
  const p95Idx = Math.floor(simulations * 0.95);

  const percentiles: PercentileResult = {
    p50: toDateStr(completionDates[p50Idx]!),
    p85: toDateStr(completionDates[p85Idx]!),
    p95: toDateStr(completionDates[p95Idx]!),
  };

  // Build histogram: count occurrences of each completion date
  const dateCounts = new Map<string, number>();
  for (const d of completionDates) {
    const ds = toDateStr(d);
    dateCounts.set(ds, (dateCounts.get(ds) ?? 0) + 1);
  }

  const sortedHistDates = [...dateCounts.keys()].sort();
  const histogram: HistogramBucket[] = [];
  let cumulative = 0;

  for (const date of sortedHistDates) {
    const count = dateCounts.get(date)!;
    const probability = count / simulations;
    cumulative += probability;
    histogram.push({ date, probability, cumulative });
  }

  // Get linear forecast for comparison
  const linearForecast = computeForecast(project, epicFilter);
  const linearCompletionDate = linearForecast.projectedCompletionDate;

  // Compute linearConfidence: % of simulations that complete on or before linear date
  let linearConfidence = 0;
  if (linearCompletionDate) {
    const linearDate = new Date(linearCompletionDate);
    linearDate.setUTCHours(23, 59, 59, 999);
    let countWithin = 0;
    for (const d of completionDates) {
      if (d.getTime() <= linearDate.getTime()) {
        countWithin++;
      }
    }
    linearConfidence = countWithin / simulations;
  }

  return {
    percentiles,
    histogram,
    remainingStories,
    simulationCount: simulations,
    sampleSize: throughput.length,
    averageDailyRate,
    linearCompletionDate,
    linearConfidence,
  };
}
