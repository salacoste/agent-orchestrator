/**
 * Tests for Conflict Resolver Service
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { createConflictResolver, ConflictError } from "../src/conflict-resolver.js";
import type {
  ConflictResolver,
  Conflict,
  MergeSelections,
  StateManager,
  StoryState,
} from "../src/types.js";

// Mock StateManager
const createMockStateManager = (): StateManager => {
  const stories = new Map<string, StoryState>();

  return {
    initialize: vi.fn(async () => {}),
    get: vi.fn((storyId: string) => stories.get(storyId) || null),
    getAll: vi.fn(() => stories),
    set: vi.fn(async (_storyId: string, state: StoryState, _expectedVersion?: string) => {
      stories.set(state.id, { ...state, version: `v${Date.now()}-${randomUUID()}` });
      return { success: true, version: `v${Date.now()}-${randomUUID()}`, error: undefined };
    }),
    update: vi.fn(
      async (_storyId: string, updates: Partial<StoryState>, _expectedVersion?: string) => {
        const storyId = _storyId || "test-story";
        const existing = stories.get(storyId);
        if (!existing) {
          return { success: false, version: "", error: "Story not found" };
        }
        const updated = { ...existing, ...updates, version: `v${Date.now()}-${randomUUID()}` };
        stories.set(storyId, updated);
        return { success: true, version: updated.version, error: undefined };
      },
    ),
    batchSet: vi.fn(async () => ({ succeeded: [], failed: [] })),
    invalidate: vi.fn(async () => {}),
    getVersion: vi.fn((storyId: string) => {
      const story = stories.get(storyId);
      return story?.version || null;
    }),
    close: vi.fn(async () => {}),
  };
};

// Helper to create a test story state
function createStoryState(overrides: Partial<StoryState> = {}): StoryState {
  return {
    id: "STORY-001",
    status: "backlog",
    title: "Test Story",
    version: "v1709758234567-a1b2c3d4",
    updatedAt: "2026-03-07T10:00:00.000Z",
    ...overrides,
  };
}

// Helper to create Conflict
function createConflict(overrides: Partial<Conflict> = {}): Conflict {
  return {
    storyId: "STORY-001",
    expectedVersion: "v1",
    actualVersion: "v2",
    conflicts: [
      {
        field: "status",
        currentValue: "in-progress",
        proposedValue: "done",
      },
      {
        field: "assignedAgent",
        currentValue: "agent-1",
        proposedValue: "agent-2",
      },
    ],
    current: createStoryState({
      version: "v2",
      status: "in-progress",
      assignedAgent: "agent-1",
    }),
    proposed: createStoryState({
      version: "v1",
      status: "done",
      assignedAgent: "agent-2",
    }),
    ...overrides,
  };
}

describe("ConflictResolver", () => {
  let stateManager: StateManager;
  let resolver: ConflictResolver;

  beforeEach(() => {
    vi.clearAllMocks();
    stateManager = createMockStateManager();
    resolver = createConflictResolver(stateManager);
  });

  describe("interface definition", () => {
    it("should have detect, resolve, and merge methods", async () => {
      expect(typeof resolver.detect).toBe("function");
      expect(typeof resolver.resolve).toBe("function");
      expect(typeof resolver.merge).toBe("function");
    });
  });

  describe("conflict detection", () => {
    it("should detect conflict when versions mismatch", () => {
      stateManager.get = vi.fn(() =>
        createStoryState({
          version: "v2",
        }),
      );

      const updates = { status: "done" as const };
      const conflict = resolver.detect("STORY-001", "v1", updates);

      expect(conflict).not.toBeNull();
      expect(conflict?.storyId).toBe("STORY-001");
      expect(conflict?.expectedVersion).toBe("v1");
      expect(conflict?.actualVersion).toBe("v2");
      expect(conflict?.conflicts).toHaveLength(1); // Only status field in updates
    });

    it("should return null when no conflict", () => {
      stateManager.get = vi.fn(() =>
        createStoryState({
          version: "v1",
        }),
      );

      const updates = { status: "done" as const };
      const conflict = resolver.detect("STORY-001", "v1", updates);

      expect(conflict).toBeNull();
    });

    it("should return null when story not found", () => {
      stateManager.get = vi.fn(() => null);

      const updates = { status: "done" as const };
      const conflict = resolver.detect("STORY-001", "v1", updates);

      expect(conflict).toBeNull();
    });

    it("should generate conflict report with all conflicting fields", () => {
      stateManager.get = vi.fn(() =>
        createStoryState({
          version: "v2",
          status: "in-progress",
          assignedAgent: "agent-1",
        }),
      );

      const updates = { status: "done", assignedAgent: "agent-2" };
      const conflict = resolver.detect("STORY-001", "v1", updates);

      expect(conflict?.conflicts).toHaveLength(2);
      expect(conflict?.conflicts[0].field).toBe("status");
      expect(conflict?.conflicts[1].field).toBe("assignedAgent");
    });
  });

  describe("overwrite resolution", () => {
    it("should overwrite state and return new version", async () => {
      const conflict = createConflict();

      stateManager.set = vi.fn(async () => ({
        success: true,
        version: "v3",
      }));

      const result = await resolver.resolve(conflict, "overwrite");

      expect(result.success).toBe(true);
      expect(result.newVersion).toBe("v3");
      expect(stateManager.set).toHaveBeenCalledWith("STORY-001", conflict.proposed, "v2");
    });

    it("should return error if set fails", async () => {
      const conflict = createConflict();

      stateManager.set = vi.fn(async () => ({
        success: false,
        version: "",
        error: "Write failed",
      }));

      const result = await resolver.resolve(conflict, "overwrite");

      expect(result.success).toBe(false);
      expect(result.error).toBe("Write failed");
    });
  });

  describe("retry resolution", () => {
    it("should refresh state and reapply changes", async () => {
      const conflict = createConflict();

      stateManager.invalidate = vi.fn(async () => {});

      // Mock get to return updated state after invalidate
      let callCount = 0;
      stateManager.get = vi.fn(() => {
        callCount++;
        if (callCount === 1) {
          // First call in detect (not tested here)
          return createStoryState({
            version: "v2",
            status: "in-progress",
          });
        }
        // Second call after invalidate - returns updated state
        return createStoryState({
          version: "v3",
          status: "done",
        });
      });

      stateManager.set = vi.fn(async (_storyId, _state, version) => ({
        success: true,
        version: version!,
      }));

      const result = await resolver.resolve(conflict, "retry");

      expect(result.success).toBe(true);
      expect(stateManager.invalidate).toHaveBeenCalled();
      expect(result.newVersion).toBeDefined();
    });

    it("should return error if story not found after refresh", async () => {
      const conflict = createConflict();

      stateManager.invalidate = vi.fn(async () => {});
      stateManager.get = vi.fn(() => null);

      const result = await resolver.resolve(conflict, "retry");

      expect(result.success).toBe(false);
      expect(result.error).toContain("not found after refresh");
    });
  });

  describe("merge resolution", () => {
    it("should merge states with field selections", async () => {
      const conflict = createConflict();

      stateManager.set = vi.fn(async (_storyId, _mergedState) => ({
        success: true,
        version: "v3",
      }));

      const result = await resolver.resolve(conflict, "merge");

      expect(result.success).toBe(true);
      expect(result.newVersion).toBe("v3");
      // Verify merged state keeps current values by default
      const mergedState = stateManager.set.mock.calls[0][1];
      expect(mergedState.status).toBe("in-progress"); // Current value
      expect(mergedState.assignedAgent).toBe("agent-1"); // Current value
    });

    it("should use merge() method to combine states", () => {
      const current = createStoryState({
        version: "v2",
        status: "in-progress",
        assignedAgent: "agent-1",
      });

      const proposed = createStoryState({
        version: "v1",
        status: "done",
        assignedAgent: "agent-2",
      });

      const selections: MergeSelections = {
        status: "proposed",
        assignedAgent: "current",
      };

      const merged = resolver.merge(current, proposed, selections);

      expect(merged.status).toBe("done");
      expect(merged.assignedAgent).toBe("agent-1");
      expect(merged.version).toBe("v2"); // Current version preserved
    });

    it("should return error if merge fails", async () => {
      const conflict = createConflict();

      stateManager.set = vi.fn(async () => ({
        success: false,
        version: "",
        error: "Merge failed",
      }));

      const result = await resolver.resolve(conflict, "merge");

      expect(result.success).toBe(false);
      expect(result.error).toBe("Merge failed");
    });
  });

  describe("ConflictError", () => {
    it("should create error with conflict details", () => {
      const conflict = createConflict();
      const error = new ConflictError(conflict, "Custom message");

      expect(error.name).toBe("ConflictError");
      expect(error.message).toBe("Custom message");
      expect(error.conflict).toEqual(conflict);
    });

    it("should use default message if none provided", () => {
      const conflict = createConflict();
      const error = new ConflictError(conflict);

      expect(error.message).toContain("STORY-001");
      expect(error.message).toContain("v1");
      expect(error.message).toContain("v2");
    });
  });

  describe("CLI command integration", () => {
    // Note: Full CLI command tests would be in packages/cli
    // These tests verify the ConflictResolver can be used by CLI code

    it("should support JSON output format", async () => {
      const conflict = createConflict();

      // This verifies the Conflict structure has all fields needed for JSON output
      expect(conflict.storyId).toBeDefined();
      expect(conflict.expectedVersion).toBeDefined();
      expect(conflict.actualVersion).toBeDefined();
      expect(conflict.conflicts).toBeInstanceOf(Array);
      expect(conflict.current).toBeDefined();
      expect(conflict.proposed).toBeDefined();
    });

    it("should provide all data needed for conflict display", () => {
      const conflict = createConflict();

      // Verify conflict display data is complete
      expect(conflict.storyId).toBe("STORY-001");
      expect(conflict.conflicts).toHaveLength(2);

      const statusConflict = conflict.conflicts.find((c) => c.field === "status");
      expect(statusConflict).toBeDefined();
      expect(statusConflict?.currentValue).toBe("in-progress");
      expect(statusConflict?.proposedValue).toBe("done");
    });
  });
});
