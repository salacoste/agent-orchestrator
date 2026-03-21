/**
 * SyncBridge — orchestration layer that wires StateManager + FileWatcher +
 * SyncService together for bidirectional sprint-status.yaml synchronization.
 *
 * Creates and manages the lifecycle of all three services.
 * Consumers get a single entry point for the entire sync subsystem.
 */

import type {
  StateManager,
  FileWatcher,
  SyncService,
  SyncStatus,
  BMADTracker,
  EventBus,
} from "./types.js";
import { createStateManager } from "./state-manager.js";
import { createFileWatcher } from "./file-watcher.js";
import { createSyncService } from "./sync-service.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SyncBridgeConfig {
  /** Absolute path to sprint-status.yaml */
  sprintStatusPath: string;
  /** BMADTracker adapter for reading/writing the flat YAML */
  bmadTracker: BMADTracker;
  /** Optional event bus for publishing state change events */
  eventBus?: EventBus;
  /** Polling interval for SyncService (default: 10000ms) */
  pollInterval?: number;
}

export interface SyncBridgeStatus {
  initialized: boolean;
  cacheSize: number;
  watcherActive: boolean;
  syncStatus: SyncStatus | null;
}

export interface SyncBridge {
  /** Create and wire all three services */
  initialize(): Promise<void>;
  /** Tear down all services in reverse order */
  close(): Promise<void>;
  /** Get the StateManager instance (throws if not initialized) */
  getStateManager(): StateManager;
  /** Aggregate status from all services */
  getStatus(): SyncBridgeStatus;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createSyncBridge(config: SyncBridgeConfig): SyncBridge {
  let stateManager: StateManager | null = null;
  let fileWatcher: FileWatcher | null = null;
  let syncService: SyncService | null = null;
  let initialized = false;
  let closed = false;

  return {
    async initialize(): Promise<void> {
      if (initialized) return;

      // 1. Create StateManager pointed at sprint-status.yaml
      stateManager = createStateManager({
        yamlPath: config.sprintStatusPath,
        eventBus: config.eventBus,
        createBackup: true,
      });
      await stateManager.initialize();

      // 2. Create FileWatcher watching sprint-status.yaml
      fileWatcher = createFileWatcher({
        stateManager,
        eventBus: config.eventBus,
      });
      await fileWatcher.watch(config.sprintStatusPath);

      // 3. Create SyncService connecting StateManager ↔ BMADTracker
      syncService = createSyncService({
        eventBus: config.eventBus ?? createNoopEventBus(),
        stateManager,
        bmadTracker: config.bmadTracker,
        pollInterval: config.pollInterval,
      });

      initialized = true;
      closed = false;
    },

    async close(): Promise<void> {
      if (closed || !initialized) return;
      closed = true;

      // Tear down in reverse order: SyncService → FileWatcher → StateManager
      if (syncService) {
        await syncService.close();
      }
      if (fileWatcher) {
        await fileWatcher.close();
      }
      if (stateManager) {
        await stateManager.close();
      }

      initialized = false;
    },

    getStateManager(): StateManager {
      if (!stateManager || !initialized) {
        throw new Error("SyncBridge not initialized — call initialize() first");
      }
      return stateManager;
    },

    getStatus(): SyncBridgeStatus {
      if (!initialized || !stateManager) {
        return {
          initialized: false,
          cacheSize: 0,
          watcherActive: false,
          syncStatus: null,
        };
      }

      return {
        initialized: true,
        cacheSize: stateManager.getAll().size,
        watcherActive: fileWatcher?.isWatching(config.sprintStatusPath) ?? false,
        syncStatus: syncService?.getStatus() ?? null,
      };
    },
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Minimal no-op EventBus for when none is provided. */
function createNoopEventBus(): EventBus {
  return {
    name: "noop",
    async publish() {},
    async subscribe() {
      return () => {};
    },
    isConnected() {
      return false;
    },
    isDegraded() {
      return false;
    },
    getQueueSize() {
      return 0;
    },
    async close() {},
  };
}
