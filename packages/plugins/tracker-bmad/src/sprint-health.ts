/**
 * Sprint health indicators — surfaces stuck stories, WIP alerts,
 * throughput drops, and bottleneck warnings from sprint data.
 */

import type { ProjectConfig } from "@composio/ao-core";
import { readSprintStatus, getEpicStoryIds } from "./sprint-status-reader.js";
import { readHistory } from "./history.js";
import { computeCycleTime } from "./cycle-time.js";
import { getActiveColumns, getColumnLabel } from "./workflow-columns.js";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type HealthSeverity = "ok" | "warning" | "critical";

export interface HealthIndicator {
  id: string;
  severity: HealthSeverity;
  message: string;
  details: string[];
}

export interface SprintHealthResult {
  overall: HealthSeverity;
  indicators: HealthIndicator[];
  stuckStories: string[];
  wipColumns: string[];
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STUCK_WARNING_MS = 48 * 60 * 60 * 1000; // 48 hours
const STUCK_CRITICAL_MS = 96 * 60 * 60 * 1000; // 96 hours
const DEFAULT_WIP_LIMIT = 3;
const THROUGHPUT_WARNING_RATIO = 0.7;
const THROUGHPUT_CRITICAL_RATIO = 0.4;
const BOTTLENECK_RATIO = 2;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function worstSeverity(indicators: HealthIndicator[]): HealthSeverity {
  if (indicators.some((i) => i.severity === "critical")) return "critical";
  if (indicators.some((i) => i.severity === "warning")) return "warning";
  return "ok";
}

/**
 * Read per-column WIP limits from tracker config.
 * Falls back to DEFAULT_WIP_LIMIT for unconfigured columns.
 */
function getWipLimits(project: ProjectConfig): Record<string, number> {
  const raw = project.tracker?.["wipLimits"];
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const limits: Record<string, number> = {};
  for (const [col, val] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof val === "number" && val > 0) {
      limits[col] = val;
    }
  }
  return limits;
}

function countStoriesInColumn(
  entries: Record<string, { status: string; [key: string]: unknown }>,
  column: string,
): number {
  return Object.values(entries).filter((e) => {
    const s = typeof e.status === "string" ? e.status : "backlog";
    return s === column;
  }).length;
}

// ---------------------------------------------------------------------------
// Public: WIP limit check (used by PATCH endpoint)
// ---------------------------------------------------------------------------

export interface WipLimitResult {
  allowed: boolean;
  current: number;
  limit: number;
}

/**
 * Check whether a column is at or over its WIP limit.
 * Returns `allowed: false` if current count >= limit.
 */
export function checkWipLimit(project: ProjectConfig, column: string): WipLimitResult {
  const wipLimits = getWipLimits(project);

  // Only enforce if a limit is configured for this column
  const limit = wipLimits[column];
  if (limit === undefined) {
    return { allowed: true, current: 0, limit: 0 };
  }

  let entries: Record<string, { status: string; [key: string]: unknown }>;
  try {
    const sprint = readSprintStatus(project);
    entries = sprint.development_status;
  } catch {
    return { allowed: true, current: 0, limit };
  }

  const current = countStoriesInColumn(entries, column);
  return { allowed: current < limit, current, limit };
}

/**
 * Get all configured WIP limits with current counts.
 * Returns only columns that have configured limits.
 */
export function getWipStatus(
  project: ProjectConfig,
): Record<string, { current: number; limit: number }> {
  const wipLimits = getWipLimits(project);
  if (Object.keys(wipLimits).length === 0) return {};

  let entries: Record<string, { status: string; [key: string]: unknown }>;
  try {
    const sprint = readSprintStatus(project);
    entries = sprint.development_status;
  } catch {
    return {};
  }

  const result: Record<string, { current: number; limit: number }> = {};
  for (const [col, limit] of Object.entries(wipLimits)) {
    result[col] = { current: countStoriesInColumn(entries, col), limit };
  }
  return result;
}

// ---------------------------------------------------------------------------
// Public: WIP dashboard status (used by web widget)
// ---------------------------------------------------------------------------

export interface WipColumnStatus {
  column: string;
  label: string;
  current: number;
  limit: number | null;
  ratio: number;
  severity: "ok" | "warning" | "exceeded";
}

export function getWipDashboardStatus(project: ProjectConfig): WipColumnStatus[] {
  const wipLimits = getWipLimits(project);
  const activeColumns = getActiveColumns(project);

  let entries: Record<string, { status: string; [key: string]: unknown }>;
  try {
    const sprint = readSprintStatus(project);
    entries = sprint.development_status;
  } catch {
    return [];
  }

  const result: WipColumnStatus[] = [];

  for (const col of activeColumns) {
    const current = countStoriesInColumn(entries, col);
    const limit = wipLimits[col] ?? null;
    const ratio = limit !== null && limit > 0 ? current / limit : 0;
    let severity: WipColumnStatus["severity"] = "ok";
    if (limit !== null) {
      if (ratio >= 1) severity = "exceeded";
      else if (ratio >= 0.8) severity = "warning";
    }

    result.push({
      column: col,
      label: getColumnLabel(project, col),
      current,
      limit,
      ratio,
      severity,
    });
  }

  return result;
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export function computeSprintHealth(
  project: ProjectConfig,
  epicFilter?: string,
): SprintHealthResult {
  const indicators: HealthIndicator[] = [];
  const stuckStories: string[] = [];
  const wipColumns: string[] = [];

  // Read sprint status — if missing, return all-ok
  let sprintEntries: Record<string, { status: string; [key: string]: unknown }>;
  let epicStoryIds: Set<string> | null = null;
  try {
    const sprint = readSprintStatus(project);
    sprintEntries = sprint.development_status;
    if (epicFilter) {
      epicStoryIds = getEpicStoryIds(sprint, epicFilter);
    }
  } catch {
    return { overall: "ok", indicators: [], stuckStories: [], wipColumns: [] };
  }

  const history = readHistory(project);
  const now = Date.now();
  const wipLimits = getWipLimits(project);
  const activeColumns = getActiveColumns(project);

  // -------------------------------------------------------------------------
  // 1. Stuck stories — stories in active columns with no recent transition
  // -------------------------------------------------------------------------
  const stuckWarnings: string[] = [];
  const stuckCriticals: string[] = [];

  for (const [storyId, entry] of Object.entries(sprintEntries)) {
    const status = typeof entry.status === "string" ? entry.status : "backlog";
    if (!activeColumns.has(status)) continue;
    if (epicStoryIds && !epicStoryIds.has(storyId)) continue;

    // Find the most recent transition for this story
    let lastTransitionTime = 0;
    for (const h of history) {
      if (h.storyId === storyId) {
        const ts = new Date(h.timestamp).getTime();
        if (ts > lastTransitionTime) lastTransitionTime = ts;
      }
    }

    // If no history entry exists, we can't determine how long it's been stuck
    if (lastTransitionTime === 0) continue;

    const elapsed = now - lastTransitionTime;
    if (elapsed >= STUCK_CRITICAL_MS) {
      stuckCriticals.push(storyId);
      stuckStories.push(storyId);
    } else if (elapsed >= STUCK_WARNING_MS) {
      stuckWarnings.push(storyId);
      stuckStories.push(storyId);
    }
  }

  if (stuckCriticals.length > 0) {
    indicators.push({
      id: "stuck-stories",
      severity: "critical",
      message: `${stuckCriticals.length} ${stuckCriticals.length === 1 ? "story" : "stories"} stuck for >96h`,
      details: stuckCriticals,
    });
  } else if (stuckWarnings.length > 0) {
    indicators.push({
      id: "stuck-stories",
      severity: "warning",
      message: `${stuckWarnings.length} ${stuckWarnings.length === 1 ? "story" : "stories"} stuck for >48h`,
      details: stuckWarnings,
    });
  }

  // -------------------------------------------------------------------------
  // 2. WIP alerts — too many stories in active columns
  // -------------------------------------------------------------------------
  for (const col of activeColumns) {
    const count = countStoriesInColumn(sprintEntries, col);
    // Use per-column config, falling back to default thresholds
    const configuredLimit = wipLimits[col];
    const wipWarning = configuredLimit ?? DEFAULT_WIP_LIMIT;
    const wipCritical = configuredLimit ? configuredLimit + 2 : wipWarning + 2;

    if (count > wipCritical) {
      wipColumns.push(col);
      indicators.push({
        id: "wip-alert",
        severity: "critical",
        message: `${col} has ${count} stories (limit: ${wipCritical})`,
        details: [col],
      });
    } else if (count > wipWarning) {
      wipColumns.push(col);
      indicators.push({
        id: "wip-alert",
        severity: "warning",
        message: `${col} has ${count} stories (limit: ${wipWarning})`,
        details: [col],
      });
    }
  }

  // -------------------------------------------------------------------------
  // 3. Throughput drop — 7-day vs 4-week average
  // -------------------------------------------------------------------------
  try {
    const stats = computeCycleTime(project);
    if (stats.throughputPerWeek > 0) {
      const fourWeekDaily = stats.throughputPerWeek / 7;
      const sevenDayDaily = stats.throughputPerDay;

      if (fourWeekDaily > 0) {
        const ratio = sevenDayDaily / fourWeekDaily;
        if (ratio < THROUGHPUT_CRITICAL_RATIO) {
          indicators.push({
            id: "throughput-drop",
            severity: "critical",
            message: `Throughput dropped to ${Math.round(ratio * 100)}% of 4-week average`,
            details: [
              `7-day: ${sevenDayDaily.toFixed(2)}/day`,
              `4-week avg: ${fourWeekDaily.toFixed(2)}/day`,
            ],
          });
        } else if (ratio < THROUGHPUT_WARNING_RATIO) {
          indicators.push({
            id: "throughput-drop",
            severity: "warning",
            message: `Throughput dropped to ${Math.round(ratio * 100)}% of 4-week average`,
            details: [
              `7-day: ${sevenDayDaily.toFixed(2)}/day`,
              `4-week avg: ${fourWeekDaily.toFixed(2)}/day`,
            ],
          });
        }
      }
    }

    // -----------------------------------------------------------------------
    // 4. Bottleneck warning — one column dwell > 2x next-highest
    // -----------------------------------------------------------------------
    if (stats.averageColumnDwells.length >= 2) {
      const sorted = [...stats.averageColumnDwells].sort((a, b) => b.dwellMs - a.dwellMs);
      const highest = sorted[0];
      const secondHighest = sorted[1];
      if (
        highest &&
        secondHighest &&
        secondHighest.dwellMs > 0 &&
        highest.dwellMs >= BOTTLENECK_RATIO * secondHighest.dwellMs
      ) {
        indicators.push({
          id: "bottleneck",
          severity: "warning",
          message: `${highest.column} is a bottleneck (${(highest.dwellMs / secondHighest.dwellMs).toFixed(1)}x next column)`,
          details: [highest.column],
        });
      }
    }
  } catch {
    // Cycle time computation failed — skip throughput/bottleneck checks
  }

  return {
    overall: worstSeverity(indicators),
    indicators,
    stuckStories,
    wipColumns,
  };
}
