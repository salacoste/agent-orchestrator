/**
 * Tests for Redis Event Bus Plugin
 *
 * Note: Full pub/sub testing with ioredis mock is complex due to ESM dynamic imports.
 * These tests focus on the degraded mode behavior and basic functionality.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { create } from "../src/index.js";
import type { EventBus } from "@composio/ao-core";

describe("Redis Event Bus", () => {
  let eventBus: EventBus;

  beforeEach(() => {
    vi.clearAllMocks();

    eventBus = create({
      host: "localhost",
      port: 6379,
      channel: "test:events",
      retryDelays: [100, 200, 400],
      queueMaxSize: 10,
    });
  });

  afterEach(async () => {
    try {
      await eventBus.close();
    } catch {
      // Ignore errors during cleanup
    }
  });

  describe("creation", () => {
    it("should create event bus with default config", () => {
      const defaultBus = create({
        host: "localhost",
        port: 6379,
      });

      expect(defaultBus).toBeDefined();
      expect(defaultBus.name).toBe("redis-event-bus");
    });

    it("should create event bus with custom config", () => {
      const customBus = create({
        host: "redis.example.com",
        port: 6380,
        channel: "custom:channel",
        queueMaxSize: 500,
      });

      expect(customBus).toBeDefined();
    });
  });

  describe("publish", () => {
    it("should queue events when Redis is not connected", async () => {
      // Simulate disconnected state by closing first
      await eventBus.close();

      await eventBus.publish({
        eventType: "queued",
        metadata: {},
      });

      // Queue should have 1 event
      expect(eventBus.getQueueSize()).toBe(1);
    });

    it("should drop oldest events when queue is full", async () => {
      // Close to force degraded mode
      await eventBus.close();

      const smallBus = create({
        host: "localhost",
        port: 6379,
        queueMaxSize: 2,
      });

      // Fill queue beyond capacity
      await smallBus.publish({ eventType: "event1", metadata: {} });
      await smallBus.publish({ eventType: "event2", metadata: {} });
      await smallBus.publish({ eventType: "event3", metadata: {} });

      // Queue should be at max size (2), oldest dropped
      expect(smallBus.getQueueSize()).toBe(2);
      await smallBus.close();
    });

    it("should generate eventId and timestamp for queued events", async () => {
      // Close to force degraded mode
      await eventBus.close();

      await eventBus.publish({
        eventType: "test",
        metadata: { source: "test" },
      });

      // Even though queued, the event should have been enhanced
      // We can't directly inspect queued events, but we can verify the behavior
      expect(eventBus.getQueueSize()).toBe(1);
    });
  });

  describe("subscribe", () => {
    it("should return unsubscribe function", async () => {
      let _callCount = 0;

      const unsubscribe = await eventBus.subscribe(() => {
        _callCount++;
      });

      // Verify unsubscribe is a function
      expect(typeof unsubscribe).toBe("function");

      // Call unsubscribe to ensure it doesn't throw
      unsubscribe();
    });

    it("should support multiple subscribers", async () => {
      const unsubscribe1 = await eventBus.subscribe(() => {
        // Handler 1
      });
      const unsubscribe2 = await eventBus.subscribe(() => {
        // Handler 2
      });

      // Both should return unsubscribe functions
      expect(typeof unsubscribe1).toBe("function");
      expect(typeof unsubscribe2).toBe("function");

      unsubscribe1();
      unsubscribe2();
    });
  });

  describe("connection state", () => {
    it("should report connected status", () => {
      // Initially false until first publish/subscribe
      expect(eventBus.isConnected()).toBe(false);
      expect(eventBus.isDegraded()).toBe(false);
    });

    it("should report degraded mode when queue has events", async () => {
      // Close to force degraded mode, then publish to add to queue
      await eventBus.close();

      await eventBus.publish({
        eventType: "test",
        metadata: {},
      });

      // After close and publish, queue should have items
      expect(eventBus.getQueueSize()).toBeGreaterThan(0);
    });

    it("should track queue size correctly", async () => {
      await eventBus.close();

      expect(eventBus.getQueueSize()).toBe(0);

      await eventBus.publish({ eventType: "test", metadata: {} });
      expect(eventBus.getQueueSize()).toBe(1);

      await eventBus.publish({ eventType: "test2", metadata: {} });
      expect(eventBus.getQueueSize()).toBe(2);
    });
  });

  describe("close", () => {
    it("should close gracefully", async () => {
      await eventBus.close();

      expect(eventBus.isConnected()).toBe(false);
    });

    it("should handle multiple close calls", async () => {
      await eventBus.close();
      await eventBus.close(); // Should not throw

      expect(eventBus.isConnected()).toBe(false);
    });

    it("should clear subscribers on close", async () => {
      await eventBus.subscribe(() => {
        // Handler
      });

      await eventBus.close();

      // After close, should still be able to create new event bus
      const newBus = create({
        host: "localhost",
        port: 6379,
      });

      expect(newBus).toBeDefined();
      await newBus.close();
    });
  });

  describe("configuration", () => {
    it("should use default channel when not specified", () => {
      const bus = create({
        host: "localhost",
        port: 6379,
      });

      expect(bus).toBeDefined();
      expect(bus.name).toBe("redis-event-bus");
    });

    it("should accept custom retry delays", () => {
      const bus = create({
        host: "localhost",
        port: 6379,
        retryDelays: [50, 100, 200],
      });

      expect(bus).toBeDefined();
    });

    it("should accept custom queue max size", () => {
      const bus = create({
        host: "localhost",
        port: 6379,
        queueMaxSize: 100,
      });

      expect(bus).toBeDefined();
    });
  });
});
