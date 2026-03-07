/**
 * Event Subscription Service
 *
 * Manages subscriptions to events with pattern matching, acknowledgment,
 * retry with exponential backoff, and dead letter queue for failed events.
 */

import type { EventBus, EventBusEvent, EventHandler, EventBusCallback } from "./types.js";
import { randomUUID } from "node:crypto";
import { appendFile } from "node:fs/promises";

/** Default acknowledgment timeout (30 seconds) */
const DEFAULT_ACK_TIMEOUT_MS = 30000;

/** Default retry delays (1s, 2s, 4s, 8s, 16s) */
const DEFAULT_RETRY_DELAYS = [1000, 2000, 4000, 8000, 16000];

/** Dead Letter Queue event */
export interface DeadLetterEvent {
  eventId: string;
  eventType: string;
  timestamp: string;
  metadata: Record<string, unknown>;
  subscriptionId: string;
  retryCount: number;
  error: string;
  lastAttempt: string;
}

/** Subscription statistics */
export interface SubscriptionStats {
  activeSubscriptions: number;
  totalProcessed: number;
  dlqSize: number;
}

/** Subscription handle returned by subscribe() */
export type SubscriptionHandle = string;

/** Acknowledgment callback */
export type AckCallback = () => Promise<void>;

/** Acknowledgment context passed to handlers */
export interface AckContext {
  ack: AckCallback;
  timeout: number;
}

/** Subscription parameters */
export interface SubscriptionParams {
  eventTypes: string | string[];
  handler: EventHandler;
  options?: {
    ackTimeout?: number;
    maxRetries?: number;
    retryDelays?: number[];
    requireAck?: boolean;
  };
}

/** EventSubscription service configuration */
export interface EventSubscriptionConfig {
  eventBus: EventBus;
  dlqPath?: string;
}

/** Internal subscription state */
interface Subscription {
  id: string;
  eventTypes: string[];
  handler: EventHandler;
  ackTimeout: number;
  maxRetries: number;
  retryDelays: number[];
  requireAck: boolean;
  pattern: string; // Normalized pattern for matching
  unsubscribe: () => void;
}

/** Pending acknowledgment */
interface PendingAck {
  eventId: string;
  subscriptionId: string;
  event: EventBusEvent;
  handler: EventHandler;
  timeout: NodeJS.Timeout;
  timestamp: number;
}

/**
 * Event Subscription Service Implementation
 */
export class EventSubscriptionServiceImpl {
  private config: EventSubscriptionConfig;
  private subscriptions: Map<string, Subscription> = new Map();
  private pendingAcks: Map<string, PendingAck> = new Map();
  private deadLetterQueue: DeadLetterEvent[] = [];
  private stats: SubscriptionStats = {
    activeSubscriptions: 0,
    totalProcessed: 0,
    dlqSize: 0,
  };

  constructor(config: EventSubscriptionConfig) {
    this.config = config;
  }

  /**
   * Subscribe to event types with pattern matching
   * @param params - Subscription parameters
   * @returns Subscription handle for unsubscribing
   */
  async subscribe(params: SubscriptionParams): Promise<SubscriptionHandle> {
    const subscriptionId = `sub-${randomUUID()}`;
    const eventTypes = Array.isArray(params.eventTypes) ? params.eventTypes : [params.eventTypes];

    const ackTimeout = params.options?.ackTimeout ?? DEFAULT_ACK_TIMEOUT_MS;
    const maxRetries = params.options?.maxRetries ?? DEFAULT_RETRY_DELAYS.length;
    const retryDelays = params.options?.retryDelays ?? DEFAULT_RETRY_DELAYS;
    const requireAck = params.options?.requireAck ?? false;

    // Create unified pattern for matching (wildcard or exact)
    const pattern = this.normalizePattern(eventTypes);

    const subscription: Subscription = {
      id: subscriptionId,
      eventTypes,
      handler: params.handler,
      ackTimeout,
      maxRetries,
      retryDelays,
      requireAck,
      pattern,
      unsubscribe: () => {}, // Will be set after EventBus.subscribe
    };

    // Register with EventBus for each event type
    const unsubscribes: Array<() => void> = [];

    for (const _eventType of eventTypes) {
      const callback = this.createEventCallback(subscription);
      const unsubscribe = await this.config.eventBus.subscribe(callback);
      unsubscribes.push(unsubscribe);
    }

    // Set up combined unsubscribe
    subscription.unsubscribe = () => {
      unsubscribes.forEach((unsub) => unsub());
    };

    this.subscriptions.set(subscriptionId, subscription);
    this.updateStats();

    return subscriptionId;
  }

  /**
   * Unsubscribe using handle returned by subscribe()
   * @param handle - Subscription handle
   */
  async unsubscribe(handle: SubscriptionHandle): Promise<void> {
    const subscription = this.subscriptions.get(handle);
    if (!subscription) {
      return; // Invalid handle, gracefully ignore
    }

    subscription.unsubscribe();
    this.subscriptions.delete(handle);
    this.updateStats();
  }

  /**
   * Get current Dead Letter Queue contents
   * @returns Array of dead letter events
   */
  getDeadLetterQueue(): DeadLetterEvent[] {
    return [...this.deadLetterQueue];
  }

  /**
   * Replay a dead letter event by retrying delivery
   * @param eventId - Event ID to replay
   */
  async replayDLQ(eventId: string): Promise<void> {
    const dlqIndex = this.deadLetterQueue.findIndex((e) => e.eventId === eventId);
    if (dlqIndex === -1) {
      return; // Event not in DLQ
    }

    const dlqEvent = this.deadLetterQueue[dlqIndex];
    const subscription = this.subscriptions.get(dlqEvent.subscriptionId);

    if (!subscription) {
      // Subscription no longer exists, remove from DLQ
      this.deadLetterQueue.splice(dlqIndex, 1);
      this.updateStats();
      return;
    }

    // Remove from DLQ and retry
    this.deadLetterQueue.splice(dlqIndex, 1);

    const event: EventBusEvent = {
      eventId: dlqEvent.eventId,
      eventType: dlqEvent.eventType,
      timestamp: dlqEvent.timestamp,
      metadata: dlqEvent.metadata,
    };

    // Retry delivery (without DLQ on failure to avoid infinite loop)
    await this.deliverEvent(subscription, event, false);
    this.updateStats();
  }

  /**
   * Get subscription statistics
   * @returns Current statistics
   */
  getStats(): SubscriptionStats {
    return { ...this.stats };
  }

  /**
   * Close the subscription service and cleanup resources
   */
  async close(): Promise<void> {
    // Unsubscribe all subscriptions
    for (const subscription of this.subscriptions.values()) {
      subscription.unsubscribe();
    }
    this.subscriptions.clear();

    // Clear pending acknowledgments
    for (const pendingAck of this.pendingAcks.values()) {
      clearTimeout(pendingAck.timeout);
    }
    this.pendingAcks.clear();
    this.updateStats();
  }

  /**
   * Create event callback for subscription
   * @param subscription - Subscription state
   * @returns Event callback function
   */
  private createEventCallback(subscription: Subscription): EventBusCallback {
    return async (event: EventBusEvent) => {
      // Check if event matches subscription patterns
      if (!this.matchesEventTypes(event.eventType, subscription.eventTypes)) {
        return; // Skip non-matching events
      }

      this.stats.totalProcessed++;
      await this.deliverEvent(subscription, event, true);
    };
  }

  /**
   * Check if event type matches subscription patterns
   * @param eventType - Event type to check
   * @param subscribedTypes - Subscribed event types (may include wildcards)
   * @returns true if event type matches
   */
  private matchesEventTypes(eventType: string, subscribedTypes: string[]): boolean {
    return subscribedTypes.some((pattern) => {
      // Exact match
      if (pattern === eventType) {
        return true;
      }

      // Wildcard match (e.g., "story.*" matches "story.completed")
      if (pattern.endsWith("*")) {
        const prefix = pattern.slice(0, -1);
        return eventType.startsWith(prefix);
      }

      return false;
    });
  }

  /**
   * Deliver event to subscription handler with retry logic
   * @param subscription - Target subscription
   * @param event - Event to deliver
   * @param useDlq - Whether to use DLQ on final failure
   */
  private async deliverEvent(
    subscription: Subscription,
    event: EventBusEvent,
    useDlq: boolean,
  ): Promise<void> {
    const retryDelays = subscription.retryDelays;
    const maxRetries = subscription.maxRetries;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        if (subscription.requireAck) {
          await this.deliverWithAck(subscription, event);
        } else {
          await subscription.handler(event);
        }
        // Success - stop retrying
        return;
      } catch (error) {
        const isLastAttempt = attempt >= maxRetries;

        if (isLastAttempt) {
          // All retries exhausted
          if (useDlq) {
            await this.addToDlq(subscription, event, attempt, error);
          }
          return;
        }

        // Wait before retry with exponential backoff
        const delay = retryDelays[attempt] ?? retryDelays[retryDelays.length - 1];
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  /**
   * Deliver event with acknowledgment timeout
   * @param subscription - Target subscription
   * @param event - Event to deliver
   */
  private async deliverWithAck(subscription: Subscription, event: EventBusEvent): Promise<void> {
    const ackId = `${event.eventId}:${subscription.id}`;

    // Create ack callback that resolves the outer promise
    let ackResolve: (() => void) | undefined;
    let ackReject: ((error: unknown) => void) | undefined;

    const ackPromise = new Promise<void>((resolve, reject) => {
      ackResolve = resolve;
      ackReject = reject;
    });

    // Create the ack callback passed to handler
    const ackCallback = async (): Promise<void> => {
      const pendingAck = this.pendingAcks.get(ackId);
      if (pendingAck && ackResolve) {
        clearTimeout(pendingAck.timeout);
        this.pendingAcks.delete(ackId);
        ackResolve();
      }
    };

    // Set timeout for acknowledgment
    const timeout = setTimeout(() => {
      this.pendingAcks.delete(ackId);
      if (ackReject) {
        ackReject(new Error(`Acknowledgment timeout after ${subscription.ackTimeout}ms`));
      }
    }, subscription.ackTimeout);

    // Store pending acknowledgment
    this.pendingAcks.set(ackId, {
      eventId: event.eventId,
      subscriptionId: subscription.id,
      event,
      handler: subscription.handler,
      timeout,
      timestamp: Date.now(),
    });

    // Deliver event to handler
    try {
      await subscription.handler(event, ackCallback);
      // Handler completed successfully, but ack might not have been called yet
      // Wait for ack callback to be called or timeout
      await ackPromise;
    } catch (error) {
      // Handler threw an error
      this.pendingAcks.delete(ackId);
      clearTimeout(timeout);
      throw error;
    }
  }

  /**
   * Add event to Dead Letter Queue
   * @param subscription - Subscription that failed
   * @param event - Event that failed
   * @param retryCount - Number of retry attempts
   * @param error - Error that caused failure
   */
  private async addToDlq(
    subscription: Subscription,
    event: EventBusEvent,
    retryCount: number,
    error: unknown,
  ): Promise<void> {
    const dlqEvent: DeadLetterEvent = {
      eventId: event.eventId,
      eventType: event.eventType,
      timestamp: event.timestamp,
      metadata: event.metadata,
      subscriptionId: subscription.id,
      retryCount,
      error: error instanceof Error ? error.message : String(error),
      lastAttempt: new Date().toISOString(),
    };

    this.deadLetterQueue.push(dlqEvent);

    // Persist to disk if configured
    if (this.config.dlqPath) {
      await this.persistDlq(dlqEvent);
    }

    this.updateStats();
  }

  /**
   * Persist dead letter event to disk
   * @param dlqEvent - Event to persist
   */
  private async persistDlq(dlqEvent: DeadLetterEvent): Promise<void> {
    if (!this.config.dlqPath) return;

    try {
      const logEntry = JSON.stringify(dlqEvent) + "\n";
      await appendFile(this.config.dlqPath, logEntry, "utf-8");
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("[EventSubscription] Failed to persist DLQ event:", error);
    }
  }

  /**
   * Normalize event types to a pattern string
   * @param eventTypes - Event types to normalize
   * @returns Normalized pattern
   */
  private normalizePattern(eventTypes: string[]): string {
    if (eventTypes.length === 1) {
      return eventTypes[0];
    }
    // Multiple types stored as comma-separated
    return eventTypes.join(",");
  }

  /**
   * Update subscription statistics
   */
  private updateStats(): void {
    this.stats.activeSubscriptions = this.subscriptions.size;
    this.stats.dlqSize = this.deadLetterQueue.length;
  }
}

/**
 * Factory function to create an EventSubscription service instance
 * @param config - Service configuration
 * @returns Configured EventSubscription service
 */
export function createEventSubscription(
  config: EventSubscriptionConfig,
): EventSubscriptionServiceImpl {
  return new EventSubscriptionServiceImpl(config);
}
