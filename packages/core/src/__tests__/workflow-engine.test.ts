/**
 * Workflow Engine Tests
 *
 * Tests the workflow execution system for plugin automation.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  createWorkflowEngine,
  type WorkflowDefinition,
  type WorkflowContext,
} from "../workflow-engine.js";

describe("WorkflowEngine", () => {
  let engine: ReturnType<typeof createWorkflowEngine>;
  let mockContext: WorkflowContext;

  beforeEach(() => {
    engine = createWorkflowEngine();
    mockContext = {
      logger: {
        info: vi.fn(),
        error: vi.fn(),
        warn: vi.fn(),
      },
      state: {
        get: vi.fn(),
        set: vi.fn(),
      },
      events: {
        emit: vi.fn(),
      },
    };
  });

  describe("Register workflows", () => {
    it("should register workflow definitions", () => {
      const workflows: WorkflowDefinition[] = [
        {
          name: "test-workflow",
          trigger: {
            event: { type: "story.completed" },
          },
          steps: [
            {
              action: "log",
            },
          ],
        },
      ];

      const registered = engine.register(workflows);
      expect(registered).toHaveLength(1);
      expect(registered[0]?.name).toBe("test-workflow");
    });

    it("should list all registered workflows", () => {
      const workflows: WorkflowDefinition[] = [
        {
          name: "workflow-1",
          trigger: { event: { type: "test" } },
          steps: [{ action: "action1" }],
        },
        {
          name: "workflow-2",
          trigger: { event: { type: "test" } },
          steps: [{ action: "action2" }],
        },
      ];

      engine.register(workflows);
      const listed = engine.listWorkflows();
      expect(listed).toHaveLength(2);
    });
  });

  describe("Execute workflow", () => {
    it("should execute steps in sequence", async () => {
      const executionOrder: string[] = [];
      const workflows: WorkflowDefinition[] = [
        {
          name: "sequential-workflow",
          trigger: { event: { type: "test" } },
          steps: [
            {
              action: "step1",
            },
            {
              action: "step2",
            },
            {
              action: "step3",
            },
          ],
        },
      ];

      engine.register(workflows);

      const mockActions = {
        step1: async () => {
          executionOrder.push("step1");
        },
        step2: async () => {
          executionOrder.push("step2");
        },
        step3: async () => {
          executionOrder.push("step3");
        },
      };

      const result = await engine.execute("sequential-workflow", mockContext, mockActions);

      expect(result.status).toBe("completed");
      expect(executionOrder).toEqual(["step1", "step2", "step3"]);
    });

    it("should pass previous step result to next step", async () => {
      const workflows: WorkflowDefinition[] = [
        {
          name: "result-passing",
          trigger: { event: { type: "test" } },
          steps: [
            {
              action: "set-value",
            },
            {
              action: "use-value",
            },
          ],
        },
      ];

      engine.register(workflows);

      const mockActions = {
        "set-value": async () => ({ result: 42 }),
        "use-value": async (context: { previousResult?: unknown }) => {
          return context.previousResult;
        },
      };

      const result = await engine.execute("result-passing", mockContext, mockActions);

      expect(result.status).toBe("completed");
    });

    it("should handle conditional steps (if)", async () => {
      const workflows: WorkflowDefinition[] = [
        {
          name: "conditional-workflow",
          trigger: { event: { type: "test" } },
          steps: [
            {
              action: "check",
              if: {
                field: "context.data.status",
                operator: "eq",
                value: "approved",
              },
            },
            {
              action: "only-if-approved",
            },
          ],
        },
      ];

      engine.register(workflows);

      const approvedContext = {
        ...mockContext,
        data: { status: "approved" },
      };

      const mockActions = {
        check: async () => ({ status: "approved" }),
        "only-if-approved": async () => "approved",
      };

      const result = await engine.execute("conditional-workflow", approvedContext, mockActions);

      expect(result.status).toBe("completed");
      expect(result.executedSteps).toBe(2);
    });

    it("should skip conditional steps when condition false", async () => {
      const workflows: WorkflowDefinition[] = [
        {
          name: "conditional-workflow",
          trigger: { event: { type: "test" } },
          steps: [
            {
              action: "check",
              if: {
                field: "context.data.status",
                operator: "eq",
                value: "approved",
              },
            },
            {
              action: "only-if-approved",
            },
          ],
        },
      ];

      engine.register(workflows);

      const rejectedContext = {
        ...mockContext,
        data: { status: "rejected" },
      };

      const mockActions = {
        check: async () => ({ status: "rejected" }),
        "only-if-approved": async () => "approved",
      };

      const result = await engine.execute("conditional-workflow", rejectedContext, mockActions);

      expect(result.status).toBe("completed");
      expect(result.executedSteps).toBe(1);
    });
  });

  describe("Async workflow execution", () => {
    it("should execute async steps asynchronously", async () => {
      const workflows: WorkflowDefinition[] = [
        {
          name: "async-workflow",
          trigger: { event: { type: "test" } },
          steps: [
            {
              action: "async-step",
              async: true,
            },
          ],
        },
      ];

      engine.register(workflows);

      const mockActions = {
        "async-step": async () => {
          await new Promise((resolve) => setTimeout(resolve, 10));
          return "async-result";
        },
      };

      const result = await engine.execute("async-workflow", mockContext, mockActions);

      expect(result.status).toBe("async");
      // Wait for async execution to complete
      await new Promise((resolve) => setTimeout(resolve, 50));
    });
  });

  describe("Error handling", () => {
    it("should mark workflow as failed when step throws", async () => {
      const workflows: WorkflowDefinition[] = [
        {
          name: "failing-workflow",
          trigger: { event: { type: "test" } },
          steps: [
            {
              action: "good-step",
            },
            {
              action: "bad-step",
            },
          ],
        },
      ];

      engine.register(workflows);

      const mockActions = {
        "good-step": async () => "good",
        "bad-step": async () => {
          throw new Error("Step failed");
        },
      };

      const result = await engine.execute("failing-workflow", mockContext, mockActions);

      expect(result.status).toBe("failed");
      expect(result.error).toBe("Step failed");
      expect(result.executedSteps).toBe(1); // Only good-step executed
    });

    it("should log error with plugin and handler name", async () => {
      const workflows: WorkflowDefinition[] = [
        {
          name: "failing-workflow",
          trigger: { event: { type: "test" } },
          plugin: "test-plugin",
          steps: [
            {
              action: "bad-step",
            },
          ],
        },
      ];

      engine.register(workflows);

      const mockActions = {
        "bad-step": async () => {
          throw new Error("Handler error");
        },
      };

      await engine.execute("failing-workflow", mockContext, mockActions);

      // Verify logger.error was called with a message containing all relevant info
      expect(mockContext.logger.error).toHaveBeenCalled();
      const calls = (mockContext.logger.error as ReturnType<typeof vi.fn>).mock.calls;
      const errorMessage = calls[0]?.[0] as string;
      expect(errorMessage).toContain("[test-plugin]");
      expect(errorMessage).toContain("failing-workflow");
      expect(errorMessage).toContain("bad-step");
      expect(errorMessage).toContain("Handler error");
    });
  });

  describe("Workflow history", () => {
    it("should track workflow execution history", async () => {
      const workflows: WorkflowDefinition[] = [
        {
          name: "tracked-workflow",
          trigger: { event: { type: "test" } },
          steps: [{ action: "step1" }],
        },
      ];

      engine.register(workflows);

      const mockActions = {
        step1: async () => "result",
      };

      await engine.execute("tracked-workflow", mockContext, mockActions);
      await engine.execute("tracked-workflow", mockContext, mockActions);

      const history = engine.getHistory("tracked-workflow");
      expect(history).toHaveLength(2);
    });

    it("should include workflow metadata in history", async () => {
      const workflows: WorkflowDefinition[] = [
        {
          name: "metadata-workflow",
          trigger: { event: { type: "test" } },
          steps: [{ action: "step1" }],
        },
      ];

      engine.register(workflows);

      const mockActions = {
        step1: async () => "result",
      };

      await engine.execute("metadata-workflow", mockContext, mockActions);

      const history = engine.getHistory("metadata-workflow");
      const entry = history[0];

      expect(entry?.workflowName).toBe("metadata-workflow");
      expect(entry?.status).toBe("completed");
      expect(entry?.startTime).toBeDefined();
      expect(entry?.duration).toBeGreaterThanOrEqual(0);
    });
  });
});
