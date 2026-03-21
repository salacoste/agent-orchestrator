/**
 * Shared utilities for NotificationPlugin adapters.
 *
 * Converts between the NotificationPlugin interface (used by NotificationService)
 * and the legacy Notifier interface (used by the 8-slot plugin system).
 * Used by slack, webhook, and composio notifier plugin adapters.
 */

import type { Notification, OrchestratorEvent, EventPriority } from "./types.js";

/**
 * Map NotificationPriority to EventPriority for OrchestratorEvent compatibility.
 */
export function mapNotificationPriority(priority: Notification["priority"]): EventPriority {
  switch (priority) {
    case "critical":
      return "urgent";
    case "warning":
      return "action";
    case "info":
      return "info";
    default:
      return "info";
  }
}

/**
 * Convert a Notification into an OrchestratorEvent for the legacy Notifier interface.
 */
export function notificationToOrchestratorEvent(notification: Notification): OrchestratorEvent {
  return {
    id: notification.eventId,
    type: "session.needs_input" as OrchestratorEvent["type"],
    priority: mapNotificationPriority(notification.priority),
    sessionId: (notification.metadata?.["agentId"] as string) ?? "system",
    projectId: (notification.metadata?.["projectId"] as string) ?? "agent-orchestrator",
    timestamp: new Date(notification.timestamp),
    message: `${notification.title}: ${notification.message}`,
    data: notification.metadata ?? {},
  };
}
