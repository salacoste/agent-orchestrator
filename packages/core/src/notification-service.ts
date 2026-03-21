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
  NotificationTrigger,
  NotificationHistoryEntry,
  NotificationHistoryFilter,
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

/** Delivery latency warning threshold (1 second) */
const LATENCY_WARNING_THRESHOLD_MS = 1000;

/** Default digest flush interval (30 minutes) */
const DEFAULT_DIGEST_INTERVAL_MS = 1800000;

/** Default history max entries */
const DEFAULT_HISTORY_MAX_ENTRIES = 1000;

/** Default history retention (7 days in ms) */
const DEFAULT_HISTORY_RETENTION_DAYS = 7;

/** Default per-type dedup windows (milliseconds) */
const DEFAULT_DEDUP_WINDOWS: Record<string, number> = {
  "agent.blocked": 300000, // 5 min
  "story.blocked": 300000, // 5 min
  "agent.offline": 300000, // 5 min
  "conflict.detected": 600000, // 10 min
  "eventbus.backlog": 600000, // 10 min
};

/** Default event-type-to-notification trigger map.
 * NOTE: "notification.backlog" and "notification.digest" are intentionally excluded —
 * they are self-published by this service and re-consuming them would cause an
 * infinite recursive loop. External consumers can subscribe to them directly.
 */
const DEFAULT_TRIGGER_MAP: Record<string, NotificationTrigger> = {
  "agent.blocked": { priority: "critical", title: "Agent Blocked" },
  "story.blocked": { priority: "critical", title: "Story Blocked" },
  "conflict.detected": { priority: "critical", title: "Conflict Detected" },
  "eventbus.backlog": { priority: "critical", title: "Event Bus Backlog" },
  "agent.offline": { priority: "warning", title: "Agent Offline" },
  "story.completed": { priority: "info", title: "Story Completed" },
  "story.started": { priority: "info", title: "Story Started" },
  "story.assigned": { priority: "info", title: "Story Assigned" },
  "agent.resumed": { priority: "info", title: "Agent Resumed" },
};

/** Queued notification with metadata */
interface QueuedNotification {
  notification: Notification;
  queuedAt: number;
  retryCount: number;
  targetPlugin: string;
}

/** Deduplication key — entity-based for same-entity suppression */
interface DedupKey {
  entityId: string;
  eventType: string;
  expiresAt: number;
}

/**
 * Notification Service Implementation
 */
export class NotificationServiceImpl implements NotificationService {
  private config: NotificationServiceConfig;
  private triggerMap: Record<string, NotificationTrigger>;
  private queue: QueuedNotification[] = [];
  private deadLetterQueue: DeadLetterNotification[] = [];
  private dedupSet: Set<string> = new Set();
  private dedupKeys: DedupKey[] = [];
  private processing = false;
  private closed = false;
  private dedupCount = 0; // Track actual duplicates, not all tracked notifications
  private eventBusUnsubscribe: (() => void) | null = null; // Store unsubscribe function
  private digestBuffer: Notification[] = [];
  private digestTimer: ReturnType<typeof setInterval> | null = null;
  private history: NotificationHistoryEntry[] = [];
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
      triggerMap: config.triggerMap,
      dedupWindowByType: config.dedupWindowByType,
      digestIntervalMs: config.digestIntervalMs,
      historyMaxEntries: config.historyMaxEntries,
      historyRetentionDays: config.historyRetentionDays,
    };

    // Merge user-provided trigger map with defaults (user overrides win)
    this.triggerMap = { ...DEFAULT_TRIGGER_MAP, ...config.triggerMap };

    // Validate preferences plugin names
    if (this.config.preferences) {
      this.validatePreferences(this.config.preferences);
    }

    // Start digest flush timer
    const digestInterval = this.config.digestIntervalMs ?? DEFAULT_DIGEST_INTERVAL_MS;
    this.digestTimer = setInterval(() => {
      this.flushDigest().catch((error) => {
        // eslint-disable-next-line no-console -- digest flush error is intentional observability
        console.error("[notification] Digest flush error:", error);
      });
    }, digestInterval);

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

    // Entity-based dedup: {eventType}:{entityId}
    const entityId = this.extractEntityId(notification.metadata ?? {});
    const dedupKey = `${notification.eventType}:${entityId}`;
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

    // Add to dedup set with per-type window
    this.dedupSet.add(dedupKey);
    this.dedupKeys.push({
      entityId,
      eventType: notification.eventType,
      expiresAt: Date.now() + this.getDedupWindow(notification.eventType),
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

    // Get plugins filtered by notification preferences (try event type first, then priority)
    const targetPlugins = this.filterPluginsByPreference(
      notification.eventType,
      notification.priority,
    );

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

    // Record to history
    this.addToHistory(notification, deliveredPlugins);

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
   * Get notification history with optional filtering
   */
  getHistory(filter?: NotificationHistoryFilter): NotificationHistoryEntry[] {
    // Prune expired entries first
    const retentionMs =
      (this.config.historyRetentionDays ?? DEFAULT_HISTORY_RETENTION_DAYS) * 86400000;
    const cutoff = Date.now() - retentionMs;
    this.history = this.history.filter((e) => new Date(e.deliveredAt).getTime() >= cutoff);

    if (!filter) return [...this.history];

    return this.history.filter((entry) => {
      if (filter.since && new Date(entry.deliveredAt) < filter.since) return false;
      if (filter.eventType && entry.notification.eventType !== filter.eventType) return false;
      if (filter.priority && entry.notification.priority !== filter.priority) return false;
      return true;
    });
  }

  /**
   * Close notification service
   */
  async close(): Promise<void> {
    this.closed = true;

    // Stop digest timer
    if (this.digestTimer) {
      clearInterval(this.digestTimer);
      this.digestTimer = null;
    }

    // Unsubscribe from event bus to prevent memory leak
    if (this.eventBusUnsubscribe) {
      this.eventBusUnsubscribe();
      this.eventBusUnsubscribe = null;
    }

    this.queue = [];
    this.dedupSet.clear();
    this.dedupKeys = [];
    this.dedupCount = 0;
    this.digestBuffer = [];
    this.history = [];
    this.updateStats();
  }

  /**
   * Subscribe to events on event bus and convert to notifications.
   * Uses configurable trigger map for event-to-priority classification.
   * Info-priority events are logged but not sent to plugins.
   * Medium-priority events are accumulated in digest buffer.
   */
  private async subscribeToEvents(): Promise<void> {
    // Store unsubscribe function for cleanup in close()
    this.eventBusUnsubscribe = await this.config.eventBus.subscribe(
      async (event: EventBusEvent) => {
        const startTime = Date.now();

        // Look up event type in trigger map
        const trigger = this.getTrigger(event.eventType);
        if (!trigger) {
          return; // Unknown event type — not notification-worthy
        }

        const message = this.buildMessage(event.eventType, event.metadata);

        // Info-priority events: log only, do not send to plugins.
        // Entity-based dedup check prevents log spam from rapid duplicate events.
        if (trigger.priority === "info") {
          const entityId = this.extractEntityId(event.metadata);
          const dedupKey = `${event.eventType}:${entityId}`;
          if (this.dedupSet.has(dedupKey)) {
            return; // Already logged this event entity
          }
          this.dedupSet.add(dedupKey);
          this.dedupKeys.push({
            entityId,
            eventType: event.eventType,
            expiresAt: Date.now() + this.getDedupWindow(event.eventType),
          });
          // eslint-disable-next-line no-console -- info events are intentionally log-only
          console.log(`[notification] ${trigger.title}: ${message}`);
          return;
        }

        // Build notification for critical/warning/medium events
        const notification: Notification = {
          eventId: event.eventId,
          eventType: event.eventType,
          priority: trigger.priority,
          title: trigger.title,
          message,
          metadata: event.metadata,
          timestamp: event.timestamp,
        };

        // Medium-priority events: accumulate in digest buffer
        if (trigger.priority === "medium") {
          this.digestBuffer.push(notification);
          return;
        }

        // Critical/warning events: full plugin delivery pipeline
        await this.send(notification);

        // Measure and warn on delivery latency
        const latencyMs = Date.now() - startTime;
        this.stats.lastLatencyMs = latencyMs;
        if (latencyMs > LATENCY_WARNING_THRESHOLD_MS) {
          // eslint-disable-next-line no-console -- latency warning is intentional observability
          console.warn(
            `[notification] Delivery latency ${latencyMs}ms exceeds ${LATENCY_WARNING_THRESHOLD_MS}ms threshold for ${event.eventType}`,
          );
        }
      },
    );
  }

  /**
   * Look up event type in trigger map (exact match only)
   */
  private getTrigger(eventType: string): NotificationTrigger | null {
    return this.triggerMap[eventType] ?? null;
  }

  /**
   * Extract entity ID from metadata for dedup key.
   * Prefers storyId over agentId; falls back to "unknown".
   */
  private extractEntityId(metadata: Record<string, unknown>): string {
    if (typeof metadata.storyId === "string" && metadata.storyId) {
      return metadata.storyId;
    }
    if (typeof metadata.agentId === "string" && metadata.agentId) {
      return metadata.agentId;
    }
    return "unknown";
  }

  /**
   * Get dedup window for a given event type.
   * Checks user config overrides, then per-type defaults, then global fallback.
   */
  private getDedupWindow(eventType: string): number {
    const userOverride = this.config.dedupWindowByType?.[eventType];
    if (userOverride !== undefined) return userOverride;
    return DEFAULT_DEDUP_WINDOWS[eventType] ?? this.config.dedupWindowMs ?? DEFAULT_DEDUP_WINDOW_MS;
  }

  /**
   * Flush accumulated digest buffer as a single summary notification.
   * Called on interval timer. No-op if buffer is empty.
   */
  private async flushDigest(): Promise<void> {
    if (this.digestBuffer.length === 0) return;

    const buffered = this.digestBuffer.splice(0);
    const typeCounts = new Map<string, number>();
    for (const n of buffered) {
      typeCounts.set(n.eventType, (typeCounts.get(n.eventType) ?? 0) + 1);
    }

    const summary = Array.from(typeCounts.entries())
      .map(([type, count]) => `${type}: ${count}`)
      .join(", ");

    const digestNotification: Notification = {
      eventId: `digest-${Date.now()}`,
      eventType: "notification.digest",
      priority: "warning",
      title: `Digest: ${buffered.length} notifications`,
      message: summary,
      metadata: { digestCount: buffered.length, types: Object.fromEntries(typeCounts) },
      timestamp: new Date().toISOString(),
    };

    await this.send(digestNotification);
  }

  /**
   * Add notification to history ring buffer
   */
  private addToHistory(notification: Notification, deliveredPlugins: string[]): void {
    this.history.push({
      notification,
      deliveredAt: new Date().toISOString(),
      deliveredPlugins,
    });
    const maxEntries = this.config.historyMaxEntries ?? DEFAULT_HISTORY_MAX_ENTRIES;
    if (this.history.length > maxEntries) {
      this.history.splice(0, this.history.length - maxEntries);
    }
  }

  /**
   * Build notification message with contextual details and actionable CLI suggestions
   */
  private buildMessage(eventType: string, metadata: Record<string, unknown>): string {
    const storyId = typeof metadata.storyId === "string" ? metadata.storyId : "";
    const agentId = typeof metadata.agentId === "string" ? metadata.agentId : "";
    const reason = typeof metadata.reason === "string" ? metadata.reason : "";

    let message = this.getBaseMessage(eventType, storyId, agentId);

    if (reason) {
      message += `: ${reason}`;
    }

    const suggestion = this.getActionableContext(eventType, agentId, storyId);
    if (suggestion) {
      message += `\n${suggestion}`;
    }

    return message;
  }

  /**
   * Get base message from event type and metadata
   */
  private getBaseMessage(eventType: string, storyId: string, agentId: string): string {
    switch (eventType) {
      case "agent.blocked":
        return storyId ? `Story ${storyId} agent is blocked` : "Agent is blocked";
      case "story.blocked":
        return storyId ? `Story ${storyId} is blocked` : "Story is blocked";
      case "conflict.detected":
        return storyId ? `Conflict detected for ${storyId}` : "Conflict detected";
      case "notification.backlog":
        return `Notification queue depth exceeded threshold`;
      case "eventbus.backlog":
        return `Event bus backlog detected`;
      case "agent.offline":
        return agentId ? `Agent ${agentId} is offline` : "Agent is offline";
      case "story.completed":
        return storyId ? `Story ${storyId} completed` : "Story completed";
      case "story.started":
        return storyId ? `Story ${storyId} started` : "Story started";
      case "story.assigned":
        return storyId ? `Story ${storyId} assigned to ${agentId || "agent"}` : "Story assigned";
      case "agent.resumed":
        return agentId ? `Agent ${agentId} resumed` : "Agent resumed";
      default:
        return eventType;
    }
  }

  /**
   * Get actionable CLI suggestion for an event type
   */
  private getActionableContext(eventType: string, agentId: string, storyId: string): string {
    switch (eventType) {
      case "agent.blocked":
        return agentId ? `Run: ao status ${agentId}` : "Run: ao fleet";
      case "story.blocked":
        return storyId ? `Run: ao resume ${storyId}` : "Run: ao fleet";
      case "conflict.detected":
        return "Run: ao resolve-conflicts";
      case "agent.offline":
        return agentId ? `Run: ao fleet; ao status ${agentId}` : "Run: ao fleet";
      case "eventbus.backlog":
      case "notification.backlog":
        return "Run: ao events --tail";
      default:
        return "";
    }
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
        activeKeys.add(`${key.eventType}:${key.entityId}`);
      }
    }

    this.dedupKeys = this.dedupKeys.filter((key) => key.expiresAt > now);
    this.dedupSet = activeKeys;
  }

  /**
   * Validate notification preferences plugin names.
   * Warns on unknown plugin names instead of throwing, so one misconfigured
   * route doesn't disable the entire notification service.
   */
  private validatePreferences(preferences: NotificationPreferences): void {
    const availablePluginNames = new Set(this.config.plugins.map((p) => p.name));

    for (const [pattern, pluginList] of Object.entries(preferences)) {
      if (!pluginList) continue;

      const plugins = pluginList.split(",").map((p) => p.trim());
      for (const pluginName of plugins) {
        if (pluginName !== "all" && !availablePluginNames.has(pluginName)) {
          // eslint-disable-next-line no-console -- warn about misconfigured routing without killing the entire service
          console.warn(
            `[notification-service] Unknown plugin "${pluginName}" in preferences for pattern "${pattern}". ` +
              `Available plugins: ${Array.from(availablePluginNames).join(", ")}`,
          );
        }
      }
    }
  }

  /**
   * Filter plugins based on notification preferences.
   * Tries matching by event type pattern first (e.g., "blocked" matches "agent.blocked"),
   * then falls back to matching by priority key (e.g., "urgent", "action", "warning", "info").
   * This supports both event-type-pattern preferences and priority-based routing from config.
   */
  private filterPluginsByPreference(eventType: string, priority?: string): NotificationPlugin[] {
    if (!this.config.preferences || Object.keys(this.config.preferences).length === 0) {
      // No preferences configured, use all plugins
      return this.config.plugins;
    }

    // Find matching preference pattern: try event type first, then priority
    let matchedPattern = this.findMatchingPreferencePattern(eventType);
    if (!matchedPattern && priority) {
      matchedPattern = this.findMatchingPreferencePattern(priority);
    }

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
