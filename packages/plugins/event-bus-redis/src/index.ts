/**
 * Redis-backed event bus plugin for pub/sub messaging
 *
 * Provides real-time event distribution across processes using Redis pub/sub.
 * Supports degraded mode operation when Redis is unavailable.
 */

import { randomUUID } from "node:crypto";
import type {
  PluginModule,
  EventBus,
  EventBusEvent,
  EventBusConfig,
  EventSubscriber,
} from "@composio/ao-core";

export const manifest = {
  name: "redis-event-bus",
  slot: "event-bus" as const,
  description: "Redis-backed event bus for pub/sub messaging",
  version: "0.1.0",
};

interface RedisEventBusConfigInternal extends EventBusConfig {
  channel: string;
  retryDelays: number[];
  queueMaxSize: number;
}

interface ConnectionState {
  isConnected: boolean;
  isDegraded: boolean;
}

/**
 * Create a Redis-backed event bus
 */
export function create(config: EventBusConfig): EventBus {
  const internalConfig: RedisEventBusConfigInternal = {
    channel: config.channel || "ao:events",
    retryDelays: config.retryDelays || [1000, 2000, 4000, 8000, 16000],
    queueMaxSize: config.queueMaxSize || 1000,
    host: config.host,
    port: config.port,
    db: config.db,
    password: config.password,
    enableAOF: config.enableAOF,
  };

  // Lazy load Redis to handle connection failures
  let RedisClass: { default: new (...args: unknown[]) => unknown } | null = null;
  let redis: {
    on: (event: string, handler: (...args: unknown[]) => void) => void;
    publish: (channel: string, message: string) => void;
    subscribe: (channel: string) => void;
    duplicate: () => ReturnType<typeof _createRedisClient>;
    quit: () => Promise<void>;
    config: (command: string, ...args: string[]) => Promise<unknown>;
  } | null = null;

  function _createRedisClient() {
    if (!RedisClass?.default) {
      throw new Error("Redis class not available");
    }
    return new RedisClass.default({
      host: internalConfig.host,
      port: internalConfig.port,
      db: internalConfig.db || 0,
      password: internalConfig.password,
      retryStrategy: (times: number) => {
        const delay =
          internalConfig.retryDelays[Math.min(times, internalConfig.retryDelays.length - 1)];
        return delay ?? 5000;
      },
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
      lazyConnect: false,
    });
  }

  // Subscriber management
  const subscribers = new Map<string, Set<EventSubscriber>>();
  let unsubscribe: (() => void) | null = null;

  // Event queue for degraded mode
  const eventQueue: EventBusEvent[] = [];

  // Connection state
  const state: ConnectionState = {
    isConnected: false,
    isDegraded: false,
  };

  /**
   * Initialize Redis connection
   */
  async function initRedis(): Promise<void> {
    if (redis) return;

    try {
      RedisClass = await import("ioredis");
    } catch {
      throw new Error("ioredis package not found. Install it with: pnpm add ioredis", {
        cause: "MISSING_DEPENDENCY",
      });
    }

    redis = _createRedisClient();

    // Connection event handlers
    redis.on("connect", () => {
      // eslint-disable-next-line no-console
      console.log(`[EventBus] Connected to Redis at ${internalConfig.host}:${internalConfig.port}`);
      state.isConnected = true;
      state.isDegraded = false;
    });

    redis.on("ready", async () => {
      state.isConnected = true;
      state.isDegraded = false;

      // Enable AOF persistence if configured
      if (internalConfig.enableAOF) {
        try {
          await redis.config("SET", "appendonly", "yes");
        } catch {
          // eslint-disable-next-line no-console
          console.warn("[EventBus] Failed to enable AOF");
        }
      }

      // Drain queued events from degraded mode
      await drainQueue();
    });

    redis.on("error", (error: Error) => {
      // eslint-disable-next-line no-console
      console.error("[EventBus] Redis error:", error.message);
      state.isConnected = false;
    });

    redis.on("close", () => {
      // eslint-disable-next-line no-console
      console.warn("[EventBus] Redis connection closed");
      state.isConnected = false;
      state.isDegraded = true;
    });

    // Subscribe to events
    await subscribeToChannel();
  }

  /**
   * Subscribe to Redis channel
   */
  async function subscribeToChannel(): Promise<void> {
    if (!redis) return;

    const subscriber = redis.duplicate();
    await subscriber.connect();

    subscriber.subscribe(internalConfig.channel);

    subscriber.on("message", (channel: string, message: string) => {
      if (channel !== internalConfig.channel) return;

      try {
        const event: EventBusEvent = JSON.parse(message);

        // Deliver to all subscribers
        for (const sub of subscribers.values()) {
          for (const callback of sub) {
            try {
              callback(event);
            } catch {
              // eslint-disable-next-line no-console
              console.error("[EventBus] Subscriber callback error");
            }
          }
        }
      } catch {
        // eslint-disable-next-line no-console
        console.error("[EventBus] Failed to parse event");
      }
    });

    unsubscribe = async () => {
      await subscriber.unsubscribe(internalConfig.channel);
      await subscriber.quit();
    };
  }

  /**
   * Drain queued events when connection restored
   */
  async function drainQueue(): Promise<void> {
    if (!redis || !state.isConnected || eventQueue.length === 0) return;

    // eslint-disable-next-line no-console
    console.log(`[EventBus] Draining ${eventQueue.length} queued events...`);

    while (eventQueue.length > 0 && state.isConnected) {
      const event = eventQueue.shift();
      if (!event) break;

      try {
        await redis.publish(internalConfig.channel, JSON.stringify(event));
      } catch {
        // eslint-disable-next-line no-console
        console.error("[EventBus] Failed to drain queued event");
        // Put it back at the front of the queue
        eventQueue.unshift(event);
        break;
      }
    }
  }

  /**
   * Queue event for later delivery
   */
  function queueEvent(event: EventBusEvent): void {
    if (eventQueue.length >= internalConfig.queueMaxSize) {
      eventQueue.shift(); // Drop oldest
    }
    eventQueue.push(event);
  }

  return {
    name: "redis-event-bus",

    async publish(event: Omit<EventBusEvent, "eventId" | "timestamp">): Promise<void> {
      const fullEvent: EventBusEvent = {
        ...event,
        eventId: randomUUID(),
        timestamp: new Date().toISOString(),
      };

      // Try to initialize Redis if not already done
      try {
        await initRedis();
      } catch {
        // Redis unavailable - queue event
        // eslint-disable-next-line no-console
        console.warn("[EventBus] Redis unavailable, queuing event locally");
        state.isDegraded = true;
        queueEvent(fullEvent);
        return;
      }

      // Publish if connected, otherwise queue
      if (state.isConnected && redis) {
        try {
          await redis.publish(internalConfig.channel, JSON.stringify(fullEvent));
        } catch {
          // eslint-disable-next-line no-console
          console.error("[EventBus] Failed to publish event");
          queueEvent(fullEvent);
        }
      } else {
        queueEvent(fullEvent);
      }
    },

    async subscribe(callback: EventSubscriber): Promise<() => void> {
      const subscriptionId = randomUUID();

      if (!subscribers.has(subscriptionId)) {
        subscribers.set(subscriptionId, new Set());
      }
      const subscriberSet = subscribers.get(subscriptionId);
      if (subscriberSet) {
        subscriberSet.add(callback);
      }

      // Ensure Redis is initialized
      try {
        await initRedis();
      } catch {
        // eslint-disable-next-line no-console
        console.warn("[EventBus] Redis unavailable for subscription");
      }

      // Return unsubscribe function
      return () => {
        subscribers.get(subscriptionId)?.delete(callback);
        if (subscribers.get(subscriptionId)?.size === 0) {
          subscribers.delete(subscriptionId);
        }
      };
    },

    isConnected(): boolean {
      return state.isConnected;
    },

    isDegraded(): boolean {
      return state.isDegraded;
    },

    getQueueSize(): number {
      return eventQueue.length;
    },

    async ping(): Promise<number | undefined> {
      if (!redis || !state.isConnected) {
        return undefined;
      }

      try {
        const startTime = Date.now();
        // Use Redis PING command to measure round-trip latency
        await redis.config("GET", "timeout"); // Light command that requires server response
        return Date.now() - startTime;
      } catch {
        return undefined;
      }
    },

    async close(): Promise<void> {
      // Close Redis connection first (this will trigger "close" event setting isDegraded)
      if (redis) {
        await redis.quit();
        redis = null;
      }

      // Flush queued events after connection closed
      await drainQueue();

      // Call unsubscribe if exists
      if (unsubscribe) {
        await unsubscribe();
        unsubscribe = null;
      }

      // Clear subscribers
      subscribers.clear();

      state.isConnected = false;
      // Note: isDegraded remains as set by close event
    },
  };
}

export default { manifest, create } satisfies PluginModule<EventBus>;
