/**
 * Integration Test Environment Setup
 *
 * Shared configuration and utilities for integration tests.
 * Provides Redis instance setup, temp directory management, and test helpers.
 */

import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";

// ============================================================================
// Test Environment Configuration
// ============================================================================

export interface IntegrationTestEnv {
  tempDir: string;
  redisPort?: number;
  redisHost?: string;
  cleanup: () => Promise<void>;
}

let currentEnv: IntegrationTestEnv | null = null;

/**
 * Create integration test environment
 * @returns Test environment with temp directory and cleanup
 */
export async function createIntegrationTestEnv(): Promise<IntegrationTestEnv> {
  const tempDir = await mkdtemp(join(process.env.TMP || "/tmp", "ao-integration-test-"));

  const env: IntegrationTestEnv = {
    tempDir,
    redisHost: process.env.REDIS_HOST || "localhost",
    redisPort: process.env.REDIS_PORT ? parseInt(process.env.REDIS_PORT, 10) : undefined,
    cleanup: async () => {
      // Cleanup temp directory
      await rm(tempDir, { recursive: true, force: true });
    },
  };

  currentEnv = env;
  return env;
}

/**
 * Get current test environment
 * @throws Error if environment not initialized
 */
export function getTestEnv(): IntegrationTestEnv {
  if (!currentEnv) {
    throw new Error(
      "Integration test environment not initialized. Call createIntegrationTestEnv() first.",
    );
  }
  return currentEnv;
}

/**
 * Generate unique test ID for isolation
 */
export function generateTestId(): string {
  return `test-${randomUUID().slice(0, 8)}`;
}

// ============================================================================
// Redis Test Fixture
// ============================================================================

export interface RedisTestFixture {
  createEventBus: () => EventBus;
  isConnected: () => boolean;
  cleanup: () => Promise<void>;
}

/**
 * Create Redis test fixture
 * Attempts to use real Redis if available, otherwise provides mock
 */
export async function createRedisTestFixture(): Promise<RedisTestFixture> {
  // Try to use real Redis via import
  let RedisClass: { default: new (...args: unknown[]) => unknown } | null = null;
  let redis: {
    on: (event: string, handler: (...args: unknown[]) => void) => void;
    publish: (channel: string, message: string) => void;
    subscribe: (channel: string) => void;
    quit: () => Promise<void>;
  } | null = null;
  let isConnected = false;

  try {
    RedisClass = await import("ioredis");
  } catch {
    // ioredis not available - use mock
    console.warn("[RedisFixture] ioredis not available, using mock EventBus");
  }

  async function connect(): Promise<void> {
    if (!RedisClass) {
      // Mock connected state
      isConnected = true;
      return;
    }

    try {
      const env = getTestEnv();
      redis = new RedisClass.default({
        host: env.redisHost || "localhost",
        port: env.redisPort || 6379,
        lazyConnect: false,
        retryStrategy: () => 1000,
        maxRetriesPerRequest: 1,
      }) as typeof redis;

      await new Promise<void>((resolve, reject) => {
        if (!redis) return reject(new Error("Redis not initialized"));

        const timeout = setTimeout(() => reject(new Error("Redis connection timeout")), 5000);

        redis.once("ready", () => {
          clearTimeout(timeout);
          isConnected = true;
          resolve();
        });

        redis.on("error", () => {
          clearTimeout(timeout);
          isConnected = false;
          resolve(); // Resolve anyway - tests should handle unavailable Redis
        });
      });
    } catch (error) {
      console.warn("[RedisFixture] Redis connection failed:", error);
      isConnected = false;
    }
  }

  await connect();

  return {
    createEventBus: () => {
      // Create EventBus implementation (simplified for testing)
      const subscribers = new Set<(event: unknown) => void>();
      const eventQueue: unknown[] = [];

      return {
        name: "test-event-bus",
        async publish(event: Omit<EventBusEvent, "eventId" | "timestamp">): Promise<void> {
          const fullEvent: EventBusEvent = {
            ...event,
            eventId: randomUUID(),
            timestamp: new Date().toISOString(),
          };

          if (isConnected && redis) {
            try {
              await redis.publish("ao:events", JSON.stringify(fullEvent));
            } catch {
              eventQueue.push(fullEvent);
            }
          } else {
            eventQueue.push(fullEvent);
          }

          // Deliver to all subscribers (synchronous for mock, async for real Redis)
          for (const subscriber of subscribers) {
            try {
              await subscriber(fullEvent);
            } catch {
              // Subscriber errors are logged but don't stop delivery
            }
          }
        },
        async subscribe(callback: (event: unknown) => void): Promise<() => void> {
          subscribers.add(callback);
          return () => {
            subscribers.delete(callback);
          };
        },
        isConnected: () => isConnected,
        isDegraded: () => !isConnected,
        getQueueSize: () => eventQueue.length,
        async close(): Promise<void> {
          if (redis) {
            await redis.quit();
            redis = null;
          }
          isConnected = false;
          subscribers.clear();
        },
      };
    },
    isConnected: () => isConnected,
    cleanup: async () => {
      if (redis) {
        await redis.quit();
        redis = null;
      }
      isConnected = false;
    },
  };
}

// ============================================================================
// YAML Helper Functions
// ============================================================================

/**
 * Create a minimal sprint-status.yaml content for testing
 */
export function createTestYamlContent(projectName: string = "test-project"): string {
  return `# generated: ${new Date().toISOString()}
# project: ${projectName}
# project_key: TEST
# tracking_system: file-system
# story_location: _bmad-output/implementation-artifacts

development_status:
  story-1: backlog
  story-2: in-progress
  story-3: done
`;
}

/**
 * Create YAML file in temp directory
 */
export async function createTestYaml(
  tempDir: string,
  filename: string = "sprint-status.yaml",
): Promise<string> {
  const yamlPath = join(tempDir, filename);
  const { writeFile } = await import("node:fs/promises");
  await writeFile(yamlPath, createTestYamlContent(), "utf-8");
  return yamlPath;
}

// ============================================================================
// Type Re-exports for convenience
// ============================================================================

import type { EventBus, EventBusEvent } from "@composio/ao-core";

export type { EventBus, EventBusEvent };
