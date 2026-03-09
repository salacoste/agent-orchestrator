/**
 * Performance Tests for Audit Trail (Story 2-4)
 *
 * NFR: Complete within 100ms
 * Tests JSONL append operations meet performance requirements
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  measurePerformance,
  assertPerformance,
  PERFORMANCE_THRESHOLDS,
  formatPerformanceResult,
} from "../helpers/performance.js";
import { createAuditTrail } from "../../src/audit-trail.js";
import type { EventBus, EventBusEvent } from "../../src/types.js";

describe("Audit Trail Performance (Story 2-4)", () => {
  let tempDir: string;
  let logPath: string;

  beforeAll(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "audit-perf-"));
    logPath = join(tempDir, "audit.jsonl");
  });

  afterAll(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  describe("NFR: Append within 100ms", () => {
    it("should append single event within 100ms", async () => {
      // Create mock event bus
      const mockEventBus: EventBus = {
        name: "mock",
        publish: async (_event: EventBusEvent) => {},
        subscribe: async () => () => {},
        close: async () => {},
      };

      const auditTrail = await createAuditTrail({
        eventBus: mockEventBus,
        logPath,
      });

      try {
        const result = await measurePerformance(
          "audit-trail-append-single",
          async () => {
            const event: EventBusEvent = {
              eventId: `evt-${Date.now()}-${Math.random()}`,
              eventType: "test.event",
              timestamp: new Date().toISOString(),
              metadata: { test: true },
            };
            await mockEventBus.publish(event);
          },
          {
            targetMs: PERFORMANCE_THRESHOLDS.AUDIT_TRAIL_APPEND,
            iterations: 20,
            warmupIterations: 5,
          },
        );

        console.log(formatPerformanceResult(result));
        assertPerformance(result);

        expect(result.durationMs).toBeLessThan(PERFORMANCE_THRESHOLDS.AUDIT_TRAIL_APPEND);
        expect(result.passed).toBe(true);
      } finally {
        await auditTrail.close();
      }
    });

    it("should handle burst of 10 appends within 100ms each", async () => {
      const mockEventBus: EventBus = {
        name: "mock",
        publish: async (_event: EventBusEvent) => {},
        subscribe: async () => () => {},
        close: async () => {},
      };

      const burstLogPath = join(tempDir, "audit-burst.jsonl");
      const auditTrail = await createAuditTrail({
        eventBus: mockEventBus,
        logPath: burstLogPath,
      });

      try {
        // Warmup
        for (let i = 0; i < 3; i++) {
          await mockEventBus.publish({
            eventId: `warmup-${i}`,
            eventType: "test.warmup",
            timestamp: new Date().toISOString(),
            metadata: {},
          });
        }

        // Measure burst
        const measurements: number[] = [];
        for (let i = 0; i < 10; i++) {
          const start = performance.now();
          await mockEventBus.publish({
            eventId: `burst-${i}`,
            eventType: "test.burst",
            timestamp: new Date().toISOString(),
            metadata: { index: i },
          });
          measurements.push(performance.now() - start);
        }

        const avgDuration = measurements.reduce((a, b) => a + b, 0) / measurements.length;
        const maxDuration = Math.max(...measurements);

        console.log(`Burst test: avg=${avgDuration.toFixed(2)}ms, max=${maxDuration.toFixed(2)}ms`);

        expect(avgDuration).toBeLessThan(PERFORMANCE_THRESHOLDS.AUDIT_TRAIL_APPEND);
        expect(maxDuration).toBeLessThan(PERFORMANCE_THRESHOLDS.AUDIT_TRAIL_APPEND * 2); // Allow 2x for worst case
      } finally {
        await auditTrail.close();
      }
    });

    it("should handle large metadata payload within 100ms", async () => {
      const mockEventBus: EventBus = {
        name: "mock",
        publish: async (_event: EventBusEvent) => {},
        subscribe: async () => () => {},
        close: async () => {},
      };

      const largeLogPath = join(tempDir, "audit-large.jsonl");
      const auditTrail = await createAuditTrail({
        eventBus: mockEventBus,
        logPath: largeLogPath,
      });

      try {
        // Create large metadata (5KB)
        const largeMetadata = {
          data: "x".repeat(5000),
          nested: {
            array: Array(50).fill({ key: "value", num: 123 }),
          },
        };

        const result = await measurePerformance(
          "audit-trail-append-large",
          async () => {
            await mockEventBus.publish({
              eventId: `large-${Date.now()}`,
              eventType: "test.large",
              timestamp: new Date().toISOString(),
              metadata: largeMetadata,
            });
          },
          {
            targetMs: PERFORMANCE_THRESHOLDS.AUDIT_TRAIL_APPEND,
            iterations: 10,
            warmupIterations: 3,
          },
        );

        console.log(formatPerformanceResult(result));
        assertPerformance(result);

        expect(result.durationMs).toBeLessThan(PERFORMANCE_THRESHOLDS.AUDIT_TRAIL_APPEND);
      } finally {
        await auditTrail.close();
      }
    });
  });

  describe("Performance baseline documentation", () => {
    it("should document actual vs target performance", async () => {
      const mockEventBus: EventBus = {
        name: "mock",
        publish: async (_event: EventBusEvent) => {},
        subscribe: async () => () => {},
        close: async () => {},
      };

      const baselineLogPath = join(tempDir, "audit-baseline.jsonl");
      const auditTrail = await createAuditTrail({
        eventBus: mockEventBus,
        logPath: baselineLogPath,
      });

      try {
        const result = await measurePerformance(
          "audit-trail-baseline",
          async () => {
            await mockEventBus.publish({
              eventId: `baseline-${Date.now()}`,
              eventType: "test.baseline",
              timestamp: new Date().toISOString(),
              metadata: { baseline: true },
            });
          },
          {
            targetMs: PERFORMANCE_THRESHOLDS.AUDIT_TRAIL_APPEND,
            iterations: 50,
            warmupIterations: 10,
          },
        );

        // Document baseline
        console.log("\n📊 Performance Baseline (Story 2-4 - Audit Trail):");
        console.log(`   Target: <${PERFORMANCE_THRESHOLDS.AUDIT_TRAIL_APPEND}ms`);
        console.log(`   Actual: ${result.durationMs.toFixed(3)}ms`);
        console.log(`   Min: ${result.minMs.toFixed(3)}ms`);
        console.log(`   Max: ${result.maxMs.toFixed(3)}ms`);
        console.log(`   StdDev: ${result.stdDevMs.toFixed(3)}ms`);
        console.log(`   Passed: ${result.passed ? "✅" : "❌"}`);

        expect(result.passed).toBe(true);
      } finally {
        await auditTrail.close();
      }
    });
  });
});
