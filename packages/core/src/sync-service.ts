/**
 * Sync Service
 *
 * Bidirectional state synchronization between Agent Orchestrator and BMAD tracker.
 * Handles conflict resolution with timestamp-based "last write wins" strategy.
 * Supports degraded mode when BMAD tracker is unavailable.
 */

import type {
  SyncService,
  SyncServiceConfig,
  SyncDirection,
  SyncResult,
  SyncAllResult,
  SyncStatus,
  StoryState,
  ConflictInfo,
} from "./types.js";

export class SyncServiceImpl implements SyncService {
  private config: SyncServiceConfig;
  private syncQueue: Map<string, PendingSync> = new Map();
  private failedSyncs: Map<string, FailedSync> = new Map();
  private lastSyncTime: string | null = null;
  private degradedMode = false;
  private pollTimer?: NodeJS.Timeout;

  constructor(config: SyncServiceConfig) {
    this.config = config;
    this.initialize();
  }

  private async initialize(): Promise<void> {
    // Subscribe to state change events
    await this.config.eventBus.subscribe(async (event) => {
      // Filter for relevant story events
      const eventType = event.eventType;
      if (
        eventType === "story.completed" ||
        eventType === "story.started" ||
        eventType === "story.blocked"
      ) {
        const storyId = event.metadata.storyId as string;
        const state = this.config.stateManager.get(storyId);
        if (state) {
          await this.syncToBMAD(storyId, state);
        }
      }
    });

    // Start polling for BMAD changes
    this.startPolling();

    // Check BMAD availability
    await this.checkBMADAvailability();
  }

  async syncToBMAD(storyId: string, state: StoryState): Promise<SyncResult> {
    if (!this.config.bmadTracker) {
      return {
        storyId,
        success: false,
        error: "BMAD tracker not configured",
      };
    }

    try {
      // Check for conflicts
      const bmadState = await this.config.bmadTracker.getStory(storyId);
      if (bmadState && bmadState.version !== state.version) {
        const conflict = this.resolveConflict(state, bmadState);
        if (conflict && conflict.resolvedState) {
          // Apply resolved state
          await this.config.bmadTracker.updateStory(storyId, conflict.resolvedState);

          await this.config.eventBus.publish({
            eventType: "sync.conflict_resolved",
            metadata: {
              storyId,
              winner: conflict.winner,
              localTimestamp: conflict.localTimestamp,
              bmadTimestamp: conflict.bmadTimestamp,
              resolvedTimestamp: conflict.resolvedState.updatedAt,
            },
          });

          return {
            storyId,
            success: true,
            conflict,
          };
        }
      }

      // Push to BMAD
      await this.config.bmadTracker.updateStory(storyId, state);

      // Log success
      await this.config.eventBus.publish({
        eventType: "sync.completed",
        metadata: {
          storyId,
          direction: "to-bmad",
          timestamp: new Date().toISOString(),
        },
      });

      return {
        storyId,
        success: true,
      };
    } catch (error) {
      const errorMsg = (error as Error).message;

      // Queue for retry
      this.syncQueue.set(storyId, {
        storyId,
        state,
        direction: "to-bmad",
        retryCount: 0,
      });

      return {
        storyId,
        success: false,
        error: errorMsg,
      };
    }
  }

  async syncFromBMAD(storyId: string): Promise<SyncResult> {
    try {
      const bmadState = await this.config.bmadTracker.getStory(storyId);
      if (!bmadState) {
        return {
          storyId,
          success: false,
          error: `Story ${storyId} not found in BMAD`,
        };
      }

      const localState = this.config.stateManager.get(storyId);

      // Check for conflicts
      if (localState && localState.version !== bmadState.version) {
        const conflict = this.resolveConflict(localState, bmadState);
        if (conflict && conflict.resolvedState) {
          // Update local with resolved state
          await this.config.stateManager.set(storyId, conflict.resolvedState);
        }
      } else {
        // No conflict, update local
        await this.config.stateManager.set(storyId, bmadState);
      }

      // Invalidate cache
      await this.config.stateManager.invalidate();

      // Publish event
      await this.config.eventBus.publish({
        eventType: "sync.external_update",
        metadata: {
          storyId,
          direction: "from-bmad",
          timestamp: new Date().toISOString(),
        },
      });

      return {
        storyId,
        success: true,
      };
    } catch (error) {
      return {
        storyId,
        success: false,
        error: (error as Error).message,
      };
    }
  }

  async syncAll(direction: SyncDirection = "bidirectional"): Promise<SyncAllResult> {
    const start = Date.now();
    const succeeded: string[] = [];
    const failed: Array<{ storyId: string; error: string }> = [];
    const conflicts: Array<{ storyId: string; info: ConflictInfo }> = [];

    if (direction === "to-bmad") {
      // Sync local stories to BMAD
      const localStories = this.config.stateManager.getAll();
      for (const [storyId, localState] of localStories.entries()) {
        const result = await this.syncToBMAD(storyId, localState);
        if (result.success) {
          succeeded.push(storyId);
        } else {
          failed.push({ storyId, error: result.error || "Unknown error" });
        }
      }
    } else if (direction === "from-bmad") {
      // Sync all stories from BMAD
      const bmadStories = await this.config.bmadTracker.listStories();
      for (const [storyId] of bmadStories.entries()) {
        const result = await this.syncFromBMAD(storyId);
        if (result.success) {
          succeeded.push(storyId);
        } else {
          failed.push({ storyId, error: result.error || "Unknown error" });
        }
      }
    } else {
      // Bidirectional - sync from BMAD and resolve conflicts
      const bmadStories = await this.config.bmadTracker.listStories();
      for (const [storyId, bmadState] of bmadStories.entries()) {
        const localState = this.config.stateManager.get(storyId);
        if (localState && localState.version !== bmadState.version) {
          const conflict = this.resolveConflict(localState, bmadState);
          if (conflict) {
            conflicts.push({ storyId, info: conflict });
            // Apply resolved state
            if (conflict.resolvedState) {
              await this.config.stateManager.set(storyId, conflict.resolvedState);
              succeeded.push(storyId);
            }
          }
        } else {
          succeeded.push(storyId);
        }
      }
    }

    const duration = Date.now() - start;

    return {
      succeeded,
      failed,
      conflicts,
      duration,
    };
  }

  getStatus(): SyncStatus {
    return {
      lastSyncTime: this.lastSyncTime,
      queueSize: this.syncQueue.size,
      failedCount: this.failedSyncs.size,
      bmadConnected: !this.degradedMode,
      degradedMode: this.degradedMode,
    };
  }

  async retryFailed(): Promise<void> {
    // Retry pending syncs from queue
    for (const [storyId, pending] of this.syncQueue.entries()) {
      if (pending.direction === "to-bmad") {
        await this.syncToBMAD(storyId, pending.state);
      } else {
        await this.syncFromBMAD(storyId);
      }

      // Remove from queue after retry attempt
      this.syncQueue.delete(storyId);
    }
  }

  async close(): Promise<void> {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
    }

    // Flush pending syncs
    for (const [storyId, pending] of this.syncQueue.entries()) {
      if (pending.direction === "to-bmad") {
        await this.syncToBMAD(storyId, pending.state);
      }
    }
  }

  private startPolling(): void {
    this.pollTimer = setInterval(async () => {
      try {
        // Poll BMAD for changes
        const bmadStories = await this.config.bmadTracker.listStories();
        const localStories = this.config.stateManager.getAll();

        // Find stories that changed in BMAD
        for (const [storyId, bmadState] of bmadStories.entries()) {
          const localState = localStories.get(storyId);
          if (!localState || localState.version !== bmadState.version) {
            // Sync from BMAD
            await this.syncFromBMAD(storyId);
          }
        }

        this.lastSyncTime = new Date().toISOString();
      } catch {
        // Log error but continue polling - silence error as it's unused
        // eslint-disable-next-line no-console
        console.error("Poll error: Failed to sync from BMAD");
      }
    }, this.config.pollInterval || 10000);
  }

  private async checkBMADAvailability(): Promise<void> {
    try {
      const available = await this.config.bmadTracker.isAvailable();
      if (!available) {
        this.enterDegradedMode();
      }
    } catch {
      // Error checking availability - enter degraded mode
      this.enterDegradedMode();
    }
  }

  private enterDegradedMode(): void {
    if (!this.degradedMode) {
      // eslint-disable-next-line no-console
      console.warn("BMAD tracker unavailable. State queued for sync.");
      this.degradedMode = true;

      // Retry connection with exponential backoff
      const retryDelays = this.config.retryDelays || [1000, 2000, 4000, 8000, 16000];

      const retryWithBackoff = async (index: number): Promise<void> => {
        if (index >= retryDelays.length) {
          // Exhausted all retries, stop attempting
          return;
        }

        setTimeout(async () => {
          try {
            const available = await this.config.bmadTracker.isAvailable();
            if (available) {
              // eslint-disable-next-line no-console
              console.info("BMAD tracker reconnected");
              this.degradedMode = false;

              // Flush queued syncs
              await this.retryFailed();
              return; // Success, stop retrying
            }
          } catch {
            // Still unavailable, continue to next retry
          }

          // Retry with next delay (exponential backoff)
          await retryWithBackoff(index + 1);
        }, retryDelays[index]);
      };

      // Start first retry
      retryWithBackoff(0);
    }
  }

  private resolveConflict(local: StoryState, bmad: StoryState): ConflictInfo | null {
    // Timestamp-based resolution: last write wins
    const localTime = new Date(local.updatedAt).getTime();
    const bmadTime = new Date(bmad.updatedAt).getTime();

    if (localTime === bmadTime) {
      // Same timestamp - prefer local
      return {
        type: "same_timestamp",
        localTimestamp: local.updatedAt,
        bmadTimestamp: bmad.updatedAt,
        resolvedState: local,
      };
    }

    const winner = localTime > bmadTime ? "local" : "bmad";
    const resolvedState = winner === "local" ? local : bmad;

    return {
      type: "timestamp_mismatch",
      localTimestamp: local.updatedAt,
      bmadTimestamp: bmad.updatedAt,
      winner,
      resolvedState,
    };
  }
}

interface PendingSync {
  storyId: string;
  state: StoryState;
  direction: "to-bmad" | "from-bmad";
  retryCount: number;
}

interface FailedSync {
  storyId: string;
  state: StoryState;
  direction: "to-bmad" | "from-bmad";
  attempts: number;
  lastError: string;
}

/**
 * Factory function to create a SyncService instance
 * @param config - Sync service configuration
 * @returns SyncService instance
 */
export function createSyncService(config: SyncServiceConfig): SyncService {
  return new SyncServiceImpl(config);
}
