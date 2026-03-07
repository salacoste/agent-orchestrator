/**
 * Tests for EventSubscription Service
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createEventSubscription } from "../src/event-subscription.js";
import type { EventBus, EventBusEvent } from "../src/types.js";

// Mock EventBus
const createMockEventBus = (): EventBus => ({
  name: "mock-event-bus",
  isConnected: vi.fn(() => true),
  isDegraded: vi.fn(() => false),
  getQueueSize: vi.fn(() => 0),
  publish: vi.fn(async () => {}),
  close: vi.fn(async () => {}),
  subscribe: vi.fn(async () => () => {}),
});

describe("EventSubscription", () => {
  let mockEventBus: EventBus;
  let subscriptionService: ReturnType<typeof createEventSubscription>;
  let mockUnsubscribe: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockEventBus = createMockEventBus();
    mockUnsubscribe = vi.fn();
    mockEventBus.subscribe = vi.fn(async () => mockUnsubscribe);
    subscriptionService = createEventSubscription({
      eventBus: mockEventBus,
      dlqPath: "/tmp/test-dlq.jsonl",
    });
  });

  afterEach(async () => {
    await subscriptionService.close();
  });

  describe("subscribe", () => {
    it("should subscribe to a single event type", async () => {
      const handler = vi.fn(async () => undefined);
      const handle = await subscriptionService.subscribe({
        eventTypes: "story.completed",
        handler,
      });

      expect(handle).toBeDefined();
      expect(handle).toMatch(/^sub-/);
      expect(mockEventBus.subscribe).toHaveBeenCalledTimes(1);
    });

    it("should subscribe to multiple event types", async () => {
      const handler = vi.fn(async () => undefined);
      await subscriptionService.subscribe({
        eventTypes: ["story.completed", "story.started"],
        handler,
      });

      expect(mockEventBus.subscribe).toHaveBeenCalledTimes(2);
    });

    it("should subscribe to wildcard pattern", async () => {
      const handler = vi.fn(async () => undefined);
      await subscriptionService.subscribe({
        eventTypes: "story.*",
        handler,
      });

      expect(mockEventBus.subscribe).toHaveBeenCalledTimes(1);
    });

    it("should generate unique subscription handles", async () => {
      const handler1 = vi.fn(async () => undefined);
      const handler2 = vi.fn(async () => undefined);

      const handle1 = await subscriptionService.subscribe({
        eventTypes: "story.completed",
        handler: handler1,
      });

      const handle2 = await subscriptionService.subscribe({
        eventTypes: "story.started",
        handler: handler2,
      });

      expect(handle1).not.toBe(handle2);
    });
  });

  describe("unsubscribe", () => {
    it("should unsubscribe valid handle", async () => {
      const handler = vi.fn(async () => undefined);
      const handle = await subscriptionService.subscribe({
        eventTypes: "story.completed",
        handler,
      });

      await subscriptionService.unsubscribe(handle);

      expect(mockUnsubscribe).toHaveBeenCalledTimes(1);
    });

    it("should handle invalid handle gracefully", async () => {
      await expect(subscriptionService.unsubscribe("invalid-handle")).resolves.toBeUndefined();
    });
  });

  describe("event delivery", () => {
    it("should deliver matching events to handler", async () => {
      const handler = vi.fn(async () => undefined);

      await subscriptionService.subscribe({
        eventTypes: "story.completed",
        handler,
      });

      // Get the registered callback from EventBus.subscribe call
      const subscribeCall = mockEventBus.subscribe.mock.calls[0];
      const eventCallback = subscribeCall[0];

      // Simulate event delivery
      const event: EventBusEvent = {
        eventId: "evt-1",
        eventType: "story.completed",
        timestamp: new Date().toISOString(),
        metadata: { storyId: "1-2" },
      };

      await eventCallback(event);

      expect(handler).toHaveBeenCalledWith(event);
    });

    it("should not deliver non-matching events to handler", async () => {
      const handler = vi.fn(async () => undefined);

      await subscriptionService.subscribe({
        eventTypes: "story.completed",
        handler,
      });

      const subscribeCall = mockEventBus.subscribe.mock.calls[0];
      const eventCallback = subscribeCall[0];

      // Different event type
      const event: EventBusEvent = {
        eventId: "evt-1",
        eventType: "story.started",
        timestamp: new Date().toISOString(),
        metadata: { storyId: "1-2" },
      };

      await eventCallback(event);

      expect(handler).not.toHaveBeenCalled();
    });

    it("should match wildcard patterns", async () => {
      const handler = vi.fn(async () => undefined);

      await subscriptionService.subscribe({
        eventTypes: "story.*",
        handler,
      });

      const subscribeCall = mockEventBus.subscribe.mock.calls[0];
      const eventCallback = subscribeCall[0];

      // Should match story.completed
      const event1: EventBusEvent = {
        eventId: "evt-1",
        eventType: "story.completed",
        timestamp: new Date().toISOString(),
        metadata: { storyId: "1-2" },
      };

      await eventCallback(event1);

      expect(handler).toHaveBeenCalledWith(event1);
    });

    it("should deliver to multiple matching subscribers", async () => {
      const handler1 = vi.fn(async () => undefined);
      const handler2 = vi.fn(async () => undefined);

      await subscriptionService.subscribe({
        eventTypes: "story.*",
        handler: handler1,
      });

      await subscriptionService.subscribe({
        eventTypes: "story.completed",
        handler: handler2,
      });

      // Get callbacks
      const callback1 = mockEventBus.subscribe.mock.calls[0][0];
      const callback2 = mockEventBus.subscribe.mock.calls[1][0];

      const event: EventBusEvent = {
        eventId: "evt-1",
        eventType: "story.completed",
        timestamp: new Date().toISOString(),
        metadata: { storyId: "1-2" },
      };

      // Both callbacks receive the event
      await callback1(event);
      await callback2(event);

      expect(handler1).toHaveBeenCalledWith(event);
      expect(handler2).toHaveBeenCalledWith(event);
    });

    it("should require explicit acknowledgment", async () => {
      const handler = vi.fn(async () => undefined);

      await subscriptionService.subscribe({
        eventTypes: "story.completed",
        handler,
        options: { requireAck: true, ackTimeout: 5000 },
      });

      const subscribeCall = mockEventBus.subscribe.mock.calls[0];
      const eventCallback = subscribeCall[0];

      const event: EventBusEvent = {
        eventId: "evt-1",
        eventType: "story.completed",
        timestamp: new Date().toISOString(),
        metadata: { storyId: "1-2" },
      };

      // Handler should receive AckContext and call it
      handler.mockImplementationOnce(async (_evt, _ack) => {
        // Ack callback should be provided
        expect(_ack).toBeDefined();
        expect(typeof _ack).toBe("function");
        // Call ack to complete the event
        await _ack?.();
      });

      await eventCallback(event);

      expect(handler).toHaveBeenCalled();
    });
  });

  describe("error handling and retry", () => {
    it("should retry failed handler with exponential backoff", async () => {
      let attemptCount = 0;
      const handler = vi.fn(async () => {
        attemptCount++;
        if (attemptCount < 3) {
          throw new Error("Temporary failure");
        }
      });

      await subscriptionService.subscribe({
        eventTypes: "story.completed",
        handler,
        options: {
          maxRetries: 5,
          retryDelays: [10, 20, 40, 80, 160], // Short delays for testing
        },
      });

      const subscribeCall = mockEventBus.subscribe.mock.calls[0];
      const eventCallback = subscribeCall[0];

      const event: EventBusEvent = {
        eventId: "evt-1",
        eventType: "story.completed",
        timestamp: new Date().toISOString(),
        metadata: { storyId: "1-2" },
      };

      await eventCallback(event);

      // Wait for retries
      await new Promise((resolve) => setTimeout(resolve, 300));

      expect(handler).toHaveBeenCalledTimes(3); // Initial + 2 retries
    });

    it("should send failed events to Dead Letter Queue after max retries", async () => {
      const handler = vi.fn(async () => {
        throw new Error("Permanent failure");
      });

      await subscriptionService.subscribe({
        eventTypes: "story.completed",
        handler,
        options: {
          maxRetries: 2,
          retryDelays: [10, 20],
        },
      });

      const subscribeCall = mockEventBus.subscribe.mock.calls[0];
      const eventCallback = subscribeCall[0];

      const event: EventBusEvent = {
        eventId: "evt-1",
        eventType: "story.completed",
        timestamp: new Date().toISOString(),
        metadata: { storyId: "1-2" },
      };

      await eventCallback(event);

      // Wait for retries + DLQ write
      await new Promise((resolve) => setTimeout(resolve, 200));

      const dlq = subscriptionService.getDeadLetterQueue();
      expect(dlq.length).toBeGreaterThan(0);
      expect(dlq[0].eventId).toBe("evt-1");
      expect(dlq[0].retryCount).toBe(2);
    });

    it("should persist DLQ to disk", async () => {
      const handler = vi.fn(async () => {
        throw new Error("Permanent failure");
      });

      const testDlqPath = "/tmp/test-dlq-persist.jsonl";

      const serviceWithPersist = createEventSubscription({
        eventBus: mockEventBus,
        dlqPath: testDlqPath,
      });

      await serviceWithPersist.subscribe({
        eventTypes: "story.completed",
        handler,
        options: {
          maxRetries: 1,
          retryDelays: [10],
        },
      });

      const subscribeCall = mockEventBus.subscribe.mock.calls[0];
      const eventCallback = subscribeCall[0];

      const event: EventBusEvent = {
        eventId: "evt-2",
        eventType: "story.completed",
        timestamp: new Date().toISOString(),
        metadata: { storyId: "1-3" },
      };

      await eventCallback(event);

      // Wait for DLQ write
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Verify file exists
      const { existsSync } = await import("node:fs");
      expect(existsSync(testDlqPath)).toBe(true);

      // Cleanup
      await serviceWithPersist.close();
      const { unlink } = await import("node:fs/promises");
      try {
        await unlink(testDlqPath);
      } catch {
        // Ignore cleanup errors
      }
    });
  });

  describe("Dead Letter Queue", () => {
    it("should return DLQ events", async () => {
      const handler = vi.fn(async () => {
        throw new Error("Permanent failure");
      });

      await subscriptionService.subscribe({
        eventTypes: "story.completed",
        handler,
        options: {
          maxRetries: 1,
          retryDelays: [10],
        },
      });

      const subscribeCall = mockEventBus.subscribe.mock.calls[0];
      const eventCallback = subscribeCall[0];

      const event: EventBusEvent = {
        eventId: "evt-1",
        eventType: "story.completed",
        timestamp: new Date().toISOString(),
        metadata: { storyId: "1-2" },
      };

      await eventCallback(event);

      // Wait for DLQ
      await new Promise((resolve) => setTimeout(resolve, 100));

      const dlq = subscriptionService.getDeadLetterQueue();
      expect(dlq.length).toBeGreaterThan(0);
      expect(dlq[0]).toMatchObject({
        eventId: "evt-1",
        eventType: "story.completed",
        retryCount: 1,
      });
    });

    it("should replay DLQ event", async () => {
      let shouldFail = true;

      // Create a handler that can be configured to fail or succeed
      const conditionalHandler = vi.fn(async () => {
        if (shouldFail) {
          throw new Error("Force DLQ");
        }
      });

      await subscriptionService.subscribe({
        eventTypes: "story.completed",
        handler: conditionalHandler,
        options: { maxRetries: 1, retryDelays: [10] },
      });

      const subscribeCall = mockEventBus.subscribe.mock.calls[0];
      const eventCallback = subscribeCall[0];

      const event: EventBusEvent = {
        eventId: "evt-replay",
        eventType: "story.completed",
        timestamp: new Date().toISOString(),
        metadata: { storyId: "1-2" },
      };

      // First call - will fail and go to DLQ
      await eventCallback(event);
      await new Promise((resolve) => setTimeout(resolve, 100));

      const dlq = subscriptionService.getDeadLetterQueue();
      expect(dlq.length).toBeGreaterThan(0);
      const eventId = dlq[0].eventId;

      // Now make handler succeed
      shouldFail = false;
      conditionalHandler.mockClear();

      // Replay the DLQ event
      await subscriptionService.replayDLQ(eventId);

      // Wait for delivery
      await new Promise((resolve) => setTimeout(resolve, 50));

      // Handler should have been called during replay
      expect(conditionalHandler).toHaveBeenCalled();
    });
  });

  describe("statistics", () => {
    it("should return subscription statistics", async () => {
      const handler = vi.fn(async () => undefined);

      await subscriptionService.subscribe({
        eventTypes: "story.completed",
        handler,
      });

      const stats = subscriptionService.getStats();

      expect(stats).toMatchObject({
        activeSubscriptions: expect.any(Number),
        totalProcessed: expect.any(Number),
        dlqSize: expect.any(Number),
      });
    });
  });

  describe("acknowledgment timeout", () => {
    it("should timeout unacknowledged events", async () => {
      const handler = vi.fn(async (_evt, _ack) => {
        // Don't call ack, let it timeout
      });

      await subscriptionService.subscribe({
        eventTypes: "story.completed",
        handler,
        options: {
          requireAck: true,
          ackTimeout: 50, // Short timeout for testing
          maxRetries: 1, // Only retry once to keep test short
          retryDelays: [10], // Short retry delay
        },
      });

      const subscribeCall = mockEventBus.subscribe.mock.calls[0];
      const eventCallback = subscribeCall[0];

      const event: EventBusEvent = {
        eventId: "evt-1",
        eventType: "story.completed",
        timestamp: new Date().toISOString(),
        metadata: { storyId: "1-2" },
      };

      await eventCallback(event);

      expect(handler).toHaveBeenCalled();

      // Wait for timeout + retry
      await new Promise((resolve) => setTimeout(resolve, 150));

      // Event should be in DLQ due to timeout
      const dlq = subscriptionService.getDeadLetterQueue();
      const timedOutEvent = dlq.find((e) => e.eventId === "evt-1");
      expect(timedOutEvent?.error).toContain("timeout");
    });
  });

  describe("close", () => {
    it("should cleanup resources on close", async () => {
      const handler = vi.fn(async () => undefined);

      await subscriptionService.subscribe({
        eventTypes: "story.completed",
        handler,
      });

      await subscriptionService.close();

      // Should be able to close without error
      const stats = subscriptionService.getStats();
      expect(stats.activeSubscriptions).toBe(0);
    });
  });
});
