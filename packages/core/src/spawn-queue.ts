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
  /** Higher number = higher priority. Default: 0. (Story 43.4) */
  priority: number;
  /** Insertion order for stable sort when priorities are equal. */
  insertionOrder: number;
}

/** Queue state for API responses. */
export interface SpawnQueueState {
  pending: number;
  running: number;
  limit: number | null;
  entries: Array<{ storyId?: string; enqueuedAt: string; priority: number }>;
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
  let insertionCounter = 0; // Grows indefinitely — safe up to Number.MAX_SAFE_INTEGER (9 quadrillion)

  // Note: calls sessionManager.list() on each check. Acceptable for current scale;
  // if session count grows large, consider caching with short TTL.
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

      // Pick highest-priority entry (Story 43.4). Stable: equal priority → FIFO.
      // O(n) scan + splice. Acceptable for queues <100 items. Upgrade to heap if needed.
      if (queue.length === 0) {
        processing = false;
        return;
      }
      let bestIdx = 0;
      for (let i = 1; i < queue.length; i++) {
        const best = queue[bestIdx];
        const candidate = queue[i];
        if (
          candidate.priority > best.priority ||
          (candidate.priority === best.priority && candidate.insertionOrder < best.insertionOrder)
        ) {
          bestIdx = i;
        }
      }
      const entry = queue.splice(bestIdx, 1)[0];

      try {
        const session = await config.sessionManager.spawn(entry.config);
        entry.resolve(session);
      } catch (err) {
        entry.reject(err instanceof Error ? err : new Error(String(err)));
      }
    } finally {
      processing = false;
    }

    // Check if more queued items can be processed.
    // Use queueMicrotask to break recursion stack with large queues.
    if (queue.length > 0) {
      queueMicrotask(() => void processNext());
    }
  }

  const spawnQueue: SpawnQueue = {
    async enqueue(spawnConfig: SessionSpawnConfig): Promise<Session> {
      // No limit = bypass queue entirely (unlimited mode)
      if (limit === null) {
        return config.sessionManager.spawn(spawnConfig);
      }

      // ALL limited spawns go through queue to prevent race conditions.
      // processNext() handles sequential WIP checking + spawning.
      return new Promise<Session>((resolve, reject) => {
        queue.push({
          config: spawnConfig,
          resolve,
          reject,
          enqueuedAt: new Date().toISOString(),
          priority: spawnConfig.priority ?? 0,
          insertionOrder: insertionCounter++,
        });
        // Trigger processing (may spawn immediately if under limit)
        queueMicrotask(() => void processNext());
      });
    },

    async getState(): Promise<SpawnQueueState> {
      const running = await getRunningCount();
      // Return entries sorted by priority (highest first) for display
      const sorted = [...queue].sort((a, b) =>
        b.priority !== a.priority ? b.priority - a.priority : a.insertionOrder - b.insertionOrder,
      );
      return {
        pending: queue.length,
        running,
        limit,
        entries: sorted.map((e) => ({
          storyId: e.config.issueId,
          enqueuedAt: e.enqueuedAt,
          priority: e.priority,
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

  // Auto-register in service registry. Only one queue should be created per process.
  // Tests should call clearServiceRegistry() in beforeEach.
  registerSpawnQueue(spawnQueue);
  return spawnQueue;
}
