/**
 * DLQ Auto-Replay Service — replays DLQ entries on startup with a 30-second drain timeout
 *
 * On orchestrator startup, loads pending DLQ entries and replays them in FIFO order
 * (oldest first) using registered replay handlers. Entries that fail replay remain
 * in the DLQ. If the 30-second timeout is reached, remaining entries are skipped.
 */

import type { DeadLetterQueueService } from "./dead-letter-queue.js";
import { replayEntry, NO_HANDLER_ERROR_PREFIX, type ReplayContext } from "./dlq-replay-handlers.js";

/** Result of auto-replay execution */
export interface DLQAutoReplayResult {
  /** Number of entries successfully replayed and removed from DLQ */
  replayed: number;
  /** Number of entries that failed replay (remain in DLQ) */
  failed: number;
  /** Number of entries skipped (no handler or timeout) */
  skipped: number;
  /** Whether the 30-second timeout was reached */
  timedOut: boolean;
  /** Total duration in milliseconds */
  durationMs: number;
}

/** Default drain timeout in milliseconds (30 seconds) */
const DEFAULT_DRAIN_TIMEOUT_MS = 30_000;

/**
 * Run auto-replay on DLQ entries.
 *
 * Replays entries in FIFO order (oldest first). Successful replays are removed
 * from the DLQ. Failed replays remain. Stops if the timeout is reached.
 *
 * @param dlq - DeadLetterQueueService instance (must be started / entries loaded)
 * @param context - ReplayContext with service dependencies
 * @param timeoutMs - Maximum time to spend replaying (default: 30000ms)
 * @returns Result summary
 */
export async function runDLQAutoReplay(
  dlq: DeadLetterQueueService,
  context: ReplayContext,
  timeoutMs: number = DEFAULT_DRAIN_TIMEOUT_MS,
): Promise<DLQAutoReplayResult> {
  const startTime = Date.now();
  let replayed = 0;
  let failed = 0;
  let skipped = 0;
  let timedOut = false;

  // Get current entries sorted by failedAt (oldest first — already in FIFO order)
  const entries = await dlq.list();

  for (const entry of entries) {
    // Check timeout
    if (Date.now() - startTime >= timeoutMs) {
      timedOut = true;
      skipped += entries.length - replayed - failed - skipped;
      break;
    }

    const result = await replayEntry(entry, context);

    if (result.success) {
      // Remove from DLQ on success
      await dlq.remove(entry.errorId);
      replayed++;
    } else if (result.error?.startsWith(NO_HANDLER_ERROR_PREFIX)) {
      skipped++;
    } else {
      // Replay failed — leave in DLQ
      failed++;
    }
  }

  return {
    replayed,
    failed,
    skipped,
    timedOut,
    durationMs: Date.now() - startTime,
  };
}
