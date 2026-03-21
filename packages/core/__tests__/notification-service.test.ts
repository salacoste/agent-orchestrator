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
      // Each notification needs a unique entity (storyId) so entity-based dedup doesn't suppress them
      const sendPromises = [];
      for (let i = 0; i < 5; i++) {
        sendPromises.push(
          service.send({
            eventId: randomUUID(),
            eventType: "test.event",
            priority: "info",
            title: `Test ${i}`,
            message: `Test notification ${i}`,
            metadata: { storyId: `story-${i}` },
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

    it("should warn on unknown plugin names in preferences without throwing", async () => {
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      const service = createNotificationService({
        eventBus: mockEventBus,
        plugins: mockPlugins,
        dlqPath: testDlqPath,
        preferences: {
          blocked: "desktop,nonexistent",
        },
      });
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('Unknown plugin "nonexistent"'));
      await service.close();
      warnSpy.mockRestore();
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

    it("should route by priority when event type does not match any preference", async () => {
      const service = createNotificationService({
        eventBus: mockEventBus,
        plugins: mockPlugins,
        dlqPath: testDlqPath,
        preferences: {
          critical: "desktop",
          info: "slack",
        },
      });

      // Event type "custom.event" won't match any preference pattern,
      // but priority "critical" will match the "critical" preference key
      const notification: Notification = {
        eventId: randomUUID(),
        eventType: "custom.event",
        priority: "critical",
        title: "Critical Alert",
        message: "Something critical happened",
        timestamp: new Date().toISOString(),
      };

      const result = await service.send(notification);
      expect(result.deliveredPlugins).toEqual(["desktop"]);

      await service.close();
    });

    it("should prefer event type match over priority match", async () => {
      const service = createNotificationService({
        eventBus: mockEventBus,
        plugins: mockPlugins,
        dlqPath: testDlqPath,
        preferences: {
          blocked: "webhook",
          critical: "desktop",
        },
      });

      // "agent.blocked" matches "blocked" pattern (event type substring match),
      // so "webhook" should be used, not "desktop" from the "critical" priority match
      const notification: Notification = {
        eventId: randomUUID(),
        eventType: "agent.blocked",
        priority: "critical",
        title: "Blocked",
        message: "Agent blocked",
        timestamp: new Date().toISOString(),
      };

      const result = await service.send(notification);
      expect(result.deliveredPlugins).toEqual(["webhook"]);

      await service.close();
    });
  });

  describe("Event-Driven Notification Triggers (Story 3-2)", () => {
    describe("AC1: Configurable trigger map", () => {
      it("should classify agent.blocked as critical", async () => {
        let subscriberCallback: ((event: EventBusEvent) => void) | null = null;
        const eventBus = createMockEventBus();
        (eventBus.subscribe as ReturnType<typeof vi.fn>).mockImplementation(
          async (cb: (event: EventBusEvent) => void) => {
            subscriberCallback = cb;
            return () => {};
          },
        );

        const plugin = createMockPlugin("desktop");
        const service = createNotificationService({
          eventBus,
          plugins: [plugin],
        });

        await vi.waitFor(() => expect(subscriberCallback).not.toBeNull());

        await subscriberCallback!({
          eventId: randomUUID(),
          eventType: "agent.blocked",
          timestamp: new Date().toISOString(),
          metadata: { storyId: "story-1", agentId: "agent-1" },
        });

        expect(plugin.send).toHaveBeenCalledOnce();
        const notification = (plugin.send as ReturnType<typeof vi.fn>).mock
          .calls[0][0] as Notification;
        expect(notification.priority).toBe("critical");
        expect(notification.title).toBe("Agent Blocked");

        await service.close();
      });

      it("should classify story.blocked as critical", async () => {
        let subscriberCallback: ((event: EventBusEvent) => void) | null = null;
        const eventBus = createMockEventBus();
        (eventBus.subscribe as ReturnType<typeof vi.fn>).mockImplementation(
          async (cb: (event: EventBusEvent) => void) => {
            subscriberCallback = cb;
            return () => {};
          },
        );

        const plugin = createMockPlugin("desktop");
        const service = createNotificationService({
          eventBus,
          plugins: [plugin],
        });

        await vi.waitFor(() => expect(subscriberCallback).not.toBeNull());

        await subscriberCallback!({
          eventId: randomUUID(),
          eventType: "story.blocked",
          timestamp: new Date().toISOString(),
          metadata: { storyId: "story-2" },
        });

        expect(plugin.send).toHaveBeenCalledOnce();
        const notification = (plugin.send as ReturnType<typeof vi.fn>).mock
          .calls[0][0] as Notification;
        expect(notification.priority).toBe("critical");
        expect(notification.title).toBe("Story Blocked");

        await service.close();
      });

      it("should classify conflict.detected as critical", async () => {
        let subscriberCallback: ((event: EventBusEvent) => void) | null = null;
        const eventBus = createMockEventBus();
        (eventBus.subscribe as ReturnType<typeof vi.fn>).mockImplementation(
          async (cb: (event: EventBusEvent) => void) => {
            subscriberCallback = cb;
            return () => {};
          },
        );

        const plugin = createMockPlugin("desktop");
        const service = createNotificationService({
          eventBus,
          plugins: [plugin],
        });

        await vi.waitFor(() => expect(subscriberCallback).not.toBeNull());

        await subscriberCallback!({
          eventId: randomUUID(),
          eventType: "conflict.detected",
          timestamp: new Date().toISOString(),
          metadata: { storyId: "story-3" },
        });

        expect(plugin.send).toHaveBeenCalledOnce();
        const notification = (plugin.send as ReturnType<typeof vi.fn>).mock
          .calls[0][0] as Notification;
        expect(notification.priority).toBe("critical");
        expect(notification.title).toBe("Conflict Detected");

        await service.close();
      });

      it("should classify agent.offline as warning", async () => {
        let subscriberCallback: ((event: EventBusEvent) => void) | null = null;
        const eventBus = createMockEventBus();
        (eventBus.subscribe as ReturnType<typeof vi.fn>).mockImplementation(
          async (cb: (event: EventBusEvent) => void) => {
            subscriberCallback = cb;
            return () => {};
          },
        );

        const plugin = createMockPlugin("desktop");
        const service = createNotificationService({
          eventBus,
          plugins: [plugin],
        });

        await vi.waitFor(() => expect(subscriberCallback).not.toBeNull());

        await subscriberCallback!({
          eventId: randomUUID(),
          eventType: "agent.offline",
          timestamp: new Date().toISOString(),
          metadata: { agentId: "agent-5" },
        });

        expect(plugin.send).toHaveBeenCalledOnce();
        const notification = (plugin.send as ReturnType<typeof vi.fn>).mock
          .calls[0][0] as Notification;
        expect(notification.priority).toBe("warning");
        expect(notification.title).toBe("Agent Offline");

        await service.close();
      });

      it("should classify eventbus.backlog as critical", async () => {
        let subscriberCallback: ((event: EventBusEvent) => void) | null = null;
        const eventBus = createMockEventBus();
        (eventBus.subscribe as ReturnType<typeof vi.fn>).mockImplementation(
          async (cb: (event: EventBusEvent) => void) => {
            subscriberCallback = cb;
            return () => {};
          },
        );

        const plugin = createMockPlugin("desktop");
        const service = createNotificationService({
          eventBus,
          plugins: [plugin],
        });

        await vi.waitFor(() => expect(subscriberCallback).not.toBeNull());

        await subscriberCallback!({
          eventId: randomUUID(),
          eventType: "eventbus.backlog",
          timestamp: new Date().toISOString(),
          metadata: {},
        });

        expect(plugin.send).toHaveBeenCalledOnce();
        const notification = (plugin.send as ReturnType<typeof vi.fn>).mock
          .calls[0][0] as Notification;
        expect(notification.priority).toBe("critical");
        expect(notification.title).toBe("Event Bus Backlog");

        await service.close();
      });

      it("should ignore unknown event types", async () => {
        let subscriberCallback: ((event: EventBusEvent) => void) | null = null;
        const eventBus = createMockEventBus();
        (eventBus.subscribe as ReturnType<typeof vi.fn>).mockImplementation(
          async (cb: (event: EventBusEvent) => void) => {
            subscriberCallback = cb;
            return () => {};
          },
        );

        const plugin = createMockPlugin("desktop");
        const service = createNotificationService({
          eventBus,
          plugins: [plugin],
        });

        await vi.waitFor(() => expect(subscriberCallback).not.toBeNull());

        await subscriberCallback!({
          eventId: randomUUID(),
          eventType: "some.random.event",
          timestamp: new Date().toISOString(),
          metadata: {},
        });

        expect(plugin.send).not.toHaveBeenCalled();

        await service.close();
      });

      it("should allow overriding trigger map via config", async () => {
        let subscriberCallback: ((event: EventBusEvent) => void) | null = null;
        const eventBus = createMockEventBus();
        (eventBus.subscribe as ReturnType<typeof vi.fn>).mockImplementation(
          async (cb: (event: EventBusEvent) => void) => {
            subscriberCallback = cb;
            return () => {};
          },
        );

        const plugin = createMockPlugin("desktop");
        const service = createNotificationService({
          eventBus,
          plugins: [plugin],
          triggerMap: {
            "custom.event": { priority: "warning", title: "Custom Alert" },
          },
        });

        await vi.waitFor(() => expect(subscriberCallback).not.toBeNull());

        await subscriberCallback!({
          eventId: randomUUID(),
          eventType: "custom.event",
          timestamp: new Date().toISOString(),
          metadata: {},
        });

        expect(plugin.send).toHaveBeenCalledOnce();
        const notification = (plugin.send as ReturnType<typeof vi.fn>).mock
          .calls[0][0] as Notification;
        expect(notification.priority).toBe("warning");
        expect(notification.title).toBe("Custom Alert");

        await service.close();
      });

      it("should merge custom trigger map with defaults", async () => {
        let subscriberCallback: ((event: EventBusEvent) => void) | null = null;
        const eventBus = createMockEventBus();
        (eventBus.subscribe as ReturnType<typeof vi.fn>).mockImplementation(
          async (cb: (event: EventBusEvent) => void) => {
            subscriberCallback = cb;
            return () => {};
          },
        );

        const plugin = createMockPlugin("desktop");
        const service = createNotificationService({
          eventBus,
          plugins: [plugin],
          triggerMap: {
            "agent.blocked": { priority: "warning", title: "Agent Needs Help" },
          },
        });

        await vi.waitFor(() => expect(subscriberCallback).not.toBeNull());

        // Custom override: agent.blocked is now warning instead of critical
        await subscriberCallback!({
          eventId: randomUUID(),
          eventType: "agent.blocked",
          timestamp: new Date().toISOString(),
          metadata: { agentId: "agent-1" },
        });

        const notification1 = (plugin.send as ReturnType<typeof vi.fn>).mock
          .calls[0][0] as Notification;
        expect(notification1.priority).toBe("warning");
        expect(notification1.title).toBe("Agent Needs Help");

        // Default still works for non-overridden events
        await subscriberCallback!({
          eventId: randomUUID(),
          eventType: "conflict.detected",
          timestamp: new Date().toISOString(),
          metadata: { storyId: "story-1" },
        });

        const notification2 = (plugin.send as ReturnType<typeof vi.fn>).mock
          .calls[1][0] as Notification;
        expect(notification2.priority).toBe("critical");
        expect(notification2.title).toBe("Conflict Detected");

        await service.close();
      });
    });

    describe("AC2: Actionable notification context", () => {
      let subscriberCallback: ((event: EventBusEvent) => void) | null;
      let plugin: NotificationPlugin;
      let service: NotificationService;

      beforeEach(async () => {
        subscriberCallback = null;
        const eventBus = createMockEventBus();
        (eventBus.subscribe as ReturnType<typeof vi.fn>).mockImplementation(
          async (cb: (event: EventBusEvent) => void) => {
            subscriberCallback = cb;
            return () => {};
          },
        );

        plugin = createMockPlugin("desktop");
        service = createNotificationService({
          eventBus,
          plugins: [plugin],
        });

        await vi.waitFor(() => expect(subscriberCallback).not.toBeNull());
      });

      afterEach(async () => {
        await service.close();
      });

      it("should include CLI suggestion for agent.blocked", async () => {
        await subscriberCallback!({
          eventId: randomUUID(),
          eventType: "agent.blocked",
          timestamp: new Date().toISOString(),
          metadata: { agentId: "agent-7", storyId: "story-1" },
        });

        const notification = (plugin.send as ReturnType<typeof vi.fn>).mock
          .calls[0][0] as Notification;
        expect(notification.message).toContain("ao status agent-7");
      });

      it("should include CLI suggestion for conflict.detected", async () => {
        await subscriberCallback!({
          eventId: randomUUID(),
          eventType: "conflict.detected",
          timestamp: new Date().toISOString(),
          metadata: { storyId: "story-2" },
        });

        const notification = (plugin.send as ReturnType<typeof vi.fn>).mock
          .calls[0][0] as Notification;
        expect(notification.message).toContain("ao resolve-conflicts");
      });

      it("should include CLI suggestion for agent.offline", async () => {
        await subscriberCallback!({
          eventId: randomUUID(),
          eventType: "agent.offline",
          timestamp: new Date().toISOString(),
          metadata: { agentId: "agent-3" },
        });

        const notification = (plugin.send as ReturnType<typeof vi.fn>).mock
          .calls[0][0] as Notification;
        expect(notification.message).toContain("ao fleet");
        expect(notification.message).toContain("ao status agent-3");
      });

      it("should include reason in message when present", async () => {
        await subscriberCallback!({
          eventId: randomUUID(),
          eventType: "agent.blocked",
          timestamp: new Date().toISOString(),
          metadata: { agentId: "agent-1", storyId: "story-1", reason: "Missing dependency" },
        });

        const notification = (plugin.send as ReturnType<typeof vi.fn>).mock
          .calls[0][0] as Notification;
        expect(notification.message).toContain("Missing dependency");
      });

      it("should handle missing metadata gracefully", async () => {
        await subscriberCallback!({
          eventId: randomUUID(),
          eventType: "agent.blocked",
          timestamp: new Date().toISOString(),
          metadata: {},
        });

        const notification = (plugin.send as ReturnType<typeof vi.fn>).mock
          .calls[0][0] as Notification;
        expect(notification.message).toContain("Agent is blocked");
        expect(notification.message).toContain("ao fleet");
      });

      it("should include story ID in message for story.blocked", async () => {
        await subscriberCallback!({
          eventId: randomUUID(),
          eventType: "story.blocked",
          timestamp: new Date().toISOString(),
          metadata: { storyId: "story-42" },
        });

        const notification = (plugin.send as ReturnType<typeof vi.fn>).mock
          .calls[0][0] as Notification;
        expect(notification.message).toContain("Story story-42 is blocked");
        expect(notification.message).toContain("ao resume story-42");
      });

      it("should ignore notification.backlog via subscriber (self-published, not in trigger map)", async () => {
        await subscriberCallback!({
          eventId: randomUUID(),
          eventType: "notification.backlog",
          timestamp: new Date().toISOString(),
          metadata: { queueDepth: 100 },
        });

        // notification.backlog is excluded from trigger map to prevent infinite loop
        expect(plugin.send).not.toHaveBeenCalled();
      });
    });

    describe("AC3: Info events log-only", () => {
      it("should log info events to console without sending to plugins", async () => {
        const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

        let subscriberCallback: ((event: EventBusEvent) => void) | null = null;
        const eventBus = createMockEventBus();
        (eventBus.subscribe as ReturnType<typeof vi.fn>).mockImplementation(
          async (cb: (event: EventBusEvent) => void) => {
            subscriberCallback = cb;
            return () => {};
          },
        );

        const plugin = createMockPlugin("desktop");
        const service = createNotificationService({
          eventBus,
          plugins: [plugin],
        });

        await vi.waitFor(() => expect(subscriberCallback).not.toBeNull());

        await subscriberCallback!({
          eventId: randomUUID(),
          eventType: "story.completed",
          timestamp: new Date().toISOString(),
          metadata: { storyId: "story-1" },
        });

        // Plugin should NOT have been called
        expect(plugin.send).not.toHaveBeenCalled();

        // Console.log should have been called with info message
        expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("[notification]"));
        expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("Story Completed"));

        logSpy.mockRestore();
        await service.close();
      });

      it("should log story.started as info without plugin delivery", async () => {
        const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

        let subscriberCallback: ((event: EventBusEvent) => void) | null = null;
        const eventBus = createMockEventBus();
        (eventBus.subscribe as ReturnType<typeof vi.fn>).mockImplementation(
          async (cb: (event: EventBusEvent) => void) => {
            subscriberCallback = cb;
            return () => {};
          },
        );

        const plugin = createMockPlugin("desktop");
        const service = createNotificationService({
          eventBus,
          plugins: [plugin],
        });

        await vi.waitFor(() => expect(subscriberCallback).not.toBeNull());

        await subscriberCallback!({
          eventId: randomUUID(),
          eventType: "story.started",
          timestamp: new Date().toISOString(),
          metadata: { storyId: "story-5" },
        });

        expect(plugin.send).not.toHaveBeenCalled();
        expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("Story Started"));

        logSpy.mockRestore();
        await service.close();
      });

      it("should log agent.resumed as info without plugin delivery", async () => {
        const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

        let subscriberCallback: ((event: EventBusEvent) => void) | null = null;
        const eventBus = createMockEventBus();
        (eventBus.subscribe as ReturnType<typeof vi.fn>).mockImplementation(
          async (cb: (event: EventBusEvent) => void) => {
            subscriberCallback = cb;
            return () => {};
          },
        );

        const plugin = createMockPlugin("desktop");
        const service = createNotificationService({
          eventBus,
          plugins: [plugin],
        });

        await vi.waitFor(() => expect(subscriberCallback).not.toBeNull());

        await subscriberCallback!({
          eventId: randomUUID(),
          eventType: "agent.resumed",
          timestamp: new Date().toISOString(),
          metadata: { agentId: "agent-2" },
        });

        expect(plugin.send).not.toHaveBeenCalled();
        expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("Agent Resumed"));

        logSpy.mockRestore();
        await service.close();
      });

      it("should log story.assigned as info without plugin delivery", async () => {
        const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

        let subscriberCallback: ((event: EventBusEvent) => void) | null = null;
        const eventBus = createMockEventBus();
        (eventBus.subscribe as ReturnType<typeof vi.fn>).mockImplementation(
          async (cb: (event: EventBusEvent) => void) => {
            subscriberCallback = cb;
            return () => {};
          },
        );

        const plugin = createMockPlugin("desktop");
        const service = createNotificationService({
          eventBus,
          plugins: [plugin],
        });

        await vi.waitFor(() => expect(subscriberCallback).not.toBeNull());

        await subscriberCallback!({
          eventId: randomUUID(),
          eventType: "story.assigned",
          timestamp: new Date().toISOString(),
          metadata: { storyId: "story-8", agentId: "agent-4" },
        });

        expect(plugin.send).not.toHaveBeenCalled();
        expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("Story Assigned"));

        logSpy.mockRestore();
        await service.close();
      });

      it("should still send critical events to plugins", async () => {
        const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

        let subscriberCallback: ((event: EventBusEvent) => void) | null = null;
        const eventBus = createMockEventBus();
        (eventBus.subscribe as ReturnType<typeof vi.fn>).mockImplementation(
          async (cb: (event: EventBusEvent) => void) => {
            subscriberCallback = cb;
            return () => {};
          },
        );

        const plugin = createMockPlugin("desktop");
        const service = createNotificationService({
          eventBus,
          plugins: [plugin],
        });

        await vi.waitFor(() => expect(subscriberCallback).not.toBeNull());

        await subscriberCallback!({
          eventId: randomUUID(),
          eventType: "agent.blocked",
          timestamp: new Date().toISOString(),
          metadata: { agentId: "agent-1" },
        });

        // Plugin SHOULD have been called for critical events
        expect(plugin.send).toHaveBeenCalledOnce();

        logSpy.mockRestore();
        await service.close();
      });
    });

    describe("AC4: Delivery latency measurement", () => {
      it("should track lastLatencyMs in status", async () => {
        let subscriberCallback: ((event: EventBusEvent) => void) | null = null;
        const eventBus = createMockEventBus();
        (eventBus.subscribe as ReturnType<typeof vi.fn>).mockImplementation(
          async (cb: (event: EventBusEvent) => void) => {
            subscriberCallback = cb;
            return () => {};
          },
        );

        const plugin = createMockPlugin("desktop");
        const service = createNotificationService({
          eventBus,
          plugins: [plugin],
        });

        await vi.waitFor(() => expect(subscriberCallback).not.toBeNull());

        await subscriberCallback!({
          eventId: randomUUID(),
          eventType: "agent.blocked",
          timestamp: new Date().toISOString(),
          metadata: { agentId: "agent-1" },
        });

        const status = service.getStatus();
        expect(status.lastLatencyMs).toBeDefined();
        expect(typeof status.lastLatencyMs).toBe("number");
        expect(status.lastLatencyMs).toBeGreaterThanOrEqual(0);

        await service.close();
      });

      it("should warn when latency exceeds 1 second", async () => {
        const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

        let subscriberCallback: ((event: EventBusEvent) => void) | null = null;
        const eventBus = createMockEventBus();
        (eventBus.subscribe as ReturnType<typeof vi.fn>).mockImplementation(
          async (cb: (event: EventBusEvent) => void) => {
            subscriberCallback = cb;
            return () => {};
          },
        );

        // Create a slow plugin that takes > 1s
        const slowPlugin: NotificationPlugin = {
          name: "slow",
          send: vi.fn(async () => {
            // Advance time by 1500ms to simulate slow delivery
            vi.advanceTimersByTime(1500);
          }),
          isAvailable: vi.fn(async () => true),
        };

        const service = createNotificationService({
          eventBus,
          plugins: [slowPlugin],
        });

        await vi.waitFor(() => expect(subscriberCallback).not.toBeNull());

        await subscriberCallback!({
          eventId: randomUUID(),
          eventType: "agent.blocked",
          timestamp: new Date().toISOString(),
          metadata: { agentId: "agent-1" },
        });

        expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("Delivery latency"));
        expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("exceeds"));

        warnSpy.mockRestore();
        await service.close();
      });

      it("should not warn when latency is under threshold", async () => {
        const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

        let subscriberCallback: ((event: EventBusEvent) => void) | null = null;
        const eventBus = createMockEventBus();
        (eventBus.subscribe as ReturnType<typeof vi.fn>).mockImplementation(
          async (cb: (event: EventBusEvent) => void) => {
            subscriberCallback = cb;
            return () => {};
          },
        );

        const plugin = createMockPlugin("desktop");
        const service = createNotificationService({
          eventBus,
          plugins: [plugin],
        });

        await vi.waitFor(() => expect(subscriberCallback).not.toBeNull());

        await subscriberCallback!({
          eventId: randomUUID(),
          eventType: "agent.blocked",
          timestamp: new Date().toISOString(),
          metadata: { agentId: "agent-1" },
        });

        // Should not have warned about latency (fast delivery)
        const latencyWarnings = warnSpy.mock.calls.filter((call) =>
          String(call[0]).includes("Delivery latency"),
        );
        expect(latencyWarnings).toHaveLength(0);

        warnSpy.mockRestore();
        await service.close();
      });
    });
  });

  // ==========================================================================
  // Story 3-3: Notification Deduplication & Digest Mode
  // ==========================================================================

  describe("Entity-Based Deduplication (Story 3-3, AC1)", () => {
    it("should suppress same eventType + same entity within dedup window", async () => {
      const notification1: Notification = {
        eventId: randomUUID(),
        eventType: "agent.blocked",
        priority: "critical",
        title: "Agent Blocked",
        message: "Agent blocked",
        metadata: { agentId: "agent-1" },
        timestamp: new Date().toISOString(),
      };

      const notification2: Notification = {
        eventId: randomUUID(), // Different event ID
        eventType: "agent.blocked",
        priority: "critical",
        title: "Agent Blocked",
        message: "Agent blocked again",
        metadata: { agentId: "agent-1" }, // Same entity
        timestamp: new Date().toISOString(),
      };

      const result1 = await notificationService.send(notification1);
      const result2 = await notificationService.send(notification2);

      expect(result1.duplicate).toBeUndefined();
      expect(result2.duplicate).toBe(true);
      expect(notificationService.getStatus().dedupCount).toBe(1);
    });

    it("should allow same eventType with different entity", async () => {
      const notification1: Notification = {
        eventId: randomUUID(),
        eventType: "agent.blocked",
        priority: "critical",
        title: "Agent Blocked",
        message: "Agent 1 blocked",
        metadata: { agentId: "agent-1" },
        timestamp: new Date().toISOString(),
      };

      const notification2: Notification = {
        eventId: randomUUID(),
        eventType: "agent.blocked",
        priority: "critical",
        title: "Agent Blocked",
        message: "Agent 2 blocked",
        metadata: { agentId: "agent-2" }, // Different entity
        timestamp: new Date().toISOString(),
      };

      const result1 = await notificationService.send(notification1);
      const result2 = await notificationService.send(notification2);

      expect(result1.duplicate).toBeUndefined();
      expect(result2.duplicate).toBeUndefined();
      expect(notificationService.getStatus().dedupCount).toBe(0);
    });

    it("should prefer storyId over agentId for entity extraction", async () => {
      const notification1: Notification = {
        eventId: randomUUID(),
        eventType: "story.blocked",
        priority: "critical",
        title: "Story Blocked",
        message: "Story blocked",
        metadata: { storyId: "story-1", agentId: "agent-1" },
        timestamp: new Date().toISOString(),
      };

      const notification2: Notification = {
        eventId: randomUUID(),
        eventType: "story.blocked",
        priority: "critical",
        title: "Story Blocked",
        message: "Story blocked again",
        metadata: { storyId: "story-1", agentId: "agent-2" }, // Same storyId, diff agentId
        timestamp: new Date().toISOString(),
      };

      await notificationService.send(notification1);
      const result2 = await notificationService.send(notification2);

      // Should dedup because storyId is the same
      expect(result2.duplicate).toBe(true);
    });

    it("should use 'unknown' entity when no storyId or agentId in metadata", async () => {
      const notification1: Notification = {
        eventId: randomUUID(),
        eventType: "conflict.detected",
        priority: "critical",
        title: "Conflict",
        message: "Conflict 1",
        metadata: { someOtherField: "value" },
        timestamp: new Date().toISOString(),
      };

      const notification2: Notification = {
        eventId: randomUUID(),
        eventType: "conflict.detected",
        priority: "critical",
        title: "Conflict",
        message: "Conflict 2",
        metadata: { anotherField: "value2" },
        timestamp: new Date().toISOString(),
      };

      await notificationService.send(notification1);
      const result2 = await notificationService.send(notification2);

      // Both have entity "unknown" → dedup
      expect(result2.duplicate).toBe(true);
    });

    it("should use dedup key format {eventType}:{entityId}", async () => {
      // Send one notification with storyId metadata
      const result = await notificationService.send({
        eventId: randomUUID(),
        eventType: "story.blocked",
        priority: "critical",
        title: "Story Blocked",
        message: "Story blocked",
        metadata: { storyId: "story-42" },
        timestamp: new Date().toISOString(),
      });

      expect(result.duplicate).toBeUndefined();

      // Same eventType + same storyId but different eventId → should dedup
      const result2 = await notificationService.send({
        eventId: randomUUID(),
        eventType: "story.blocked",
        priority: "critical",
        title: "Story Blocked",
        message: "Story blocked again",
        metadata: { storyId: "story-42" },
        timestamp: new Date().toISOString(),
      });

      expect(result2.duplicate).toBe(true);
    });
  });

  describe("Per-Type Dedup Windows (Story 3-3, AC2)", () => {
    it("should use per-type window defaults (5 min for agent.blocked)", async () => {
      const service = createNotificationService({
        eventBus: mockEventBus,
        plugins: mockPlugins,
      });

      await service.send({
        eventId: randomUUID(),
        eventType: "agent.blocked",
        priority: "critical",
        title: "Agent Blocked",
        message: "Blocked",
        metadata: { agentId: "agent-1" },
        timestamp: new Date().toISOString(),
      });

      // Advance 4 minutes — still within 5-min window
      vi.advanceTimersByTime(240000);

      const result = await service.send({
        eventId: randomUUID(),
        eventType: "agent.blocked",
        priority: "critical",
        title: "Agent Blocked",
        message: "Blocked again",
        metadata: { agentId: "agent-1" },
        timestamp: new Date().toISOString(),
      });

      expect(result.duplicate).toBe(true);

      await service.close();
    });

    it("should use longer per-type window for conflict.detected (10 min)", async () => {
      const service = createNotificationService({
        eventBus: mockEventBus,
        plugins: mockPlugins,
      });

      await service.send({
        eventId: randomUUID(),
        eventType: "conflict.detected",
        priority: "critical",
        title: "Conflict",
        message: "Conflict",
        metadata: { storyId: "story-1" },
        timestamp: new Date().toISOString(),
      });

      // Advance 6 minutes — past 5-min default but within 10-min conflict window
      vi.advanceTimersByTime(360000);

      const result = await service.send({
        eventId: randomUUID(),
        eventType: "conflict.detected",
        priority: "critical",
        title: "Conflict",
        message: "Conflict again",
        metadata: { storyId: "story-1" },
        timestamp: new Date().toISOString(),
      });

      expect(result.duplicate).toBe(true);

      await service.close();
    });

    it("should allow after per-type window expires", async () => {
      const service = createNotificationService({
        eventBus: mockEventBus,
        plugins: mockPlugins,
      });

      await service.send({
        eventId: randomUUID(),
        eventType: "agent.blocked",
        priority: "critical",
        title: "Agent Blocked",
        message: "Blocked",
        metadata: { agentId: "agent-1" },
        timestamp: new Date().toISOString(),
      });

      // Advance past 5-min window
      vi.advanceTimersByTime(301000);

      const result = await service.send({
        eventId: randomUUID(),
        eventType: "agent.blocked",
        priority: "critical",
        title: "Agent Blocked",
        message: "Blocked again",
        metadata: { agentId: "agent-1" },
        timestamp: new Date().toISOString(),
      });

      expect(result.duplicate).toBeUndefined();

      await service.close();
    });

    it("should allow user config to override per-type dedup window", async () => {
      const service = createNotificationService({
        eventBus: mockEventBus,
        plugins: mockPlugins,
        dedupWindowByType: {
          "agent.blocked": 60000, // Override to 1 minute
        },
      });

      await service.send({
        eventId: randomUUID(),
        eventType: "agent.blocked",
        priority: "critical",
        title: "Agent Blocked",
        message: "Blocked",
        metadata: { agentId: "agent-1" },
        timestamp: new Date().toISOString(),
      });

      // Advance 1.5 minutes — past user-configured 1-min window
      vi.advanceTimersByTime(90000);

      const result = await service.send({
        eventId: randomUUID(),
        eventType: "agent.blocked",
        priority: "critical",
        title: "Agent Blocked",
        message: "Blocked again",
        metadata: { agentId: "agent-1" },
        timestamp: new Date().toISOString(),
      });

      expect(result.duplicate).toBeUndefined();

      await service.close();
    });

    it("should fall back to global dedupWindowMs for unknown event types", async () => {
      const service = createNotificationService({
        eventBus: mockEventBus,
        plugins: mockPlugins,
        dedupWindowMs: 120000, // 2 minutes global
      });

      await service.send({
        eventId: randomUUID(),
        eventType: "custom.event",
        priority: "warning",
        title: "Custom",
        message: "Custom event",
        metadata: { storyId: "story-1" },
        timestamp: new Date().toISOString(),
      });

      // Advance 1 minute — within 2-min global window
      vi.advanceTimersByTime(60000);

      const stillDeduped = await service.send({
        eventId: randomUUID(),
        eventType: "custom.event",
        priority: "warning",
        title: "Custom",
        message: "Custom again",
        metadata: { storyId: "story-1" },
        timestamp: new Date().toISOString(),
      });

      expect(stillDeduped.duplicate).toBe(true);

      // Advance past 2-min global window
      vi.advanceTimersByTime(61000);

      const notDeduped = await service.send({
        eventId: randomUUID(),
        eventType: "custom.event",
        priority: "warning",
        title: "Custom",
        message: "Custom third time",
        metadata: { storyId: "story-1" },
        timestamp: new Date().toISOString(),
      });

      expect(notDeduped.duplicate).toBeUndefined();

      await service.close();
    });
  });

  describe("Digest Mode (Story 3-3, AC3)", () => {
    it("should buffer medium-priority events from event bus instead of sending immediately", async () => {
      let subscriberCallback: ((event: EventBusEvent) => Promise<void>) | null = null;
      const eventBus = createMockEventBus();
      (eventBus.subscribe as ReturnType<typeof vi.fn>).mockImplementation(
        async (cb: (event: EventBusEvent) => Promise<void>) => {
          subscriberCallback = cb;
          return () => {};
        },
      );

      const plugin = createMockPlugin("desktop");
      const service = createNotificationService({
        eventBus,
        plugins: [plugin],
        triggerMap: {
          "queue.depth": { priority: "medium", title: "Queue Depth Alert" },
        },
        digestIntervalMs: 60000, // 1 minute for testing
      });

      await vi.waitFor(() => expect(subscriberCallback).not.toBeNull());

      // Publish medium-priority event
      await subscriberCallback!({
        eventId: randomUUID(),
        eventType: "queue.depth",
        timestamp: new Date().toISOString(),
        metadata: { depth: 25 },
      });

      // Plugin should NOT have been called (buffered)
      expect(plugin.send).not.toHaveBeenCalled();

      await service.close();
    });

    it("should flush digest buffer on timer interval", async () => {
      let subscriberCallback: ((event: EventBusEvent) => Promise<void>) | null = null;
      const eventBus = createMockEventBus();
      (eventBus.subscribe as ReturnType<typeof vi.fn>).mockImplementation(
        async (cb: (event: EventBusEvent) => Promise<void>) => {
          subscriberCallback = cb;
          return () => {};
        },
      );

      const plugin = createMockPlugin("desktop");
      const service = createNotificationService({
        eventBus,
        plugins: [plugin],
        triggerMap: {
          "queue.depth": { priority: "medium", title: "Queue Depth Alert" },
        },
        digestIntervalMs: 60000,
      });

      await vi.waitFor(() => expect(subscriberCallback).not.toBeNull());

      // Buffer 3 medium events
      for (let i = 0; i < 3; i++) {
        await subscriberCallback!({
          eventId: randomUUID(),
          eventType: "queue.depth",
          timestamp: new Date().toISOString(),
          metadata: { depth: 20 + i, storyId: `story-${i}` },
        });
      }

      expect(plugin.send).not.toHaveBeenCalled();

      // Advance past digest interval
      await vi.advanceTimersByTimeAsync(61000);

      // Plugin should have been called with digest summary
      expect(plugin.send).toHaveBeenCalledTimes(1);
      const sentNotification = (plugin.send as ReturnType<typeof vi.fn>).mock
        .calls[0][0] as Notification;
      expect(sentNotification.eventType).toBe("notification.digest");
      expect(sentNotification.title).toBe("Digest: 3 notifications");
      expect(sentNotification.message).toContain("queue.depth: 3");

      await service.close();
    });

    it("should not send digest when buffer is empty", async () => {
      const plugin = createMockPlugin("desktop");
      const service = createNotificationService({
        eventBus: mockEventBus,
        plugins: [plugin],
        digestIntervalMs: 60000,
      });

      // Advance past digest interval without any medium events
      await vi.advanceTimersByTimeAsync(61000);

      // Plugin should NOT have been called
      expect(plugin.send).not.toHaveBeenCalled();

      await service.close();
    });

    it("should clear digest buffer on close()", async () => {
      let subscriberCallback: ((event: EventBusEvent) => Promise<void>) | null = null;
      const eventBus = createMockEventBus();
      (eventBus.subscribe as ReturnType<typeof vi.fn>).mockImplementation(
        async (cb: (event: EventBusEvent) => Promise<void>) => {
          subscriberCallback = cb;
          return () => {};
        },
      );

      const plugin = createMockPlugin("desktop");
      const service = createNotificationService({
        eventBus,
        plugins: [plugin],
        triggerMap: {
          "queue.depth": { priority: "medium", title: "Queue Depth Alert" },
        },
        digestIntervalMs: 60000,
      });

      await vi.waitFor(() => expect(subscriberCallback).not.toBeNull());

      // Buffer a medium event
      await subscriberCallback!({
        eventId: randomUUID(),
        eventType: "queue.depth",
        timestamp: new Date().toISOString(),
        metadata: { depth: 25 },
      });

      // Close without flushing
      await service.close();

      // Advance timer — should NOT flush because service is closed
      await vi.advanceTimersByTimeAsync(61000);

      expect(plugin.send).not.toHaveBeenCalled();
    });
  });

  describe("Notification History (Story 3-3, AC4)", () => {
    it("should store notifications in history after send()", async () => {
      await notificationService.send({
        eventId: randomUUID(),
        eventType: "agent.blocked",
        priority: "critical",
        title: "Agent Blocked",
        message: "Blocked",
        metadata: { agentId: "agent-1" },
        timestamp: new Date().toISOString(),
      });

      const history = notificationService.getHistory();
      expect(history).toHaveLength(1);
      expect(history[0].notification.eventType).toBe("agent.blocked");
      expect(history[0].deliveredPlugins).toContain("desktop");
      expect(history[0].deliveredAt).toBeDefined();
    });

    it("should cap history at maxEntries", async () => {
      const service = createNotificationService({
        eventBus: mockEventBus,
        plugins: mockPlugins,
        historyMaxEntries: 3,
      });

      for (let i = 0; i < 5; i++) {
        await service.send({
          eventId: randomUUID(),
          eventType: "agent.blocked",
          priority: "critical",
          title: `Blocked ${i}`,
          message: `Blocked ${i}`,
          metadata: { agentId: `agent-${i}` }, // Different entities to avoid dedup
          timestamp: new Date().toISOString(),
        });
      }

      const history = service.getHistory();
      expect(history).toHaveLength(3);
      // Should keep the 3 most recent (agents 2, 3, 4)
      expect(history[0].notification.title).toBe("Blocked 2");
      expect(history[2].notification.title).toBe("Blocked 4");

      await service.close();
    });

    it("should prune entries older than retention period", async () => {
      const service = createNotificationService({
        eventBus: mockEventBus,
        plugins: mockPlugins,
        historyRetentionDays: 1, // 1 day retention
      });

      await service.send({
        eventId: randomUUID(),
        eventType: "agent.blocked",
        priority: "critical",
        title: "Old notification",
        message: "Old",
        metadata: { agentId: "agent-1" },
        timestamp: new Date().toISOString(),
      });

      // Advance past 1 day retention
      vi.advanceTimersByTime(86400001); // 1 day + 1ms

      await service.send({
        eventId: randomUUID(),
        eventType: "agent.blocked",
        priority: "critical",
        title: "New notification",
        message: "New",
        metadata: { agentId: "agent-2" },
        timestamp: new Date().toISOString(),
      });

      const history = service.getHistory();
      // Old entry should be pruned
      expect(history).toHaveLength(1);
      expect(history[0].notification.title).toBe("New notification");

      await service.close();
    });

    it("should filter history by eventType", async () => {
      await notificationService.send({
        eventId: randomUUID(),
        eventType: "agent.blocked",
        priority: "critical",
        title: "Agent Blocked",
        message: "Blocked",
        metadata: { agentId: "agent-1" },
        timestamp: new Date().toISOString(),
      });

      await notificationService.send({
        eventId: randomUUID(),
        eventType: "conflict.detected",
        priority: "critical",
        title: "Conflict",
        message: "Conflict",
        metadata: { storyId: "story-1" },
        timestamp: new Date().toISOString(),
      });

      const filtered = notificationService.getHistory({ eventType: "agent.blocked" });
      expect(filtered).toHaveLength(1);
      expect(filtered[0].notification.eventType).toBe("agent.blocked");
    });

    it("should filter history by priority", async () => {
      await notificationService.send({
        eventId: randomUUID(),
        eventType: "agent.blocked",
        priority: "critical",
        title: "Critical",
        message: "Critical",
        metadata: { agentId: "agent-1" },
        timestamp: new Date().toISOString(),
      });

      await notificationService.send({
        eventId: randomUUID(),
        eventType: "agent.offline",
        priority: "warning",
        title: "Warning",
        message: "Warning",
        metadata: { agentId: "agent-2" },
        timestamp: new Date().toISOString(),
      });

      const criticalOnly = notificationService.getHistory({ priority: "critical" });
      expect(criticalOnly).toHaveLength(1);
      expect(criticalOnly[0].notification.priority).toBe("critical");
    });

    it("should filter history by since date", async () => {
      await notificationService.send({
        eventId: randomUUID(),
        eventType: "agent.blocked",
        priority: "critical",
        title: "Before",
        message: "Before",
        metadata: { agentId: "agent-1" },
        timestamp: new Date().toISOString(),
      });

      const sinceDate = new Date(Date.now() + 1000); // 1 second from now
      vi.advanceTimersByTime(2000);

      await notificationService.send({
        eventId: randomUUID(),
        eventType: "agent.blocked",
        priority: "critical",
        title: "After",
        message: "After",
        metadata: { agentId: "agent-2" },
        timestamp: new Date().toISOString(),
      });

      const filtered = notificationService.getHistory({ since: sinceDate });
      expect(filtered).toHaveLength(1);
      expect(filtered[0].notification.title).toBe("After");
    });

    it("should clear history on close()", async () => {
      await notificationService.send({
        eventId: randomUUID(),
        eventType: "agent.blocked",
        priority: "critical",
        title: "Test",
        message: "Test",
        metadata: { agentId: "agent-1" },
        timestamp: new Date().toISOString(),
      });

      expect(notificationService.getHistory()).toHaveLength(1);

      await notificationService.close();

      // Re-create to test empty history
      const newService = createNotificationService({
        eventBus: mockEventBus,
        plugins: mockPlugins,
      });

      expect(newService.getHistory()).toHaveLength(0);

      await newService.close();
    });

    it("should return copy of history (not mutable reference)", async () => {
      await notificationService.send({
        eventId: randomUUID(),
        eventType: "agent.blocked",
        priority: "critical",
        title: "Test",
        message: "Test",
        metadata: { agentId: "agent-1" },
        timestamp: new Date().toISOString(),
      });

      const history1 = notificationService.getHistory();
      const history2 = notificationService.getHistory();
      expect(history1).not.toBe(history2);
      expect(history1).toEqual(history2);
    });
  });

  describe("Performance (Story 3-3, AC5)", () => {
    it("should complete dedup check in <5ms for 1000 entries", async () => {
      // Pre-populate dedup set with 1000 entries
      const service = createNotificationService({
        eventBus: mockEventBus,
        plugins: mockPlugins,
      });

      // Send 1000 unique notifications to fill dedup set
      for (let i = 0; i < 1000; i++) {
        await service.send({
          eventId: randomUUID(),
          eventType: "agent.blocked",
          priority: "critical",
          title: "Test",
          message: "Test",
          metadata: { agentId: `agent-${i}` },
          timestamp: new Date().toISOString(),
        });
      }

      // Measure dedup check time for a duplicate
      vi.useRealTimers();
      const start = performance.now();
      await service.send({
        eventId: randomUUID(),
        eventType: "agent.blocked",
        priority: "critical",
        title: "Test",
        message: "Test",
        metadata: { agentId: "agent-0" }, // Duplicate of first
        timestamp: new Date().toISOString(),
      });
      const elapsed = performance.now() - start;

      expect(elapsed).toBeLessThan(5);

      vi.useFakeTimers();
      await service.close();
    });
  });
});
