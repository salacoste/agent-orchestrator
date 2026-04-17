/**
 * Portfolio metrics calculation for aggregated dashboard view.
 *
 * Calculates summary metrics across all configured projects:
 * - Total agents and utilization percentage
 * - Story counts by status
 * - Sprint health score (0-100)
 */

import type { PortfolioProject, PortfolioMetrics } from "./types";

/**
 * Calculate aggregated metrics from a list of portfolio projects.
 *
 * @param projects - Array of portfolio projects with pre-aggregated metrics
 * @returns PortfolioMetrics with totals and derived scores
 */
export function calculatePortfolioMetrics(projects: PortfolioProject[]): PortfolioMetrics {
  // Handle empty state
  if (projects.length === 0) {
    return {
      totalAgents: 0,
      totalConfiguredAgents: 0,
      stories: {
        backlog: 0,
        inProgress: 0,
        done: 0,
        blocked: 0,
        total: 0,
      },
      sprintHealthScore: 0,
      utilizationPercent: 0,
      poolUtilization: undefined,
    };
  }

  // Aggregate totals across all projects
  let totalAgents = 0;
  let totalConfiguredAgents = 0;
  let totalPoolAgents = 0;
  let activePoolAgents = 0;
  let totalReservedAgents = 0;
  let poolProjectCount = 0;
  const storyCounts = {
    backlog: 0,
    inProgress: 0,
    done: 0,
    blocked: 0,
  };

  for (const project of projects) {
    totalAgents += project.activeAgents;
    totalConfiguredAgents += project.totalAgents;
    storyCounts.backlog += project.stories.backlog;
    storyCounts.inProgress += project.stories.inProgress;
    storyCounts.done += project.stories.done;
    storyCounts.blocked += project.stories.blocked;

    // Pool utilization tracking
    if (project.sharedPool?.enabled) {
      poolProjectCount++;
      totalPoolAgents += project.totalAgents;
      activePoolAgents += project.activeAgents;
      totalReservedAgents += project.sharedPool.reservedAgents?.length ?? 0;
    }
  }

  const totalStories =
    storyCounts.backlog + storyCounts.inProgress + storyCounts.done + storyCounts.blocked;

  // Calculate sprint health score:
  // Formula: (doneStories / totalStories) * 100 - (blockedStories * 5)
  // Clamped to [0, 100]
  let sprintHealthScore = 0;
  if (totalStories > 0) {
    const completionRatio = storyCounts.done / totalStories;
    const blockedPenalty = storyCounts.blocked * 5;
    sprintHealthScore = Math.round(completionRatio * 100 - blockedPenalty);
    // Clamp to valid range
    sprintHealthScore = Math.max(0, Math.min(100, sprintHealthScore));
  }

  // Calculate utilization percentage: active agents / total agents across all projects
  const utilizationPercent =
    totalConfiguredAgents > 0 ? Math.round((totalAgents / totalConfiguredAgents) * 100) : 0;

  // Compute pool utilization metrics (only when pool projects exist)
  const poolUtilization =
    poolProjectCount > 0
      ? { totalPoolAgents, activePoolAgents, totalReservedAgents, poolProjectCount }
      : undefined;

  return {
    totalAgents,
    totalConfiguredAgents,
    stories: {
      ...storyCounts,
      total: totalStories,
    },
    sprintHealthScore,
    utilizationPercent,
    poolUtilization,
  };
}

/**
 * Get CSS color variable for sprint health score.
 *
 * @param score - Sprint health score 0-100
 * @returns CSS variable name for color
 */
export function getHealthScoreColor(score: number): string {
  if (score >= 80) return "var(--color-success)";
  if (score >= 60) return "var(--color-warning)";
  return "var(--color-error)";
}

/**
 * Get status label for sprint health score.
 *
 * @param score - Sprint health score 0-100
 * @returns Human-readable status label
 */
export function getHealthStatusLabel(score: number): string {
  if (score >= 80) return "Healthy";
  if (score >= 60) return "Moderate";
  return "At Risk";
}
