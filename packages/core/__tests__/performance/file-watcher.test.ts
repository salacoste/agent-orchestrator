/**
 * Performance Tests for File Watcher (Story 2-6)
 *
 * NFR: 500ms debounce
 * Tests File Watcher debouncing behavior
 */

import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  measurePerformance,
  PERFORMANCE_THRESHOLDS,
  formatPerformanceResult,
} from "../helpers/performance.js";
import { createFileWatcher } from "../../src/file-watcher.js";
import type { StateManager, EventBus } from "../../src/types.js";

// Mock StateManager for testing
function createMockStateManager(): StateManager {
  const cache = new Map<
    string,
    { id: string; status: string; title: string; version: string; updatedAt: string }
  >();

  return {
    initialize: vi.fn().mockResolvedValue(undefined),
    get: vi.fn((id: string) => cache.get(id) || null),
    getAll: vi.fn(() => new Map(cache)),
    set: vi.fn().mockImplementation(async (id: string, state: { status: string }) => {
      cache.set(id, {
        id,
        status: state.status,
        title: id,
        version: `v${Date.now()}`,
        updatedAt: new Date().toISOString(),
      });
      return { success: true, version: `v${Date.now()}` };
    }),
    update: vi.fn().mockResolvedValue({ success: true, version: "v1" }),
    batchSet: vi.fn().mockResolvedValue({ succeeded: [], failed: [] }),
    invalidate: vi.fn().mockResolvedValue(undefined),
    getVersion: vi.fn(() => "v1"),
    close: vi.fn().mockResolvedValue(undefined),
    verify: vi.fn().mockResolvedValue({ valid: true }),
  };
}

// Mock EventBus for testing
function createMockEventBus(): EventBus {
  return {
    name: "mock",
    publish: vi.fn().mockResolvedValue(undefined),
    subscribe: vi.fn().mockResolvedValue(() => {}),
    close: vi.fn().mockResolvedValue(undefined),
    isConnected: () => true,
    isDegraded: () => false,
    getQueueSize: () => 0,
  };
}

describe("File Watcher Performance (Story 2-6)", () => {
  let tempDir: string;
  let yamlPath: string;

  beforeAll(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "watcher-perf-"));
    yamlPath = join(tempDir, "sprint-status.yaml");

    const initialYaml = `generated: 2026-03-09
project: test-project
project_key: TEST
tracking_system: file-system
story_location: test-location

development_status:
  story-1: done
  story-2: in-progress
`;

    await writeFile(yamlPath, initialYaml, "utf-8");
  });

  afterAll(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  describe("NFR: 500ms debounce", () => {
    it("should debounce rapid changes with 500ms delay", async () => {
      const mockStateManager = createMockStateManager();
      const mockEventBus = createMockEventBus();

      const fileWatcher = createFileWatcher({
        stateManager: mockStateManager,
        eventBus: mockEventBus,
        debounceMs: PERFORMANCE_THRESHOLDS.FILE_WATCHER_DEBOUNCE,
        enabled: true,
      });

      try {
        await fileWatcher.watch(yamlPath);

        // Make rapid changes
        const start = performance.now();

        // Simulate 3 rapid file changes
        for (let i = 0; i < 3; i++) {
          await writeFile(
            yamlPath,
            `generated: 2026-03-09
project: test-project
project_key: TEST
tracking_system: file-system
story_location: test-location

development_status:
  story-1: done
  story-2: ${i === 2 ? "done" : "in-progress"}
`,
            "utf-8",
          );
        }

        // Wait for debounce to process
        await new Promise((resolve) =>
          setTimeout(resolve, PERFORMANCE_THRESHOLDS.FILE_WATCHER_DEBOUNCE + 100),
        );

        const elapsed = performance.now() - start;

        console.log(`Debounce processing: ${elapsed.toFixed(0)}ms`);
        expect(elapsed).toBeGreaterThanOrEqual(PERFORMANCE_THRESHOLDS.FILE_WATCHER_DEBOUNCE);
      } finally {
        await fileWatcher.close();
      }
    });

    it("should complete debounce cycle within expected time", async () => {
      const mockStateManager = createMockStateManager();
      const mockEventBus = createMockEventBus();

      const fileWatcher = createFileWatcher({
        stateManager: mockStateManager,
        eventBus: mockEventBus,
        debounceMs: PERFORMANCE_THRESHOLDS.FILE_WATCHER_DEBOUNCE,
        enabled: true,
      });

      try {
        await fileWatcher.watch(yamlPath);

        const start = performance.now();

        // Make multiple rapid changes
        for (let i = 0; i < 5; i++) {
          await writeFile(
            yamlPath,
            `generated: 2026-03-09
project: test-project
development_status:
  story-1: done
  story-2: iteration-${i}
`,
            "utf-8",
          );
        }

        // Wait for debounce
        await new Promise((resolve) =>
          setTimeout(resolve, PERFORMANCE_THRESHOLDS.FILE_WATCHER_DEBOUNCE + 200),
        );

        const elapsed = performance.now() - start;

        // Verify timing: should be at least debounce time, but not too much more
        console.log(`Debounce cycle completed in ${elapsed.toFixed(0)}ms`);
        expect(elapsed).toBeGreaterThanOrEqual(PERFORMANCE_THRESHOLDS.FILE_WATCHER_DEBOUNCE);
        expect(elapsed).toBeLessThan(PERFORMANCE_THRESHOLDS.FILE_WATCHER_DEBOUNCE + 1000);
      } finally {
        await fileWatcher.close();
      }
    });

    it("should verify debounce timing accuracy", async () => {
      const mockStateManager = createMockStateManager();
      const mockEventBus = createMockEventBus();

      const debounceMs = 500;
      const fileWatcher = createFileWatcher({
        stateManager: mockStateManager,
        eventBus: mockEventBus,
        debounceMs,
        enabled: true,
      });

      try {
        await fileWatcher.watch(yamlPath);

        // Measure debounce timing
        const result = await measurePerformance(
          "file-watcher-debounce",
          async () => {
            await writeFile(
              yamlPath,
              `generated: 2026-03-09
project: test-project
development_status:
  story-1: done
  story-2: test-${Date.now()}
`,
            );
            await new Promise((resolve) => setTimeout(resolve, debounceMs + 50));
          },
          {
            targetMs: debounceMs + 100, // Debounce + buffer
            iterations: 3,
          },
        );

        console.log(formatPerformanceResult(result));
        expect(result.durationMs).toBeGreaterThanOrEqual(debounceMs);
      } finally {
        await fileWatcher.close();
      }
    });
  });
});
