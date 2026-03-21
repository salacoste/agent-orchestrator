/**
 * Tests for Story 2-2 Task 2: EventPublisher calls from completion/failure handlers.
 *
 * Verifies that:
 * - createCompletionHandler publishes story.completed via EventPublisher
 * - createFailureHandler publishes story.blocked via EventPublisher
 * - Handlers work gracefully when no EventPublisher is provided
 * - EventPublisher errors don't block handler execution
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createCompletionHandler, createFailureHandler } from "../completion-handlers.js";
import type { AgentRegistry, AgentAssignment, AgentStatus, EventPublisher } from "../types.js";

// Mock tmux log capture (not relevant for these tests)
vi.mock("../log-capture.js", () => ({
  captureTmuxSessionLogs: vi.fn().mockResolvedValue(undefined),
  getLogFilePath: vi.fn(() => "/tmp/mock-log.txt"),
  storeLogPathInMetadata: vi.fn().mockResolvedValue(undefined),
}));

function createTempProject(): { dir: string; configPath: string } {
  const dir = mkdtempSync(join(tmpdir(), "ao-completion-events-"));
  mkdirSync(join(dir, ".audit"), { recursive: true });

  writeFileSync(
    join(dir, "sprint-status.yaml"),
    "development_status:\n  test-story: in-progress\n",
    "utf-8",
  );

  const configPath = join(dir, "agent-orchestrator.yaml");
  writeFileSync(configPath, "# mock config\n", "utf-8");

  return { dir, configPath };
}

function createMockRegistry(): AgentRegistry {
  const assignments = new Map<string, AgentAssignment>();
  return {
    getByAgent: (id: string) => assignments.get(id) ?? null,
    list: () => Array.from(assignments.values()),
    getByStory: (storyId: string) => {
      for (const a of assignments.values()) {
        if (a.storyId === storyId) return a;
      }
      return null;
    },
    findActiveByStory: (storyId: string) => {
      for (const a of assignments.values()) {
        if (a.storyId === storyId && a.status === "active") return a;
      }
      return null;
    },
    register: (a: AgentAssignment) => assignments.set(a.agentId, a),
    remove: (id: string) => assignments.delete(id),
    updateStatus: (id: string, status: AgentStatus) => {
      const a = assignments.get(id);
      if (a) a.status = status;
    },
    getZombies: () => [],
    reload: async () => {},
    getRetryCount: () => 0,
    incrementRetry: () => {},
    getRetryHistory: () => null,
  };
}

function createMockEventPublisher(): EventPublisher {
  return {
    publishStoryCompleted: vi.fn().mockResolvedValue(undefined),
    publishStoryStarted: vi.fn().mockResolvedValue(undefined),
    publishStoryBlocked: vi.fn().mockResolvedValue(undefined),
    publishStoryAssigned: vi.fn().mockResolvedValue(undefined),
    publishAgentResumed: vi.fn().mockResolvedValue(undefined),
    publishStoryUnblocked: vi.fn().mockResolvedValue(undefined),
    flush: vi.fn().mockResolvedValue(undefined),
    getQueueSize: vi.fn().mockReturnValue(0),
    getDroppedEventsCount: vi.fn().mockReturnValue(0),
    close: vi.fn().mockResolvedValue(undefined),
  };
}

describe("completion handlers event publishing (Story 2-2)", () => {
  let tmp: ReturnType<typeof createTempProject>;

  beforeEach(() => {
    vi.clearAllMocks();
    tmp = createTempProject();
  });

  afterEach(() => {
    rmSync(tmp.dir, { recursive: true, force: true });
  });

  describe("createCompletionHandler with eventPublisher", () => {
    it("publishes story.completed event on agent completion", async () => {
      const registry = createMockRegistry();
      registry.register({
        agentId: "agent-1",
        storyId: "test-story",
        assignedAt: new Date(),
        status: "active",
        contextHash: "abc",
      });

      const publisher = createMockEventPublisher();
      const handler = createCompletionHandler(
        registry,
        tmp.dir,
        tmp.configPath,
        join(tmp.dir, ".audit"),
        undefined,
        undefined,
        undefined,
        publisher,
      );

      await handler({
        agentId: "agent-1",
        storyId: "test-story",
        exitCode: 0,
        completedAt: new Date(),
        duration: 5000,
      });

      expect(publisher.publishStoryCompleted).toHaveBeenCalledOnce();
      expect(publisher.publishStoryCompleted).toHaveBeenCalledWith(
        expect.objectContaining({
          storyId: "test-story",
          agentId: "agent-1",
          newStatus: "done",
          duration: 5000,
        }),
      );
    });

    it("works without eventPublisher (backward compatible)", async () => {
      const registry = createMockRegistry();
      registry.register({
        agentId: "agent-1",
        storyId: "test-story",
        assignedAt: new Date(),
        status: "active",
        contextHash: "abc",
      });

      // No eventPublisher param — should not throw
      const handler = createCompletionHandler(
        registry,
        tmp.dir,
        tmp.configPath,
        join(tmp.dir, ".audit"),
      );

      await handler({
        agentId: "agent-1",
        storyId: "test-story",
        exitCode: 0,
        completedAt: new Date(),
        duration: 5000,
      });

      // No assertion on publisher — just verifying no crash
    });
  });

  describe("createFailureHandler with eventPublisher", () => {
    it("publishes story.blocked event on agent failure", async () => {
      const registry = createMockRegistry();
      registry.register({
        agentId: "agent-1",
        storyId: "test-story",
        assignedAt: new Date(),
        status: "active",
        contextHash: "abc",
      });

      const publisher = createMockEventPublisher();
      const handler = createFailureHandler(
        registry,
        tmp.dir,
        tmp.configPath,
        join(tmp.dir, ".audit"),
        undefined,
        undefined,
        undefined,
        publisher,
      );

      await handler({
        agentId: "agent-1",
        storyId: "test-story",
        exitCode: 1,
        reason: "failed",
        failedAt: new Date(),
        duration: 3000,
      });

      expect(publisher.publishStoryBlocked).toHaveBeenCalledOnce();
      expect(publisher.publishStoryBlocked).toHaveBeenCalledWith(
        expect.objectContaining({
          storyId: "test-story",
          agentId: "agent-1",
          reason: "failed",
          exitCode: 1,
        }),
      );
    });

    it("does not publish story.blocked on disconnected (manual termination)", async () => {
      const registry = createMockRegistry();
      registry.register({
        agentId: "agent-1",
        storyId: "test-story",
        assignedAt: new Date(),
        status: "active",
        contextHash: "abc",
      });

      const publisher = createMockEventPublisher();
      const handler = createFailureHandler(
        registry,
        tmp.dir,
        tmp.configPath,
        join(tmp.dir, ".audit"),
        undefined,
        undefined,
        undefined,
        publisher,
      );

      await handler({
        agentId: "agent-1",
        storyId: "test-story",
        reason: "disconnected",
        failedAt: new Date(),
        duration: 1000,
      });

      expect(publisher.publishStoryBlocked).not.toHaveBeenCalled();
    });

    it("does not crash when eventPublisher.publishStoryBlocked throws", async () => {
      const registry = createMockRegistry();
      registry.register({
        agentId: "agent-1",
        storyId: "test-story",
        assignedAt: new Date(),
        status: "active",
        contextHash: "abc",
      });

      const publisher = createMockEventPublisher();
      vi.mocked(publisher.publishStoryBlocked).mockRejectedValue(new Error("publish failed"));
      const handler = createFailureHandler(
        registry,
        tmp.dir,
        tmp.configPath,
        join(tmp.dir, ".audit"),
        undefined,
        undefined,
        undefined,
        publisher,
      );

      // Should not throw
      await handler({
        agentId: "agent-1",
        storyId: "test-story",
        exitCode: 1,
        reason: "crashed",
        failedAt: new Date(),
        duration: 2000,
      });

      expect(publisher.publishStoryBlocked).toHaveBeenCalledOnce();
    });
  });
});
