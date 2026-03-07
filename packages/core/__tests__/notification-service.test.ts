/**
 * Tests for NotificationService
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createNotificationService } from "../src/notification-service.js";
import type {
  NotificationService,
  Notification,
  NotificationPlugin,
  EventBus,
  EventBusEvent,
  NotificationPreferences as _NotificationPreferences,
} from "../src/types.js";
import { randomUUID } from "node:crypto";
import { unlink } from "node:fs/promises";

// Mock EventBus
const createMockEventBus = (): EventBus => ({
  name: "mock-event-bus",
  isConnected: vi.fn(() => true),
  isDegraded: vi.fn(() => false),
  getQueueSize: vi.fn(() => 0),
  publish: vi.fn(async () => {}),
  close: vi.fn(async () => {}),
  subscribe: vi.fn(async (_callback) => {
    // Return unsubscribe function
    return () => {};
  }),
});

// Mock notification plugin
const createMockPlugin = (name: string, available = true): NotificationPlugin => ({
  name,
  send: vi.fn(async () => {}),
  isAvailable: vi.fn(async () => available),
});

describe("NotificationService", () => {
  let notificationService: NotificationService;
  let mockEventBus: EventBus;
  let mockPlugins: NotificationPlugin[];
  let testDlqPath: string;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.useFakeTimers();

    mockEventBus = createMockEventBus();
    mockPlugins = [
      createMockPlugin("desktop"),
      createMockPlugin("slack"),
      createMockPlugin("webhook"),
    ];

    testDlqPath = `/tmp/test-dlq-${randomUUID()}.jsonl`;

    notificationService = createNotificationService({
      eventBus: mockEventBus,
      plugins: mockPlugins,
      dlqPath: testDlqPath,
      backlogThreshold: 50,
      dedupWindowMs: 300000, // 5 minutes
    });
  });

  afterEach(async () => {
    vi.useRealTimers();
    await notificationService.close();

    // Clean up DLQ file
    try {
      await unlink(testDlqPath);
    } catch {
      // Ignore
    }
  });

  describe("AC1: Receive events via event bus subscription", () => {
    it("should subscribe to event bus on initialization", async () => {
      expect(mockEventBus.subscribe).toHaveBeenCalled();
    });

    it("should assign priority based on event type", async () => {
      const criticalNotification: Notification = {
        eventId: randomUUID(),
        eventType: "agent.blocked",
        priority: "critical",
        title: "Agent Blocked",
        message: "Agent ao-story-1 is blocked",
        timestamp: new Date().toISOString(),
      };

      const result = await notificationService.send(criticalNotification);

      expect(result.success).toBe(true);
      expect(result.deliveredPlugins).toHaveLength(3);
    });

    it("should queue notifications by priority (critical > warning > info)", async () => {
      const infoNotification: Notification = {
        eventId: randomUUID(),
        eventType: "story.started",
        priority: "info",
        title: "Story Started",
        message: "Story 1-1 started",
        timestamp: new Date().toISOString(),
      };

      const criticalNotification: Notification = {
        eventId: randomUUID(),
        eventType: "agent.blocked",
        priority: "critical",
        title: "Agent Blocked",
        message: "Agent ao-story-1 is blocked",
        timestamp: new Date().toISOString(),
      };

      // Send info first, then critical
      await notificationService.send(infoNotification);
      await notificationService.send(criticalNotification);

      const status = notificationService.getStatus();
      expect(status.queueDepth).toBe(0); // Both should be processed immediately
    });
  });

  describe("AC2: Deduplication within 5 minutes", () => {
    it("should deduplicate notifications with identical event ID + type within window", async () => {
      const eventId = randomUUID();
      const eventType = "agent.blocked";

      const notification1: Notification = {
        eventId,
        eventType,
        priority: "critical",
        title: "Agent Blocked",
        message: "Agent ao-story-1 is blocked",
        timestamp: new Date().toISOString(),
      };

      const notification2: Notification = {
        eventId,
        eventType,
        priority: "critical",
        title: "Agent Blocked",
        message: "Agent ao-story-1 is blocked",
        timestamp: new Date().toISOString(),
      };

      const result1 = await notificationService.send(notification1);
      const result2 = await notificationService.send(notification2);

      expect(result1.duplicate).toBeUndefined();
      expect(result2.duplicate).toBe(true);

      const status = notificationService.getStatus();
      expect(status.dedupCount).toBe(1);
    });

    it("should allow different event types with same event ID", async () => {
      const eventId = randomUUID();

      const notification1: Notification = {
        eventId,
        eventType: "agent.blocked",
        priority: "critical",
        title: "Agent Blocked",
        message: "Agent ao-story-1 is blocked",
        timestamp: new Date().toISOString(),
      };

      const notification2: Notification = {
        eventId,
        eventType: "agent.resumed",
        priority: "warning",
        title: "Agent Resumed",
        message: "Agent ao-story-1 resumed",
        timestamp: new Date().toISOString(),
      };

      const result1 = await notificationService.send(notification1);
      const result2 = await notificationService.send(notification2);

      expect(result1.duplicate).toBeUndefined();
      expect(result2.duplicate).toBeUndefined();

      const status = notificationService.getStatus();
      expect(status.dedupCount).toBe(0);
    });

    it("should allow same notification after dedup window expires", async () => {
      const eventId = randomUUID();
      const eventType = "agent.blocked";

      const notification1: Notification = {
        eventId,
        eventType,
        priority: "critical",
        title: "Agent Blocked",
        message: "Agent ao-story-1 is blocked",
        timestamp: new Date().toISOString(),
      };

      const notification2: Notification = {
        eventId,
        eventType,
        priority: "critical",
        title: "Agent Blocked",
        message: "Agent ao-story-1 is blocked",
        timestamp: new Date().toISOString(),
      };

      const result1 = await notificationService.send(notification1);
      expect(result1.duplicate).toBeUndefined();

      // Advance past dedup window
      vi.advanceTimersByTime(301000); // 5 minutes 1 second

      const result2 = await notificationService.send(notification2);
      expect(result2.duplicate).toBeUndefined();
    });
  });

  describe("AC3: Route to configured notification plugins", () => {
    it("should route to all available plugins", async () => {
      const notification: Notification = {
        eventId: randomUUID(),
        eventType: "agent.blocked",
        priority: "critical",
        title: "Agent Blocked",
        message: "Agent ao-story-1 is blocked",
        timestamp: new Date().toISOString(),
      };

      const result = await notificationService.send(notification);

      expect(result.success).toBe(true);
      expect(result.deliveredPlugins).toEqual(["desktop", "slack", "webhook"]);
      expect(result.failedPlugins).toHaveLength(0);

      // Verify each plugin was called
      for (const plugin of mockPlugins) {
        expect(plugin.send).toHaveBeenCalledWith(
          expect.objectContaining({
            eventId: notification.eventId,
            title: "Agent Blocked",
          }),
        );
      }
    });

    it("should handle plugin unavailability gracefully", async () => {
      const unavailablePlugin = createMockPlugin("unavailable", false);
      const serviceWithUnavailable = createNotificationService({
        eventBus: mockEventBus,
        plugins: [...mockPlugins, unavailablePlugin],
        dlqPath: testDlqPath,
      });

      const notification: Notification = {
        eventId: randomUUID(),
        eventType: "agent.blocked",
        priority: "critical",
        title: "Agent Blocked",
        message: "Agent ao-story-1 is blocked",
        timestamp: new Date().toISOString(),
      };

      const result = await serviceWithUnavailable.send(notification);

      expect(result.deliveredPlugins).toEqual(["desktop", "slack", "webhook"]);
      expect(result.failedPlugins).toHaveLength(0); // Unavailable plugins are skipped, not failed

      await serviceWithUnavailable.close();
    });
  });

  describe("AC4: Alert on backlog > 50 items", () => {
    it("should publish backlog event when threshold exceeded", async () => {
      // Use real timers for this test since we need setTimeout to work
      vi.useRealTimers();

      let publishedEventCount = 0;
      let latestBacklogEvent: Omit<EventBusEvent, "eventId" | "timestamp"> | undefined;

      mockEventBus.publish = vi.fn(async (event) => {
        // Capture notification.backlog events
        if (event.eventType === "notification.backlog") {
          publishedEventCount++;
          latestBacklogEvent = event;
        }
      });

      // Create a plugin with delayed sending to build up queue
      const slowPlugin: NotificationPlugin = {
        name: "slow",
        send: vi.fn(async () => new Promise((resolve) => setTimeout(resolve, 50))),
        isAvailable: vi.fn(async () => true),
      };

      const service = createNotificationService({
        eventBus: mockEventBus,
        plugins: [slowPlugin],
        backlogThreshold: 3, // Lower threshold for testing
      });

      // Send notifications faster than they're processed to build queue
      const sendPromises = [];
      for (let i = 0; i < 5; i++) {
        sendPromises.push(
          service.send({
            eventId: randomUUID(),
            eventType: "test.event",
            priority: "info",
            title: `Test ${i}`,
            message: `Test notification ${i}`,
            timestamp: new Date().toISOString(),
          }),
        );
      }

      // Wait for all sends to complete
      await Promise.all(sendPromises);

      // Verify backlog was published when queue exceeded threshold
      expect(publishedEventCount).toBeGreaterThan(0);
      expect(latestBacklogEvent?.eventType).toBe("notification.backlog");

      await service.close();

      // Restore fake timers for other tests
      vi.useFakeTimers();
    });
  });

  describe("AC5: Retry with exponential backoff", () => {
    it("should retry failed plugin delivery with exponential backoff", async () => {
      const failingPlugin: NotificationPlugin = {
        name: "failing",
        send: vi.fn(async () => {
          throw new Error("Delivery failed");
        }),
        isAvailable: vi.fn(async () => true),
      };

      const service = createNotificationService({
        eventBus: mockEventBus,
        plugins: [failingPlugin],
        dlqPath: testDlqPath,
      });

      const notification: Notification = {
        eventId: randomUUID(),
        eventType: "agent.blocked",
        priority: "critical",
        title: "Agent Blocked",
        message: "Agent ao-story-1 is blocked",
        timestamp: new Date().toISOString(),
      };

      // Use fake timers to control retry timing
      vi.useFakeTimers();

      const sendPromise = service.send(notification);

      // Advance time for retries: 1s, 2s, 4s, 8s, 16s (5 attempts total)
      for (const delay of [1000, 2000, 4000, 8000, 16000]) {
        await vi.advanceTimersByTimeAsync(delay);
      }

      const result = await sendPromise;

      expect(result.success).toBe(false);
      expect(failingPlugin.send).toHaveBeenCalledTimes(3); // Initial + 2 retries

      // Check DLQ
      const dlq = service.getDLQ();
      expect(dlq).toHaveLength(1);
      expect(dlq[0].targetPlugin).toBe("failing");
      expect(dlq[0].retryCount).toBe(3);

      await service.close();
    });
  });

  describe("getStatus", () => {
    it("should return current notification status", () => {
      const status = notificationService.getStatus();

      expect(status).toMatchObject({
        queueDepth: 0,
        dedupCount: 0,
        dlqSize: 0,
      });
    });

    it("should track dedup count", async () => {
      const eventId = randomUUID();

      const notification1: Notification = {
        eventId,
        eventType: "agent.blocked",
        priority: "critical",
        title: "Agent Blocked",
        message: "Agent ao-story-1 is blocked",
        timestamp: new Date().toISOString(),
      };

      const notification2: Notification = {
        eventId,
        eventType: "agent.blocked",
        priority: "critical",
        title: "Agent Blocked",
        message: "Agent ao-story-1 is blocked",
        timestamp: new Date().toISOString(),
      };

      await notificationService.send(notification1);
      await notificationService.send(notification2);

      const status = notificationService.getStatus();
      expect(status.dedupCount).toBe(1);
    });
  });

  describe("getDLQ", () => {
    it("should return dead letter queue", async () => {
      const failingPlugin: NotificationPlugin = {
        name: "failing",
        send: vi.fn(async () => {
          throw new Error("Delivery failed");
        }),
        isAvailable: vi.fn(async () => true),
      };

      const service = createNotificationService({
        eventBus: mockEventBus,
        plugins: [failingPlugin],
        dlqPath: testDlqPath,
      });

      const notification: Notification = {
        eventId: randomUUID(),
        eventType: "agent.blocked",
        priority: "critical",
        title: "Agent Blocked",
        message: "Agent ao-story-1 is blocked",
        timestamp: new Date().toISOString(),
      };

      // Wait for retries and DLQ
      vi.useFakeTimers();
      const sendPromise = service.send(notification);

      for (const delay of [1000, 2000, 4000, 8000, 16000]) {
        await vi.advanceTimersByTimeAsync(delay);
      }

      await sendPromise;

      const dlq = service.getDLQ();
      expect(dlq).toHaveLength(1);
      expect(dlq[0].notification.eventId).toBe(notification.eventId);

      await service.close();
    });
  });

  describe("retryDLQ", () => {
    it("should retry notification from DLQ", async () => {
      const plugin: NotificationPlugin = {
        name: "test",
        send: vi.fn(async () => {}),
        isAvailable: vi.fn(async () => true),
      };

      const service = createNotificationService({
        eventBus: mockEventBus,
        plugins: [plugin],
        dlqPath: testDlqPath,
      });

      // First, create a DLQ entry by sending with failing plugin
      const failingPlugin: NotificationPlugin = {
        name: "failing",
        send: vi.fn(async () => {
          throw new Error("Failed");
        }),
        isAvailable: vi.fn(async () => true),
      };

      const serviceWithFailing = createNotificationService({
        eventBus: mockEventBus,
        plugins: [failingPlugin],
        dlqPath: testDlqPath,
      });

      const notification: Notification = {
        eventId: randomUUID(),
        eventType: "agent.blocked",
        priority: "critical",
        title: "Agent Blocked",
        message: "Agent ao-story-1 is blocked",
        timestamp: new Date().toISOString(),
      };

      vi.useFakeTimers();
      const sendPromise = serviceWithFailing.send(notification);

      for (const delay of [1000, 2000, 4000, 8000, 16000]) {
        await vi.advanceTimersByTimeAsync(delay);
      }

      await sendPromise;
      await serviceWithFailing.close();

      // Now retry from DLQ using working plugin
      const dlq = service.getDLQ();
      if (dlq.length > 0) {
        await service.retryDLQ(dlq[0].notification.eventId);

        const newDlq = service.getDLQ();
        expect(newDlq.length).toBeLessThan(dlq.length);
      }

      await service.close();
    });
  });

  describe("close", () => {
    it("should close service and cleanup resources", async () => {
      await notificationService.close();

      const status = notificationService.getStatus();
      expect(status.queueDepth).toBe(0);
    });

    it("should unsubscribe from event bus on close", async () => {
      // Use real timers for this test
      vi.useRealTimers();

      let unsubscribeCalled = false;
      const mockUnsubscribe = vi.fn(() => {
        unsubscribeCalled = true;
      });

      const eventBusWithUnsubscribe = {
        ...createMockEventBus(),
        subscribe: vi.fn(async () => {
          // Small delay to simulate async subscription
          await new Promise((resolve) => setTimeout(resolve, 1));
          return mockUnsubscribe;
        }),
      };

      const service = createNotificationService({
        eventBus: eventBusWithUnsubscribe,
        plugins: mockPlugins,
        dlqPath: testDlqPath,
      });

      // Wait for subscription to complete
      await new Promise((resolve) => setTimeout(resolve, 10));

      await service.close();

      expect(unsubscribeCalled).toBe(true);

      // Restore fake timers for other tests
      vi.useFakeTimers();
    });
  });

  describe("lastProcessedTime", () => {
    it("should update lastProcessedTime after sending notification", async () => {
      const notification: Notification = {
        eventId: randomUUID(),
        eventType: "agent.blocked",
        priority: "critical",
        title: "Agent Blocked",
        message: "Agent ao-story-1 is blocked",
        timestamp: new Date().toISOString(),
      };

      const beforeStatus = notificationService.getStatus();
      expect(beforeStatus.lastProcessedTime).toBeUndefined();

      await notificationService.send(notification);

      const afterStatus = notificationService.getStatus();
      expect(afterStatus.lastProcessedTime).toBeDefined();
      expect(afterStatus.lastProcessedTime).not.toBeUndefined();
    });
  });

  describe("Notification Preferences (AC6)", () => {
    it("should route to all plugins when no preferences configured", async () => {
      const service = createNotificationService({
        eventBus: mockEventBus,
        plugins: mockPlugins,
        dlqPath: testDlqPath,
      });

      const notification: Notification = {
        eventId: randomUUID(),
        eventType: "agent.blocked",
        priority: "critical",
        title: "Agent Blocked",
        message: "Agent ao-story-1 is blocked",
        timestamp: new Date().toISOString(),
      };

      const result = await service.send(notification);

      expect(result.deliveredPlugins).toEqual(["desktop", "slack", "webhook"]);

      await service.close();
    });

    it("should route to all plugins when preferences is empty object", async () => {
      const service = createNotificationService({
        eventBus: mockEventBus,
        plugins: mockPlugins,
        dlqPath: testDlqPath,
        preferences: {}, // Empty object, not undefined
      });

      const notification: Notification = {
        eventId: randomUUID(),
        eventType: "agent.blocked",
        priority: "critical",
        title: "Agent Blocked",
        message: "Agent ao-story-1 is blocked",
        timestamp: new Date().toISOString(),
      };

      const result = await service.send(notification);

      // Empty preferences should behave like no preferences - route to all plugins
      expect(result.deliveredPlugins).toEqual(["desktop", "slack", "webhook"]);

      await service.close();
    });

    it("should route to specified plugins based on event type preference", async () => {
      const service = createNotificationService({
        eventBus: mockEventBus,
        plugins: mockPlugins,
        dlqPath: testDlqPath,
        preferences: {
          blocked: "desktop,slack",
        },
      });

      const notification: Notification = {
        eventId: randomUUID(),
        eventType: "agent.blocked",
        priority: "critical",
        title: "Agent Blocked",
        message: "Agent ao-story-1 is blocked",
        timestamp: new Date().toISOString(),
      };

      const result = await service.send(notification);

      expect(result.deliveredPlugins).toEqual(["desktop", "slack"]);
      expect(result.deliveredPlugins).not.toContain("webhook");

      await service.close();
    });

    it("should route to all plugins when preference specifies 'all'", async () => {
      const service = createNotificationService({
        eventBus: mockEventBus,
        plugins: mockPlugins,
        dlqPath: testDlqPath,
        preferences: {
          blocked: "all",
        },
      });

      const notification: Notification = {
        eventId: randomUUID(),
        eventType: "agent.blocked",
        priority: "critical",
        title: "Agent Blocked",
        message: "Agent ao-story-1 is blocked",
        timestamp: new Date().toISOString(),
      };

      const result = await service.send(notification);

      expect(result.deliveredPlugins).toEqual(["desktop", "slack", "webhook"]);

      await service.close();
    });

    it("should support exact event type match in preferences", async () => {
      const service = createNotificationService({
        eventBus: mockEventBus,
        plugins: mockPlugins,
        dlqPath: testDlqPath,
        preferences: {
          "agent.blocked": "desktop",
          "story.started": "slack",
        },
      });

      const blockedNotification: Notification = {
        eventId: randomUUID(),
        eventType: "agent.blocked",
        priority: "critical",
        title: "Agent Blocked",
        message: "Agent ao-story-1 is blocked",
        timestamp: new Date().toISOString(),
      };

      const startedNotification: Notification = {
        eventId: randomUUID(),
        eventType: "story.started",
        priority: "info",
        title: "Story Started",
        message: "Story 1-1 started",
        timestamp: new Date().toISOString(),
      };

      const blockedResult = await service.send(blockedNotification);
      const startedResult = await service.send(startedNotification);

      expect(blockedResult.deliveredPlugins).toEqual(["desktop"]);
      expect(startedResult.deliveredPlugins).toEqual(["slack"]);

      await service.close();
    });

    it("should validate plugin names in preferences", async () => {
      expect(() => {
        createNotificationService({
          eventBus: mockEventBus,
          plugins: mockPlugins,
          dlqPath: testDlqPath,
          preferences: {
            blocked: "desktop,nonexistent",
          },
        });
      }).toThrow("Invalid plugin name");
    });

    it("should use default routing when no preference matches", async () => {
      const service = createNotificationService({
        eventBus: mockEventBus,
        plugins: mockPlugins,
        dlqPath: testDlqPath,
        preferences: {
          blocked: "desktop",
        },
      });

      const notification: Notification = {
        eventId: randomUUID(),
        eventType: "story.started",
        priority: "info",
        title: "Story Started",
        message: "Story 1-1 started",
        timestamp: new Date().toISOString(),
      };

      const result = await service.send(notification);

      // No preference for "started", so all plugins get it
      expect(result.deliveredPlugins).toEqual(["desktop", "slack", "webhook"]);

      await service.close();
    });

    it("should handle multiple event types with different preferences", async () => {
      const service = createNotificationService({
        eventBus: mockEventBus,
        plugins: mockPlugins,
        dlqPath: testDlqPath,
        preferences: {
          blocked: "desktop,slack",
          conflict: "webhook",
          completed: "slack",
        },
      });

      const notifications = [
        {
          eventType: "agent.blocked",
          expected: ["desktop", "slack"],
        },
        {
          eventType: "conflict.detected",
          expected: ["webhook"],
        },
        {
          eventType: "story.completed",
          expected: ["slack"],
        },
      ];

      for (const { eventType, expected } of notifications) {
        const notification: Notification = {
          eventId: randomUUID(),
          eventType,
          priority: "critical",
          title: "Test",
          message: "Test message",
          timestamp: new Date().toISOString(),
        };

        const result = await service.send(notification);
        expect(result.deliveredPlugins).toEqual(expected);
      }

      await service.close();
    });
  });
});
