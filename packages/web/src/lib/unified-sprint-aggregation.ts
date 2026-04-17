/**
 * Unified Sprint Aggregation — cross-project sprint data for unified view (Epic 53, Story 53.1).
 *
 * Aggregates sprint status from all configured projects into UnifiedSprintEntry[]
 * with summary statistics and health computation.
 *
 * Pattern: Pure sync functions for summary/health, async for data loading.
 * Follows the same aggregation pattern as portfolio-aggregation.ts.
 *
 * NFR-F5-1: Page loads within 2 seconds for up to 50 projects.
 */

import type { OrchestratorConfig } from "@composio/ao-core";
import type { UnifiedSprintEntry, SprintHealthStatus } from "./types";

/** Story keys match pattern X-Y-name or Xa-Y-name (e.g., "1-2-user-auth", "25a-1-recovery"). Epics/retros never match. */
const STORY_KEY_PATTERN = /^\d+[a-z]*-\d+-/;

/** Valid story statuses that count as "done". */
const DONE_STATUSES = new Set(["done"]);

/** Valid story statuses that count as "in progress". */
const IN_PROGRESS_STATUSES = new Set(["in-progress", "review"]);

/** Valid story statuses that count as "blocked". */
const BLOCKED_STATUSES = new Set(["blocked"]);

/** Valid story statuses that count as backlog ( not yet started). */
const BACKLOG_STATUSES = new Set(["backlog", "ready-for-dev"]);

// =============================================================================
// HEALTH COMPUTATION (pure function)
// =============================================================================

/**
 * Compute sprint health status based on story progress and blocked count.
 *
 * Logic:
 * - "blocked": all active work is blocked (blocked > 0 and inProgress === 0)
 * - "at-risk": progress < 50% AND > 75% elapsed, OR more blocked than in-progress
 * - "on-track": everything else
 *
 * @param entry - Sprint entry with story counts
 * @param elapsedFraction - Optional fraction of sprint time elapsed (0-1)
 * @returns Health status indicator
 */
export function computeSprintHealth(
  entry: Pick<UnifiedSprintEntry, "stories" | "progressPercent">,
  elapsedFraction?: number,
): SprintHealthStatus {
  const { stories, progressPercent } = entry;

  // Blocked: all active work is blocked
  if (stories.blocked > 0 && stories.inProgress === 0) {
    return "blocked";
  }

  // At-risk: more blocked than working
  if (stories.blocked > stories.inProgress) {
    return "at-risk";
  }

  // At-risk: low progress with high elapsed time
  if (elapsedFraction !== undefined && progressPercent < 50 && elapsedFraction > 0.75) {
    return "at-risk";
  }

  return "on-track";
}

// =============================================================================
// HEALTH REASON COMPUTATION (pure function — Story 53.3)
// =============================================================================

/**
 * Compute human-readable reasons for a sprint's health status.
 * Returns an array of reason strings; empty array when sprint is on-track.
 * A sprint can match multiple rules — all matching reasons are returned.
 *
 * Rule order (priority for display):
 * 1. All active stories blocked (blocked > 0 && inProgress === 0)
 * 2. More blocked than in-progress
 * 3. Low progress with high elapsed time
 *
 * @param entry - Sprint entry with story counts and progress
 * @param elapsedFraction - Optional fraction of sprint time elapsed (0-1)
 * @returns Array of reason strings
 */
export function computeHealthReasons(
  entry: Pick<UnifiedSprintEntry, "stories" | "progressPercent">,
  elapsedFraction?: number,
): string[] {
  const { stories, progressPercent } = entry;
  const reasons: string[] = [];

  // Rule 1: All active work is blocked
  if (stories.blocked > 0 && stories.inProgress === 0) {
    reasons.push(`All ${stories.blocked} active stories are blocked`);
  }

  // Rule 2: More blocked than working (only when some work is in progress)
  if (stories.inProgress > 0 && stories.blocked > stories.inProgress) {
    reasons.push(
      `More blocked stories (${stories.blocked}) than in-progress (${stories.inProgress})`,
    );
  }

  // Rule 3: Low progress with high elapsed time
  if (elapsedFraction !== undefined && progressPercent < 50 && elapsedFraction > 0.75) {
    reasons.push(
      `Only ${progressPercent}% complete with ${Math.round(elapsedFraction * 100)}% of sprint elapsed`,
    );
  }

  return reasons;
}

// =============================================================================
// VELOCITY COMPUTATION (pure function — Story 53.4)
// =============================================================================

/**
 * Compute sprint velocity as stories completed per day.
 *
 * Formula: stories.done / max(1, sprintDays)
 * - Active sprints: elapsed days from startDate to now
 * - Completed sprints: total days from startDate to endDate
 * - Planning sprints or no dates: velocity = 0
 *
 * @param entry - Sprint entry with story counts and dates
 * @returns Stories completed per day (0 when dates unavailable)
 */
export function computeVelocity(
  entry: Pick<UnifiedSprintEntry, "stories" | "status" | "startDate" | "endDate">,
): number {
  const { stories, status, startDate, endDate } = entry;

  // Planning sprints or no start date → no velocity
  if (status === "planning" || !startDate) return 0;

  const now = Date.now();
  const startMs = new Date(startDate).getTime();

  if (isNaN(startMs)) return 0;

  let days: number;
  if (status === "completed" && endDate) {
    const endMs = new Date(endDate).getTime();
    if (isNaN(endMs)) return 0;
    days = (endMs - startMs) / (1000 * 60 * 60 * 24);
  } else {
    // Active sprint: elapsed days
    days = (now - startMs) / (1000 * 60 * 60 * 24);
  }

  // Clamp to minimum 1 day to prevent division by zero / inflated velocity
  const clampedDays = Math.max(1, days);
  return stories.done / clampedDays;
}

/**
 * Compute inferred velocity trend direction based on current sprint indicators.
 *
 * Since we lack historical sprint data, "trend" is inferred from health + progress:
 * - "stable": progressPercent >= 70 (well on track regardless of health)
 * - "improving": on-track health AND progressPercent >= 50
 * - "declining": at-risk or blocked health AND progressPercent < 50
 * - "unknown": no dates or sprint in planning
 *
 * @param entry - Sprint entry with health, progress, and dates
 * @returns Inferred trend direction
 */
export function computeVelocityTrend(
  entry: Pick<UnifiedSprintEntry, "health" | "progressPercent" | "status" | "startDate">,
): "improving" | "declining" | "stable" | "unknown" {
  const { health, progressPercent, status, startDate } = entry;

  // Unknown: no dates or planning
  if (status === "planning" || !startDate) return "unknown";

  // Stable: well advanced regardless of health
  if (progressPercent >= 70) return "stable";

  // Improving: on-track with reasonable progress
  if (health === "on-track" && progressPercent >= 50) return "improving";

  // Declining: at-risk or blocked with low progress
  if ((health === "at-risk" || health === "blocked") && progressPercent < 50) return "declining";

  // Default: stable for anything else that doesn't clearly fit
  return "stable";
}

// =============================================================================
// ELAPSED TIME COMPUTATION
// =============================================================================

/**
 * Compute fraction of time elapsed between start and end dates.
 * Returns undefined when dates are unavailable (no time-based analysis possible).
 *
 * @param startDate - ISO date string for sprint start
 * @param endDate - ISO date string for sprint end
 * @returns Fraction of time elapsed (0-1), or undefined if dates unavailable
 */
function computeElapsedFraction(
  startDate: string | null,
  endDate: string | null,
): number | undefined {
  if (!startDate || !endDate) return undefined;
  try {
    const start = new Date(startDate).getTime();
    const end = new Date(endDate).getTime();
    const now = Date.now();
    const total = end - start;
    if (total <= 0) return undefined;
    return Math.max(0, Math.min(1, (now - start) / total));
  } catch {
    return undefined;
  }
}

// =============================================================================
// SUMMARY COMPUTATION (pure function)
// =============================================================================

/**
 * Compute aggregated summary statistics from unified sprint entries.
 * Re-exported from unified-sprint-summary.ts for backward compatibility.
 * Use unified-sprint-summary.ts directly in client components to avoid
 * pulling in @composio/ao-plugin-tracker-bmad (node:fs/path).
 */
export { computeSprintSummary } from "./unified-sprint-summary";

// =============================================================================
// SPRINT STATUS COUNTING (from SprintStatus development_status map)
// =============================================================================

/** Result of counting stories by status. */
interface StoryCounts {
  total: number;
  done: number;
  inProgress: number;
  blocked: number;
  backlog: number;
}

/**
 * Count stories by status from a development_status map.
 * Entries may be strings or objects with a .status field.
 *
 * @param devStatus - development_status record from sprint-status.yaml
 * @returns Story counts by status category
 */
export function countStories(devStatus: Record<string, unknown>): StoryCounts {
  const counts: StoryCounts = { total: 0, done: 0, inProgress: 0, blocked: 0, backlog: 0 };

  for (const [key, value] of Object.entries(devStatus)) {
    // Only count story keys (X-Y-name pattern), skip epics and retros
    if (!STORY_KEY_PATTERN.test(key)) continue;

    const status =
      typeof value === "string" ? value : ((value as { status?: string })?.status ?? "unknown");

    counts.total++;
    if (DONE_STATUSES.has(status)) {
      counts.done++;
    } else if (IN_PROGRESS_STATUSES.has(status)) {
      counts.inProgress++;
    } else if (BLOCKED_STATUSES.has(status)) {
      counts.blocked++;
    } else if (BACKLOG_STATUSES.has(status)) {
      counts.backlog++;
    } else {
      // Unknown status — treat as backlog for forward compatibility
      counts.backlog++;
    }
  }

  return counts;
}

// =============================================================================
// SPRINT STATUS DETERMINATION
// =============================================================================

/**
 * Determine sprint lifecycle status from story counts.
 * - "completed" if all stories are done
 * - "planning" if all stories are in backlog (none in-progress or done)
 * - "active" otherwise
 */
function determineSprintStatus(counts: StoryCounts): UnifiedSprintEntry["status"] {
  if (counts.total === 0) return "planning";
  if (counts.done === counts.total) return "completed";
  if (counts.inProgress === 0 && counts.done === 0) return "planning";
  return "active";
}

// =============================================================================
// AGGREGATION (async — reads sprint status from tracker)
// =============================================================================

/**
 * Aggregate unified sprint data from all configured projects.
 *
 * Iterates over all projects in config, reads sprint status via the BMAD tracker,
 * computes story counts, progress, health, and returns a UnifiedSprintEntry[].
 *
 * Projects where sprint status reading fails are skipped (logged as warning).
 *
 * @param config - Orchestrator configuration with projects
 * @returns Array of unified sprint entries, one per project with sprint data
 */
export async function aggregateUnifiedSprints(
  config: Pick<OrchestratorConfig, "projects">,
): Promise<UnifiedSprintEntry[]> {
  // Dynamic import to avoid bundling issues in Next.js
  const tracker = await import("@composio/ao-plugin-tracker-bmad");
  const entries: UnifiedSprintEntry[] = [];

  for (const [projectId, project] of Object.entries(config.projects)) {
    try {
      const sprintStatus = tracker.readSprintStatus(project);
      if (!sprintStatus?.development_status) continue;

      const counts = countStories(sprintStatus.development_status as Record<string, unknown>);

      // Skip projects with no stories
      if (counts.total === 0) continue;

      const progressPercent = counts.total > 0 ? Math.round((counts.done / counts.total) * 100) : 0;
      const status = determineSprintStatus(counts);

      const sprintName =
        status === "completed"
          ? "Completed Sprint"
          : status === "planning"
            ? "Planning Sprint"
            : "Active Sprint";

      const entry: UnifiedSprintEntry = {
        projectId,
        projectName: project.name || projectId,
        sprintName,
        startDate: null,
        endDate: null,
        stories: counts,
        progressPercent,
        status,
        health: "on-track", // Default; will be computed below
        healthReasons: [], // Default; will be computed below
        velocity: 0, // Default; will be computed below
        velocityTrend: "unknown", // Default; will be computed below
      };

      const elapsed = computeElapsedFraction(null, null);
      entry.health = computeSprintHealth(entry, elapsed);
      entry.healthReasons = computeHealthReasons(entry, elapsed);
      entry.velocity = computeVelocity(entry);
      entry.velocityTrend = computeVelocityTrend(entry);
      entries.push(entry);
    } catch (err) {
      console.warn(
        `[aggregateUnifiedSprints] Failed to read sprint for project ${projectId}:`,
        err instanceof Error ? err.message : err,
      );
    }
  }

  return entries;
}
