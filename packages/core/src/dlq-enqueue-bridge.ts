/**
 * DLQ Enqueue Bridge — creates an onNonRetryable callback wired to a DLQ instance
 *
 * Bridges RetryService's onNonRetryable callback to DeadLetterQueueService.enqueue(),
 * formatting the standardized DLQ payload from the error and retry history.
 */

import type { DeadLetterQueueService } from "./dead-letter-queue.js";
import type { RetryHistoryEntry } from "./retry-service.js";

/**
 * Create an onNonRetryable callback that enqueues failed operations to the DLQ.
 *
 * @param dlq - DeadLetterQueueService instance to enqueue to
 * @param operationType - Operation type string (e.g., "bmad_sync", "event_publish")
 * @returns Callback suitable for RetryOptions.onNonRetryable
 */
export function createDLQEnqueueCallback(
  dlq: DeadLetterQueueService,
  operationType: string,
): (error: Error, retryHistory: RetryHistoryEntry[]) => Promise<void> {
  return async (error: Error, retryHistory: RetryHistoryEntry[]): Promise<void> => {
    try {
      await dlq.enqueue({
        operation: operationType,
        payload: { error: error.message, retryHistory },
        failureReason: error.message,
        retryCount: retryHistory.length,
        originalError: error,
      });
    } catch {
      // DLQ enqueue failure should never propagate — silently swallow
    }
  };
}
