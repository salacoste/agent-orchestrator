/**
 * Sprint health indicators — surfaces stuck stories, WIP alerts,
 * throughput drops, and bottleneck warnings from sprint data.
 */

import type { ProjectConfig } from "@composio/ao-core";
import { readSprintStatus } from "./sprint-status-reader.js";
import { readHistory } from "./history.js";
import { computeCycleTime } from "./cycle-time.js";

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
const WIP_WARNING = 3;
const WIP_CRITICAL = 5;
const THROUGHPUT_WARNING_RATIO = 0.7;
const THROUGHPUT_CRITICAL_RATIO = 0.4;
const BOTTLENECK_RATIO = 2;

const ACTIVE_COLUMNS = new Set(["in-progress", "review"]);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function worstSeverity(indicators: HealthIndicator[]): HealthSeverity {
  if (indicators.some((i) => i.severity === "critical")) return "critical";
  if (indicators.some((i) => i.severity === "warning")) return "warning";
  return "ok";
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export function computeSprintHealth(project: ProjectConfig): SprintHealthResult {
  const indicators: HealthIndicator[] = [];
  const stuckStories: string[] = [];
  const wipColumns: string[] = [];

  // Read sprint status — if missing, return all-ok
  let sprintEntries: Record<string, { status: string; [key: string]: unknown }>;
  try {
    const sprint = readSprintStatus(project);
    sprintEntries = sprint.development_status;
  } catch {
    return { overall: "ok", indicators: [], stuckStories: [], wipColumns: [] };
  }

  const history = readHistory(project);
  const now = Date.now();

  // -------------------------------------------------------------------------
  // 1. Stuck stories — stories in active columns with no recent transition
  // -------------------------------------------------------------------------
  const stuckWarnings: string[] = [];
  const stuckCriticals: string[] = [];

  for (const [storyId, entry] of Object.entries(sprintEntries)) {
    const status = typeof entry.status === "string" ? entry.status : "backlog";
    if (!ACTIVE_COLUMNS.has(status)) continue;

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
  for (const col of ACTIVE_COLUMNS) {
    const count = Object.values(sprintEntries).filter((e) => {
      const s = typeof e.status === "string" ? e.status : "backlog";
      return s === col;
    }).length;

    if (count > WIP_CRITICAL) {
      wipColumns.push(col);
      indicators.push({
        id: "wip-alert",
        severity: "critical",
        message: `${col} has ${count} stories (limit: ${WIP_CRITICAL})`,
        details: [col],
      });
    } else if (count > WIP_WARNING) {
      wipColumns.push(col);
      indicators.push({
        id: "wip-alert",
        severity: "warning",
        message: `${col} has ${count} stories (limit: ${WIP_WARNING})`,
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
      const highest = sorted[0]!;
      const secondHighest = sorted[1]!;

      if (
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
