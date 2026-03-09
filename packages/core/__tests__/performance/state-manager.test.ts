/**
 * Performance Tests for State Manager (Story 2-5)
 *
 * NFR: Sub-millisecond reads (<1ms)
 * Tests State Manager cache read performance
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  measurePerformance,
  assertPerformance,
  PERFORMANCE_THRESHOLDS,
  formatPerformanceResult,
} from "../helpers/performance.js";
import { createStateManager } from "../../src/state-manager.js";

describe("State Manager Performance (Story 2-5)", () => {
  let tempDir: string;
  let yamlPath: string;

  beforeAll(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "state-perf-"));
    yamlPath = join(tempDir, "sprint-status.yaml");

    const initialYaml = `generated: 2026-03-09
project: test-project
project_key: TEST
tracking_system: file-system
story_location: test-location

development_status:
  story-1: done
  story-2: done
  story-3: in-progress
  epic-1: done
`;

    await writeFile(yamlPath, initialYaml, "utf-8");
  });

  afterAll(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  describe("NFR: Sub-millisecond cache reads", () => {
    it("should read from cache in sub-millisecond", async () => {
      const stateManager = createStateManager({ yamlPath });
      await stateManager.initialize();

      try {
        // Prime cache with a read
        const firstRead = stateManager.get("story-1");
        expect(firstRead).not.toBeNull();

        // Measure cached reads
        const result = await measurePerformance(
          "state-manager-cache-read",
          () => {
            const state = stateManager.get("story-1");
            expect(state).not.toBeNull();
          },
          {
            targetMs: PERFORMANCE_THRESHOLDS.CACHE_READ,
            iterations: 100,
            warmupIterations: 5,
          },
        );

        console.log(formatPerformanceResult(result));
        assertPerformance(result);

        expect(result.durationMs).toBeLessThan(PERFORMANCE_THRESHOLDS.CACHE_READ);
        expect(result.passed).toBe(true);
      } finally {
        await stateManager.close();
      }
    });

    it("should handle 100 sequential cache reads in <100ms total", async () => {
      const stateManager = createStateManager({ yamlPath });
      await stateManager.initialize();

      try {
        // Prime cache
        stateManager.get("story-1");

        const start = performance.now();

        for (let i = 0; i < 100; i++) {
          const state = stateManager.get("story-1");
          expect(state).not.toBeNull();
        }

        const totalMs = performance.now() - start;
        const avgMs = totalMs / 100;

        console.log(
          `100 sequential reads: ${totalMs.toFixed(3)}ms total, avg: ${avgMs.toFixed(4)}ms`,
        );
        expect(avgMs).toBeLessThan(PERFORMANCE_THRESHOLDS.CACHE_READ);
      } finally {
        await stateManager.close();
      }
    });

    it("should read multiple keys efficiently", async () => {
      const stateManager = createStateManager({ yamlPath });
      await stateManager.initialize();

      try {
        // Prime cache
        stateManager.get("story-1");
        stateManager.get("story-2");
        stateManager.get("story-3");

        const result = await measurePerformance(
          "multi-key-read",
          () => {
            const s1 = stateManager.get("story-1");
            const s2 = stateManager.get("story-2");
            const s3 = stateManager.get("story-3");
            expect(s1).not.toBeNull();
            expect(s2).not.toBeNull();
            expect(s3).not.toBeNull();
          },
          {
            targetMs: PERFORMANCE_THRESHOLDS.CACHE_READ,
            iterations: 50,
          },
        );

        console.log(formatPerformanceResult(result));
        assertPerformance(result);
      } finally {
        await stateManager.close();
      }
    });
  });
});
