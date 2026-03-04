/**
 * Sprint forecast — linear regression on burndown history to project
 * completion date, velocity, and pace indicators.
 */

import type { ProjectConfig } from "@composio/ao-core";
import { readSprintStatus } from "./sprint-status-reader.js";
import { readHistory } from "./history.js";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface SprintForecast {
  projectedCompletionDate: string | null;
  daysRemaining: number | null;
  pace: "ahead" | "on-pace" | "behind" | "no-data";
  confidence: number;
  currentVelocity: number;
  requiredVelocity: number;
  remainingStories: number;
  totalStories: number;
  completedStories: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const EMPTY_FORECAST: SprintForecast = {
  projectedCompletionDate: null,
  daysRemaining: null,
  pace: "no-data",
  confidence: 0,
  currentVelocity: 0,
  requiredVelocity: 0,
  remainingStories: 0,
  totalStories: 0,
  completedStories: 0,
};

const MS_PER_DAY = 24 * 60 * 60 * 1000;

// ---------------------------------------------------------------------------
// Linear regression helpers
// ---------------------------------------------------------------------------

interface RegressionResult {
  slope: number;
  intercept: number;
  rSquared: number;
}

function linearRegression(points: Array<{ x: number; y: number }>): RegressionResult {
  const n = points.length;
  if (n < 2) return { slope: 0, intercept: 0, rSquared: 0 };

  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumX2 = 0;

  for (const p of points) {
    sumX += p.x;
    sumY += p.y;
    sumXY += p.x * p.y;
    sumX2 += p.x * p.x;
  }

  const denominator = n * sumX2 - sumX * sumX;
  if (denominator === 0) return { slope: 0, intercept: sumY / n, rSquared: 0 };

  const slope = (n * sumXY - sumX * sumY) / denominator;
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

  const rSquared = ssTot === 0 ? 1 : Math.max(0, 1 - ssRes / ssTot);

  return { slope, intercept, rSquared };
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export function computeForecast(project: ProjectConfig): SprintForecast {
  // Read sprint status — count total and done stories
  let totalStories = 0;
  let completedStories = 0;

  try {
    const sprint = readSprintStatus(project);
    for (const [id, entry] of Object.entries(sprint.development_status)) {
      const status = typeof entry.status === "string" ? entry.status : "backlog";
      // Skip epic-level entries
      if (id.startsWith("epic-") || status.startsWith("epic-")) continue;
      totalStories++;
      if (status === "done") completedStories++;
    }
  } catch {
    return { ...EMPTY_FORECAST };
  }

  const remainingStories = totalStories - completedStories;

  // If all done, return immediately
  if (remainingStories === 0 && totalStories > 0) {
    const today = new Date().toISOString().slice(0, 10);
    return {
      projectedCompletionDate: today,
      daysRemaining: 0,
      pace: "ahead",
      confidence: 1,
      currentVelocity: 0,
      requiredVelocity: 0,
      remainingStories: 0,
      totalStories,
      completedStories,
    };
  }

  // Read history and build cumulative completions by day
  const history = readHistory(project);
  if (history.length === 0) {
    return { ...EMPTY_FORECAST, totalStories, completedStories, remainingStories };
  }

  // Group completions by date
  const completionsByDate = new Map<string, number>();
  for (const entry of history) {
    if (entry.toStatus === "done") {
      const date = entry.timestamp.slice(0, 10);
      completionsByDate.set(date, (completionsByDate.get(date) ?? 0) + 1);
    }
  }

  if (completionsByDate.size === 0) {
    return { ...EMPTY_FORECAST, totalStories, completedStories, remainingStories };
  }

  // Sort dates and build cumulative data points
  const sortedDates = [...completionsByDate.keys()].sort();
  const firstDateStr = sortedDates[0];
  if (!firstDateStr) {
    return { ...EMPTY_FORECAST, totalStories, completedStories, remainingStories };
  }
  const firstDate = new Date(firstDateStr);

  const points: Array<{ x: number; y: number }> = [];
  let cumulative = 0;
  for (const date of sortedDates) {
    cumulative += completionsByDate.get(date) ?? 0;
    const dayIndex = Math.round((new Date(date).getTime() - firstDate.getTime()) / MS_PER_DAY);
    points.push({ x: dayIndex, y: cumulative });
  }

  // Need at least 2 data points for regression
  if (points.length < 2) {
    return {
      ...EMPTY_FORECAST,
      totalStories,
      completedStories,
      remainingStories,
      currentVelocity: cumulative > 0 ? cumulative : 0,
    };
  }

  // Linear regression: y = mx + b, where y=cumulative completed, x=day index
  const { slope, rSquared } = linearRegression(points);
  const currentVelocity = Math.max(0, slope); // stories/day

  // Project when cumulative reaches totalStories
  let projectedCompletionDate: string | null = null;
  let daysRemaining: number | null = null;

  if (slope > 0) {
    const lastPoint = points[points.length - 1];
    const lastDateStr = sortedDates[sortedDates.length - 1];
    if (!lastPoint || !lastDateStr) {
      return { ...EMPTY_FORECAST, totalStories, completedStories, remainingStories };
    }
    const storiesLeft = totalStories - lastPoint.y;
    const daysToComplete = storiesLeft / slope;
    const lastDate = new Date(lastDateStr);
    const projectedDate = new Date(lastDate.getTime() + daysToComplete * MS_PER_DAY);

    projectedCompletionDate = projectedDate.toISOString().slice(0, 10);

    // Days remaining from today
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    daysRemaining = Math.max(
      0,
      Math.ceil((projectedDate.getTime() - today.getTime()) / MS_PER_DAY),
    );
  }

  // Pace determination — requires sprintEndDate config
  let pace: SprintForecast["pace"] = "no-data";
  let requiredVelocity = 0;

  const sprintEndDate = project.tracker?.["sprintEndDate"];
  if (typeof sprintEndDate === "string" && sprintEndDate) {
    const targetDate = new Date(sprintEndDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const daysUntilTarget = Math.max(1, (targetDate.getTime() - today.getTime()) / MS_PER_DAY);

    requiredVelocity = remainingStories / daysUntilTarget;

    if (currentVelocity >= requiredVelocity * 1.1) {
      pace = "ahead";
    } else if (currentVelocity >= requiredVelocity * 0.9) {
      pace = "on-pace";
    } else {
      pace = "behind";
    }
  }

  return {
    projectedCompletionDate,
    daysRemaining,
    pace,
    confidence: rSquared,
    currentVelocity,
    requiredVelocity,
    remainingStories,
    totalStories,
    completedStories,
  };
}
