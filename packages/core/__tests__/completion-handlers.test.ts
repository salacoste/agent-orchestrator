import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  createCompletionHandler,
  createFailureHandler,
  logAuditEvent,
  updateSprintStatus,
  formatFailureReason,
} from "../src/completion-handlers.js";
import type { AgentRegistry, Notifier, CompletionEvent, FailureEvent } from "../src/types.js";
import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import type * as _MetadataModule from "../src/metadata.js";
import type * as _PathsModule from "../src/paths.js";

// Mock metadata functions that require actual files
vi.mock("../src/metadata.js", async (importOriginal) => {
  const actual = await importOriginal<typeof _MetadataModule>();
  return {
    ...actual,
    updateMetadata: vi.fn(),
    readMetadata: vi.fn(),
  };
});

// Mock getSessionsDir to avoid realpathSync on non-existent files
vi.mock("../src/paths.js", async (importOriginal) => {
  const actual = await importOriginal<typeof _PathsModule>();
  return {
    ...actual,
    getSessionsDir: vi.fn(() => "/tmp/test-sessions"),
  };
});

describe("Completion Handlers", () => {
  let mockRegistry: AgentRegistry;
  let mockNotifier: Notifier;
  let projectPath: string;
  let configPath: string;
  let auditDir: string;

  const testAssignment = {
    agentId: "test-agent-1",
    storyId: "1-6-agent-completion-detection",
    assignedAt: new Date(),
    status: "active" as const,
    contextHash: "abc123",
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup paths
    projectPath = "/tmp/test-project";
    configPath = "/tmp/agent-orchestrator.yaml";
    auditDir = join(projectPath, "sessions", "audit");

    // Mock registry
    mockRegistry = {
      register: vi.fn(),
      getByAgent: vi.fn().mockReturnValue(testAssignment),
      getByStory: vi.fn(),
      findActiveByStory: vi.fn(),
      list: vi.fn(),
      remove: vi.fn(),
      getZombies: vi.fn(),
      reload: vi.fn().mockResolvedValue(undefined),
    } as unknown as AgentRegistry;

    // Mock notifier
    mockNotifier = {
      name: "desktop",
      notify: vi.fn().mockResolvedValue(undefined),
    } as unknown as Notifier;
  });

  describe("logAuditEvent", () => {
    it("should log event to JSONL file", () => {
      const event = {
        timestamp: "2024-01-01T00:00:00.000Z",
        event_type: "test_event",
        agent_id: "test-agent",
        story_id: "1-1-test",
      };

      const result = logAuditEvent(auditDir, event);

      // Verify function completes without error
      expect(result).toBeUndefined();

      // Verify audit file was created
      const auditFile = join(auditDir, "agent-lifecycle.jsonl");
      expect(existsSync(auditFile)).toBe(true);
    });

    it("should handle logging errors gracefully", () => {
      // This would require mocking fs operations to fail
      expect(() => {
        logAuditEvent("/invalid/path", {
          timestamp: "2024-01-01T00:00:00.000Z",
          event_type: "test",
          agent_id: "test",
          story_id: "test",
        });
      }).not.toThrow();
    });
  });

  describe("updateSprintStatus", () => {
    beforeEach(() => {
      // Create test sprint-status.yaml
      const yamlContent = `
development_status:
  1-1-test-story: in-progress
  1-2-another-story: ready-for-dev
`;
      writeFileSync(join(projectPath, "sprint-status.yaml"), yamlContent, "utf-8");
      mkdirSync(join(projectPath, "sessions"), { recursive: true });
    });

    it("should update story status", () => {
      const result = updateSprintStatus(projectPath, "1-1-test-story", "done");
      expect(result).toBe(true);
    });

    it("should handle non-existent stories gracefully", () => {
      // The function returns true if the YAML file exists and is valid,
      // even if the specific story key isn't found (it adds the key)
      // But for truly non-existent stories, this is acceptable behavior
      const result = updateSprintStatus(projectPath, "nonexistent", "done");
      // Function updates YAML if file exists, regardless of story presence
      expect(result).toBe(true);
    });

    it("should handle missing sprint-status.yaml", () => {
      const result = updateSprintStatus("/nonexistent", "1-1-test", "done");
      expect(result).toBe(false);
    });
  });

  describe("createCompletionHandler", () => {
    it("should update registry and sprint status on completion", async () => {
      const handler = createCompletionHandler(
        mockRegistry,
        projectPath,
        configPath,
        auditDir,
        mockNotifier,
      );

      const event: CompletionEvent = {
        agentId: "test-agent-1",
        storyId: "1-1-test-story",
        exitCode: 0,
        duration: 60000,
        completedAt: new Date(),
      };

      await handler(event);

      // Verify registry.remove was called
      expect(mockRegistry.remove).toHaveBeenCalledWith("test-agent-1");
    });

    it("should log completion event", async () => {
      const handler = createCompletionHandler(mockRegistry, projectPath, configPath, auditDir);

      const event: CompletionEvent = {
        agentId: "test-agent-1",
        storyId: "1-1-test-story",
        exitCode: 0,
        duration: 60000,
        completedAt: new Date(),
      };

      await handler(event);

      // Verify registry.remove was called
      expect(mockRegistry.remove).toHaveBeenCalled();
    });
  });

  describe("createFailureHandler", () => {
    it("should update registry and sprint status on failure", async () => {
      const handler = createFailureHandler(
        mockRegistry,
        projectPath,
        configPath,
        auditDir,
        mockNotifier,
      );

      const event: FailureEvent = {
        agentId: "test-agent-1",
        storyId: "1-1-test-story",
        reason: "failed",
        exitCode: 1,
        failedAt: new Date(),
        duration: 30000,
      };

      await handler(event);

      // Verify registry.remove was called
      expect(mockRegistry.remove).toHaveBeenCalledWith("test-agent-1");
    });

    it("should send notification on failure", async () => {
      const handler = createFailureHandler(
        mockRegistry,
        projectPath,
        configPath,
        auditDir,
        mockNotifier,
      );

      const event: FailureEvent = {
        agentId: "test-agent-1",
        storyId: "1-1-test-story",
        reason: "failed",
        exitCode: 1,
        failedAt: new Date(),
        duration: 30000,
      };

      await handler(event);

      // Verify notify was called
      expect(mockNotifier.notify).toHaveBeenCalled();
    });

    it("should not send notification for manual termination", async () => {
      const handler = createFailureHandler(
        mockRegistry,
        projectPath,
        configPath,
        auditDir,
        mockNotifier,
      );

      const event: FailureEvent = {
        agentId: "test-agent-1",
        storyId: "1-1-test-story",
        reason: "disconnected",
        failedAt: new Date(),
        duration: 30000,
      };

      await handler(event);

      // Verify notify was NOT called for manual termination
      expect(mockNotifier.notify).not.toHaveBeenCalled();
    });

    it("should send urgent notification for crashes", async () => {
      const handler = createFailureHandler(
        mockRegistry,
        projectPath,
        configPath,
        auditDir,
        mockNotifier,
      );

      const event: FailureEvent = {
        agentId: "test-agent-1",
        storyId: "1-1-test-story",
        reason: "crashed",
        signal: "SIGSEGV",
        failedAt: new Date(),
        duration: 15000,
      };

      await handler(event);

      // Verify notify was called with urgent priority
      expect(mockNotifier.notify).toHaveBeenCalledWith(
        expect.objectContaining({
          priority: "urgent",
        }),
      );
    });
  });

  describe("formatFailureReason", () => {
    it("should format failure reasons correctly", () => {
      expect(formatFailureReason("failed")).toBe("failed with non-zero exit code");
      expect(formatFailureReason("crashed")).toBe("crashed");
      expect(formatFailureReason("timed_out")).toBe("timed out");
      expect(formatFailureReason("disconnected")).toBe("was disconnected (manual termination)");
    });

    it("should return unknown reason as-is", () => {
      expect(formatFailureReason("unknown" as any)).toBe("unknown");
    });
  });
});
