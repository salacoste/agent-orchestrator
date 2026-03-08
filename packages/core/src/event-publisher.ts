/**
 * Event Publishing Service
 *
 * Publishes events when stories change state, ensuring real-time
 * notification for all subscribers.
 */

import type {
  EventBus,
  EventBusEvent,
  EventPublisher,
  StoryCompletedEvent,
  StoryStartedEvent,
  StoryBlockedEvent,
  StoryAssignedEvent,
  AgentResumedEvent,
} from "./types.js";
import type { DegradedModeService } from "./degraded-mode.js";
import { registerEventPublisher } from "./service-registry.js";
import { randomUUID } from "node:crypto";
import { appendFile, readFile, writeFile, stat } from "node:fs/promises";

/** Cleanup interval for deduplication cache */
const CLEANUP_INTERVAL_MS = 60000;

/** Default maximum backup log file size (10MB) */
const DEFAULT_BACKUP_MAX_SIZE = 10 * 1024 * 1024;

export interface EventPublisherConfig {
  eventBus: EventBus;
  deduplicationWindowMs?: number; // Default: 5000ms
  backupLogPath?: string; // Path to JSONL backup log
  queueMaxSize?: number; // Default: 1000
  backupLogMaxSize?: number; // Default: 10MB, truncate when exceeded
  degradedModeService?: DegradedModeService; // Optional degraded mode service
}

export class EventPublisherImpl implements EventPublisher {
  private config: EventPublisherConfig;
  private publishedEvents: Map<string, number>; // key: "eventType:storyId", value: timestamp
  private eventQueue: EventBusEvent[] = [];
  private cleanupTimer?: ReturnType<typeof setInterval>;
  private isFlushing: boolean = false;
  private droppedEventsCount: number = 0; // Track dropped events for monitoring

  constructor(config: EventPublisherConfig) {
    this.config = config;
    this.publishedEvents = new Map();

    // Clean up expired deduplication entries every minute
    this.cleanupTimer = setInterval(() => {
      this.cleanupDeduplicationCache();
    }, CLEANUP_INTERVAL_MS);

    // Register health check with degraded mode service if available
    if (this.config.degradedModeService) {
      this.config.degradedModeService.registerHealthCheck("event-bus", async () => {
        return this.config.eventBus.isConnected();
      });

      // Register recovery callback to automatically flush queued events when event bus reconnects
      // Includes retry logic with exponential backoff
      this.config.degradedModeService.onRecovery(async (eventBusAvailable: boolean) => {
        if (eventBusAvailable) {
          // eslint-disable-next-line no-console
          console.log("[EventPublisher] Event bus reconnected, flushing queued events...");

          // Retry with exponential backoff (max 3 retries: 0s, 1s, 4s, 9s delays)
          const maxRetries = 3;
          let attempt = 0;
          let success = false;

          while (!success && attempt <= maxRetries) {
            try {
              await this.flush();
              success = true;
              // eslint-disable-next-line no-console
              console.log("[EventPublisher] Flush completed successfully on recovery");
            } catch (error) {
              attempt++;
              if (attempt <= maxRetries) {
                const delayMs = attempt * attempt * 1000; // 1s, 4s, 9s exponential backoff
                // eslint-disable-next-line no-console
                console.warn(
                  `[EventPublisher] Flush attempt ${attempt} failed, retrying in ${delayMs}ms...`,
                );
                // eslint-disable-next-line no-await-in-loop
                await new Promise((resolve) => setTimeout(resolve, delayMs));
              } else {
                // eslint-disable-next-line no-console
                console.error(
                  `[EventPublisher] Failed to flush events after ${maxRetries} retries:`,
                  error,
                );
                // eslint-disable-next-line no-console
                console.error(
                  "[EventPublisher] Events remain queued and will be retried on next recovery",
                );
              }
            }
          }
        }
      });
    }

    // Register this EventPublisher instance in the service registry for CLI access
    registerEventPublisher(this);
  }

  /**
   * Publish a story.completed event
   * @param params - Event parameters including story details and completion metadata
   */
  async publishStoryCompleted(params: StoryCompletedEvent): Promise<void> {
    await this.publish({
      eventType: "story.completed",
      metadata: {
        storyId: params.storyId,
        previousStatus: params.previousStatus,
        newStatus: params.newStatus,
        agentId: params.agentId,
        duration: params.duration,
        filesModified: params.filesModified ?? [],
        testsPassed: params.testsPassed,
        testsFailed: params.testsFailed,
      },
    });
  }

  /**
   * Publish a story.started event
   * @param params - Event parameters including story ID and agent assignment
   */
  async publishStoryStarted(params: StoryStartedEvent): Promise<void> {
    await this.publish({
      eventType: "story.started",
      metadata: {
        storyId: params.storyId,
        agentId: params.agentId,
        contextHash: params.contextHash,
      },
    });
  }

  /**
   * Publish a story.blocked event
   * @param params - Event parameters including blockage reason and error details
   */
  async publishStoryBlocked(params: StoryBlockedEvent): Promise<void> {
    await this.publish({
      eventType: "story.blocked",
      metadata: {
        storyId: params.storyId,
        agentId: params.agentId,
        reason: params.reason,
        exitCode: params.exitCode,
        signal: params.signal,
        errorContext: params.errorContext,
      },
    });
  }

  /**
   * Publish a story.assigned event
   * @param params - Event parameters including agent assignment details
   */
  async publishStoryAssigned(params: StoryAssignedEvent): Promise<void> {
    await this.publish({
      eventType: "story.assigned",
      metadata: {
        storyId: params.storyId,
        agentId: params.agentId,
        previousAgentId: params.previousAgentId,
        reason: params.reason,
      },
    });
  }

  /**
   * Publish an agent.resumed event
   * @param params - Event parameters including retry count and agent details
   */
  async publishAgentResumed(params: AgentResumedEvent): Promise<void> {
    await this.publish({
      eventType: "agent.resumed",
      metadata: {
        storyId: params.storyId,
        previousAgentId: params.previousAgentId,
        newAgentId: params.newAgentId,
        retryCount: params.retryCount,
        userMessage: params.userMessage,
      },
    });
  }

  /**
   * Core publish method with deduplication and degraded mode handling
   * @param event - Event to publish (without eventId and timestamp)
   */
  private async publish(event: Omit<EventBusEvent, "eventId" | "timestamp">): Promise<void> {
    const storyId = event.metadata.storyId as string | undefined;
    const dedupeKey = `${event.eventType}:${storyId ?? "global"}`;

    // Check deduplication
    if (this.isDuplicate(dedupeKey)) {
      return; // Skip duplicate event
    }

    const fullEvent: EventBusEvent = {
      ...event,
      eventId: randomUUID(),
      timestamp: new Date().toISOString(),
    };

    // Try to publish via event bus
    if (this.config.eventBus.isConnected()) {
      try {
        await this.config.eventBus.publish(fullEvent);
        this.markPublished(dedupeKey);
        return;
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error("[EventPublisher] Failed to publish event:", error);
      }
    }

    // Queue for later - also queue to degraded mode service if available
    this.queueEvent(fullEvent);

    // Also queue to degraded mode service for monitoring
    if (this.config.degradedModeService && !this.config.eventBus.isConnected()) {
      try {
        await this.config.degradedModeService.queueEvent(fullEvent);
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error("[EventPublisher] Failed to queue event to degraded mode:", error);
      }
    }
  }

  /**
   * Check if an event key is within the deduplication window
   * @param key - Deduplication key (eventType:storyId)
   * @returns true if the event was recently published and should be deduplicated
   */
  private isDuplicate(key: string): boolean {
    const timestamp = this.publishedEvents.get(key);
    if (!timestamp) return false;

    const windowMs = this.config.deduplicationWindowMs ?? 5000;
    const age = Date.now() - timestamp;
    return age < windowMs;
  }

  /**
   * Mark an event as published to prevent duplicates
   * @param key - Deduplication key to mark
   */
  private markPublished(key: string): void {
    this.publishedEvents.set(key, Date.now());
  }

  /**
   * Queue an event for later publishing when EventBus is unavailable
   * Also writes to backup log for durability
   * @param event - Event to queue
   */
  private queueEvent(event: EventBusEvent): void {
    const maxSize = this.config.queueMaxSize ?? 1000;

    if (this.eventQueue.length >= maxSize) {
      // Drop oldest event
      this.eventQueue.shift();
      this.droppedEventsCount++;
      // eslint-disable-next-line no-console
      console.warn(
        `[EventPublisher] Event queue full, dropped oldest event (total dropped: ${this.droppedEventsCount})`,
      );
    }

    this.eventQueue.push(event);

    // Backup to log file asynchronously with rotation check
    this.backupToLogWithRotation(event).catch((err) => {
      // eslint-disable-next-line no-console
      console.error("[EventPublisher] Failed to write event to backup log:", err);
    });
  }

  /**
   * Write event to backup log file with automatic rotation when size exceeds limit
   * @param event - Event to write to backup log
   */
  private async backupToLogWithRotation(event: EventBusEvent): Promise<void> {
    if (!this.config.backupLogPath) return;

    const maxSize = this.config.backupLogMaxSize ?? DEFAULT_BACKUP_MAX_SIZE;

    try {
      // Check current file size
      const stats = await stat(this.config.backupLogPath).catch(() => null);
      if (stats && stats.size >= maxSize) {
        // Rotate: keep only the most recent half of the file
        await this.rotateBackupLog();
      }

      // Append new event
      const logEntry = JSON.stringify(event) + "\n";
      await appendFile(this.config.backupLogPath, logEntry, "utf-8");
    } catch (error) {
      // If rotation or append fails, log but don't crash
      // eslint-disable-next-line no-console
      console.error("[EventPublisher] Backup log write failed:", error);
    }
  }

  /**
   * Rotate backup log by keeping only the most recent entries
   * Reads the file, keeps the last half, and writes it back
   */
  private async rotateBackupLog(): Promise<void> {
    if (!this.config.backupLogPath) return;

    try {
      const content = await readFile(this.config.backupLogPath, "utf-8");
      const lines = content.trim().split("\n");

      // Keep the most recent half of entries
      const keepCount = Math.floor(lines.length / 2);
      const recentEntries = lines.slice(-keepCount).join("\n") + "\n";

      await writeFile(this.config.backupLogPath, recentEntries, "utf-8");

      // eslint-disable-next-line no-console
      console.log(`[EventPublisher] Rotated backup log, kept ${keepCount} most recent entries`);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("[EventPublisher] Backup log rotation failed:", error);
    }
  }

  /**
   * Flush all queued events to the EventBus
   * Prevents concurrent flush operations with isFlushing flag
   * Has a 30-second timeout to prevent indefinite blocking (NFR-SC6)
   * Displays progress during flush operation
   */
  async flush(timeoutMs = 30000): Promise<void> {
    // Prevent concurrent flush operations
    if (this.isFlushing) {
      return;
    }

    this.isFlushing = true;

    // Track initial state for progress reporting
    const initialQueueSize = this.eventQueue.length;
    let degradedModeQueueSize = 0;
    if (this.config.degradedModeService) {
      degradedModeQueueSize = this.config.degradedModeService.getQueuedEvents().length;
    }
    const totalEventsToFlush = initialQueueSize + degradedModeQueueSize;

    if (totalEventsToFlush > 0) {
      // eslint-disable-next-line no-console
      console.log(`[EventPublisher] Starting flush: ${totalEventsToFlush} events queued`);
    }

    // Create a timeout promise
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Flush timeout after ${timeoutMs}ms`));
      }, timeoutMs);
    });

    // Create the flush operation promise
    const flushOperation = async (): Promise<void> => {
      let eventsFlushed = 0;

      try {
        // First, flush internal queue
        while (this.eventQueue.length > 0) {
          const event = this.eventQueue.shift();
          if (!event) break;

          if (this.config.eventBus.isConnected()) {
            try {
              await this.config.eventBus.publish(event);
              const storyId = event.metadata.storyId as string | undefined;
              this.markPublished(`${event.eventType}:${storyId ?? "global"}`);

              // Display progress
              eventsFlushed++;
              if (totalEventsToFlush > 10) {
                // Only show progress for larger batches to avoid noise
                const progress = Math.round((eventsFlushed / totalEventsToFlush) * 100);
                // eslint-disable-next-line no-console
                console.log(
                  `[EventPublisher] Progress: ${eventsFlushed}/${totalEventsToFlush} (${progress}%)`,
                );
              }
            } catch (error) {
              // eslint-disable-next-line no-console
              console.error("[EventPublisher] Failed to flush queued event:", error);
              // Re-queue and stop flushing
              this.eventQueue.unshift(event);
              break;
            }
          }
        }

        // Then, drain events from degraded mode service if available
        if (this.config.degradedModeService && this.config.eventBus.isConnected()) {
          try {
            const degradedEvents = this.config.degradedModeService.getQueuedEvents();
            if (degradedEvents.length > 0) {
              // eslint-disable-next-line no-console
              console.log(
                `[EventPublisher] Draining ${degradedEvents.length} events from degraded mode`,
              );

              for (const queuedOp of degradedEvents) {
                if (!this.config.eventBus.isConnected()) break;

                try {
                  // Extract the actual event from QueuedOperation.data
                  const event = queuedOp.data as EventBusEvent;
                  if (event && event.eventType && event.eventId) {
                    await this.config.eventBus.publish(event);
                    this.config.degradedModeService.clearDrainedEvents(1);

                    // Display progress
                    eventsFlushed++;
                    if (totalEventsToFlush > 10) {
                      const progress = Math.round((eventsFlushed / totalEventsToFlush) * 100);
                      // eslint-disable-next-line no-console
                      console.log(
                        `[EventPublisher] Progress: ${eventsFlushed}/${totalEventsToFlush} (${progress}%)`,
                      );
                    }
                  } else {
                    // Skip malformed queued operations
                    // eslint-disable-next-line no-console
                    console.warn(
                      "[EventPublisher] Skipping malformed queued operation:",
                      queuedOp.id,
                    );
                    this.config.degradedModeService.clearDrainedEvents(1);
                  }
                } catch (error) {
                  // eslint-disable-next-line no-console
                  console.error("[EventPublisher] Failed to flush degraded mode event:", error);
                  // Stop draining on first error
                  break;
                }
              }
            }
          } catch (error) {
            // eslint-disable-next-line no-console
            console.error("[EventPublisher] Failed to get degraded events:", error);
          }
        }

        // Report final status
        if (eventsFlushed > 0) {
          const remaining = this.getQueueSize();
          // eslint-disable-next-line no-console
          console.log(
            `[EventPublisher] Flush complete: ${eventsFlushed} flushed, ${remaining} remain queued`,
          );
        }
      } finally {
        this.isFlushing = false;
      }
    };

    try {
      // Race between flush operation and timeout
      await Promise.race([flushOperation(), timeoutPromise]);
    } catch (error) {
      // Log partial state on timeout/error
      const remaining = this.getQueueSize();
      // eslint-disable-next-line no-console
      console.error(
        `[EventPublisher] Flush error: ${error}. Events flushed so far: ${totalEventsToFlush - remaining}, remaining: ${remaining}`,
      );
      // Ensure isFlushing is reset on error
      this.isFlushing = false;
      throw error; // Re-throw to allow caller to handle
    }
  }

  /**
   * Get the current number of queued events waiting to be flushed
   * Includes both internal queue and degraded mode service queue
   * @returns Number of events in the queue
   */
  getQueueSize(): number {
    const internalQueueSize = this.eventQueue.length;
    const degradedModeQueueSize = this.config.degradedModeService
      ? this.config.degradedModeService.getQueuedEvents().length
      : 0;
    return internalQueueSize + degradedModeQueueSize;
  }

  /**
   * Get the number of events that have been dropped due to full queue
   * @returns Number of dropped events
   */
  getDroppedEventsCount(): number {
    return this.droppedEventsCount;
  }

  /**
   * Clean up expired entries from the deduplication cache
   * Removes entries older than the deduplication window
   */
  private cleanupDeduplicationCache(): void {
    const windowMs = this.config.deduplicationWindowMs ?? 5000;
    const now = Date.now();

    for (const [key, timestamp] of this.publishedEvents.entries()) {
      const age = now - timestamp;
      if (age >= windowMs) {
        this.publishedEvents.delete(key);
      }
    }
  }

  /**
   * Close the publisher and release all resources
   * - Clears the cleanup timer
   * - Flushes remaining queued events
   * - Clears the deduplication cache to prevent memory leaks
   */
  async close(): Promise<void> {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }

    // Flush any remaining queued events
    await this.flush();

    // Clear deduplication cache to prevent memory leaks
    this.publishedEvents.clear();
  }
}

/**
 * Factory function to create an EventPublisher instance
 * @param config - Configuration for the event publisher
 * @returns Configured EventPublisher instance
 */
export function createEventPublisher(config: EventPublisherConfig): EventPublisher {
  return new EventPublisherImpl(config);
}
