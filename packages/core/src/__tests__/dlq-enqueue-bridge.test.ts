/**
 * Tests for DLQ Enqueue Bridge — onNonRetryable callback wired to DLQ
 */

import { describe, it, expect, vi } from "vitest";
import { createDLQEnqueueCallback } from "../dlq-enqueue-bridge.js";
import type { DeadLetterQueueService } from "../dead-letter-queue.js";
import type { RetryHistoryEntry } from "../retry-service.js";

function createMockDLQ(): DeadLetterQueueService {
  return {
    start: vi.fn().mockResolvedValue(undefined),
    stop: vi.fn().mockResolvedValue(undefined),
    onAlert: vi.fn(),
    enqueue: vi.fn().mockResolvedValue("mock-error-id"),
    list: vi.fn().mockResolvedValue([]),
    get: vi.fn().mockResolvedValue(null),
    replay: vi.fn().mockResolvedValue(null),
    remove: vi.fn().mockResolvedValue(false),
    purge: vi.fn().mockResolvedValue(0),
    getStats: vi.fn().mockResolvedValue({
      totalEntries: 0,
      byOperation: {},
      oldestEntry: null,
      newestEntry: null,
      atCapacity: false,
    }),
  } as unknown as DeadLetterQueueService;
}

describe("createDLQEnqueueCallback", () => {
  it("enqueues to DLQ with correct payload format", async () => {
    const dlq = createMockDLQ();
    const callback = createDLQEnqueueCallback(dlq, "bmad_sync");

    const error = new Error("Connection timeout");
    const retryHistory: RetryHistoryEntry[] = [
      { attempt: 1, error: "Connection timeout", delay: 1000 },
      { attempt: 2, error: "Connection timeout", delay: 2000 },
    ];

    await callback(error, retryHistory);

    expect(dlq.enqueue).toHaveBeenCalledTimes(1);
    expect(dlq.enqueue).toHaveBeenCalledWith({
      operation: "bmad_sync",
      payload: { error: "Connection timeout", retryHistory },
      failureReason: "Connection timeout",
      retryCount: 2,
      originalError: error,
    });
  });

  it("uses the provided operationType in the enqueue payload", async () => {
    const dlq = createMockDLQ();
    const callback = createDLQEnqueueCallback(dlq, "event_publish");

    await callback(new Error("fail"), []);

    expect(dlq.enqueue).toHaveBeenCalledWith(
      expect.objectContaining({ operation: "event_publish" }),
    );
  });

  it("handles DLQ enqueue failure gracefully without throwing", async () => {
    const dlq = createMockDLQ();
    (dlq.enqueue as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("DLQ disk full"));

    const callback = createDLQEnqueueCallback(dlq, "bmad_sync");

    // Should not throw
    await expect(
      callback(new Error("original error"), [{ attempt: 1, error: "x", delay: 100 }]),
    ).resolves.toBeUndefined();
  });
});
