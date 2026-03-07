/**
 * Tests for EventPublisher Service
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createEventPublisher } from "../src/event-publisher.js";
import type { EventBus } from "../src/types.js";

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

describe("EventPublisher", () => {
  let mockEventBus: EventBus;
  let eventPublisher: ReturnType<typeof createEventPublisher>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockEventBus = createMockEventBus();
    eventPublisher = createEventPublisher({
      eventBus: mockEventBus,
      deduplicationWindowMs: 5000,
      backupLogPath: "/tmp/test-events.jsonl",
      queueMaxSize: 10,
    });
  });

  afterEach(async () => {
    await eventPublisher.flush();
    await eventPublisher.close();
  });

  describe("publishStoryCompleted", () => {
    it("should publish story.completed event with correct metadata", async () => {
      await eventPublisher.publishStoryCompleted({
        storyId: "1-2-test-story",
        previousStatus: "in-progress",
        newStatus: "done",
        agentId: "ao-story-1",
        duration: 3600000,
        filesModified: ["src/test.ts"],
        testsPassed: 10,
        testsFailed: 0,
      });

      expect(mockEventBus.publish).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: "story.completed",
          metadata: expect.objectContaining({
            storyId: "1-2-test-story",
            previousStatus: "in-progress",
            newStatus: "done",
            agentId: "ao-story-1",
          }),
        }),
      );
    });
  });

  describe("publishStoryStarted", () => {
    it("should publish story.started event with correct metadata", async () => {
      await eventPublisher.publishStoryStarted({
        storyId: "1-3-test-story",
        agentId: "ao-story-2",
        contextHash: "abc123",
      });

      expect(mockEventBus.publish).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: "story.started",
          metadata: expect.objectContaining({
            storyId: "1-3-test-story",
            agentId: "ao-story-2",
            contextHash: "abc123",
          }),
        }),
      );
    });
  });

  describe("publishStoryBlocked", () => {
    it("should publish story.blocked event with correct metadata", async () => {
      await eventPublisher.publishStoryBlocked({
        storyId: "1-4-test-story",
        agentId: "ao-story-3",
        reason: "failed",
        exitCode: 1,
        signal: "SIGTERM",
        errorContext: "Process exited with code 1",
      });

      expect(mockEventBus.publish).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: "story.blocked",
          metadata: expect.objectContaining({
            storyId: "1-4-test-story",
            agentId: "ao-story-3",
            reason: "failed",
            exitCode: 1,
            signal: "SIGTERM",
            errorContext: "Process exited with code 1",
          }),
        }),
      );
    });
  });

  describe("publishStoryAssigned", () => {
    it("should publish story.assigned event with correct metadata", async () => {
      await eventPublisher.publishStoryAssigned({
        storyId: "1-5-test-story",
        agentId: "ao-story-4",
        previousAgentId: "ao-story-3",
        reason: "manual",
      });

      expect(mockEventBus.publish).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: "story.assigned",
          metadata: expect.objectContaining({
            storyId: "1-5-test-story",
            agentId: "ao-story-4",
            previousAgentId: "ao-story-3",
            reason: "manual",
          }),
        }),
      );
    });
  });

  describe("publishAgentResumed", () => {
    it("should publish agent.resumed event with correct metadata", async () => {
      await eventPublisher.publishAgentResumed({
        storyId: "1-6-test-story",
        previousAgentId: "ao-story-5",
        newAgentId: "ao-story-6",
        retryCount: 2,
        userMessage: "Trying again",
      });

      expect(mockEventBus.publish).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: "agent.resumed",
          metadata: expect.objectContaining({
            storyId: "1-6-test-story",
            previousAgentId: "ao-story-5",
            newAgentId: "ao-story-6",
            retryCount: 2,
            userMessage: "Trying again",
          }),
        }),
      );
    });
  });

  describe("event deduplication", () => {
    it("should deduplicate identical events within deduplication window", async () => {
      const params = {
        storyId: "1-2-test-story",
        previousStatus: "in-progress",
        newStatus: "done",
        agentId: "ao-story-1",
        duration: 3600000,
      };

      // Publish same event twice rapidly
      await eventPublisher.publishStoryCompleted(params);
      await eventPublisher.publishStoryCompleted(params);

      // Should only publish once (second call deduplicated)
      expect(mockEventBus.publish).toHaveBeenCalledTimes(1);
    });

    it("should not deduplicate events with different story IDs", async () => {
      await eventPublisher.publishStoryCompleted({
        storyId: "1-2-test-story",
        previousStatus: "in-progress",
        newStatus: "done",
        agentId: "ao-story-1",
        duration: 3600000,
      });

      await eventPublisher.publishStoryCompleted({
        storyId: "1-3-test-story",
        previousStatus: "in-progress",
        newStatus: "done",
        agentId: "ao-story-1",
        duration: 3600000,
      });

      // Both events should be published (different story IDs)
      expect(mockEventBus.publish).toHaveBeenCalledTimes(2);
    });

    it("should deduplicate different event types for same story", async () => {
      await eventPublisher.publishStoryStarted({
        storyId: "1-2-test-story",
        agentId: "ao-story-1",
        contextHash: "abc123",
      });

      await eventPublisher.publishStoryCompleted({
        storyId: "1-2-test-story",
        previousStatus: "in-progress",
        newStatus: "done",
        agentId: "ao-story-1",
        duration: 3600000,
      });

      // Both events should be published (different event types)
      expect(mockEventBus.publish).toHaveBeenCalledTimes(2);
    });
  });

  describe("degraded mode handling", () => {
    it("should queue events when EventBus is not connected", async () => {
      mockEventBus.isConnected = vi.fn(() => false);

      await eventPublisher.publishStoryCompleted({
        storyId: "1-2-test-story",
        previousStatus: "in-progress",
        newStatus: "done",
        agentId: "ao-story-1",
        duration: 3600000,
      });

      // Event should be queued
      expect(eventPublisher.getQueueSize()).toBe(1);
      expect(mockEventBus.publish).not.toHaveBeenCalled();
    });

    it("should flush queued events when flush() is called", async () => {
      mockEventBus.isConnected = vi.fn(() => false);

      // Queue some events
      await eventPublisher.publishStoryCompleted({
        storyId: "1-2-test-story",
        previousStatus: "in-progress",
        newStatus: "done",
        agentId: "ao-story-1",
        duration: 3600000,
      });
      await eventPublisher.publishStoryStarted({
        storyId: "1-3-test-story",
        agentId: "ao-story-2",
        contextHash: "abc123",
      });

      expect(eventPublisher.getQueueSize()).toBe(2);

      // Reconnect and flush
      mockEventBus.isConnected = vi.fn(() => true);
      await eventPublisher.flush();

      // All events should be published
      expect(mockEventBus.publish).toHaveBeenCalledTimes(2);
      expect(eventPublisher.getQueueSize()).toBe(0);
    });

    it("should handle queue overflow by dropping oldest events", async () => {
      mockEventBus.isConnected = vi.fn(() => false);

      const smallPublisher = createEventPublisher({
        eventBus: mockEventBus,
        queueMaxSize: 2,
      });

      // Fill queue beyond capacity
      await smallPublisher.publishStoryCompleted({
        storyId: "1-1",
        previousStatus: "in-progress",
        newStatus: "done",
        agentId: "ao-1",
        duration: 1000,
      });
      await smallPublisher.publishStoryCompleted({
        storyId: "1-2",
        previousStatus: "in-progress",
        newStatus: "done",
        agentId: "ao-2",
        duration: 1000,
      });
      await smallPublisher.publishStoryCompleted({
        storyId: "1-3",
        previousStatus: "in-progress",
        newStatus: "done",
        agentId: "ao-3",
        duration: 1000,
      });

      // Queue should be at max size (2), oldest dropped
      expect(smallPublisher.getQueueSize()).toBe(2);
    });
  });

  describe("getQueueSize", () => {
    it("should return 0 when no events are queued", () => {
      expect(eventPublisher.getQueueSize()).toBe(0);
    });

    it("should return correct queue size when events are queued", async () => {
      mockEventBus.isConnected = vi.fn(() => false);

      await eventPublisher.publishStoryCompleted({
        storyId: "1-1",
        previousStatus: "in-progress",
        newStatus: "done",
        agentId: "ao-1",
        duration: 1000,
      });
      await eventPublisher.publishStoryStarted({
        storyId: "1-2",
        agentId: "ao-2",
        contextHash: "abc",
      });

      expect(eventPublisher.getQueueSize()).toBe(2);
    });
  });

  describe("backup log", () => {
    // Clean up test files before each test
    beforeEach(async () => {
      const { unlink } = await import("node:fs/promises");
      const { existsSync } = await import("node:fs");
      const testFiles = [
        "/tmp/test-event-publisher-backup.jsonl",
        "/tmp/test-event-publisher-rotation.jsonl",
      ];
      for (const file of testFiles) {
        if (existsSync(file)) {
          try {
            await unlink(file);
          } catch {
            // Ignore cleanup errors
          }
        }
      }
    });

    // Clean up test files after each test
    afterEach(async () => {
      const { unlink } = await import("node:fs/promises");
      const { existsSync } = await import("node:fs");
      const testFiles = [
        "/tmp/test-event-publisher-backup.jsonl",
        "/tmp/test-event-publisher-rotation.jsonl",
      ];
      for (const file of testFiles) {
        if (existsSync(file)) {
          try {
            await unlink(file);
          } catch {
            // Ignore cleanup errors
          }
        }
      }
    });

    it("should write queued events to backup log in JSONL format", async () => {
      mockEventBus.isConnected = vi.fn(() => false);

      const testBackupLog = "/tmp/test-event-publisher-backup.jsonl";

      const publisher = createEventPublisher({
        eventBus: mockEventBus,
        backupLogPath: testBackupLog,
      });

      await publisher.publishStoryCompleted({
        storyId: "1-1",
        previousStatus: "in-progress",
        newStatus: "done",
        agentId: "ao-1",
        duration: 1000,
      });

      // Wait for async backup write
      await new Promise((resolve) => setTimeout(resolve, 100));

      const { readFile } = await import("node:fs/promises");
      const { existsSync } = await import("node:fs");
      expect(existsSync(testBackupLog)).toBe(true);

      const content = await readFile(testBackupLog, "utf-8");
      const lines = content.trim().split("\n");

      // Should have exactly one line
      expect(lines).toHaveLength(1);

      // Should be valid JSON
      const event = JSON.parse(lines[0]);
      expect(event.eventType).toBe("story.completed");
      expect(event.metadata.storyId).toBe("1-1");

      await publisher.close();
    });

    it("should append multiple events to backup log", async () => {
      mockEventBus.isConnected = vi.fn(() => false);

      const testBackupLog = "/tmp/test-event-publisher-backup.jsonl";

      const publisher = createEventPublisher({
        eventBus: mockEventBus,
        backupLogPath: testBackupLog,
      });

      await publisher.publishStoryCompleted({
        storyId: "1-1",
        previousStatus: "in-progress",
        newStatus: "done",
        agentId: "ao-1",
        duration: 1000,
      });

      await publisher.publishStoryStarted({
        storyId: "1-2",
        agentId: "ao-2",
        contextHash: "abc",
      });

      // Wait for async backup writes
      await new Promise((resolve) => setTimeout(resolve, 100));

      const { readFile } = await import("node:fs/promises");
      const { existsSync } = await import("node:fs");
      expect(existsSync(testBackupLog)).toBe(true);

      const content = await readFile(testBackupLog, "utf-8");
      const lines = content.trim().split("\n");

      // Should have two lines
      expect(lines).toHaveLength(2);

      // Each line should be valid JSON
      const event1 = JSON.parse(lines[0]);
      const event2 = JSON.parse(lines[1]);

      // Both events should be present (order may vary due to async writes)
      const eventTypes = new Set([event1.eventType, event2.eventType]);
      expect(eventTypes).toContain("story.completed");
      expect(eventTypes).toContain("story.started");

      await publisher.close();
    });

    it("should validate JSONL format - each line is complete JSON", async () => {
      mockEventBus.isConnected = vi.fn(() => false);

      const testBackupLog = "/tmp/test-event-publisher-backup.jsonl";

      const publisher = createEventPublisher({
        eventBus: mockEventBus,
        backupLogPath: testBackupLog,
      });

      await publisher.publishStoryBlocked({
        storyId: "1-1",
        reason: "failed",
        exitCode: 1,
      });

      // Wait for async backup write
      await new Promise((resolve) => setTimeout(resolve, 100));

      const { readFile } = await import("node:fs/promises");
      const { existsSync } = await import("node:fs");
      expect(existsSync(testBackupLog)).toBe(true);

      const content = await readFile(testBackupLog, "utf-8");

      // Verify each line can be parsed as JSON
      const lines = content.trim().split("\n");
      lines.forEach((line) => {
        expect(() => JSON.parse(line)).not.toThrow();
        const parsed = JSON.parse(line);
        expect(parsed).toHaveProperty("eventId");
        expect(parsed).toHaveProperty("eventType");
        expect(parsed).toHaveProperty("timestamp");
        expect(parsed).toHaveProperty("metadata");
      });

      await publisher.close();
    });

    it("should rotate backup log when size exceeds limit", async () => {
      mockEventBus.isConnected = vi.fn(() => false);

      const testBackupLog = "/tmp/test-event-publisher-rotation.jsonl";
      const { unlink } = await import("node:fs/promises");
      const { existsSync } = await import("node:fs");

      // Clean up before test
      if (existsSync(testBackupLog)) {
        await unlink(testBackupLog);
      }

      // Create initial log with some events
      const { writeFile } = await import("node:fs/promises");
      const initialEvents = Array(10)
        .fill(null)
        .map(
          (_, i) =>
            JSON.stringify({
              eventId: `event-${i}`,
              eventType: "test",
              timestamp: new Date().toISOString(),
              metadata: { index: i },
            }) + "\n",
        )
        .join("");
      await writeFile(testBackupLog, initialEvents);

      // Get file size to set rotation threshold just above it
      const { stat, readFile } = await import("node:fs/promises");
      const stats = await stat(testBackupLog);

      const publisher = createEventPublisher({
        eventBus: mockEventBus,
        backupLogPath: testBackupLog,
        backupLogMaxSize: stats.size, // Set max size to current file size
      });

      // Publish one more event to trigger rotation
      await publisher.publishStoryCompleted({
        storyId: "1-1",
        previousStatus: "in-progress",
        newStatus: "done",
        agentId: "ao-1",
        duration: 1000,
      });

      // Wait for async write and rotation
      await new Promise((resolve) => setTimeout(resolve, 200));

      // Verify file was rotated (should have fewer entries now)
      const content = await readFile(testBackupLog, "utf-8");
      const lines = content.trim().split("\n");

      // After rotation, should have roughly half the entries (5 original + 1 new)
      expect(lines.length).toBeLessThan(10);
      expect(lines.length).toBeGreaterThan(0);

      await publisher.close();

      // Clean up after test
      if (existsSync(testBackupLog)) {
        await unlink(testBackupLog).catch(() => {});
      }
    });

    it("should handle backup log rotation errors gracefully", async () => {
      mockEventBus.isConnected = vi.fn(() => false);

      const testBackupLog = "/tmp/test-event-publisher-backup.jsonl";

      const publisher = createEventPublisher({
        eventBus: mockEventBus,
        backupLogPath: testBackupLog,
        backupLogMaxSize: 1, // Very small size to trigger rotation
      });

      // Publish event - should handle rotation without throwing
      await expect(
        publisher.publishStoryCompleted({
          storyId: "1-1",
          previousStatus: "in-progress",
          newStatus: "done",
          agentId: "ao-1",
          duration: 1000,
        }),
      ).resolves.toBeUndefined();

      await publisher.close();
    });
  });

  describe("close() cleanup", () => {
    it("should clear deduplication cache on close", async () => {
      await eventPublisher.publishStoryCompleted({
        storyId: "1-1",
        previousStatus: "in-progress",
        newStatus: "done",
        agentId: "ao-1",
        duration: 1000,
      });

      // Event should be in deduplication cache
      await eventPublisher.publishStoryCompleted({
        storyId: "1-1",
        previousStatus: "in-progress",
        newStatus: "done",
        agentId: "ao-1",
        duration: 1000,
      });

      // Should only publish once (deduplicated)
      expect(mockEventBus.publish).toHaveBeenCalledTimes(1);

      await eventPublisher.close();

      // After close, cache is cleared, so event should publish again
      mockEventBus.publish = vi.fn(async () => {});

      await eventPublisher.publishStoryCompleted({
        storyId: "1-1",
        previousStatus: "in-progress",
        newStatus: "done",
        agentId: "ao-1",
        duration: 1000,
      });

      // Should publish again since cache was cleared
      expect(mockEventBus.publish).toHaveBeenCalledTimes(1);
    });
  });
});
