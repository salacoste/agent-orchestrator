/**
 * Pure sync sprint summary computation.
 * Split from unified-sprint-aggregation.ts to avoid pulling
 * @composio/ao-plugin-tracker-bmad (node:fs/path) into client bundles.
 */

import type { UnifiedSprintEntry, UnifiedSprintSummary } from "./types";

/**
 * Compute aggregate summary statistics from unified sprint entries.
 * Pure sync function — safe for client components.
 */
export function computeSprintSummary(sprints: UnifiedSprintEntry[]): UnifiedSprintSummary {
  if (sprints.length === 0) {
    return {
      totalSprints: 0,
      activeSprints: 0,
      completedSprints: 0,
      planningSprints: 0,
      totalStories: 0,
      storiesDone: 0,
      avgProgress: 0,
      atRiskSprints: 0,
      avgVelocity: 0,
      maxVelocity: 0,
    };
  }

  let activeSprints = 0;
  let completedSprints = 0;
  let planningSprints = 0;
  let totalStories = 0;
  let storiesDone = 0;
  let totalProgress = 0;
  let atRiskSprints = 0;
  let totalVelocity = 0;
  let velocityCount = 0;
  let maxVelocity = 0;

  for (const sprint of sprints) {
    if (sprint.status === "active") activeSprints++;
    if (sprint.status === "completed") completedSprints++;
    if (sprint.status === "planning") planningSprints++;
    totalStories += sprint.stories.total;
    storiesDone += sprint.stories.done;
    totalProgress += sprint.progressPercent;
    if (sprint.health === "at-risk" || sprint.health === "blocked") atRiskSprints++;
    if (sprint.velocity > 0) {
      totalVelocity += sprint.velocity;
      velocityCount++;
      if (sprint.velocity > maxVelocity) maxVelocity = sprint.velocity;
    }
  }

  return {
    totalSprints: sprints.length,
    activeSprints,
    completedSprints,
    planningSprints,
    totalStories,
    storiesDone,
    avgProgress: Math.round(totalProgress / sprints.length),
    atRiskSprints,
    avgVelocity: velocityCount > 0 ? Math.round((totalVelocity / velocityCount) * 100) / 100 : 0,
    maxVelocity,
  };
}
