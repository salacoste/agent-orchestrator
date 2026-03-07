/**
 * Tests for Sync Service
 *
 * Tests bidirectional state synchronization between Agent Orchestrator and BMAD tracker.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { createSyncService } from "../src/sync-service.js";
import type { SyncService, BMADTracker, StateManager, StoryState, EventBus } from "../src/types.js";

// Mock EventBus
const createMockEventBus = () => ({
  name: "mock-eventbus",
  publish: vi.fn(async () => {}),
  subscribe: vi.fn(async () => vi.fn()),
  isConnected: vi.fn(() => true),
  isDegraded: vi.fn(() => false),
  getQueueSize: vi.fn(() => 0),
  close: vi.fn(async () => {}),
});

// Mock StateManager
const createMockStateManager = (): StateManager => {
  const stories = new Map<string, StoryState>();

  return {
    initialize: vi.fn(async () => {}),
    get: vi.fn((storyId: string) => stories.get(storyId) || null),
    getAll: vi.fn(() => stories),
    set: vi.fn(async (_storyId: string, state: StoryState, _expectedVersion?: string) => {
      stories.set(state.id, {
        ...state,
        version: `v${Date.now()}-mock`,
        updatedAt: new Date().toISOString(),
      });
      return { success: true, version: `v${Date.now()}-mock`, error: undefined };
    }),
    update: vi.fn(
      async (_storyId: string, updates: Partial<StoryState>, _expectedVersion?: string) => {
        const storyId = _storyId || "test-story";
        const existing = stories.get(storyId);
        if (!existing) {
          return { success: false, version: "", error: "Story not found" };
        }
        const updated = {
          ...existing,
          ...updates,
          version: `v${Date.now()}-mock`,
          updatedAt: new Date().toISOString(),
        };
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

// Mock BMAD Tracker
const createMockBMADTracker = (): BMADTracker => {
  const stories = new Map<string, StoryState>();

  return {
    name: "mock-bmad",
    getStory: vi.fn(async (storyId: string) => stories.get(storyId) || null),
    updateStory: vi.fn(async (_storyId: string, state: StoryState) => {
      stories.set(state.id, state);
    }),
    listStories: vi.fn(async () => stories),
    isAvailable: vi.fn(async () => true),
  };
};

// Helper to create a test story state
function createStoryState(overrides: Partial<StoryState> = {}): StoryState {
  return {
    id: "STORY-001",
    status: "in-progress",
    title: "Test Story",
    version: "v1709758234567-a1b2c3d4",
    updatedAt: "2026-03-07T10:00:00.000Z",
    ...overrides,
  };
}

describe("SyncService", () => {
  let stateManager: StateManager;
  let bmadTracker: BMADTracker;
  let eventBus: ReturnType<typeof createMockEventBus>;
  let syncService: SyncService;

  beforeEach(() => {
    vi.clearAllMocks();
    stateManager = createMockStateManager();
    bmadTracker = createMockBMADTracker();
    eventBus = createMockEventBus();

    syncService = createSyncService({
      eventBus: eventBus as unknown as EventBus,
      stateManager,
      bmadTracker,
      pollInterval: 100, // Short interval for tests
      retryDelays: [100, 200, 400],
      maxRetries: 3,
    });
  });

  describe("syncToBMAD", () => {
    it("should successfully sync story state to BMAD", async () => {
      const storyState = createStoryState();
      (stateManager.get as ReturnType<typeof vi.fn>).mockReturnValue(storyState);

      const result = await syncService.syncToBMAD("STORY-001", storyState);

      expect(result.success).toBe(true);
      expect(result.storyId).toBe("STORY-001");
      expect(bmadTracker.updateStory).toHaveBeenCalledWith("STORY-001", storyState);
      expect(eventBus.publish).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: "sync.completed",
          metadata: expect.objectContaining({
            storyId: "STORY-001",
            direction: "to-bmad",
          }),
        }),
      );
    });

    it("should return error when BMAD tracker is not configured", async () => {
      const serviceWithoutTracker = createSyncService({
        eventBus: eventBus as unknown as EventBus,
        stateManager,
        bmadTracker: null as unknown as BMADTracker,
      });

      const result = await serviceWithoutTracker.syncToBMAD("STORY-001", createStoryState());

      expect(result.success).toBe(false);
      expect(result.error).toBe("BMAD tracker not configured");
    });

    it("should detect and resolve conflicts using timestamp-based resolution", async () => {
      const localState = createStoryState({
        version: "v2",
        status: "done",
        updatedAt: "2026-03-07T11:00:00.000Z", // Newer
      });

      const bmadState = createStoryState({
        version: "v1",
        status: "in-progress",
        updatedAt: "2026-03-07T10:00:00.000Z", // Older
      });

      (bmadTracker.getStory as ReturnType<typeof vi.fn>).mockResolvedValue(bmadState);
      (stateManager.get as ReturnType<typeof vi.fn>).mockReturnValue(localState);

      const result = await syncService.syncToBMAD("STORY-001", localState);

      // Local should win (newer timestamp)
      expect(result.success).toBe(true);
      expect(bmadTracker.updateStory).toHaveBeenCalled();
    });

    it("should queue sync for retry on error", async () => {
      const storyState = createStoryState();
      (bmadTracker.updateStory as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error("Network error"),
      );

      const result = await syncService.syncToBMAD("STORY-001", storyState);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Network error");

      const status = syncService.getStatus();
      expect(status.queueSize).toBeGreaterThan(0);
    });
  });

  describe("syncFromBMAD", () => {
    it("should successfully sync story state from BMAD", async () => {
      const bmadState = createStoryState({
        status: "done",
        version: "v2",
        updatedAt: "2026-03-07T11:00:00.000Z",
      });

      (bmadTracker.getStory as ReturnType<typeof vi.fn>).mockResolvedValue(bmadState);

      const result = await syncService.syncFromBMAD("STORY-001");

      expect(result.success).toBe(true);
      expect(result.storyId).toBe("STORY-001");
      expect(stateManager.set).toHaveBeenCalledWith("STORY-001", bmadState);
      expect(stateManager.invalidate).toHaveBeenCalled();
      expect(eventBus.publish).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: "sync.external_update",
          metadata: expect.objectContaining({
            storyId: "STORY-001",
            direction: "from-bmad",
          }),
        }),
      );
    });

    it("should return error when story not found in BMAD", async () => {
      (bmadTracker.getStory as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const result = await syncService.syncFromBMAD("STORY-001");

      expect(result.success).toBe(false);
      expect(result.error).toContain("not found in BMAD");
    });

    it("should resolve conflicts when syncing from BMAD", async () => {
      const localState = createStoryState({
        version: "v1",
        status: "in-progress",
        updatedAt: "2026-03-07T10:00:00.000Z", // Older
      });

      const bmadState = createStoryState({
        version: "v2",
        status: "done",
        updatedAt: "2026-03-07T11:00:00.000Z", // Newer
      });

      (stateManager.get as ReturnType<typeof vi.fn>).mockReturnValue(localState);
      (bmadTracker.getStory as ReturnType<typeof vi.fn>).mockResolvedValue(bmadState);

      const result = await syncService.syncFromBMAD("STORY-001");

      expect(result.success).toBe(true);
      // BMAD state should win (newer timestamp)
      expect(stateManager.set).toHaveBeenCalledWith("STORY-001", bmadState);
    });
  });

  describe("syncAll", () => {
    it("should sync all stories bidirectional", async () => {
      const story1 = createStoryState({ id: "STORY-001", version: "v1" });
      const story2 = createStoryState({ id: "STORY-002", version: "v1" });

      const storiesMap = new Map([
        ["STORY-001", story1],
        ["STORY-002", story2],
      ]);

      (bmadTracker.listStories as ReturnType<typeof vi.fn>).mockResolvedValue(storiesMap);
      (stateManager.getAll as ReturnType<typeof vi.fn>).mockReturnValue(storiesMap);

      const result = await syncService.syncAll("bidirectional");

      expect(result.succeeded).toHaveLength(2);
      expect(result.failed).toHaveLength(0);
      expect(result.duration).toBeGreaterThanOrEqual(0);
    });

    it("should sync all stories to BMAD only", async () => {
      const story1 = createStoryState({ id: "STORY-001" });
      const story2 = createStoryState({ id: "STORY-002" });

      const storiesMap = new Map([
        ["STORY-001", story1],
        ["STORY-002", story2],
      ]);

      (bmadTracker.listStories as ReturnType<typeof vi.fn>).mockResolvedValue(storiesMap);
      (stateManager.getAll as ReturnType<typeof vi.fn>).mockReturnValue(storiesMap);

      const result = await syncService.syncAll("to-bmad");

      expect(result.succeeded).toHaveLength(2);
      expect(bmadTracker.updateStory).toHaveBeenCalledTimes(2);
    });

    it("should sync all stories from BMAD only", async () => {
      const story1 = createStoryState({ id: "STORY-001" });
      const story2 = createStoryState({ id: "STORY-002" });

      const storiesMap = new Map([
        ["STORY-001", story1],
        ["STORY-002", story2],
      ]);

      (bmadTracker.listStories as ReturnType<typeof vi.fn>).mockResolvedValue(storiesMap);
      // Mock getStory to return the stories (used by syncFromBMAD)
      (bmadTracker.getStory as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce(story1)
        .mockResolvedValueOnce(story2);
      (stateManager.getAll as ReturnType<typeof vi.fn>).mockReturnValue(new Map());

      const result = await syncService.syncAll("from-bmad");

      expect(result.succeeded).toHaveLength(2);
      expect(stateManager.set).toHaveBeenCalledTimes(2);
    });
  });

  describe("getStatus", () => {
    it("should return current sync status", () => {
      const status = syncService.getStatus();

      expect(status).toHaveProperty("lastSyncTime");
      expect(status).toHaveProperty("queueSize");
      expect(status).toHaveProperty("failedCount");
      expect(status).toHaveProperty("bmadConnected");
      expect(status).toHaveProperty("degradedMode");
    });

    it("should reflect degraded mode when BMAD is unavailable", async () => {
      // Create a service with BMAD unavailable from the start
      const degradedTracker = createMockBMADTracker();
      (degradedTracker.isAvailable as ReturnType<typeof vi.fn>).mockResolvedValue(false);

      const degradedService = createSyncService({
        eventBus: eventBus as unknown as EventBus,
        stateManager,
        bmadTracker: degradedTracker,
        pollInterval: 100,
      });

      // Wait for initialization to complete
      await new Promise((resolve) => setTimeout(resolve, 50));

      const status = degradedService.getStatus();
      expect(status.degradedMode).toBe(true);
      expect(status.bmadConnected).toBe(false);

      // Cleanup
      await degradedService.close();
    });
  });

  describe("retryFailed", () => {
    it("should retry failed syncs", async () => {
      const storyState = createStoryState();
      (bmadTracker.updateStory as ReturnType<typeof vi.fn>)
        .mockRejectedValueOnce(new Error("Network error"))
        .mockResolvedValueOnce(undefined);

      // First attempt fails
      await syncService.syncToBMAD("STORY-001", storyState);

      // Retry should succeed
      await syncService.retryFailed();

      expect(bmadTracker.updateStory).toHaveBeenCalledTimes(2);
    });
  });

  describe("close", () => {
    it("should close sync service and cleanup resources", async () => {
      await syncService.close();

      const status = syncService.getStatus();
      // After close, polling should stop and resources cleaned up
      expect(status).toBeDefined();
    });
  });
});
