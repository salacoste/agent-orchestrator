/**
 * Spawn Queue — WIP-limited sequential agent spawning (Story 43.3).
 *
 * All spawn requests go through the queue. If under the WIP limit,
 * spawn immediately. If at limit, queue and auto-dequeue when an
 * agent finishes. Queue is in-memory (rebuilt from sprint-status on startup).
 */
import type { Session, SessionSpawnConfig, SessionManager } from "./types.js";
import { registerSpawnQueue } from "./service-registry.js";

/** Pending spawn request with resolver. */
interface QueueEntry {
  config: SessionSpawnConfig;
  resolve: (session: Session) => void;
  reject: (error: Error) => void;
  enqueuedAt: string;
}

/** Queue state for API responses. */
export interface SpawnQueueState {
  pending: number;
  running: number;
  limit: number | null;
  entries: Array<{ storyId?: string; enqueuedAt: string }>;
}

/** Spawn queue interface. */
export interface SpawnQueue {
  /** Enqueue a spawn request. Resolves when the session is actually spawned. */
  enqueue(config: SessionSpawnConfig): Promise<Session>;
  /** Get current queue state. */
  getState(): Promise<SpawnQueueState>;
  /** Process the next queued spawn if under WIP limit. */
  processNext(): Promise<void>;
  /** Stop the queue (for cleanup). */
  stop(): void;
}

export interface SpawnQueueConfig {
  maxConcurrentAgents?: number;
  sessionManager: SessionManager;
}

/**
 * Create a spawn queue with WIP limit enforcement.
 */
export function createSpawnQueue(config: SpawnQueueConfig): SpawnQueue {
  const limit = config.maxConcurrentAgents ?? null;
  const queue: QueueEntry[] = [];
  let processing = false;

  async function getRunningCount(): Promise<number> {
    const sessions = await config.sessionManager.list();
    return sessions.filter((s) => s.status === "working" || s.status === "spawning").length;
  }

  async function processNext(): Promise<void> {
    if (processing || queue.length === 0) return;
    processing = true;

    try {
      // Check WIP limit
      if (limit !== null) {
        const running = await getRunningCount();
        if (running >= limit) {
          processing = false;
          return; // At limit — wait for a slot
        }
      }

      const entry = queue.shift();
      if (!entry) {
        processing = false;
        return;
      }

      try {
        const session = await config.sessionManager.spawn(entry.config);
        entry.resolve(session);
      } catch (err) {
        entry.reject(err instanceof Error ? err : new Error(String(err)));
      }
    } finally {
      processing = false;
    }

    // Check if more queued items can be processed
    if (queue.length > 0) {
      void processNext();
    }
  }

  const spawnQueue: SpawnQueue = {
    async enqueue(spawnConfig: SessionSpawnConfig): Promise<Session> {
      // If no limit or under limit, try to spawn immediately
      if (limit === null) {
        return config.sessionManager.spawn(spawnConfig);
      }

      const running = await getRunningCount();
      if (running < limit && queue.length === 0) {
        // Under limit and no queue backlog — spawn directly
        return config.sessionManager.spawn(spawnConfig);
      }

      // At limit or queue has items — enqueue
      return new Promise<Session>((resolve, reject) => {
        queue.push({
          config: spawnConfig,
          resolve,
          reject,
          enqueuedAt: new Date().toISOString(),
        });
      });
    },

    async getState(): Promise<SpawnQueueState> {
      const running = await getRunningCount();
      return {
        pending: queue.length,
        running,
        limit,
        entries: queue.map((e) => ({
          storyId: e.config.issueId,
          enqueuedAt: e.enqueuedAt,
        })),
      };
    },

    processNext,

    stop() {
      // Reject all pending entries
      while (queue.length > 0) {
        const entry = queue.shift();
        entry?.reject(new Error("Queue stopped"));
      }
    },
  };

  registerSpawnQueue(spawnQueue);
  return spawnQueue;
}
