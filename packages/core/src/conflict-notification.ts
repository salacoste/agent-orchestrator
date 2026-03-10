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
  EventHandler,
  Event,
  NotificationService,
  Notification,
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
  lastNotificationAt: Date | null;
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
  private handlers: Map<string, EventHandler> = new Map();
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

    // Subscribe to conflict events
    const conflictDetectedHandler: EventHandler = async (event: Event) => {
      await this.handleConflictDetected(event);
    };

    const conflictResolvedHandler: EventHandler = async (event: Event) => {
      await this.handleConflictResolved(event);
    };

    this.handlers.set("conflict.detected", conflictDetectedHandler);
    this.handlers.set("conflict.resolved", conflictResolvedHandler);

    await this.config.eventBus.subscribe("conflict.detected", conflictDetectedHandler);
    await this.config.eventBus.subscribe("conflict.resolved", conflictResolvedHandler);

    this.started = true;
  }

  async stop(): Promise<void> {
    if (!this.started) return;

    // Unsubscribe from all events
    for (const [eventType, handler] of this.handlers) {
      await this.config.eventBus.unsubscribe(eventType, handler);
    }
    this.handlers.clear();
    this.started = false;
  }

  getStats(): ConflictNotificationStats {
    return { ...this.stats };
  }

  async notifyConflict(conflict: AgentConflict): Promise<void> {
    if (!this.config.enabled || !this.config.notificationService) return;

    // Check severity threshold
    if (!this.meetsSeverityThreshold(conflict.severity)) return;

    const notification: Notification = {
      id: `conflict-${conflict.conflictId}`,
      type: "conflict.detected",
      title: `Agent Conflict Detected`,
      message: `Conflict on story ${conflict.storyId}: ${conflict.existingAgent} vs ${conflict.conflictingAgent}`,
      priority: this.getNotificationPriority(conflict.severity),
      timestamp: new Date(),
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

    const notification: Notification = {
      id: `resolution-${result.conflictId}`,
      type: "conflict.resolved",
      title: `Conflict Resolved`,
      message: `Story conflict resolved: ${result.reason}`,
      priority: "normal",
      timestamp: new Date(),
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

  private async handleConflictDetected(event: Event): Promise<void> {
    if (!this.config.notifyOnDetection) return;

    const conflict = event.data as unknown as AgentConflict;
    if (conflict) {
      await this.notifyConflict(conflict);
    }
  }

  private async handleConflictResolved(event: Event): Promise<void> {
    if (!this.config.notifyOnResolution) return;

    const result = event.data as unknown as ResolutionResult;
    if (result) {
      await this.notifyResolution(result);
    }
  }

  private async sendNotification(notification: Notification): Promise<void> {
    if (!this.config.notificationService) return;

    try {
      await this.config.notificationService.send(notification);
      this.stats.totalSent++;
      this.stats.lastNotificationAt = new Date();
    } catch (error) {
      this.stats.failedNotifications++;
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
        return "urgent";
      case "high":
        return "high";
      case "medium":
        return "normal";
      case "low":
        return "low";
      default:
        return "normal";
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
