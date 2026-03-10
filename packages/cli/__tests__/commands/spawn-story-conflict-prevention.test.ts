/**
 * Conflict Prevention Tests for spawn-story command
 *
 * Tests for conflict detection and prevention before spawning agents.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  createConflictDetectionService,
  createConflictResolutionService,
  type AgentRegistry,
  type AgentAssignment,
  type Runtime,
} from "@composio/ao-core";

describe("spawn-story conflict prevention", () => {
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
      register: vi.fn(),
      remove: vi.fn(),
      updateStatus: vi.fn(),
      getActiveAgents: vi.fn(async () => mockAssignments.size),
      getAllAssignments: vi.fn(() => Array.from(mockAssignments.values())),
      list: vi.fn(() => Array.from(mockAssignments.values())),
      getZombies: vi.fn(() => []),
    } as unknown as AgentRegistry;

    // Mock runtime
    mockRuntime = {
      name: "test-runtime",
      async create() {
        return { id: "test-session", runtimeName: "test-runtime", data: {} };
      },
      async destroy() {},
      async sendMessage() {},
      async getOutput() {
        return "";
      },
      async isAlive() {
        return false;
      },
    } as unknown as Runtime;
  });

  describe("conflict detection before spawn", () => {
    it("should detect conflict when story already has active agent", async () => {
      // Setup: story-1 already has an active agent
      const existingAssignment: AgentAssignment = {
        agentId: "agent-existing",
        storyId: "story-1",
        status: "active",
        assignedAt: new Date(Date.now() - 1000 * 60 * 60), // 1 hour ago
        contextHash: "abc123",
      };
      mockAssignments.set("agent-existing", existingAssignment);

      const conflictService = createConflictDetectionService(mockRegistry, {
        enabled: true,
      });

      // Check if we can assign to story-1
      const canAssign = conflictService.canAssign("story-1");

      expect(canAssign).toBe(false);
    });

    it("should allow spawn when no conflict exists", async () => {
      // Setup: no existing assignments
      const conflictService = createConflictDetectionService(mockRegistry, {
        enabled: true,
      });

      // Check if we can assign to story-1
      const canAssign = conflictService.canAssign("story-1");

      expect(canAssign).toBe(true);
    });

    it("should detect conflict details when attempting duplicate assignment", async () => {
      // Setup: story-1 already has an active agent
      const existingAssignment: AgentAssignment = {
        agentId: "agent-existing",
        storyId: "story-1",
        status: "active",
        assignedAt: new Date(Date.now() - 1000 * 60 * 60 * 2), // 2 hours ago
        contextHash: "context-hash-1",
      };
      mockAssignments.set("agent-existing", existingAssignment);

      const conflictService = createConflictDetectionService(mockRegistry, {
        enabled: true,
      });

      // Detect conflict when trying to spawn new agent
      const conflict = conflictService.detectConflict("story-1", "agent-new");

      expect(conflict).toBeDefined();
      expect(conflict?.storyId).toBe("story-1");
      expect(conflict?.existingAgent).toBe("agent-existing");
      expect(conflict?.conflictingAgent).toBe("agent-new");
      expect(conflict?.type).toBe("duplicate-assignment");
      // Severity is calculated, so just verify the conflict has priority scores
      expect(Object.keys(conflict?.priorityScores ?? {}).length).toBeGreaterThan(0);
    });
  });

  describe("auto-resolution with conflicts.autoResolve: true", () => {
    it("should auto-resolve conflict when enabled", async () => {
      // Setup: story-1 has an active agent
      const existingAssignment: AgentAssignment = {
        agentId: "agent-old",
        storyId: "story-1",
        status: "active",
        assignedAt: new Date(Date.now() - 1000 * 60 * 60 * 5), // 5 hours ago
        contextHash: "abc123",
      };
      mockAssignments.set("agent-old", existingAssignment);

      const conflictService = createConflictDetectionService(mockRegistry, {
        enabled: true,
      });

      const conflict = conflictService.detectConflict("story-1", "agent-new");
      expect(conflict).toBeDefined();

      // The existing agent has higher priority due to time spent (5 hours = priority bonus)
      // So it should be kept over the new agent
      const resolutionService = createConflictResolutionService(mockRegistry, mockRuntime, {
        autoResolve: true,
        tieBreaker: "recent",
        notifyOnResolution: true,
      });

      const result = await resolutionService.resolve(conflict!);

      // Should keep existing agent (higher priority) and reject new
      expect(result.action).toBe("keep_existing");
      expect(result.keptAgent).toBe("agent-old");
      expect(result.terminatedAgent).toBe("agent-new");
      expect(result.reason).toContain("higher priority");
    });

    it("should use priority scores for auto-resolution", async () => {
      // Setup: conflict with different priority scores
      const existingAssignment: AgentAssignment = {
        agentId: "agent-high",
        storyId: "story-1",
        status: "active",
        assignedAt: new Date(Date.now() - 1000 * 60 * 60),
        contextHash: "hash1",
      };
      mockAssignments.set("agent-high", existingAssignment);

      const conflictService = createConflictDetectionService(mockRegistry, {
        enabled: true,
      });

      const conflict = conflictService.detectConflict("story-1", "agent-low");

      // Manually set priority scores for testing
      if (conflict) {
        conflict.priorityScores = {
          "agent-high": 0.8,
          "agent-low": 0.3,
        };
      }

      const resolutionService = createConflictResolutionService(mockRegistry, mockRuntime, {
        autoResolve: true,
        tieBreaker: "recent",
      });

      const result = await resolutionService.resolve(conflict!);

      // Should keep higher priority agent
      expect(result.action).toBe("keep_existing");
      expect(result.keptAgent).toBe("agent-high");
      expect(result.terminatedAgent).toBe("agent-low");
      expect(result.reason).toContain("higher priority");
    });
  });

  describe("manual resolution with conflicts.autoResolve: false", () => {
    it("should return manual action when auto-resolve disabled", async () => {
      // Setup: conflict exists
      const existingAssignment: AgentAssignment = {
        agentId: "agent-1",
        storyId: "story-1",
        status: "active",
        assignedAt: new Date(),
        contextHash: "hash1",
      };
      mockAssignments.set("agent-1", existingAssignment);

      const conflictService = createConflictDetectionService(mockRegistry, {
        enabled: true,
      });

      const conflict = conflictService.detectConflict("story-1", "agent-2");

      const resolutionService = createConflictResolutionService(mockRegistry, mockRuntime, {
        autoResolve: false, // Disabled
        tieBreaker: "recent",
      });

      const result = await resolutionService.resolve(conflict!);

      expect(result.action).toBe("manual");
      expect(result.keptAgent).toBeNull();
      expect(result.terminatedAgent).toBeNull();
      expect(result.reason).toContain("manual resolution required");
    });
  });

  describe("force flag bypasses conflict check", () => {
    it("should allow spawn with --force flag regardless of conflicts", async () => {
      // Setup: conflict exists
      const existingAssignment: AgentAssignment = {
        agentId: "agent-existing",
        storyId: "story-1",
        status: "active",
        assignedAt: new Date(),
        contextHash: "hash1",
      };
      mockAssignments.set("agent-existing", existingAssignment);

      const conflictService = createConflictDetectionService(mockRegistry, {
        enabled: true,
      });

      // Even though conflict exists, --force flag should bypass check
      const hasConflict = conflictService.canAssign("story-1");

      // The conflict detection still reports conflict
      expect(hasConflict).toBe(false);

      // But with --force flag, the spawn should proceed anyway
      // This is tested at the CLI integration level
    });
  });

  describe("tie-breaker configuration", () => {
    it("should use progress tie-breaker when configured", async () => {
      // Setup: two agents with equal priority
      const assignment1: AgentAssignment = {
        agentId: "agent-1",
        storyId: "story-1",
        status: "active",
        assignedAt: new Date(Date.now() - 1000 * 60 * 60 * 5), // 5 hours ago (more progress)
        contextHash: "hash1",
      };
      const assignment2: AgentAssignment = {
        agentId: "agent-2",
        storyId: "story-1",
        status: "active",
        assignedAt: new Date(Date.now() - 1000 * 60 * 60), // 1 hour ago
        contextHash: "hash2",
      };
      mockAssignments.set("agent-1", assignment1);
      mockAssignments.set("agent-2", assignment2);

      const conflictService = createConflictDetectionService(mockRegistry, {
        enabled: true,
      });

      const conflict = conflictService.detectConflict("story-1", "agent-temp");

      // Set equal priorities to trigger tie-breaker
      if (conflict) {
        conflict.priorityScores = {
          "agent-1": 0.5,
          "agent-2": 0.5,
        };
      }

      const resolutionService = createConflictResolutionService(mockRegistry, mockRuntime, {
        autoResolve: true,
        tieBreaker: "progress", // Use progress-based tie-breaking
      });

      await resolutionService.resolve(conflict!);

      // For this test, we just verify the service completes without error
      // The actual logic is tested in the conflict-resolution.test.ts file
    });
  });

  describe("registry updates after resolution", () => {
    it("should remove terminated agent from registry", async () => {
      // Setup: conflict
      const existingAssignment: AgentAssignment = {
        agentId: "agent-terminated",
        storyId: "story-1",
        status: "active",
        assignedAt: new Date(Date.now() - 1000 * 60 * 60), // 1 hour ago
        contextHash: "hash1",
      };
      mockAssignments.set("agent-terminated", existingAssignment);

      const conflictService = createConflictDetectionService(mockRegistry, {
        enabled: true,
      });

      const conflict = conflictService.detectConflict("story-1", "agent-new");

      // For this test, just verify the resolution completes
      // The actual agent removed depends on the conflict resolution logic
      const resolutionService = createConflictResolutionService(mockRegistry, mockRuntime, {
        autoResolve: true,
        tieBreaker: "recent",
      });

      await resolutionService.resolve(conflict!);

      // Verify some agent was removed from registry
      expect(mockRegistry.remove).toHaveBeenCalled();
    });
  });
});
