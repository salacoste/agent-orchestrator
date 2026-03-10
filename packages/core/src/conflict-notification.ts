/**
 * Conflict Notification Integration
 *
 * Integrates conflict detection/resolution with the notification service.
 * Sends push notifications when conflicts are detected or resolved.
 *
 * Features:
 * - Notify on conflict detection
 * - Notify on conflict resolution (auto or manual)
 * - Support desktop and slack notification channels
 * - Configurable notification preferences
 */

import type {
  EventBus,
  EventBusEvent,
  NotificationService,
  NotificationPriority,
  AgentConflict,
  ResolutionResult,
} from "./types.js";

/**
 * Conflict notification configuration
 */
export interface ConflictNotificationConfig {
  /** Event bus to subscribe to conflict events */
  eventBus: EventBus;
  /** Notification service to send notifications */
  notificationService?: NotificationService;
  /** Enable/disable notifications (default: true) */
  enabled?: boolean;
  /** Notification channels to use (default: ["desktop"]) */
  channels?: ("desktop" | "slack" | "webhook")[];
  /** Minimum severity to notify (default: "medium") */
  minSeverity?: "critical" | "high" | "medium" | "low";
  /** Notify on detection (default: true) */
  notifyOnDetection?: boolean;
  /** Notify on resolution (default: true) */
  notifyOnResolution?: boolean;
  /** Notify on auto-resolution (default: false) */
  notifyOnAutoResolution?: boolean;
}

/**
 * Conflict notification statistics
 */
export interface ConflictNotificationStats {
  /** Total notifications sent */
  totalSent: number;
  /** Detection notifications sent */
  detectionNotifications: number;
  /** Resolution notifications sent */
  resolutionNotifications: number;
  /** Failed notifications */
  failedNotifications: number;
  /** Last notification timestamp */
  lastNotificationAt: string | null;
}

/**
 * Conflict notification integration interface
 */
export interface ConflictNotificationIntegration {
  /** Start listening for conflict events */
  start(): Promise<void>;
  /** Stop listening for conflict events */
  stop(): Promise<void>;
  /** Get notification statistics */
  getStats(): ConflictNotificationStats;
  /** Send manual notification for a conflict */
  notifyConflict(conflict: AgentConflict): Promise<void>;
  /** Send manual notification for a resolution */
  notifyResolution(result: ResolutionResult): Promise<void>;
}

/**
 * Conflict notification integration implementation
 */
class ConflictNotificationIntegrationImpl implements ConflictNotificationIntegration {
  private config: Required<
    Pick<
      ConflictNotificationConfig,
      | "enabled"
      | "channels"
      | "minSeverity"
      | "notifyOnDetection"
      | "notifyOnAutoResolution"
      | "notifyOnResolution"
    >
  > &
    Pick<ConflictNotificationConfig, "eventBus" | "notificationService">;
  private stats: ConflictNotificationStats = {
    totalSent: 0,
    detectionNotifications: 0,
    resolutionNotifications: 0,
    failedNotifications: 0,
    lastNotificationAt: null,
  };
  private unsubscribe: (() => void) | null = null;
  private started = false;

  constructor(config: ConflictNotificationConfig) {
    this.config = {
      eventBus: config.eventBus,
      notificationService: config.notificationService,
      enabled: config.enabled ?? true,
      channels: config.channels ?? ["desktop"],
      minSeverity: config.minSeverity ?? "medium",
      notifyOnDetection: config.notifyOnDetection ?? true,
      notifyOnResolution: config.notifyOnResolution ?? true,
      notifyOnAutoResolution: config.notifyOnAutoResolution ?? false,
    };
  }

  async start(): Promise<void> {
    if (this.started || !this.config.enabled) return;

    // Subscribe to all events and filter for conflict events
    this.unsubscribe = await this.config.eventBus.subscribe((event: EventBusEvent) => {
      void this.handleEvent(event);
    });

    this.started = true;
  }

  async stop(): Promise<void> {
    if (!this.started) return;

    // Call the unsubscribe function
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }
    this.started = false;
  }

  getStats(): ConflictNotificationStats {
    return { ...this.stats };
  }

  async notifyConflict(conflict: AgentConflict): Promise<void> {
    if (!this.config.enabled || !this.config.notificationService) return;

    // Check severity threshold
    if (!this.meetsSeverityThreshold(conflict.severity)) return;

    const notification = {
      eventId: `conflict-${conflict.conflictId}`,
      eventType: "conflict.detected",
      title: `Agent Conflict Detected`,
      message: `Conflict on story ${conflict.storyId}: ${conflict.existingAgent} vs ${conflict.conflictingAgent}`,
      priority: this.getNotificationPriority(conflict.severity),
      channels: this.config.channels,
      data: {
        conflictId: conflict.conflictId,
        storyId: conflict.storyId,
        existingAgent: conflict.existingAgent,
        conflictingAgent: conflict.conflictingAgent,
        severity: conflict.severity,
        recommendations: conflict.recommendations,
      },
    };

    await this.sendNotification(notification);
    this.stats.detectionNotifications++;
  }

  async notifyResolution(result: ResolutionResult): Promise<void> {
    if (!this.config.enabled || !this.config.notificationService) return;

    // Skip if auto-resolution and notifyOnAutoResolution is false
    const isAutoResolution = result.reason.includes("priority");
    if (isAutoResolution && !this.config.notifyOnAutoResolution) return;

    const notification = {
      eventId: `resolution-${result.conflictId}`,
      eventType: "conflict.resolved",
      title: `Conflict Resolved`,
      message: `Story conflict resolved: ${result.reason}`,
      priority: "info" as NotificationPriority,
      channels: this.config.channels,
      data: {
        conflictId: result.conflictId,
        action: result.action,
        keptAgent: result.keptAgent,
        terminatedAgent: result.terminatedAgent,
        reason: result.reason,
        resolvedAt: result.resolvedAt,
      },
    };

    await this.sendNotification(notification);
    this.stats.resolutionNotifications++;
  }

  private async handleEvent(event: EventBusEvent): Promise<void> {
    if (event.eventType === "conflict.detected" && this.config.notifyOnDetection) {
      const conflict = event.metadata as unknown as AgentConflict;
      if (conflict) {
        await this.notifyConflict(conflict);
      }
    } else if (event.eventType === "conflict.resolved" && this.config.notifyOnResolution) {
      const result = event.metadata as unknown as ResolutionResult;
      if (result) {
        await this.notifyResolution(result);
      }
    }
  }

  private async sendNotification(notification: {
    eventId: string;
    eventType: string;
    title: string;
    message: string;
    priority: NotificationPriority;
    channels: ("desktop" | "slack" | "webhook")[];
    data: Record<string, unknown>;
  }): Promise<void> {
    if (!this.config.notificationService) return;

    try {
      await this.config.notificationService.send({
        eventId: notification.eventId,
        eventType: notification.eventType,
        title: notification.title,
        message: notification.message,
        priority: notification.priority,
        timestamp: new Date().toISOString(),
      });
      this.stats.totalSent++;
      this.stats.lastNotificationAt = new Date().toISOString();
    } catch (error) {
      this.stats.failedNotifications++;
      // eslint-disable-next-line no-console
      console.error("Failed to send conflict notification:", error);
    }
  }

  private meetsSeverityThreshold(severity: AgentConflict["severity"]): boolean {
    const severityOrder: Record<string, number> = {
      critical: 4,
      high: 3,
      medium: 2,
      low: 1,
    };

    const thresholdLevel = severityOrder[this.config.minSeverity] ?? 2;
    const conflictLevel = severityOrder[severity] ?? 1;

    return conflictLevel >= thresholdLevel;
  }

  private getNotificationPriority(severity: AgentConflict["severity"]): NotificationPriority {
    switch (severity) {
      case "critical":
        return "critical";
      case "high":
        return "critical";
      case "medium":
        return "warning";
      case "low":
        return "info";
      default:
        return "info";
    }
  }
}

/**
 * Factory function to create a conflict notification integration
 */
export function createConflictNotificationIntegration(
  config: ConflictNotificationConfig,
): ConflictNotificationIntegration {
  return new ConflictNotificationIntegrationImpl(config);
}
