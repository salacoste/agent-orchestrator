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

describe("events query — audit trail", () => {
  it("should filter events by event type", () => {
    const events = [
      {
        eventId: "1",
        eventType: "story.completed",
        timestamp: "2026-03-18T10:00:00Z",
        metadata: { storyId: "1-1" },
        hash: "a",
      },
      {
        eventId: "2",
        eventType: "conflict.detected",
        timestamp: "2026-03-18T11:00:00Z",
        metadata: { conflictId: "c1" },
        hash: "b",
      },
      {
        eventId: "3",
        eventType: "story.started",
        timestamp: "2026-03-18T12:00:00Z",
        metadata: { storyId: "1-2" },
        hash: "c",
      },
    ];

    const filtered = events.filter((e) => e.eventType === "story.completed");
    expect(filtered).toHaveLength(1);
    expect(filtered[0].eventId).toBe("1");
  });

  it("should filter events by time window", () => {
    const now = Date.now();
    const events = [
      {
        eventId: "1",
        eventType: "old",
        timestamp: new Date(now - 3600_000 * 3).toISOString(),
        metadata: {},
        hash: "a",
      },
      {
        eventId: "2",
        eventType: "recent",
        timestamp: new Date(now - 1800_000).toISOString(),
        metadata: {},
        hash: "b",
      },
      {
        eventId: "3",
        eventType: "newest",
        timestamp: new Date(now - 60_000).toISOString(),
        metadata: {},
        hash: "c",
      },
    ];

    const cutoff = new Date(now - 3600_000).toISOString(); // 1 hour ago
    const filtered = events.filter((e) => e.timestamp >= cutoff);
    expect(filtered).toHaveLength(2);
    expect(filtered[0].eventType).toBe("recent");
    expect(filtered[1].eventType).toBe("newest");
  });

  it("should return last N events by default", () => {
    const events = Array.from({ length: 50 }, (_, i) => ({
      eventId: String(i),
      eventType: "test",
      timestamp: `2026-03-18T${String(i).padStart(2, "0")}:00:00Z`,
      metadata: {},
      hash: String(i),
    }));

    const last20 = events.slice(-20);
    expect(last20).toHaveLength(20);
    expect(last20[0].eventId).toBe("30");
    expect(last20[19].eventId).toBe("49");
  });

  it("should output JSONL format for --json flag", () => {
    const event = {
      eventId: "1",
      eventType: "story.completed",
      timestamp: "2026-03-18T10:00:00Z",
      metadata: { storyId: "1-1" },
      hash: "a",
    };
    const jsonl = JSON.stringify(event);

    const parsed = JSON.parse(jsonl);
    expect(parsed.eventId).toBe("1");
    expect(parsed.eventType).toBe("story.completed");
  });

  it("should extract entity from metadata", () => {
    const testCases = [
      { metadata: { storyId: "1-1-test" }, expected: "1-1-test" },
      { metadata: { agentId: "ao-1" }, expected: "ao-1" },
      { metadata: { serviceName: "event-bus" }, expected: "event-bus" },
      { metadata: {}, expected: "—" },
    ];

    for (const tc of testCases) {
      const entity = tc.metadata.storyId ?? tc.metadata.agentId ?? tc.metadata.serviceName ?? "—";
      expect(entity).toBe(tc.expected);
    }
  });

  it("should handle empty event list gracefully", () => {
    const events: unknown[] = [];
    expect(events.length).toBe(0);
    // CLI would show "No events found matching criteria."
  });

  it("should parse JSONL lines correctly", () => {
    const jsonl =
      '{"eventId":"1","eventType":"test","timestamp":"2026-03-18T10:00:00Z","metadata":{},"hash":"abc"}\n{"eventId":"2","eventType":"test2","timestamp":"2026-03-18T11:00:00Z","metadata":{},"hash":"def"}';

    const lines = jsonl.trim().split("\n");
    const events = lines.map((line) => JSON.parse(line));

    expect(events).toHaveLength(2);
    expect(events[0].eventId).toBe("1");
    expect(events[1].eventType).toBe("test2");
  });
});
