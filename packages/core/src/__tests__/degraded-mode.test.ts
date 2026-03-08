/**
 * Tests for DegradedModeService
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { createDegradedModeService, type DegradedModeConfig } from "../degraded-mode.js";

describe("DegradedModeService", () => {
  let service: ReturnType<typeof createDegradedModeService>;
  let tempDir: string;
  let config: DegradedModeConfig;

  beforeEach(async () => {
    // Create temp directory for backup files
    tempDir = `/tmp/degraded-mode-test-${Date.now()}`;
    await mkdir(tempDir, { recursive: true });

    config = {
      eventsBackupPath: join(tempDir, "events.jsonl"),
      syncBackupPath: join(tempDir, "syncs.jsonl"),
      maxEventQueueSize: 100,
      maxSyncQueueSize: 50,
      healthCheckIntervalMs: 100, // Fast interval for tests
      recoveryTimeoutMs: 5000,
    };

    service = createDegradedModeService(config);
    vi.useFakeTimers();
  });

  afterEach(async () => {
    vi.useRealTimers();
    await service.stop();
    try {
      await rm(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe("initialization", () => {
    it("creates service with default config", () => {
      const defaultService = createDegradedModeService({
        eventsBackupPath: "/tmp/events.jsonl",
        syncBackupPath: "/tmp/syncs.jsonl",
      });
      expect(defaultService).toBeDefined();
    });

    it("starts with normal mode", async () => {
      await service.start();
      expect(service.isDegraded()).toBe(false);
      const status = service.getStatus();
      expect(status.mode).toBe("normal");
    });
  });

  describe("service health checks", () => {
    it("registers health check for event-bus", async () => {
      const mockHealthCheck = vi.fn().mockResolvedValue(true);
      service.registerHealthCheck("event-bus", mockHealthCheck);

      await service.start();
      await vi.advanceTimersByTimeAsync(100);

      expect(mockHealthCheck).toHaveBeenCalled();
    });

    it("registers health check for bmad-tracker", async () => {
      const mockHealthCheck = vi.fn().mockResolvedValue(true);
      service.registerHealthCheck("bmad-tracker", mockHealthCheck);

      await service.start();
      await vi.advanceTimersByTimeAsync(100);

      expect(mockHealthCheck).toHaveBeenCalled();
    });

    it("detects event bus unavailability", async () => {
      const eventBusHealthCheck = vi.fn().mockResolvedValue(false);
      service.registerHealthCheck("event-bus", eventBusHealthCheck);

      await service.start();
      await vi.advanceTimersByTimeAsync(100);

      const status = service.getStatus();
      expect(status.mode).toBe("event-bus-unavailable");
      expect(status.services["event-bus"]?.available).toBe(false);
    });

    it("detects BMAD tracker unavailability", async () => {
      const bmadHealthCheck = vi.fn().mockResolvedValue(false);
      service.registerHealthCheck("bmad-tracker", bmadHealthCheck);

      await service.start();
      await vi.advanceTimersByTimeAsync(100);

      const status = service.getStatus();
      expect(status.mode).toBe("bmad-unavailable");
      expect(status.services["bmad-tracker"]?.available).toBe(false);
    });

    it("detects multiple services unavailable", async () => {
      const eventBusCheck = vi.fn().mockResolvedValue(false);
      const bmadCheck = vi.fn().mockResolvedValue(false);
      service.registerHealthCheck("event-bus", eventBusCheck);
      service.registerHealthCheck("bmad-tracker", bmadCheck);

      await service.start();
      await vi.advanceTimersByTimeAsync(100);

      const status = service.getStatus();
      expect(status.mode).toBe("multiple-services-unavailable");
    });
  });

  describe("event queuing", () => {
    it("queues events when event bus is unavailable", async () => {
      const eventBusCheck = vi.fn().mockResolvedValue(false);
      service.registerHealthCheck("event-bus", eventBusCheck);

      await service.start();
      await vi.advanceTimersByTimeAsync(100);

      await service.queueEvent({ type: "test-event", data: "test" });

      const status = service.getStatus();
      expect(status.queuedEvents).toBe(1);
    });

    it("drops oldest events when queue is full", async () => {
      const eventBusCheck = vi.fn().mockResolvedValue(false);
      service.registerHealthCheck("event-bus", eventBusCheck);

      await service.start();
      await vi.advanceTimersByTimeAsync(100);

      // Fill queue to max capacity
      for (let i = 0; i < 105; i++) {
        await service.queueEvent({ type: `event-${i}`, data: `data-${i}` });
      }

      const status = service.getStatus();
      expect(status.queuedEvents).toBeLessThanOrEqual(100);
    });

    it("persists queued events to backup file", async () => {
      const eventBusCheck = vi.fn().mockResolvedValue(false);
      service.registerHealthCheck("event-bus", eventBusCheck);

      await service.start();
      await vi.advanceTimersByTimeAsync(100);

      await service.queueEvent({ type: "test-event", data: "test" });
      await service.queueEvent({ type: "test-event-2", data: "test-2" });

      // Wait for file write
      await vi.advanceTimersByTimeAsync(50);

      const { readFile } = await import("node:fs/promises");
      const content = await readFile(config.eventsBackupPath, "utf-8");
      const lines = content.trim().split("\n");
      expect(lines.length).toBe(2);
    });

    it("gets queued events for draining", async () => {
      const eventBusCheck = vi.fn().mockResolvedValue(false);
      service.registerHealthCheck("event-bus", eventBusCheck);

      await service.start();
      await vi.advanceTimersByTimeAsync(100);

      await service.queueEvent({ type: "test-event", data: "test" });
      await service.queueEvent({ type: "test-event-2", data: "test-2" });

      const queued = service.getQueuedEvents();
      expect(queued).toHaveLength(2);
    });

    it("clears drained events", async () => {
      const eventBusCheck = vi.fn().mockResolvedValue(false);
      service.registerHealthCheck("event-bus", eventBusCheck);

      await service.start();
      await vi.advanceTimersByTimeAsync(100);

      await service.queueEvent({ type: "test-event", data: "test" });
      await service.queueEvent({ type: "test-event-2", data: "test-2" });
      await service.queueEvent({ type: "test-event-3", data: "test-3" });

      service.clearDrainedEvents(2);

      const status = service.getStatus();
      expect(status.queuedEvents).toBe(1);
    });
  });

  describe("sync operation queuing", () => {
    it("queues sync operations when BMAD is unavailable", async () => {
      const bmadCheck = vi.fn().mockResolvedValue(false);
      service.registerHealthCheck("bmad-tracker", bmadCheck);

      await service.start();
      await vi.advanceTimersByTimeAsync(100);

      await service.queueSyncOperation("update-story", { storyId: "test" });

      const status = service.getStatus();
      expect(status.queuedSyncs).toBe(1);
    });

    it("drops oldest syncs when queue is full", async () => {
      const bmadCheck = vi.fn().mockResolvedValue(false);
      service.registerHealthCheck("bmad-tracker", bmadCheck);

      await service.start();
      await vi.advanceTimersByTimeAsync(100);

      // Fill queue to max capacity
      for (let i = 0; i < 55; i++) {
        await service.queueSyncOperation("update-story", { storyId: `test-${i}` });
      }

      const status = service.getStatus();
      expect(status.queuedSyncs).toBeLessThanOrEqual(50);
    });

    it("persists queued syncs to backup file", async () => {
      const bmadCheck = vi.fn().mockResolvedValue(false);
      service.registerHealthCheck("bmad-tracker", bmadCheck);

      await service.start();
      await vi.advanceTimersByTimeAsync(100);

      await service.queueSyncOperation("update-story", { storyId: "test" });
      await service.queueSyncOperation("update-story", { storyId: "test-2" });

      // Wait for file write
      await vi.advanceTimersByTimeAsync(50);

      const { readFile } = await import("node:fs/promises");
      const content = await readFile(config.syncBackupPath, "utf-8");
      const lines = content.trim().split("\n");
      expect(lines.length).toBe(2);
    });

    it("gets queued syncs for draining", async () => {
      const bmadCheck = vi.fn().mockResolvedValue(false);
      service.registerHealthCheck("bmad-tracker", bmadCheck);

      await service.start();
      await vi.advanceTimersByTimeAsync(100);

      await service.queueSyncOperation("update-story", { storyId: "test" });
      await service.queueSyncOperation("update-story", { storyId: "test-2" });

      const queued = service.getQueuedSyncs();
      expect(queued).toHaveLength(2);
    });

    it("clears drained syncs", async () => {
      const bmadCheck = vi.fn().mockResolvedValue(false);
      service.registerHealthCheck("bmad-tracker", bmadCheck);

      await service.start();
      await vi.advanceTimersByTimeAsync(100);

      await service.queueSyncOperation("update-story", { storyId: "test" });
      await service.queueSyncOperation("update-story", { storyId: "test-2" });
      await service.queueSyncOperation("update-story", { storyId: "test-3" });

      service.clearDrainedSyncs(2);

      const status = service.getStatus();
      expect(status.queuedSyncs).toBe(1);
    });
  });

  describe("state transitions", () => {
    it("enters degraded mode when service fails", async () => {
      const eventBusCheck = vi.fn().mockResolvedValue(true);
      service.registerHealthCheck("event-bus", eventBusCheck);

      await service.start();
      await vi.advanceTimersByTimeAsync(100);

      expect(service.isDegraded()).toBe(false);

      // Service fails
      eventBusCheck.mockResolvedValue(false);
      await vi.advanceTimersByTimeAsync(100);

      expect(service.isDegraded()).toBe(true);
      const status = service.getStatus();
      expect(status.enteredAt).toBeDefined();
    });

    it("exits degraded mode when service recovers", async () => {
      const eventBusCheck = vi.fn().mockResolvedValue(false);
      service.registerHealthCheck("event-bus", eventBusCheck);

      await service.start();
      await vi.advanceTimersByTimeAsync(100);

      expect(service.isDegraded()).toBe(true);

      // Service recovers
      eventBusCheck.mockResolvedValue(true);
      await vi.advanceTimersByTimeAsync(100);

      await vi.advanceTimersByTimeAsync(100); // Wait for recovery timer

      const status = service.getStatus();
      expect(status.mode).toBe("normal");
    });

    it("transitions between degraded modes", async () => {
      const eventBusCheck = vi.fn().mockResolvedValue(false);
      const bmadCheck = vi.fn().mockResolvedValue(true);
      service.registerHealthCheck("event-bus", eventBusCheck);
      service.registerHealthCheck("bmad-tracker", bmadCheck);

      await service.start();
      await vi.advanceTimersByTimeAsync(100);

      expect(service.getStatus().mode).toBe("event-bus-unavailable");

      // Both services fail
      bmadCheck.mockResolvedValue(false);
      await vi.advanceTimersByTimeAsync(100);

      expect(service.getStatus().mode).toBe("multiple-services-unavailable");

      // Event bus recovers
      eventBusCheck.mockResolvedValue(true);
      await vi.advanceTimersByTimeAsync(100);

      expect(service.getStatus().mode).toBe("bmad-unavailable");
    });
  });

  describe("recovery", () => {
    it("starts recovery when exiting degraded mode", async () => {
      const eventBusCheck = vi.fn().mockResolvedValue(false);
      service.registerHealthCheck("event-bus", eventBusCheck);

      await service.start();
      await vi.advanceTimersByTimeAsync(100);

      await service.queueEvent({ type: "test-event", data: "test" });
      await service.queueEvent({ type: "test-event-2", data: "test-2" });

      // Service recovers
      eventBusCheck.mockResolvedValue(true);
      await vi.advanceTimersByTimeAsync(100);

      // Recovery should start (logging happens, we can't directly test timer behavior)
      const status = service.getStatus();
      expect(status.mode).toBe("normal");
    });
  });

  describe("local state operational", () => {
    it("sets local state operational status", () => {
      service.setLocalStateOperational(false);
      const status = service.getStatus();
      expect(status.localStateOperational).toBe(false);

      service.setLocalStateOperational(true);
      const status2 = service.getStatus();
      expect(status2.localStateOperational).toBe(true);
    });
  });

  describe("status reporting", () => {
    it("returns complete status", async () => {
      const eventBusCheck = vi.fn().mockResolvedValue(true);
      const bmadCheck = vi.fn().mockResolvedValue(true);
      service.registerHealthCheck("event-bus", eventBusCheck);
      service.registerHealthCheck("bmad-tracker", bmadCheck);

      await service.start();
      await vi.advanceTimersByTimeAsync(100);

      const status = service.getStatus();

      expect(status).toHaveProperty("mode");
      expect(status).toHaveProperty("services");
      expect(status).toHaveProperty("queuedEvents");
      expect(status).toHaveProperty("queuedSyncs");
      expect(status).toHaveProperty("localStateOperational");
      expect(status.services).toHaveProperty("event-bus");
      expect(status.services).toHaveProperty("bmad-tracker");
    });

    it("reports service availability correctly", async () => {
      const eventBusCheck = vi.fn().mockResolvedValue(false);
      const bmadCheck = vi.fn().mockResolvedValue(true);
      service.registerHealthCheck("event-bus", eventBusCheck);
      service.registerHealthCheck("bmad-tracker", bmadCheck);

      await service.start();
      await vi.advanceTimersByTimeAsync(100);

      const status = service.getStatus();
      expect(status.services["event-bus"]?.available).toBe(false);
      expect(status.services["bmad-tracker"]?.available).toBe(true);
    });
  });

  describe("isServiceAvailable", () => {
    it("returns true when service is available", async () => {
      const eventBusCheck = vi.fn().mockResolvedValue(true);
      service.registerHealthCheck("event-bus", eventBusCheck);

      await service.start();
      await vi.advanceTimersByTimeAsync(100);

      expect(service.isServiceAvailable("event-bus")).toBe(true);
    });

    it("returns false when service is unavailable", async () => {
      const eventBusCheck = vi.fn().mockResolvedValue(false);
      service.registerHealthCheck("event-bus", eventBusCheck);

      await service.start();
      await vi.advanceTimersByTimeAsync(100);

      expect(service.isServiceAvailable("event-bus")).toBe(false);
    });

    it("returns true for services without health checks", async () => {
      await service.start();
      await vi.advanceTimersByTimeAsync(100);

      // No health check registered for bmad-tracker
      expect(service.isServiceAvailable("bmad-tracker")).toBe(true);
    });
  });

  describe("persistence", () => {
    it("loads queued events from backup on start", async () => {
      const { writeFile } = await import("node:fs/promises");

      // Create backup file with test data
      const testEvent = {
        id: "test-id",
        timestamp: new Date().toISOString(),
        service: "event-bus",
        operation: "publish",
        data: { type: "test" },
      };
      await writeFile(config.eventsBackupPath, JSON.stringify(testEvent) + "\n", "utf-8");

      // Create new service and start it
      const newService = createDegradedModeService(config);
      await newService.start();
      await vi.advanceTimersByTimeAsync(50);

      const status = newService.getStatus();
      expect(status.queuedEvents).toBe(1);

      await newService.stop();
    });

    it("loads queued syncs from backup on start", async () => {
      const { writeFile } = await import("node:fs/promises");

      // Create backup file with test data
      const testSync = {
        id: "test-sync-id",
        timestamp: new Date().toISOString(),
        service: "bmad-tracker",
        operation: "update-story",
        data: { storyId: "test" },
      };
      await writeFile(config.syncBackupPath, JSON.stringify(testSync) + "\n", "utf-8");

      // Create new service and start it
      const newService = createDegradedModeService(config);
      await newService.start();
      await vi.advanceTimersByTimeAsync(50);

      const status = newService.getStatus();
      expect(status.queuedSyncs).toBe(1);

      await newService.stop();
    });
  });
});
