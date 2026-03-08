/**
 * CLI Events Command Tests
 *
 * Test coverage for:
 * - ao events drain command
 * - ao events status command
 * - Service registry integration
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { Command } from "commander";
import { unlink } from "node:fs/promises";
import { registerEvents } from "../../src/commands/events.js";
import {
  registerEventPublisher,
  registerDegradedModeService,
  clearServiceRegistry,
  createDegradedModeService,
  createEventPublisher,
} from "@composio/ao-core";

// Mock loadConfig to return a valid config
vi.mock("@composio/ao-core", async () => {
  const actual = await vi.importActual("@composio/ao-core");
  return {
    ...(actual as object),
    loadConfig: vi.fn(() => ({
      stateDir: "/tmp/test-ao-state",
    })),
  };
});

// Mock EventBus
const createMockEventBus = () => ({
  name: "mock-event-bus",
  publish: vi.fn(async () => {}),
  subscribe: vi.fn(async () => () => {}),
  isConnected: vi.fn(() => true),
  isDegraded: vi.fn(() => false),
  getQueueSize: vi.fn(() => 0),
  close: vi.fn(async () => {}),
});

describe("CLI Events Command", () => {
  let mockEventBus: ReturnType<typeof createMockEventBus>;
  let eventPublisher: ReturnType<typeof createEventPublisher>;
  let degradedMode: ReturnType<typeof createDegradedModeService>;
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
  let processExitSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    vi.clearAllMocks();
    mockEventBus = createMockEventBus();

    // Create degraded mode service
    degradedMode = createDegradedModeService({
      eventsBackupPath: "/tmp/test-cli-events.jsonl",
      syncBackupPath: "/tmp/test-cli-syncs.jsonl",
      healthCheckIntervalMs: 100,
      recoveryTimeoutMs: 5000,
    });

    // Create event publisher
    eventPublisher = createEventPublisher({
      eventBus: mockEventBus,
      deduplicationWindowMs: 5000,
      backupLogPath: "/tmp/test-cli-events-backup.jsonl",
      queueMaxSize: 100,
      degradedModeService: degradedMode,
    });

    // Register services for CLI access
    registerDegradedModeService(degradedMode);
    registerEventPublisher(eventPublisher);

    // Start degraded mode
    await degradedMode.start();

    // Mock console and process.exit
    consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    processExitSpy = vi.spyOn(process, "exit").mockImplementation((() => {}) as never);
  });

  afterEach(async () => {
    await degradedMode.stop();
    clearServiceRegistry();

    // Cleanup test files
    try {
      await unlink("/tmp/test-cli-events.jsonl");
      await unlink("/tmp/test-cli-syncs.jsonl");
      await unlink("/tmp/test-cli-events-backup.jsonl");
    } catch {
      // Ignore errors
    }

    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    processExitSpy.mockRestore();
  });

  describe("drain command", () => {
    it("should show drain status when no events are queued", async () => {
      const program = new Command();
      registerEvents(program);
      await program.parseAsync(["events", "drain"], { from: "user" });

      const calls = consoleLogSpy.mock.calls;
      const allOutput = calls.flat().join("\n");
      expect(allOutput).toContain("Event Drain Status");
      expect(allOutput).toContain("No queued events to drain");
    });

    it("should show drain status with queued events", async () => {
      // Publish an event while event bus is unavailable
      mockEventBus.isConnected = vi.fn(() => false);

      await eventPublisher.publishStoryCompleted({
        storyId: "test-story",
        previousStatus: "in-progress",
        newStatus: "done",
        agentId: "test-agent",
        duration: 1000,
        filesModified: [],
      });

      // Reset event bus to available
      mockEventBus.isConnected = vi.fn(() => true);

      const program = new Command();
      registerEvents(program);
      await program.parseAsync(["events", "drain"], { from: "user" });

      const allOutput = consoleLogSpy.mock.calls.flat().join("\n");
      expect(allOutput).toContain("Event Drain Status");
      expect(allOutput).toContain("Queued events:");
    });

    it("should force drain with --force flag", async () => {
      // Publish an event while event bus is unavailable
      mockEventBus.isConnected = vi.fn(() => false);

      await eventPublisher.publishStoryCompleted({
        storyId: "test-story",
        previousStatus: "in-progress",
        newStatus: "done",
        agentId: "test-agent",
        duration: 1000,
        filesModified: [],
      });

      // Reset event bus to available
      mockEventBus.isConnected = vi.fn(() => true);

      const program = new Command();
      registerEvents(program);
      await program.parseAsync(["events", "drain", "--force"], { from: "user" });

      const allOutput = consoleLogSpy.mock.calls.flat().join("\n");
      expect(allOutput).toContain("Force draining queued events");
      expect(allOutput).toContain("Drain completed");
    });

    it("should output JSON with --json flag", async () => {
      const program = new Command();
      registerEvents(program);
      await program.parseAsync(["events", "drain", "--json"], { from: "user" });

      const lastCall = consoleLogSpy.mock.calls[consoleLogSpy.mock.calls.length - 1];
      const jsonOutput = JSON.parse(lastCall[0] as string);
      expect(jsonOutput).toHaveProperty("eventBusAvailable");
      expect(jsonOutput).toHaveProperty("queuedEvents");
      expect(jsonOutput).toHaveProperty("droppedEvents");
    });

    it("should show warning when event bus is unavailable without --force", async () => {
      // Set event bus as unavailable
      mockEventBus.isConnected = vi.fn(() => false);

      // Publish an event to create queue
      await eventPublisher.publishStoryCompleted({
        storyId: "test-story",
        previousStatus: "in-progress",
        newStatus: "done",
        agentId: "test-agent",
        duration: 1000,
        filesModified: [],
      });

      // Wait for health check to run and update status
      await new Promise((resolve) => setTimeout(resolve, 150));

      const program = new Command();
      registerEvents(program);
      await program.parseAsync(["events", "drain"], { from: "user" });

      const errorOutput = consoleErrorSpy.mock.calls.flat().join("\n");
      expect(errorOutput).toContain("Event bus is currently unavailable");
      expect(processExitSpy).toHaveBeenCalledWith(1);
    });
  });

  describe("status command", () => {
    it("should show queue status", async () => {
      const program = new Command();
      registerEvents(program);
      await program.parseAsync(["events", "status"], { from: "user" });

      const allOutput = consoleLogSpy.mock.calls.flat().join("\n");
      expect(allOutput).toContain("Event Queue Status");
      expect(allOutput).toContain("Degraded mode");
      expect(allOutput).toContain("Publisher registered: Yes");
    });

    it("should show dropped events count", async () => {
      // Force some events to be dropped by filling the queue
      const smallQueuePublisher = createEventPublisher({
        eventBus: mockEventBus,
        deduplicationWindowMs: 5000,
        backupLogPath: "/tmp/test-cli-drop-events.jsonl",
        queueMaxSize: 2, // Very small queue
        degradedModeService: degradedMode,
      });

      // Publish more events than queue size
      mockEventBus.isConnected = vi.fn(() => false);

      for (let i = 0; i < 5; i++) {
        await smallQueuePublisher.publishStoryCompleted({
          storyId: `story-${i}`,
          previousStatus: "in-progress",
          newStatus: "done",
          agentId: "test-agent",
          duration: 1000,
          filesModified: [],
        });
      }

      const droppedCount = smallQueuePublisher.getDroppedEventsCount();
      expect(droppedCount).toBeGreaterThan(0);
    });

    it("should output JSON with --json flag", async () => {
      const program = new Command();
      registerEvents(program);
      await program.parseAsync(["events", "status", "--json"], { from: "user" });

      const lastCall = consoleLogSpy.mock.calls[consoleLogSpy.mock.calls.length - 1];
      const jsonOutput = JSON.parse(lastCall[0] as string);
      expect(jsonOutput).toHaveProperty("mode");
      expect(jsonOutput).toHaveProperty("publisherRegistered");
      expect(jsonOutput.publisherRegistered).toBe(true);
    });
  });
});
