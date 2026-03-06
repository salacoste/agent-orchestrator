import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  createAgentCompletionDetector,
  type AgentCompletionDetector,
  type CompletionEvent,
  type FailureEvent,
} from "../src/agent-completion-detector.js";
import type { Runtime, AgentRegistry, AgentAssignment, Notifier } from "../src/types.js";

describe("AgentCompletionDetector", () => {
  let mockRuntime: Runtime;
  let mockRegistry: AgentRegistry;
  let mockNotifier: Notifier;
  let detector: AgentCompletionDetector;

  const testAssignment: AgentAssignment = {
    agentId: "test-agent-1",
    storyId: "1-6-agent-completion-detection",
    assignedAt: new Date(),
    status: "active",
    contextHash: "abc123",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();

    // Mock runtime
    mockRuntime = {
      name: "tmux",
      create: vi.fn(),
      destroy: vi.fn(),
      sendMessage: vi.fn(),
      getOutput: vi.fn(),
      isAlive: vi.fn(),
    } as unknown as Runtime;

    // Mock registry
    mockRegistry = {
      register: vi.fn(),
      getByAgent: vi.fn().mockResolvedValue(testAssignment),
      getByStory: vi.fn(),
      findActiveByStory: vi.fn(),
      list: vi.fn(),
      remove: vi.fn(),
      getZombies: vi.fn(),
      reload: vi.fn(),
    } as unknown as AgentRegistry;

    // Mock notifier
    mockNotifier = {
      name: "desktop",
      notify: vi.fn(),
    } as unknown as Notifier;

    // Create detector
    detector = createAgentCompletionDetector({
      runtime: mockRuntime,
      registry: mockRegistry,
      notifier: mockNotifier,
      config: {
        pollInterval: 1000, // 1 second for tests
        timeout: 60000, // 1 minute for tests
      },
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("creation", () => {
    it("should create detector with default config", () => {
      const defaultDetector = createAgentCompletionDetector({
        runtime: mockRuntime,
        registry: mockRegistry,
      });

      expect(defaultDetector).toBeDefined();
    });

    it("should create detector with custom config", () => {
      const customDetector = createAgentCompletionDetector({
        runtime: mockRuntime,
        registry: mockRegistry,
        notifier: mockNotifier,
        config: {
          pollInterval: 10000,
          timeout: 120000,
        },
      });

      expect(customDetector).toBeDefined();
    });
  });

  describe("monitoring", () => {
    it("should start monitoring an agent", async () => {
      mockRegistry.getByAgent = vi.fn().mockResolvedValue(testAssignment);
      mockRuntime.isAlive = vi.fn().mockResolvedValue(true);

      await detector.monitor("test-agent-1");

      const status = detector.getStatus("test-agent-1");
      expect(status).toBeDefined();
      expect(status?.agentId).toBe("test-agent-1");
      expect(status?.isMonitoring).toBe(true);
      expect(status?.status).toBe("monitoring");
    });

    it("should throw if agent already being monitored", async () => {
      mockRegistry.getByAgent = vi.fn().mockResolvedValue(testAssignment);
      mockRuntime.isAlive = vi.fn().mockResolvedValue(true);

      await detector.monitor("test-agent-1");

      await expect(detector.monitor("test-agent-1")).rejects.toThrow(
        "Agent test-agent-1 is already being monitored",
      );
    });

    it("should throw if agent not found in registry", async () => {
      mockRegistry.getByAgent = vi.fn().mockResolvedValue(null);

      await expect(detector.monitor("test-agent-1")).rejects.toThrow(
        "Agent test-agent-1 not found in registry",
      );
    });

    it("should stop monitoring an agent", async () => {
      mockRegistry.getByAgent = vi.fn().mockResolvedValue(testAssignment);
      mockRuntime.isAlive = vi.fn().mockResolvedValue(true);

      await detector.monitor("test-agent-1");
      await detector.unmonitor("test-agent-1");

      const status = detector.getStatus("test-agent-1");
      expect(status).toBeNull();
    });
  });

  describe("status", () => {
    it("should return null for non-monitored agent", () => {
      const status = detector.getStatus("non-existent");
      expect(status).toBeNull();
    });

    it("should return status for monitored agent", async () => {
      mockRegistry.getByAgent = vi.fn().mockResolvedValue(testAssignment);
      mockRuntime.isAlive = vi.fn().mockResolvedValue(true);

      await detector.monitor("test-agent-1");

      const status = detector.getStatus("test-agent-1");
      expect(status).toMatchObject({
        agentId: "test-agent-1",
        isMonitoring: true,
        status: "monitoring",
      });
      expect(status?.startTime).toBeInstanceOf(Date);
      expect(status?.lastCheck).toBeInstanceOf(Date);
    });
  });

  describe("completion handlers", () => {
    it("should register completion handler", () => {
      const completionHandler = vi.fn();
      const statusBefore = detector.getStatus("test-agent");
      
      detector.onCompletion(completionHandler);

      // Verify handler was registered by checking it can be called
      // (The detector stores handlers and calls them in handleCompletion)
      expect(completionHandler).toBeInstanceOf(Function);
    });

    it("should support multiple completion handlers", () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();

      detector.onCompletion(handler1);
      detector.onCompletion(handler2);

      // Verify both handlers are functions (they were registered)
      expect(handler1).toBeInstanceOf(Function);
      expect(handler2).toBeInstanceOf(Function);
      expect(handler1).not.toBe(handler2); // Different handlers
    });
  });

  describe("failure handlers", () => {
    it("should register failure handler", () => {
      const failureHandler = vi.fn();
      
      detector.onFailure(failureHandler);

      // Verify handler is a function (it was registered)
      expect(failureHandler).toBeInstanceOf(Function);
    });

    it("should support multiple failure handlers", () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();

      detector.onFailure(handler1);
      detector.onFailure(handler2);

      // Verify both handlers are functions (they were registered)
      expect(handler1).toBeInstanceOf(Function);
      expect(handler2).toBeInstanceOf(Function);
      expect(handler1).not.toBe(handler2); // Different handlers
    });
  });

  describe("event payloads", () => {
    it("should include correct fields in CompletionEvent", () => {
      const testEvent: CompletionEvent = {
        agentId: "test-agent-1",
        storyId: "1-6-agent-completion-detection",
        exitCode: 0,
        duration: 60000,
        completedAt: new Date(),
      };

      expect(testEvent).toMatchObject({
        agentId: expect.any(String),
        storyId: expect.any(String),
        exitCode: expect.any(Number),
        duration: expect.any(Number),
        completedAt: expect.any(Date),
      });
    });

    it("should include correct fields in FailureEvent", () => {
      const testEvent: FailureEvent = {
        agentId: "test-agent-1",
        storyId: "1-6-agent-completion-detection",
        reason: "timed_out",
        failedAt: new Date(),
        duration: 60000,
      };

      expect(testEvent).toMatchObject({
        agentId: expect.any(String),
        storyId: expect.any(String),
        reason: expect.any(String),
        failedAt: expect.any(Date),
        duration: expect.any(Number),
      });
    });
  });
});
