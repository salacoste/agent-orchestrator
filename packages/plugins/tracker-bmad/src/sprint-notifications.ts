/**
 * Sprint notifications — checks sprint health and forecast, then produces
 * notification objects when thresholds are crossed. These can be converted
 * to OrchestratorEvents and dispatched via any Notifier plugin.
 */

import type { ProjectConfig, OrchestratorEvent, EventType } from "@composio/ao-core";
import { computeSprintHealth } from "./sprint-health.js";
import { computeForecast } from "./forecast.js";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface NotificationThresholds {
  stuckHours: number;
  wipLimit: number;
  throughputDropPct: number;
  forecastBehind: boolean;
}

export interface SprintNotification {
  type:
    | "sprint.health_warning"
    | "sprint.health_critical"
    | "sprint.forecast_behind"
    | "sprint.story_stuck"
    | "sprint.wip_exceeded";
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
