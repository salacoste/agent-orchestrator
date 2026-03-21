/**
 * Integration test: end-to-end failure → DLQ → auto-replay → success path
 *
 * Simulates a complete lifecycle:
 * 1. Operation fails → RetryService exhausts retries → onNonRetryable callback fires
 * 2. DLQ enqueue bridge captures the failure in the DLQ
 * 3. Auto-replay on startup replays the entry successfully
 * 4. Entry is removed from DLQ
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { mkdir, unlink, rmdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { createDeadLetterQueue, type DeadLetterQueueService } from "../dead-letter-queue.js";
import { createDLQEnqueueCallback } from "../dlq-enqueue-bridge.js";
import { runDLQAutoReplay } from "../dlq-auto-replay.js";
import { createRetryService } from "../retry-service.js";
import {
  registerReplayHandler,
  clearReplayHandlers,
  type ReplayContext,
} from "../dlq-replay-handlers.js";
import { createEventBusBacklogMonitor } from "../eventbus-backlog-monitor.js";
import type { EventBus } from "../types.js";

/** Silent logger to suppress retry service console noise in tests */
const _SILENT: Pick<Console, "log" | "warn" | "error" | "info"> = {
  log() {},
  warn() {},
  error() {},
  info() {},
};

describe("DLQ Integration", () => {
  let dlq: DeadLetterQueueService;
  let dlqPath: string;
  let tempDir: string;

  beforeEach(async () => {
    tempDir = join(tmpdir(), `ao-dlq-integration-${Date.now()}`);
    await mkdir(tempDir, { recursive: true });
    dlqPath = join(tempDir, "dlq.jsonl");

    dlq = createDeadLetterQueue({ dlqPath, maxEntries: 100 });
    await dlq.start();
  });

  afterEach(async () => {
    clearReplayHandlers();
    await dlq.stop();
    if (existsSync(dlqPath)) {
      await unlink(dlqPath);
    }
    await rmdir(tempDir).catch(() => {});
  });

  it("end-to-end: failure → DLQ enqueue → auto-replay → success", async () => {
    // Step 1: Create a retry service with DLQ bridge callback
    const retryService = createRetryService({
      config: { maxAttempts: 2, initialBackoffMs: 10, jitterPercent: 0 },
    });
    const dlqCallback = createDLQEnqueueCallback(dlq, "test_integration");

    // Step 2: Operation fails permanently → onNonRetryable fires → DLQ enqueue
    const failingOp = async () => {
      throw new Error("Service unavailable");
    };

    try {
      await retryService.execute(failingOp, {
        operationName: "integration-test",
        maxAttempts: 2,
        isRetryable: () => false, // Non-retryable — fires onNonRetryable immediately
        onNonRetryable: dlqCallback,
        logger: _SILENT,
      });
    } catch {
      // Expected
    }

    // Verify entry is in DLQ
    const entries = await dlq.list();
    expect(entries.length).toBe(1);
    expect(entries[0].operation).toBe("test_integration");
    expect(entries[0].failureReason).toBe("Service unavailable");

    // Step 3: Register a replay handler that succeeds
    let replayedPayload: unknown = null;
    registerReplayHandler("test_integration", async (entry) => {
      replayedPayload = entry.payload;
      return {
        success: true,
        entryId: entry.errorId,
        operationType: entry.operation,
      };
    });

    // Step 4: Auto-replay on "startup" drains the entry
    const context: ReplayContext = {};
    const result = await runDLQAutoReplay(dlq, context);

    expect(result.replayed).toBe(1);
    expect(result.failed).toBe(0);
    expect(result.timedOut).toBe(false);
    expect(replayedPayload).toBeDefined();

    // Step 5: DLQ is now empty
    const entriesAfter = await dlq.list();
    expect(entriesAfter.length).toBe(0);

    const stats = await dlq.getStats();
    expect(stats.totalEntries).toBe(0);
  });

  it("FIFO eviction preserves newest entries at capacity", async () => {
    const smallDlq = createDeadLetterQueue({ dlqPath, maxEntries: 3 });

    for (let i = 0; i < 5; i++) {
      await smallDlq.enqueue({
        operation: `op_${i}`,
        payload: { index: i },
        failureReason: `failure ${i}`,
        retryCount: 1,
        originalError: new Error(`error ${i}`),
      });
    }

    const entries = await smallDlq.list();
    expect(entries.length).toBe(3);
    // Should have the last 3 entries (indices 2, 3, 4)
    expect(entries[0].operation).toBe("op_2");
    expect(entries[1].operation).toBe("op_3");
    expect(entries[2].operation).toBe("op_4");

    const stats = await smallDlq.getStats();
    expect(stats.atCapacity).toBe(true);
  });

  it("backlog monitor fires alert on high queue depth", () => {
    vi.useFakeTimers();

    const mockBus: EventBus = {
      name: "test-bus",
      publish: vi.fn().mockResolvedValue(undefined),
      subscribe: vi.fn().mockResolvedValue(() => {}),
      isConnected: vi.fn().mockReturnValue(true),
      isDegraded: vi.fn().mockReturnValue(false),
      getQueueSize: vi.fn().mockReturnValue(500),
      close: vi.fn().mockResolvedValue(undefined),
    };

    const alertSizes: number[] = [];
    const monitor = createEventBusBacklogMonitor({
      backlogThreshold: 100,
      checkIntervalMs: 1000,
      onAlert: (size) => alertSizes.push(size),
    });

    monitor.start(mockBus);
    vi.advanceTimersByTime(3000);

    // Should have fired exactly once (deduplication)
    expect(alertSizes).toEqual([500]);

    monitor.stop();
    vi.useRealTimers();
  });

  it("DLQ enqueue bridge handles DLQ failure gracefully", async () => {
    // Create a DLQ that fails on enqueue
    const brokenDlq = {
      enqueue: vi.fn().mockRejectedValue(new Error("Disk full")),
    } as unknown as DeadLetterQueueService;

    const callback = createDLQEnqueueCallback(brokenDlq, "broken_op");

    // Should not throw
    await expect(
      callback(new Error("original"), [{ attempt: 1, error: "x", delay: 100 }]),
    ).resolves.toBeUndefined();
  });

  it("auto-replay partial failure: some succeed, some fail, some skip", async () => {
    // Register handlers
    registerReplayHandler("success_op", async (entry) => ({
      success: true,
      entryId: entry.errorId,
      operationType: entry.operation,
    }));
    registerReplayHandler("fail_op", async (entry) => ({
      success: false,
      error: "Still broken",
      entryId: entry.errorId,
      operationType: entry.operation,
    }));
    // "unknown_op" has no handler — will be skipped

    await dlq.enqueue({
      operation: "success_op",
      payload: {},
      failureReason: "test",
      retryCount: 1,
      originalError: new Error("test"),
    });
    await dlq.enqueue({
      operation: "fail_op",
      payload: {},
      failureReason: "test",
      retryCount: 1,
      originalError: new Error("test"),
    });
    await dlq.enqueue({
      operation: "unknown_op",
      payload: {},
      failureReason: "test",
      retryCount: 1,
      originalError: new Error("test"),
    });

    const result = await runDLQAutoReplay(dlq, {});

    expect(result.replayed).toBe(1);
    expect(result.failed).toBe(1);
    expect(result.skipped).toBe(1);

    // Only success_op should be removed
    const remaining = await dlq.list();
    expect(remaining.length).toBe(2);
    expect(remaining[0].operation).toBe("fail_op");
    expect(remaining[1].operation).toBe("unknown_op");
  });
});
