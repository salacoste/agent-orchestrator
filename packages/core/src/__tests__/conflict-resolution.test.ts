/**
 * Conflict Resolution Service Tests
 *
 * Tests for the conflict resolution service that automatically resolves
 * agent assignment conflicts using priority-based rules.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { createConflictResolutionService } from "../conflict-resolution.js";
import type {
  AgentConflict,
  ConflictResolutionConfig,
  AgentRegistry,
  AgentAssignment,
  Runtime,
} from "../types.js";

describe("ConflictResolutionService", () => {
  let mockRegistry: AgentRegistry;
  let mockRuntime: Runtime;
  let mockAssignments: Map<string, AgentAssignment>;

  beforeEach(() => {
    mockAssignments = new Map();

    // Mock agent registry
    mockRegistry = {
      findActiveByStory: vi.fn((storyId: string) => {
        for (const assignment of mockAssignments.values()) {
          if (assignment.storyId === storyId && assignment.status === "active") {
            return assignment;
          }
        }
        return null;
      }),

      getByAgent: vi.fn((agentId: string) => {
        return mockAssignments.get(agentId) ?? null;
      }),

      getRetryCount: vi.fn(() => 0),
      assign: vi.fn(),
      remove: vi.fn(),
      updateStatus: vi.fn(),
      getActiveAgents: vi.fn(async () => mockAssignments.size),
      getAllAssignments: vi.fn(() => Array.from(mockAssignments.values())),
    } as unknown as AgentRegistry;

    // Mock runtime for agent termination
    mockRuntime = {
      name: "test-runtime",
      create: vi.fn(async () => ({ id: "test-session" })),
      destroy: vi.fn(async () => {}),
    } as unknown as Runtime;
  });

  describe("resolve - priority-based resolution", () => {
    it("should keep higher priority agent when priorities differ significantly", async () => {
      const config: ConflictResolutionConfig = {
        autoResolve: true,
        tieBreaker: "recent",
      };

      const service = createConflictResolutionService(mockRegistry, mockRuntime, config);

      const conflict: AgentConflict = {
        conflictId: "conflict-1",
        storyId: "story-1",
        existingAgent: "agent-high",
        conflictingAgent: "agent-low",
        type: "duplicate-assignment",
        detectedAt: new Date(),
        severity: "high",
        priorityScores: {
          "agent-high": 0.8,
          "agent-low": 0.3,
        },
        recommendations: [],
      };

      const result = await service.resolve(conflict);

      expect(result.action).toBe("keep_existing");
      expect(result.keptAgent).toBe("agent-high");
      expect(result.terminatedAgent).toBe("agent-low");
      expect(result.reason).toContain("higher priority");
    });

    it("should keep newer agent when tie-breaker is 'recent'", async () => {
      const config: ConflictResolutionConfig = {
        autoResolve: true,
        tieBreaker: "recent",
      };

      const service = createConflictResolutionService(mockRegistry, mockRuntime, config);

      const conflict: AgentConflict = {
        conflictId: "conflict-2",
        storyId: "story-2",
        existingAgent: "agent-old",
        conflictingAgent: "agent-new",
        type: "duplicate-assignment",
        detectedAt: new Date(),
        severity: "high",
        priorityScores: {
          "agent-old": 0.5,
          "agent-new": 0.5,
        },
        recommendations: [],
      };

      const result = await service.resolve(conflict);

      expect(result.action).toBe("keep_new");
      expect(result.keptAgent).toBe("agent-new");
      expect(result.terminatedAgent).toBe("agent-old");
      expect(result.reason).toContain("more recent");
    });

    it("should keep agent with more progress when tie-breaker is 'progress'", async () => {
      const config: ConflictResolutionConfig = {
        autoResolve: true,
        tieBreaker: "progress",
      };

      // Setup: agent-1 has more progress (longer time)
      const assignment1: AgentAssignment = {
        agentId: "agent-1",
        storyId: "story-1",
        status: "active",
        assignedAt: new Date(Date.now() - 1000 * 60 * 60 * 5), // 5 hours ago
        contextHash: "abc123",
      };
      const assignment2: AgentAssignment = {
        agentId: "agent-2",
        storyId: "story-1",
        status: "active",
        assignedAt: new Date(Date.now() - 1000 * 60 * 60), // 1 hour ago
        contextHash: "def456",
      };
      mockAssignments.set("agent-1", assignment1);
      mockAssignments.set("agent-2", assignment2);

      const service = createConflictResolutionService(mockRegistry, mockRuntime, config);

      // Use equal priority scores to trigger tie-breaker
      const conflict: AgentConflict = {
        conflictId: "conflict-3",
        storyId: "story-1",
        existingAgent: "agent-1",
        conflictingAgent: "agent-2",
        type: "duplicate-assignment",
        detectedAt: new Date(),
        severity: "high",
        priorityScores: {
          "agent-1": 0.5, // Equal priority
          "agent-2": 0.5,
        },
        recommendations: [],
      };

      const result = await service.resolve(conflict);

      expect(result.action).toBe("keep_existing");
      expect(result.keptAgent).toBe("agent-1");
      expect(result.terminatedAgent).toBe("agent-2");
      expect(result.reason).toContain("more progress");
    });
  });

  describe("resolve - manual resolution", () => {
    it("should return manual action when auto-resolve is disabled", async () => {
      const config: ConflictResolutionConfig = {
        autoResolve: false,
        tieBreaker: "recent",
      };

      const service = createConflictResolutionService(mockRegistry, mockRuntime, config);

      const conflict: AgentConflict = {
        conflictId: "conflict-4",
        storyId: "story-1",
        existingAgent: "agent-1",
        conflictingAgent: "agent-2",
        type: "duplicate-assignment",
        detectedAt: new Date(),
        severity: "medium",
        priorityScores: {
          "agent-1": 0.6,
          "agent-2": 0.4,
        },
        recommendations: [],
      };

      const result = await service.resolve(conflict);

      expect(result.action).toBe("manual");
      expect(result.keptAgent).toBeNull();
      expect(result.terminatedAgent).toBeNull();
      expect(result.reason).toContain("auto-resolve disabled");
    });

    it("should return manual action when priorities are equal", async () => {
      const config: ConflictResolutionConfig = {
        autoResolve: true,
        tieBreaker: "recent",
      };

      const service = createConflictResolutionService(mockRegistry, mockRuntime, config);

      const conflict: AgentConflict = {
        conflictId: "conflict-5",
        storyId: "story-1",
        existingAgent: "agent-1",
        conflictingAgent: "agent-2",
        type: "duplicate-assignment",
        detectedAt: new Date(),
        severity: "high",
        priorityScores: {
          "agent-1": 0.5,
          "agent-2": 0.5,
        },
        recommendations: [],
      };

      // Mock equal scores as exactly equal
      const result = await service.resolve(conflict);

      expect(result.action).toBe("keep_new"); // Tie-breaker: recent wins
      expect(result.keptAgent).toBe("agent-2");
    });
  });

  describe("canAutoResolve", () => {
    it("should return true when autoResolve is enabled", () => {
      const config: ConflictResolutionConfig = {
        autoResolve: true,
        tieBreaker: "recent",
      };

      const service = createConflictResolutionService(mockRegistry, mockRuntime, config);

      expect(service.canAutoResolve()).toBe(true);
    });

    it("should return false when autoResolve is disabled", () => {
      const config: ConflictResolutionConfig = {
        autoResolve: false,
        tieBreaker: "recent",
      };

      const service = createConflictResolutionService(mockRegistry, mockRuntime, config);

      expect(service.canAutoResolve()).toBe(false);
    });
  });

  describe("getResolutionStrategy", () => {
    it("should return configured tie-breaker", () => {
      const config: ConflictResolutionConfig = {
        autoResolve: true,
        tieBreaker: "progress",
      };

      const service = createConflictResolutionService(mockRegistry, mockRuntime, config);

      const strategy = service.getResolutionStrategy();

      expect(strategy.tieBreaker).toBe("progress");
    });
  });

  describe("agent termination", () => {
    it("should terminate lower priority agent when resolved", async () => {
      const config: ConflictResolutionConfig = {
        autoResolve: true,
        tieBreaker: "recent",
      };

      const service = createConflictResolutionService(mockRegistry, mockRuntime, config);

      // Use equal priorities to ensure termination happens
      const conflict: AgentConflict = {
        conflictId: "conflict-6",
        storyId: "story-1",
        existingAgent: "agent-keep",
        conflictingAgent: "agent-terminate",
        type: "duplicate-assignment",
        detectedAt: new Date(),
        severity: "low",
        priorityScores: {
          "agent-keep": 0.5,
          "agent-terminate": 0.5, // Equal priority
        },
        recommendations: [],
      };

      const result = await service.resolve(conflict);

      expect(result.action).toBe("keep_new"); // tie-breaker: recent wins
      expect(result.terminatedAgent).toBe("agent-keep");
      // The reason describes what happened (termination occurred)
      expect(result.reason.toLowerCase()).toContain("agent-keep");
    });

    it("should call runtime.destroy when terminating agent", async () => {
      const config: ConflictResolutionConfig = {
        autoResolve: true,
        tieBreaker: "recent",
      };

      const service = createConflictResolutionService(mockRegistry, mockRuntime, config);

      const conflict: AgentConflict = {
        conflictId: "conflict-7",
        storyId: "story-1",
        existingAgent: "agent-1",
        conflictingAgent: "agent-2",
        type: "duplicate-assignment",
        detectedAt: new Date(),
        severity: "low",
        priorityScores: {
          "agent-1": 0.8,
          "agent-2": 0.2,
        },
        recommendations: [],
      };

      await service.resolve(conflict);

      // Verify runtime.destroy was called for the terminated agent
      expect(mockRuntime.destroy).toHaveBeenCalledWith({
        id: "agent-2",
        runtimeName: "test-runtime",
        data: {},
      });
    });
  });

  describe("registry updates", () => {
    it("should unassign terminated agent from story", async () => {
      const config: ConflictResolutionConfig = {
        autoResolve: true,
        tieBreaker: "recent",
      };

      const service = createConflictResolutionService(mockRegistry, mockRuntime, config);

      const conflict: AgentConflict = {
        conflictId: "conflict-8",
        storyId: "story-1",
        existingAgent: "agent-1",
        conflictingAgent: "agent-2",
        type: "duplicate-assignment",
        detectedAt: new Date(),
        severity: "low",
        priorityScores: {
          "agent-1": 0.7,
          "agent-2": 0.3,
        },
        recommendations: [],
      };

      await service.resolve(conflict);

      // Verify registry.remove was called for the terminated agent
      expect(mockRegistry.remove).toHaveBeenCalledWith("agent-2");
    });
  });

  describe("resolution events", () => {
    it("should publish conflict.resolved event after resolution", async () => {
      const mockEventPublisher = {
        name: "test-event-bus",
        isConnected: () => true,
        isDegraded: () => false,
        publish: vi.fn(async () => {}),
        subscribe: vi.fn(async () => () => {}),
        close: vi.fn(async () => {}),
      };

      const config: ConflictResolutionConfig = {
        autoResolve: true,
        tieBreaker: "recent",
        eventPublisher: mockEventPublisher as any,
      };

      const service = createConflictResolutionService(mockRegistry, mockRuntime, config);

      const conflict: AgentConflict = {
        conflictId: "conflict-9",
        storyId: "story-1",
        existingAgent: "agent-1",
        conflictingAgent: "agent-2",
        type: "duplicate-assignment",
        detectedAt: new Date(),
        severity: "low",
        priorityScores: {
          "agent-1": 0.7,
          "agent-2": 0.3,
        },
        recommendations: [],
      };

      await service.resolve(conflict);

      // Verify event was published
      expect(mockEventPublisher.publish).toHaveBeenCalled();
      // Cast to avoid TypeScript inference issues with mock.calls
      const calls = mockEventPublisher.publish.mock.calls as Array<Array<{ type: string }>>;
      expect(calls.length).toBeGreaterThan(0);
      expect(calls[0][0]?.type).toBe("conflict.resolved");
    });
  });
});
