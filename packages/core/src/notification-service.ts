/**
 * Notification Service
 *
 * Central notification service that queues, deduplicates, and routes notifications
 * to configured plugins (desktop, slack, webhook).
 */

import type {
  NotificationService,
  NotificationServiceConfig,
  Notification,
  NotificationResult,
  NotificationStatus,
  DeadLetterNotification,
  NotificationPlugin,
  EventBusEvent,
  NotificationPreferences,
} from "./types.js";

// Re-export NotificationServiceConfig for consumers
export type { NotificationServiceConfig };
import { appendFile } from "node:fs/promises";

/** Default deduplication window (5 minutes) */
const DEFAULT_DEDUP_WINDOW_MS = 300000;

/** Default backlog threshold */
const DEFAULT_BACKLOG_THRESHOLD = 50;

/** Default retry delays (1s, 2s, 4s, 8s, 16s) */
const DEFAULT_RETRY_DELAYS = [1000, 2000, 4000, 8000, 16000];

/** Maximum retry attempts */
const MAX_RETRY_ATTEMPTS = 3;

/** Queued notification with metadata */
interface QueuedNotification {
  notification: Notification;
  queuedAt: number;
  retryCount: number;
  targetPlugin: string;
}

/** Deduplication key */
interface DedupKey {
  eventId: string;
  eventType: string;
  expiresAt: number;
}

/**
 * Notification Service Implementation
 */
export class NotificationServiceImpl implements NotificationService {
  private config: NotificationServiceConfig;
  private queue: QueuedNotification[] = [];
  private deadLetterQueue: DeadLetterNotification[] = [];
  private dedupSet: Set<string> = new Set();
  private dedupKeys: DedupKey[] = [];
  private processing = false;
  private closed = false;
  private dedupCount = 0; // Track actual duplicates, not all tracked notifications
  private eventBusUnsubscribe: (() => void) | null = null; // Store unsubscribe function
  private stats: NotificationStatus = {
    queueDepth: 0,
    dedupCount: 0,
    dlqSize: 0,
  };

  constructor(config: NotificationServiceConfig) {
    this.config = {
      eventBus: config.eventBus,
      plugins: config.plugins,
      dlqPath: config.dlqPath ?? undefined,
      backlogThreshold: config.backlogThreshold ?? DEFAULT_BACKLOG_THRESHOLD,
      dedupWindowMs: config.dedupWindowMs ?? DEFAULT_DEDUP_WINDOW_MS,
      preferences: config.preferences,
    };

    // Validate preferences plugin names
    if (this.config.preferences) {
      this.validatePreferences(this.config.preferences);
    }

    // Subscribe to event bus for critical events (fire and forget)
    // We store the unsubscribe when subscription completes
    this.subscribeToEvents().catch((error) => {
      // Log subscription errors but don't throw in constructor
      // eslint-disable-next-line no-console
      console.error("Failed to subscribe to event bus:", error);
    });
  }

  /**
   * Send notification immediately
   */
  async send(notification: Notification): Promise<NotificationResult> {
    if (this.closed) {
      throw new Error("NotificationService is closed");
    }

    // Clean expired dedup keys first
    this.cleanExpiredDedupKeys();

    // Check for duplicate
    const dedupKey = `${notification.eventId}:${notification.eventType}`;
    if (this.dedupSet.has(dedupKey)) {
      this.dedupCount++;
      this.stats.dedupCount = this.dedupCount;
      return {
        success: true,
        deliveredPlugins: [],
        failedPlugins: [],
        duplicate: true,
      };
    }

    // Add to dedup set
    this.dedupSet.add(dedupKey);
    this.dedupKeys.push({
      eventId: notification.eventId,
      eventType: notification.eventType,
      expiresAt: Date.now() + (this.config.dedupWindowMs ?? DEFAULT_DEDUP_WINDOW_MS),
    });

    // Track as pending for backlog detection
    this.queue.push({
      notification,
      queuedAt: Date.now(),
      retryCount: 0,
      targetPlugin: "",
    });

    // Publish backlog event when queue depth exceeds threshold
    if (this.queue.length > (this.config.backlogThreshold ?? DEFAULT_BACKLOG_THRESHOLD)) {
      await this.publishBacklogEvent();
    }

    // Route to available plugins based on preferences
    const deliveredPlugins: string[] = [];
    const failedPlugins: Array<{ plugin: string; error: string }> = [];

    // Get plugins filtered by notification preferences
    const targetPlugins = this.filterPluginsByPreference(notification.eventType);

    for (const plugin of targetPlugins) {
      const available = await plugin.isAvailable();
      if (!available) {
        continue; // Skip unavailable plugins
      }

      try {
        await this.sendWithRetry(plugin, notification);
        deliveredPlugins.push(plugin.name);
      } catch (error) {
        failedPlugins.push({
          plugin: plugin.name,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    // Remove from pending queue
    const pendingIndex = this.queue.findIndex(
      (q) => q.notification.eventId === notification.eventId,
    );
    if (pendingIndex !== -1) {
      this.queue.splice(pendingIndex, 1);
    }

    this.updateStats();

    return {
      success: failedPlugins.length === 0,
      deliveredPlugins,
      failedPlugins,
    };
  }

  /**
   * Get notification queue status
   */
  getStatus(): NotificationStatus {
    return { ...this.stats, queueDepth: this.queue.length, dlqSize: this.deadLetterQueue.length };
  }

  /**
   * Get dead letter queue
   */
  getDLQ(): DeadLetterNotification[] {
    return [...this.deadLetterQueue];
  }

  /**
   * Retry failed notification from DLQ
   */
  async retryDLQ(notificationId: string): Promise<void> {
    const dlqIndex = this.deadLetterQueue.findIndex(
      (dlq) => dlq.notification.eventId === notificationId,
    );
    if (dlqIndex === -1) {
      return; // Not found in DLQ
    }

    const dlqEntry = this.deadLetterQueue[dlqIndex];
    this.deadLetterQueue.splice(dlqIndex, 1);

    // Find plugin and retry
    const plugin = this.config.plugins.find((p) => p.name === dlqEntry.targetPlugin);
    if (plugin) {
      try {
        await this.sendWithRetry(plugin, dlqEntry.notification);
      } catch (error) {
        // Re-add to DLQ if still failing
        await this.addToDLQ(
          dlqEntry.notification,
          dlqEntry.targetPlugin,
          dlqEntry.retryCount + 1,
          error,
        );
      }
    }

    this.updateStats();
  }

  /**
   * Close notification service
   */
  async close(): Promise<void> {
    this.closed = true;

    // Unsubscribe from event bus to prevent memory leak
    if (this.eventBusUnsubscribe) {
      this.eventBusUnsubscribe();
      this.eventBusUnsubscribe = null;
    }

    this.queue = [];
    this.dedupSet.clear();
    this.dedupKeys = [];
    this.dedupCount = 0;
    this.updateStats();
  }

  /**
   * Subscribe to critical events on event bus
   */
  private async subscribeToEvents(): Promise<void> {
    // Store unsubscribe function for cleanup in close()
    this.eventBusUnsubscribe = await this.config.eventBus.subscribe(
      async (event: EventBusEvent) => {
        // Convert critical events to notifications
        const priority = this.getPriorityFromEventType(event.eventType);
        if (priority) {
          const notification: Notification = {
            eventId: event.eventId,
            eventType: event.eventType,
            priority,
            title: this.getTitleFromEventType(event.eventType, event.metadata),
            message: this.getMessageFromEventType(event.eventType, event.metadata),
            metadata: event.metadata,
            timestamp: event.timestamp,
          };

          await this.send(notification);
        }
      },
    );
  }

  /**
   * Get notification priority from event type
   */
  private getPriorityFromEventType(eventType: string): "critical" | "warning" | "info" | null {
    if (eventType.includes("blocked") || eventType.includes("conflict")) {
      return "critical";
    }
    if (eventType.includes("failed") || eventType.includes("error")) {
      return "warning";
    }
    if (
      eventType.includes("completed") ||
      eventType.includes("started") ||
      eventType.includes("assigned")
    ) {
      return "info";
    }
    return null; // Not a notification-worthy event
  }

  /**
   * Get title from event type
   */
  private getTitleFromEventType(eventType: string, _metadata: Record<string, unknown>): string {
    if (eventType.includes("blocked")) {
      return "Agent Blocked";
    }
    if (eventType.includes("conflict")) {
      return "Conflict Detected";
    }
    if (eventType.includes("completed")) {
      return "Story Completed";
    }
    if (eventType.includes("started")) {
      return "Story Started";
    }
    if (eventType.includes("assigned")) {
      return "Story Assigned";
    }
    return eventType;
  }

  /**
   * Get message from event type
   */
  private getMessageFromEventType(eventType: string, metadata: Record<string, unknown>): string {
    if (eventType.includes("blocked") && metadata.storyId) {
      return `Story ${String(metadata.storyId)} agent is blocked`;
    }
    if (eventType.includes("conflict") && metadata.storyId) {
      return `Conflict detected for ${String(metadata.storyId)}`;
    }
    if (eventType.includes("completed") && metadata.storyId) {
      return `Story ${String(metadata.storyId)} completed`;
    }
    if (eventType.includes("started") && metadata.storyId) {
      return `Story ${String(metadata.storyId)} started`;
    }
    if (eventType.includes("assigned") && metadata.storyId) {
      return `Story ${String(metadata.storyId)} assigned to ${String(metadata.agentId || "agent")}`;
    }
    return eventType;
  }

  /**
   * Send notification with retry logic
   */
  private async sendWithRetry(
    plugin: NotificationPlugin,
    notification: Notification,
  ): Promise<void> {
    for (let attempt = 0; attempt < MAX_RETRY_ATTEMPTS; attempt++) {
      try {
        await plugin.send(notification);
        return; // Success
      } catch (error) {
        const isLastAttempt = attempt === MAX_RETRY_ATTEMPTS - 1;

        if (isLastAttempt) {
          // All retries exhausted
          await this.addToDLQ(notification, plugin.name, attempt + 1, error);
          throw error;
        }

        // Exponential backoff
        const delay =
          DEFAULT_RETRY_DELAYS[attempt] ?? DEFAULT_RETRY_DELAYS[DEFAULT_RETRY_DELAYS.length - 1];
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  /**
   * Add notification to dead letter queue
   */
  private async addToDLQ(
    notification: Notification,
    targetPlugin: string,
    retryCount: number,
    error: unknown,
  ): Promise<void> {
    const dlqEntry: DeadLetterNotification = {
      notification,
      targetPlugin,
      retryCount,
      error: error instanceof Error ? error.message : String(error),
      lastAttempt: new Date().toISOString(),
    };

    this.deadLetterQueue.push(dlqEntry);

    // Persist to disk if configured
    if (this.config.dlqPath) {
      try {
        const logEntry = JSON.stringify(dlqEntry) + "\n";
        await appendFile(this.config.dlqPath, logEntry, "utf-8");
      } catch {
        // Ignore persist errors
      }
    }

    this.updateStats();
  }

  /**
   * Publish backlog event
   */
  private async publishBacklogEvent(): Promise<void> {
    try {
      await this.config.eventBus.publish({
        eventType: "notification.backlog",
        metadata: {
          queueDepth: this.queue.length,
        },
      });
    } catch {
      // Ignore publish errors
    }
  }

  /**
   * Update statistics
   */
  private updateStats(): void {
    this.stats.queueDepth = this.queue.length;
    this.stats.dlqSize = this.deadLetterQueue.length;
    this.stats.dedupCount = this.dedupCount;
    this.stats.lastProcessedTime = new Date().toISOString();
  }

  /**
   * Clean expired dedup keys
   */
  private cleanExpiredDedupKeys(): void {
    const now = Date.now();
    const activeKeys = new Set<string>();

    for (const key of this.dedupKeys) {
      if (key.expiresAt > now) {
        activeKeys.add(`${key.eventId}:${key.eventType}`);
      }
    }

    this.dedupKeys = this.dedupKeys.filter((key) => key.expiresAt > now);
    this.dedupSet = activeKeys;
  }

  /**
   * Validate notification preferences plugin names
   */
  private validatePreferences(preferences: NotificationPreferences): void {
    const availablePluginNames = new Set(this.config.plugins.map((p) => p.name));

    for (const [pattern, pluginList] of Object.entries(preferences)) {
      if (!pluginList) continue;

      const plugins = pluginList.split(",").map((p) => p.trim());
      for (const pluginName of plugins) {
        if (pluginName !== "all" && !availablePluginNames.has(pluginName)) {
          throw new Error(
            `Invalid plugin name "${pluginName}" in notification preferences for pattern "${pattern}". ` +
              `Available plugins: ${Array.from(availablePluginNames).join(", ")}`,
          );
        }
      }
    }
  }

  /**
   * Filter plugins based on notification preferences for an event type
   */
  private filterPluginsByPreference(eventType: string): NotificationPlugin[] {
    if (!this.config.preferences || Object.keys(this.config.preferences).length === 0) {
      // No preferences configured, use all plugins
      return this.config.plugins;
    }

    // Find matching preference pattern
    const matchedPattern = this.findMatchingPreferencePattern(eventType);

    if (!matchedPattern) {
      // No matching preference, use all plugins
      return this.config.plugins;
    }

    const pluginList = this.config.preferences[matchedPattern];
    if (!pluginList) {
      return this.config.plugins;
    }

    // Parse plugin list
    const requestedPlugins = pluginList.split(",").map((p) => p.trim());

    if (requestedPlugins.includes("all")) {
      return this.config.plugins;
    }

    // Filter to only requested plugins that are available
    return this.config.plugins.filter((plugin) => requestedPlugins.includes(plugin.name));
  }

  /**
   * Find the first preference pattern that matches the event type
   */
  private findMatchingPreferencePattern(eventType: string): string | null {
    if (!this.config.preferences) {
      return null;
    }

    // Check for exact match first
    if (eventType in this.config.preferences) {
      return eventType;
    }

    // Check for substring match (e.g., "blocked" matches "agent.blocked")
    for (const pattern of Object.keys(this.config.preferences)) {
      if (eventType.includes(pattern)) {
        return pattern;
      }
    }

    return null;
  }
}

/**
 * Factory function to create a notification service instance
 */
export function createNotificationService(config: NotificationServiceConfig): NotificationService {
  return new NotificationServiceImpl(config);
}
