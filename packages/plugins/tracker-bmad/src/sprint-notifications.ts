/**
 * Sprint notifications — checks sprint health and forecast, then produces
 * notification objects when thresholds are crossed. These can be converted
 * to OrchestratorEvents and dispatched via any Notifier plugin.
 */

import type { ProjectConfig, OrchestratorEvent, EventType } from "@composio/ao-core";
import { computeSprintHealth } from "./sprint-health.js";
import { computeForecast } from "./forecast.js";
import { computeStoryAging } from "./story-aging.js";
import { computeTeamWorkload } from "./team-workload.js";
import { computeThroughput } from "./throughput.js";
import { computeDependencyGraph } from "./dependencies.js";
import { computeRework } from "./rework.js";
import { computeVelocityComparison } from "./velocity-comparison.js";
import { readHistory } from "./history.js";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface NotificationThresholds {
  stuckHours: number;
  wipLimit: number;
  throughputDropPct: number;
  forecastBehind: boolean;
  backlogAgingDays: number;
  cycleTimeRegressionPct: number;
  teamOverloadLimit: number;
  blockedAgingHours: number;
  reworkRatePct: number;
  reworkCountPerStory: number;
  columnAgingHours: number;
  circularDepsEnabled: boolean;
  blockedStoriesEnabled: boolean;
  velocityDecliningEnabled: boolean;
  velocityTrendConfidenceThreshold: number;
}

export interface SprintNotification {
  type:
    | "sprint.health_warning"
    | "sprint.health_critical"
    | "sprint.forecast_behind"
    | "sprint.story_stuck"
    | "sprint.wip_exceeded"
    | "sprint.backlog_aging"
    | "sprint.cycle_time_regression"
    | "sprint.team_overload"
    | "sprint.blocked_aging"
    | "sprint.rework_rate_high"
    | "sprint.rework_story_bouncing"
    | "sprint.column_aging"
    | "sprint.dependency_circular"
    | "sprint.dependency_blocked"
    | "sprint.velocity_declining"
  severity: "warning" | "critical" | "info";
  title: string;
  message: string;
  details: string[];
  timestamp: string;
}

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

const DEFAULT_THRESHOLDS: NotificationThresholds = {
  stuckHours: 48,
  wipLimit: 3,
  throughputDropPct: 30,
  forecastBehind: true,
  backlogAgingDays: 14,
  cycleTimeRegressionPct: 30,
  teamOverloadLimit: 3,
  blockedAgingHours: 48,
  reworkRatePct: 25,
  reworkCountPerStory: 3,
  columnAgingHours: 24,
  circularDepsEnabled: true,
  blockedStoriesEnabled: true,
  velocityDecliningEnabled: true,
  velocityTrendConfidenceThreshold: 0.5,
};

// ---------------------------------------------------------------------------
// Public functions
// ---------------------------------------------------------------------------

export function getDefaultThresholds(): NotificationThresholds {
  return { ...DEFAULT_THRESHOLDS };
}

export function checkSprintNotifications(
  project: ProjectConfig,
  thresholds?: Partial<NotificationThresholds>,
): SprintNotification[] {
  const merged: NotificationThresholds = {
    ...DEFAULT_THRESHOLDS,
    ...thresholds,
  };

  const health = computeSprintHealth(project);
  const forecast = computeForecast(project);

  const notifications: SprintNotification[] = [];
  const now = new Date().toISOString();

  // 1. Health indicators — warning and critical
  for (const indicator of health.indicators) {
    if (indicator.severity === "warning") {
      notifications.push({
        type: "sprint.health_warning",
        severity: "warning",
        title: `Sprint Health Warning: ${indicator.id}`,
        message: indicator.message,
        details: indicator.details,
        timestamp: now,
      });
    } else if (indicator.severity === "critical") {
      notifications.push({
        type: "sprint.health_critical",
        severity: "critical",
        title: `Sprint Health Critical: ${indicator.id}`,
        message: indicator.message,
        details: indicator.details,
        timestamp: now,
      });
    }
  }

  // 2. Stuck stories
  if (health.stuckStories.length > 0) {
    notifications.push({
      type: "sprint.story_stuck",
      severity: "warning",
      title: "Stories Stuck",
      message: `${health.stuckStories.length} ${health.stuckStories.length === 1 ? "story" : "stories"} stuck in active columns`,
      details: health.stuckStories,
      timestamp: now,
    });
  }

  // 3. WIP exceeded
  if (health.wipColumns.length > 0) {
    notifications.push({
      type: "sprint.wip_exceeded",
      severity: "warning",
      title: "WIP Limit Exceeded",
      message: `WIP limit exceeded in ${health.wipColumns.length === 1 ? "column" : "columns"}: ${health.wipColumns.join(", ")}`,
      details: health.wipColumns,
      timestamp: now,
    });
  }

  // 4. Forecast behind
  if (forecast.pace === "behind" && merged.forecastBehind) {
    notifications.push({
      type: "sprint.forecast_behind",
      severity: "warning",
      title: "Sprint Behind Pace",
      message: `Current velocity ${forecast.currentVelocity.toFixed(2)}/day is below required ${forecast.requiredVelocity.toFixed(2)}/day`,
      details: [
        `Current velocity: ${forecast.currentVelocity.toFixed(2)}/day`,
        `Required velocity: ${forecast.requiredVelocity.toFixed(2)}/day`,
        `Remaining stories: ${forecast.remainingStories}`,
      ],
      timestamp: now,
    });
  }


  // 6. Rework rate alerts
  try {
    const rework = computeRework(project);
    if (rework.reworkRate > merged.reworkRatePct) {
      const severity = rework.reworkRate > merged.reworkRatePct * 2 ? "critical" : "warning";
      notifications.push({
        type: "sprint.rework_rate_high",
        severity,
        title: "High Rework Rate",
        message: `Rework rate is ${rework.reworkRate.toFixed(1)}% (threshold: ${merged.reworkRatePct}%)`,
        details: [
          `${rework.totalReworkEvents} rework events across ${rework.stories.length} stories`,
          ...rework.worstOffenders.slice(0, 3).map((o) => `${o.storyId}: ${o.reworkCount} bounces`),
        ],
        timestamp: now,
      });
    }

    // Individual story bouncing alerts
    for (const story of rework.stories) {
      if (story.reworkCount >= merged.reworkCountPerStory) {
        notifications.push({
          type: "sprint.rework_story_bouncing",
          severity: "warning",
          title: `Story Bouncing: ${story.storyId}`,
          message: `${story.storyId} has bounced ${story.reworkCount} times`,
          details: story.events.map(
            (e) => `${e.fromStatus} → ${e.toStatus} (${e.timestamp.slice(0, 10)})`
          ),
          timestamp: now,
        });
      }
    }
  } catch {
    // Non-fatal
  }

  // 7. Column aging alerts
  try {
    const aging = computeStoryAging(project);
    const thresholdMs = merged.columnAgingHours * 60 * 60 * 1000;
    
    for (const [column, colStats] of Object.entries(aging.columns)) {
      // Skip backlog and done columns - only alert on active columns
      if (column === "backlog" || column === "done") continue;
      
      const stuckStories = colStats.stories.filter((s) => s.ageMs > thresholdMs);
      if (stuckStories.length > 0) {
        notifications.push({
          type: "sprint.column_aging",
          severity: "warning",
          title: `Stories Aging in ${column}`,
          message: `${stuckStories.length} ${stuckStories.length === 1 ? "story" : "stories"} in ${column} for >${merged.columnAgingHours}h`,
          details: stuckStories.map((s) => `${s.storyId}: ${Math.round(s.ageMs / 3600000)}h`),
          timestamp: now,
        });
      }
    }
  } catch {
    // Non-fatal — reuses aging data if already computed in section 5
  }

  // 8. Dependency cycle and blocked story alerts
  try {
    const depGraph = computeDependencyGraph(project);

    if (merged.circularDepsEnabled && depGraph.circularWarnings.length > 0) {
      notifications.push({
        type: "sprint.dependency_circular",
        severity: "critical",
        title: "Dependency Cycles Detected",
        message: `${depGraph.circularWarnings.length} circular ${depGraph.circularWarnings.length === 1 ? "dependency" : "dependencies"} found`,
        details: depGraph.circularWarnings.map((cycle) => cycle.join(" → ") + " → " + cycle[0]),
        timestamp: now,
      });
    }

    if (merged.blockedStoriesEnabled) {
      const blockedStories = Object.values(depGraph.nodes).filter((n) => n.isBlocked);
      if (blockedStories.length > 0) {
        notifications.push({
          type: "sprint.dependency_blocked",
          "severity": "warning",
          title: "Stories Blocked by Dependencies",
          message: `${blockedStories.length} ${blockedStories.length === 1 ? "story" : "stories"} blocked`,
          details: blockedStories.map((n) => `${n.storyId} blocked by: ${n.blockedBy.join(", ")}`),
          timestamp: now,
        });
      }
    }
  } catch {
    // Non-fatal — reuses dep graph data if already computed in other sections
  }

    // 12. Velocity declining trend
  try {
    if (merged.velocityDecliningEnabled) {
      const velocityComp = computeVelocityComparison(project);
      if (
        velocityComp.trend === "declining" &&
        velocityComp.trendConfidence >= merged.velocityTrendConfidenceThreshold
      ) {
        notifications.push({
          type: "sprint.velocity_declining",
          severity: velocityComp.trendSlope < -1 ? "critical" : "warning",
          title: "Velocity Trend Declining",
          message: `Weekly velocity is trending down (confidence: ${Math.round(velocityComp.trendConfidence * 100)}%)`,
          details: [
            `Average velocity: ${velocityComp.averageVelocity.toFixed(1)} stories/week`,
            `Trend slope: ${velocityComp.trendSlope.toFixed(2)} stories/week²`,
            `Confidence: ${Math.round(velocityComp.trendConfidence * 100)}%`,
            `Next week estimate: ${velocityComp.nextWeekEstimate.toFixed(1)} stories`,
            ...velocityComp.weeks.slice(-4).map((w) => `${w.weekStart}: ${w.completedCount} stories`),
          ],
          timestamp: now,
        });
      }
    }
  } catch {
    // Non-fatal
  }

  return notifications;
}

export function formatNotificationEvent(notification: SprintNotification): OrchestratorEvent {
  const priorityMap: Record<SprintNotification["severity"], OrchestratorEvent["priority"]> = {
    critical: "urgent",
    warning: "warning",
    info: "info",
  };

  return {
    id: `notif-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    type: notification.type as EventType,
    priority: priorityMap[notification.severity],
    sessionId: "",
    projectId: "",
    timestamp: new Date(notification.timestamp),
    message: `${notification.title}: ${notification.message}`,
    data: {
      notificationType: notification.type,
      severity: notification.severity,
      title: notification.title,
      details: notification.details,
    },
  };
}
