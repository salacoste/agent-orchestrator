/**
 * Tests for DLQ Auto-Replay Service — replays DLQ entries on startup
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { runDLQAutoReplay } from "../dlq-auto-replay.js";
import type { DLQEntry } from "../dead-letter-queue.js";
// Mock the replay handlers module — must be before the import
vi.mock("../dlq-replay-handlers.js", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...(actual as Record<string, unknown>),
    replayEntry: vi.fn(),
  };
});

import { replayEntry, type ReplayContext, type DLQReplayResult } from "../dlq-replay-handlers.js";

const mockReplayEntry = vi.mocked(replayEntry);

function makeDLQEntry(overrides: Partial<DLQEntry> = {}): DLQEntry {
  return {
    errorId: `err-${Math.random().toString(36).slice(2, 8)}`,
    operation: "bmad_sync",
    payload: { storyId: "1-1" },
    failureReason: "Connection timeout",
    retryCount: 3,
    failedAt: new Date().toISOString(),
    originalError: { message: "Timeout", name: "Error" },
    ...overrides,
  };
}

function createMockDLQ(entries: DLQEntry[]) {
  return {
    list: vi.fn().mockResolvedValue([...entries]),
    remove: vi.fn().mockResolvedValue(true),
    start: vi.fn(),
    stop: vi.fn(),
    onAlert: vi.fn(),
    enqueue: vi.fn(),
    get: vi.fn(),
    replay: vi.fn(),
    purge: vi.fn(),
    getStats: vi.fn(),
  };
}

describe("runDLQAutoReplay", () => {
  const context: ReplayContext = {};

  beforeEach(() => {
    vi.useFakeTimers();
    mockReplayEntry.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("replays all entries and removes successful ones from DLQ", async () => {
    const entry1 = makeDLQEntry({ errorId: "e1", operation: "bmad_sync" });
    const entry2 = makeDLQEntry({ errorId: "e2", operation: "event_publish" });
    const dlq = createMockDLQ([entry1, entry2]);

    mockReplayEntry.mockResolvedValue({
      success: true,
      entryId: "",
      operationType: "",
    });

    const result = await runDLQAutoReplay(dlq as never, context);

    expect(result.replayed).toBe(2);
    expect(result.failed).toBe(0);
    expect(result.skipped).toBe(0);
    expect(result.timedOut).toBe(false);
    expect(dlq.remove).toHaveBeenCalledTimes(2);
    expect(dlq.remove).toHaveBeenCalledWith("e1");
    expect(dlq.remove).toHaveBeenCalledWith("e2");
  });

  it("leaves failed replay entries in DLQ", async () => {
    const entry1 = makeDLQEntry({ errorId: "e1" });
    const entry2 = makeDLQEntry({ errorId: "e2" });
    const dlq = createMockDLQ([entry1, entry2]);

    mockReplayEntry
      .mockResolvedValueOnce({ success: true, entryId: "e1", operationType: "bmad_sync" })
      .mockResolvedValueOnce({
        success: false,
        error: "Service unavailable",
        entryId: "e2",
        operationType: "bmad_sync",
      });

    const result = await runDLQAutoReplay(dlq as never, context);

    expect(result.replayed).toBe(1);
    expect(result.failed).toBe(1);
    expect(dlq.remove).toHaveBeenCalledTimes(1);
    expect(dlq.remove).toHaveBeenCalledWith("e1");
  });

  it("skips entries with no registered handler", async () => {
    const entry = makeDLQEntry({ errorId: "e1", operation: "unknown_op" });
    const dlq = createMockDLQ([entry]);

    mockReplayEntry.mockResolvedValue({
      success: false,
      error: "No replay handler registered for operation type: unknown_op",
      entryId: "e1",
      operationType: "unknown_op",
    });

    const result = await runDLQAutoReplay(dlq as never, context);

    expect(result.skipped).toBe(1);
    expect(result.replayed).toBe(0);
    expect(result.failed).toBe(0);
    expect(dlq.remove).not.toHaveBeenCalled();
  });

  it("respects timeout and reports remaining as skipped", async () => {
    const entries = Array.from({ length: 5 }, (_, i) => makeDLQEntry({ errorId: `e${i}` }));
    const dlq = createMockDLQ(entries);

    // First replay takes "31 seconds" (simulated via Date.now advancement)
    let callCount = 0;
    mockReplayEntry.mockImplementation(async () => {
      callCount++;
      if (callCount === 1) {
        // After first replay, advance time past timeout
        vi.advanceTimersByTime(31_000);
      }
      return { success: true, entryId: "", operationType: "" } as DLQReplayResult;
    });

    const resultPromise = runDLQAutoReplay(dlq as never, context, 30_000);
    const result = await resultPromise;

    expect(result.timedOut).toBe(true);
    expect(result.replayed).toBe(1);
    // Remaining 4 entries should be reported as skipped
    expect(result.skipped).toBe(4);
  });

  it("processes entries in FIFO order (oldest first)", async () => {
    const entry1 = makeDLQEntry({
      errorId: "oldest",
      failedAt: "2026-03-01T00:00:00.000Z",
    });
    const entry2 = makeDLQEntry({
      errorId: "middle",
      failedAt: "2026-03-02T00:00:00.000Z",
    });
    const entry3 = makeDLQEntry({
      errorId: "newest",
      failedAt: "2026-03-03T00:00:00.000Z",
    });
    // DLQ list returns in insertion order (FIFO)
    const dlq = createMockDLQ([entry1, entry2, entry3]);

    const replayOrder: string[] = [];
    mockReplayEntry.mockImplementation(async (entry) => {
      replayOrder.push((entry as DLQEntry).errorId);
      return { success: true, entryId: "", operationType: "" };
    });

    await runDLQAutoReplay(dlq as never, context);

    expect(replayOrder).toEqual(["oldest", "middle", "newest"]);
  });

  it("handles empty DLQ gracefully", async () => {
    const dlq = createMockDLQ([]);

    const result = await runDLQAutoReplay(dlq as never, context);

    expect(result.replayed).toBe(0);
    expect(result.failed).toBe(0);
    expect(result.skipped).toBe(0);
    expect(result.timedOut).toBe(false);
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
  });
});
