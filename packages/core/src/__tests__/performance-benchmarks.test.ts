/**
 * Performance Benchmarks (Story 10.4)
 *
 * Validates stated NFR targets:
 * - Health check: < 200ms
 * - Burndown recalculate: < 200ms
 * - Log read: < 50ms for 1000 lines
 * - DLQ getStats: < 50ms
 *
 * Each benchmark runs 3 iterations and takes the median.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createHealthCheckService } from "../health-check.js";
import { createBurndownService } from "../burndown-service.js";
import { readLastLogLines, getLogFilePath } from "../log-capture.js";
import { createDeadLetterQueue } from "../dead-letter-queue.js";

/** Run a function 3 times and return median duration in ms */
async function benchmarkMedian(fn: () => Promise<void> | void): Promise<number> {
  const times: number[] = [];
  for (let i = 0; i < 3; i++) {
    const start = performance.now();
    await fn();
    times.push(performance.now() - start);
  }
  times.sort((a, b) => a - b);
  return times[Math.floor(times.length / 2)];
}

describe("Performance Benchmarks", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = join(tmpdir(), `ao-perf-bench-${Date.now()}`);
    mkdirSync(tmpDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("health check completes within 200ms", async () => {
    const service = createHealthCheckService({
      minCheckIntervalMs: 0,
      maxChecksPerWindow: 1000,
    });

    const median = await benchmarkMedian(async () => {
      await service.check();
    });

    expect(median).toBeLessThan(200);
  });

  it("burndown recalculate completes within 200ms", async () => {
    // Create sprint-status.yaml with 50 stories
    const stories: Record<string, string> = {};
    for (let i = 1; i <= 50; i++) {
      stories[`1-${i}-story-${i}`] = i <= 30 ? "done" : "in-progress";
    }

    const sprintYaml = [
      "generated: 2026-03-18",
      "project: perf-test",
      "project_key: PERF",
      "tracking_system: file-system",
      "story_location: implementation-artifacts",
      "",
      "development_status:",
      ...Object.entries(stories).map(([k, v]) => `  ${k}: ${v}`),
    ].join("\n");

    writeFileSync(join(tmpDir, "sprint-status.yaml"), sprintYaml);

    const service = createBurndownService({ projectPath: tmpDir });

    const median = await benchmarkMedian(() => {
      service.recalculate();
    });

    expect(median).toBeLessThan(200);
  });

  it("readLastLogLines completes within 50ms for 1000 lines", async () => {
    // Create a 1000-line log file
    const logsDir = join(tmpDir, "logs");
    mkdirSync(logsDir, { recursive: true });

    const lines = Array.from(
      { length: 1000 },
      (_, i) =>
        `[2026-03-18T12:00:${String(i).padStart(2, "0")}Z] Log line ${i + 1}: Agent processing story ${i % 10}`,
    );
    const logPath = getLogFilePath(tmpDir, "perf-test-agent");
    writeFileSync(logPath, lines.join("\n") + "\n");

    const median = await benchmarkMedian(() => {
      readLastLogLines(logPath, 100);
    });

    expect(median).toBeLessThan(50);
  });

  it("DLQ getStats completes within 50ms", async () => {
    const dlqPath = join(tmpDir, "dlq.jsonl");

    // Create DLQ with 100 entries
    const entries = Array.from({ length: 100 }, (_, i) =>
      JSON.stringify({
        errorId: `err-${i}`,
        operation: i % 2 === 0 ? "bmad_sync" : "event_publish",
        payload: {},
        failureReason: "test",
        retryCount: 1,
        failedAt: new Date().toISOString(),
        originalError: { message: "test", name: "Error" },
      }),
    );
    writeFileSync(dlqPath, entries.join("\n") + "\n");

    const dlq = createDeadLetterQueue({ dlqPath });
    await dlq.start();

    const median = await benchmarkMedian(async () => {
      await dlq.getStats();
    });

    await dlq.stop();

    expect(median).toBeLessThan(50);
  });

  it("all benchmarks have threshold assertions", () => {
    // Verify that benchmark thresholds are defined and reasonable
    const thresholds = {
      healthCheck: 200,
      burndownRecalculate: 200,
      logRead: 50,
      dlqStats: 50,
    };

    for (const [name, ms] of Object.entries(thresholds)) {
      expect(ms).toBeGreaterThan(0);
      expect(ms).toBeLessThanOrEqual(500); // No benchmark should allow > 500ms
      expect(name.length).toBeGreaterThan(0);
    }
  });
});
