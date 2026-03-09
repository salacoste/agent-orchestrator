/**
 * Performance Test Helpers for Agent Orchestrator
 *
 * Provides utilities for measuring and asserting performance of operations.
 * Used to validate Non-Functional Requirements (NFRs).
 */

/**
 * Result of a performance measurement
 */
export interface PerformanceResult {
  /** Name of the operation being measured */
  name: string;
  /** Average duration in milliseconds */
  durationMs: number;
  /** Target duration in milliseconds */
  targetMs: number;
  /** Whether the operation met the target */
  passed: boolean;
  /** Number of iterations measured */
  iterations: number;
  /** Minimum duration observed */
  minMs: number;
  /** Maximum duration observed */
  maxMs: number;
  /** Standard deviation of measurements */
  stdDevMs: number;
  /** All individual measurements */
  measurements: number[];
}

/**
 * Options for performance measurement
 */
export interface MeasureOptions {
  /** Target duration in milliseconds */
  targetMs: number;
  /** Number of iterations to measure (default: 10) */
  iterations?: number;
  /** Number of warmup iterations to skip (default: 3) */
  warmupIterations?: number;
  /** Slack percentage allowed above target (default: 10) */
  slackPercent?: number;
}

/**
 * Performance thresholds for all NFRs
 */
export const PERFORMANCE_THRESHOLDS = {
  // Epic 2 NFRs
  AUDIT_TRAIL_APPEND: 100, // Story 2-4: Complete within 100ms
  CACHE_READ: 1, // Story 2-5: Sub-millisecond reads
  FILE_WATCHER_DEBOUNCE: 500, // Story 2-6: Debounce 500ms

  // Architecture NFRs
  STATE_SYNC_LATENCY: 5000, // NFR-P1: ≤5s state sync latency
  AGENT_SPAWN_TIME: 10000, // NFR-P2: ≤10s agent spawn
  CLI_RESPONSE: 500, // NFR-P3: ≤500ms CLI response
  DASHBOARD_LOAD: 2000, // NFR-P4: ≤2s dashboard load
  EVENT_THROUGHPUT_MIN: 100, // NFR-P6: 100+ events/second (min)
  EVENT_LATENCY: 500, // NFR-P7: ≤500ms event latency
} as const;

/**
 * Measure the performance of an async operation
 *
 * @param name - Name of the operation being measured
 * @param fn - The operation to measure
 * @param options - Measurement options
 * @returns Performance result with statistics
 */
export async function measurePerformance(
  name: string,
  fn: () => Promise<void> | void,
  options: MeasureOptions = { targetMs: 1000 },
): Promise<PerformanceResult> {
  const { targetMs, iterations = 10, warmupIterations = 3 } = options;

  // Warmup runs (not measured) - helps avoid cold start bias
  for (let i = 0; i < warmupIterations; i++) {
    await fn();
  }

  // Measured runs
  const measurements: number[] = [];
  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    await fn();
    const end = performance.now();
    measurements.push(end - start);
  }

  // Calculate statistics
  const sum = measurements.reduce((a, b) => a + b, 0);
  const durationMs = sum / iterations;
  const minMs = Math.min(...measurements);
  const maxMs = Math.max(...measurements);

  // Calculate standard deviation
  const squaredDiffs = measurements.map((m) => Math.pow(m - durationMs, 2));
  const avgSquaredDiff = squaredDiffs.reduce((a, b) => a + b, 0) / iterations;
  const stdDevMs = Math.sqrt(avgSquaredDiff);

  const passed = durationMs <= targetMs;

  return {
    name,
    durationMs,
    targetMs,
    passed,
    iterations,
    minMs,
    maxMs,
    stdDevMs,
    measurements,
  };
}

/**
 * Assert that a performance result meets its target
 *
 * @param result - The performance result to validate
 * @param slackPercent - Additional slack percentage allowed (default: 10)
 * @throws Error if performance exceeds threshold
 */
export function assertPerformance(result: PerformanceResult, slackPercent: number = 10): void {
  const threshold = result.targetMs * (1 + slackPercent / 100);
  if (result.durationMs > threshold) {
    throw new Error(
      `Performance test "${result.name}" failed: ` +
        `${result.durationMs.toFixed(2)}ms > ${threshold.toFixed(2)}ms ` +
        `(target: ${result.targetMs}ms + ${slackPercent}% slack)\n` +
        `  Min: ${result.minMs.toFixed(2)}ms, Max: ${result.maxMs.toFixed(2)}ms, ` +
        `StdDev: ${result.stdDevMs.toFixed(2)}ms`,
    );
  }
}

/**
 * Format a performance result for logging
 */
export function formatPerformanceResult(result: PerformanceResult): string {
  const status = result.passed ? "✅ PASS" : "❌ FAIL";
  return (
    `${status} ${result.name}: ${result.durationMs.toFixed(3)}ms ` +
    `(target: <${result.targetMs}ms) ` +
    `[min=${result.minMs.toFixed(2)}ms, max=${result.maxMs.toFixed(2)}ms, ` +
    `σ=${result.stdDevMs.toFixed(2)}ms, n=${result.iterations}]`
  );
}

/**
 * Measure throughput (operations per second)
 *
 * @param name - Name of the operation
 * @param fn - The operation to measure
 * @param durationMs - How long to run the test (default: 1000ms)
 * @returns Operations per second
 */
export async function measureThroughput(
  name: string,
  fn: () => Promise<void> | void,
  durationMs: number = 1000,
): Promise<{ name: string; opsPerSecond: number; totalOps: number; durationMs: number }> {
  const start = performance.now();
  let totalOps = 0;

  while (performance.now() - start < durationMs) {
    await fn();
    totalOps++;
  }

  const actualDuration = performance.now() - start;
  const opsPerSecond = (totalOps / actualDuration) * 1000;

  return {
    name,
    opsPerSecond,
    totalOps,
    durationMs: actualDuration,
  };
}

/**
 * Assert minimum throughput
 *
 * @param result - Throughput result
 * @param minOpsPerSecond - Minimum required operations per second
 * @throws Error if throughput is below threshold
 */
export function assertThroughput(
  result: { name: string; opsPerSecond: number },
  minOpsPerSecond: number,
): void {
  if (result.opsPerSecond < minOpsPerSecond) {
    throw new Error(
      `Throughput test "${result.name}" failed: ` +
        `${result.opsPerSecond.toFixed(1)} ops/s < ${minOpsPerSecond} ops/s minimum`,
    );
  }
}

/**
 * Performance test report
 */
export interface PerformanceReport {
  timestamp: string;
  results: PerformanceResult[];
  throughputResults: { name: string; opsPerSecond: number; totalOps: number; durationMs: number }[];
  passed: number;
  failed: number;
  totalDurationMs: number;
}

/**
 * Create a performance report from results
 */
export function createPerformanceReport(
  results: PerformanceResult[],
  throughputResults: {
    name: string;
    opsPerSecond: number;
    totalOps: number;
    durationMs: number;
  }[] = [],
): PerformanceReport {
  const passed = results.filter((r) => r.passed).length;
  const failed = results.length - passed;
  const totalDurationMs = results.reduce((sum, r) => sum + r.durationMs * r.iterations, 0);

  return {
    timestamp: new Date().toISOString(),
    results,
    throughputResults,
    passed,
    failed,
    totalDurationMs,
  };
}

/**
 * Format a performance report for console output
 */
export function formatPerformanceReport(report: PerformanceReport): string {
  const lines: string[] = [
    "═".repeat(60),
    "PERFORMANCE TEST REPORT",
    `Timestamp: ${report.timestamp}`,
    "═".repeat(60),
    "",
    "LATENCY TESTS:",
    "-".repeat(60),
  ];

  for (const result of report.results) {
    lines.push(formatPerformanceResult(result));
  }

  if (report.throughputResults.length > 0) {
    lines.push("", "THROUGHPUT TESTS:", "-".repeat(60));
    for (const result of report.throughputResults) {
      lines.push(`  ${result.name}: ${result.opsPerSecond.toFixed(1)} ops/s`);
    }
  }

  lines.push(
    "",
    "═".repeat(60),
    `SUMMARY: ${report.passed} passed, ${report.failed} failed`,
    `Total duration: ${report.totalDurationMs.toFixed(0)}ms`,
    "═".repeat(60),
  );

  return lines.join("\n");
}
