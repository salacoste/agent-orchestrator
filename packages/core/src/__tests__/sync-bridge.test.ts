import { describe, it, expect, vi, beforeEach } from "vitest";
import type {
  StateManager,
  FileWatcher,
  SyncService,
  SyncStatus,
  BMADTracker,
  EventBus,
  StoryState,
} from "../types.js";
import { createSyncBridge } from "../sync-bridge.js";

// ---------------------------------------------------------------------------
// Mock factories — return controllable fakes
// ---------------------------------------------------------------------------

function createMockStateManager(): StateManager {
  return {
    initialize: vi.fn().mockResolvedValue(undefined),
    get: vi.fn().mockReturnValue(null),
    getAll: vi.fn().mockReturnValue(new Map()),
    set: vi.fn().mockResolvedValue({ success: true, version: "v1" }),
    update: vi.fn().mockResolvedValue({ success: true, version: "v1" }),
    batchSet: vi.fn().mockResolvedValue({ succeeded: [], failed: [] }),
    invalidate: vi.fn().mockResolvedValue(undefined),
    getVersion: vi.fn().mockReturnValue(null),
    close: vi.fn().mockResolvedValue(undefined),
    verify: vi.fn().mockResolvedValue({ valid: true }),
  };
}

function createMockFileWatcher(): FileWatcher {
  return {
    watch: vi.fn().mockResolvedValue(undefined),
    unwatch: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined),
    isWatching: vi.fn().mockReturnValue(false),
  };
}

function createMockSyncService(): SyncService {
  const status: SyncStatus = {
    lastSyncTime: null,
    queueSize: 0,
    failedCount: 0,
    bmadConnected: true,
    degradedMode: false,
  };
  return {
    syncToBMAD: vi.fn().mockResolvedValue({ storyId: "", success: true }),
    syncFromBMAD: vi.fn().mockResolvedValue({ storyId: "", success: true }),
    syncAll: vi.fn().mockResolvedValue({ succeeded: [], failed: [], conflicts: [], duration: 0 }),
    getStatus: vi.fn().mockReturnValue(status),
    retryFailed: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined),
  };
}

function createMockBMADTracker(): BMADTracker {
  return {
    name: "mock-bmad",
    getStory: vi.fn().mockResolvedValue(null),
    updateStory: vi.fn().mockResolvedValue(undefined),
    listStories: vi.fn().mockResolvedValue(new Map()),
    isAvailable: vi.fn().mockResolvedValue(true),
  };
}

function createMockEventBus(): EventBus {
  return {
    name: "mock-bus",
    publish: vi.fn().mockResolvedValue(undefined),
    subscribe: vi.fn().mockResolvedValue(() => {}),
    isConnected: vi.fn().mockReturnValue(true),
    isDegraded: vi.fn().mockReturnValue(false),
    getQueueSize: vi.fn().mockReturnValue(0),
    close: vi.fn().mockResolvedValue(undefined),
  };
}

// ---------------------------------------------------------------------------
// We mock the factory functions so SyncBridge uses our controllable fakes
// ---------------------------------------------------------------------------

const mockStateManager = createMockStateManager();
const mockFileWatcher = createMockFileWatcher();
const mockSyncService = createMockSyncService();

vi.mock("../state-manager.js", () => ({
  createStateManager: vi.fn(() => mockStateManager),
}));

vi.mock("../file-watcher.js", () => ({
  createFileWatcher: vi.fn(() => mockFileWatcher),
}));

vi.mock("../sync-service.js", () => ({
  createSyncService: vi.fn(() => mockSyncService),
}));

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("SyncBridge", () => {
  const mockTracker = createMockBMADTracker();
  const mockEventBus = createMockEventBus();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("initialize() creates and wires all three services", async () => {
    const bridge = createSyncBridge({
      sprintStatusPath: "/fake/sprint-status.yaml",
      bmadTracker: mockTracker,
      eventBus: mockEventBus,
    });

    await bridge.initialize();

    // StateManager should be initialized
    expect(mockStateManager.initialize).toHaveBeenCalledOnce();

    // FileWatcher should watch the sprint-status.yaml path
    expect(mockFileWatcher.watch).toHaveBeenCalledWith("/fake/sprint-status.yaml");
  });

  it("getStateManager() returns the StateManager instance", async () => {
    const bridge = createSyncBridge({
      sprintStatusPath: "/fake/sprint-status.yaml",
      bmadTracker: mockTracker,
      eventBus: mockEventBus,
    });

    await bridge.initialize();

    const sm = bridge.getStateManager();
    expect(sm).toBe(mockStateManager);
  });

  it("getStateManager() throws if not initialized", () => {
    const bridge = createSyncBridge({
      sprintStatusPath: "/fake/sprint-status.yaml",
      bmadTracker: mockTracker,
    });

    expect(() => bridge.getStateManager()).toThrow("not initialized");
  });

  it("getStatus() aggregates status from all services", async () => {
    const bridge = createSyncBridge({
      sprintStatusPath: "/fake/sprint-status.yaml",
      bmadTracker: mockTracker,
      eventBus: mockEventBus,
    });

    await bridge.initialize();

    vi.mocked(mockFileWatcher.isWatching).mockReturnValue(true);
    vi.mocked(mockStateManager.getAll).mockReturnValue(new Map([["s-1", {} as StoryState]]));

    const status = bridge.getStatus();
    expect(status.initialized).toBe(true);
    expect(status.watcherActive).toBe(true);
    expect(status.cacheSize).toBe(1);
    expect(status.syncStatus).toBeDefined();
  });

  it("close() tears down all services in reverse order", async () => {
    const callOrder: string[] = [];
    vi.mocked(mockSyncService.close).mockImplementation(async () => {
      callOrder.push("sync");
    });
    vi.mocked(mockFileWatcher.close).mockImplementation(async () => {
      callOrder.push("watcher");
    });
    vi.mocked(mockStateManager.close).mockImplementation(async () => {
      callOrder.push("state");
    });

    const bridge = createSyncBridge({
      sprintStatusPath: "/fake/sprint-status.yaml",
      bmadTracker: mockTracker,
    });

    await bridge.initialize();
    await bridge.close();

    expect(callOrder).toEqual(["sync", "watcher", "state"]);
  });

  it("close() is idempotent — safe to call multiple times", async () => {
    const bridge = createSyncBridge({
      sprintStatusPath: "/fake/sprint-status.yaml",
      bmadTracker: mockTracker,
    });

    await bridge.initialize();
    await bridge.close();
    await bridge.close(); // second call should not throw

    // Each close method called exactly once
    expect(mockSyncService.close).toHaveBeenCalledOnce();
    expect(mockFileWatcher.close).toHaveBeenCalledOnce();
    expect(mockStateManager.close).toHaveBeenCalledOnce();
  });

  it("getStatus() returns uninitialized status before initialize()", () => {
    const bridge = createSyncBridge({
      sprintStatusPath: "/fake/sprint-status.yaml",
      bmadTracker: mockTracker,
    });

    const status = bridge.getStatus();
    expect(status.initialized).toBe(false);
    expect(status.cacheSize).toBe(0);
    expect(status.watcherActive).toBe(false);
  });

  it("uses default pollInterval when not specified", async () => {
    const bridge = createSyncBridge({
      sprintStatusPath: "/fake/sprint-status.yaml",
      bmadTracker: mockTracker,
    });

    await bridge.initialize();

    // SyncService factory should have been called — we can verify it was invoked
    const { createSyncService: mockCreate } = await import("../sync-service.js");
    expect(mockCreate).toHaveBeenCalled();
  });
});
