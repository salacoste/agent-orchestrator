/**
 * Tests for StateManager Service
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createStateManager } from "../src/state-manager.js";
import type { StateManager, StoryState } from "../src/types.js";
import { randomUUID } from "node:crypto";
import { unlink, writeFile, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";

// Mock EventBus
const createMockEventBus = () => ({
  name: "mock-event-bus",
  isConnected: vi.fn(() => true),
  isDegraded: vi.fn(() => false),
  getQueueSize: vi.fn(() => 0),
  publish: vi.fn(async () => {}),
  close: vi.fn(async () => {}),
  subscribe: vi.fn(async () => vi.fn()),
});

describe("StateManager", () => {
  let stateManager: StateManager;
  let testYamlPath: string;

  // Clean up test files
  async function cleanupTestFiles() {
    const files = [testYamlPath, `${testYamlPath}.tmp`];
    for (const file of files) {
      if (file && existsSync(file)) {
        try {
          await unlink(file);
        } catch {
          // Ignore cleanup errors
        }
      }
    }
  }

  // Create a test sprint-status.yaml file
  async function createTestYaml() {
    const yamlContent = `# generated: 2026-03-06
# project: agent-orchestrator
# project_key: NOKEY
# tracking_system: file-system
# story_location: _bmad-output/implementation-artifacts

generated: 2026-03-06
project: agent-orchestrator
project_key: NOKEY
tracking_system: file-system
story_location: _bmad-output/implementation-artifacts

development_status:
  epic-2: in-progress
  2-1-redis-event-bus-implementation: done
  2-2-event-publishing-service: done
  2-3-event-subscription-service: done
  2-4-jsonl-audit-trail: done
  2-5-state-manager-write-through-cache: in-progress
  2-6-yaml-file-watcher: ready-for-dev
  epic-2-retrospective: optional
`;
    await writeFile(testYamlPath, yamlContent, "utf-8");
  }

  beforeEach(async () => {
    vi.clearAllMocks();
    // Generate unique file path per test to avoid cross-test contamination
    const testId = randomUUID();
    testYamlPath = join("/tmp", `test-sprint-status-${testId}.yaml`);
    await cleanupTestFiles();
    await createTestYaml();
  });

  afterEach(async () => {
    await stateManager?.close();
    await cleanupTestFiles();
  });

  describe("cache initialization", () => {
    it("should load sprint-status.yaml into cache on initialization", async () => {
      stateManager = createStateManager({
        yamlPath: testYamlPath,
      });

      await stateManager.initialize();

      const story = stateManager.get("2-5-state-manager-write-through-cache");
      expect(story).toBeDefined();
      expect(story?.status).toBe("in-progress");
      expect(story?.id).toBe("2-5-state-manager-write-through-cache");
    });

    it("should skip epic entries when loading cache", async () => {
      stateManager = createStateManager({
        yamlPath: testYamlPath,
      });

      await stateManager.initialize();

      const epicEntry = stateManager.get("epic-2");
      expect(epicEntry).toBeNull();
    });

    it("should return all stories from cache", async () => {
      stateManager = createStateManager({
        yamlPath: testYamlPath,
      });

      await stateManager.initialize();

      const allStories = stateManager.getAll();
      expect(allStories.size).toBeGreaterThan(0);
      expect(allStories.has("2-5-state-manager-write-through-cache")).toBe(true);
      expect(allStories.has("epic-2")).toBe(false);
    });
  });

  describe("get operations (read from cache)", () => {
    beforeEach(async () => {
      stateManager = createStateManager({
        yamlPath: testYamlPath,
      });
      await stateManager.initialize();
    });

    it("should get single story by ID", () => {
      const story = stateManager.get("2-5-state-manager-write-through-cache");
      expect(story).toBeDefined();
      expect(story?.id).toBe("2-5-state-manager-write-through-cache");
      expect(story?.status).toBe("in-progress");
    });

    it("should return null for non-existent story", () => {
      const story = stateManager.get("non-existent-story");
      expect(story).toBeNull();
    });

    it("should return copy of state (not reference)", () => {
      const story1 = stateManager.get("2-5-state-manager-write-through-cache");
      const story2 = stateManager.get("2-5-state-manager-write-through-cache");

      expect(story1).not.toBe(story2); // Different references
      expect(story1).toEqual(story2); // Same values
    });

    it("should complete get operation within 1ms", () => {
      // Warm up: perform a few get operations to ensure JIT compilation
      for (let i = 0; i < 10; i++) {
        stateManager.get("2-5-state-manager-write-through-cache");
      }

      // Measure multiple iterations for consistency
      const iterations = 1000;
      const start = performance.now();

      for (let i = 0; i < iterations; i++) {
        stateManager.get("2-5-state-manager-write-through-cache");
      }

      const elapsed = performance.now() - start;
      const avgTimeMs = elapsed / iterations;

      // Average should be well under 1ms, total time should be reasonable
      expect(avgTimeMs).toBeLessThan(1);
      expect(elapsed).toBeLessThan(100); // Total for 1000 iterations should be under 100ms
    });

    it("should get all stories as Map copy", () => {
      const allStories1 = stateManager.getAll();
      const allStories2 = stateManager.getAll();

      expect(allStories1).not.toBe(allStories2); // Different Map instances
      expect(allStories1.size).toBe(allStories2.size); // Same size
    });
  });

  describe("write-through set operations", () => {
    beforeEach(async () => {
      stateManager = createStateManager({
        yamlPath: testYamlPath,
      });
      await stateManager.initialize();
    });

    it("should write to YAML first, then update cache", async () => {
      const updateState: StoryState = {
        id: "2-5-state-manager-write-through-cache",
        status: "done",
        title: "State Manager with Write-Through Cache",
        version: "v1",
        updatedAt: new Date().toISOString(),
      };

      const result = await stateManager.set("2-5-state-manager-write-through-cache", updateState);

      expect(result.success).toBe(true);
      expect(result.version).toBeDefined();

      // Check cache was updated
      const cached = stateManager.get("2-5-state-manager-write-through-cache");
      expect(cached?.status).toBe("done");
      expect(cached?.version).toBe(result.version);

      // Check YAML was updated
      const yamlContent = await readFile(testYamlPath, "utf-8");
      expect(yamlContent).toContain("status: done");
      expect(yamlContent).toContain(`version: ${result.version}`);
    });

    it("should NOT update cache if write fails", async () => {
      // Get the current state before attempting write
      const originalVersion = stateManager.getVersion("2-5-state-manager-write-through-cache");
      const originalStatus = stateManager.get("2-5-state-manager-write-through-cache")?.status;
      const originalTitle = stateManager.get("2-5-state-manager-write-through-cache")?.title;

      // First initialize the original stateManager to get cache loaded
      // Then try to update with the invalid path
      const originalState = stateManager.get("2-5-state-manager-write-through-cache");
      expect(originalState).toBeDefined();

      // Try to update with invalid state (storyId mismatch causes failure)
      const badUpdateResult = await stateManager.set("2-5-state-manager-write-through-cache", {
        id: "WRONG-ID", // This will cause validation failure before write
        status: "done",
        title: "Test",
        version: "v1",
        updatedAt: new Date().toISOString(),
      });

      // Should fail due to storyId mismatch
      expect(badUpdateResult.success).toBe(false);

      // Verify cache was NOT updated
      const currentStatus = stateManager.get("2-5-state-manager-write-through-cache")?.status;
      const currentVersion = stateManager.getVersion("2-5-state-manager-write-through-cache");
      const currentTitle = stateManager.get("2-5-state-manager-write-through-cache")?.title;

      expect(currentStatus).toBe(originalStatus);
      expect(currentVersion).toBe(originalVersion);
      expect(currentTitle).toBe(originalTitle);
    });

    it("should generate new version stamp on each update", async () => {
      const updateState: StoryState = {
        id: "2-5-state-manager-write-through-cache",
        status: "review",
        title: "State Manager",
        version: "v1",
        updatedAt: new Date().toISOString(),
      };

      const result1 = await stateManager.set("2-5-state-manager-write-through-cache", updateState);
      const result2 = await stateManager.set("2-5-state-manager-write-through-cache", {
        ...updateState,
        status: "done",
      });

      expect(result1.version).not.toBe(result2.version);
    });
  });

  describe("version stamping", () => {
    beforeEach(async () => {
      // Reset YAML and stateManager for test isolation
      await cleanupTestFiles();
      await createTestYaml();

      stateManager = createStateManager({
        yamlPath: testYamlPath,
      });
      await stateManager.initialize();
    });

    it("should generate version stamp in format v{timestamp}-{random}", async () => {
      const updateState: StoryState = {
        id: "2-5-state-manager-write-through-cache",
        status: "review",
        title: "State Manager",
        version: "v1",
        updatedAt: new Date().toISOString(),
      };

      const result = await stateManager.set("2-5-state-manager-write-through-cache", updateState);

      expect(result.version).toMatch(/^v\d+-[a-f0-9]+$/);
    });

    it("should verify version on update (conflict detection)", async () => {
      const updateState: StoryState = {
        id: "2-5-state-manager-write-through-cache",
        status: "review",
        title: "State Manager",
        version: "v1",
        updatedAt: new Date().toISOString(),
      };

      await stateManager.set("2-5-state-manager-write-through-cache", updateState);

      // Try to update with wrong expected version
      const result2 = await stateManager.set(
        "2-5-state-manager-write-through-cache",
        { ...updateState, status: "done" },
        "wrong-version",
      );

      expect(result2.success).toBe(false);
      expect(result2.conflict).toBe(true);
      expect(result2.error).toContain("Version mismatch");
    });

    it("should allow update with correct expected version", async () => {
      const updateState: StoryState = {
        id: "2-5-state-manager-write-through-cache",
        status: "review",
        title: "State Manager",
        version: "v1",
        updatedAt: new Date().toISOString(),
      };

      const result1 = await stateManager.set("2-5-state-manager-write-through-cache", updateState);

      const result2 = await stateManager.set(
        "2-5-state-manager-write-through-cache",
        { ...updateState, status: "done" },
        result1.version,
      );

      expect(result2.success).toBe(true);
      expect(result2.conflict).toBeUndefined();
    });

    it("should get current version", () => {
      const version = stateManager.getVersion("2-5-state-manager-write-through-cache");
      expect(version).toBeDefined();
      expect(typeof version).toBe("string");
    });

    it("should detect concurrent write conflicts within same process", async () => {
      // Test that version-based conflict detection works
      // Note: This does NOT test true multi-process concurrency (see limitation below)

      const updateState: StoryState = {
        id: "2-5-state-manager-write-through-cache",
        status: "review",
        title: "State Manager",
        version: "v1",
        updatedAt: new Date().toISOString(),
      };

      // First update succeeds
      const result1 = await stateManager.set("2-5-state-manager-write-through-cache", updateState);
      expect(result1.success).toBe(true);

      // Simulate concurrent update using old version (should fail)
      const result2 = await stateManager.set(
        "2-5-state-manager-write-through-cache",
        { ...updateState, status: "done" },
        "v1", // Using old version
      );

      expect(result2.success).toBe(false);
      expect(result2.conflict).toBe(true);
      expect(result2.error).toContain("Version mismatch");

      // KNOWN LIMITATION: True multi-process concurrent writes are not prevented
      // If two processes read the same version simultaneously and both write,
      // the "last writer wins" - the first write may be lost.
      // This implementation does not use file locking or inter-process mutexes.
      // For multi-process safety, consider file locks (flock) or a mutex service.
    });
  });

  describe("cache invalidation", () => {
    const mockEventBus = createMockEventBus();

    beforeEach(async () => {
      // Reset YAML to original state for test isolation
      await cleanupTestFiles();
      await createTestYaml();

      stateManager = createStateManager({
        yamlPath: testYamlPath,
        eventBus: mockEventBus,
      });
      await stateManager.initialize();
    });

    it("should reload YAML into cache on invalidate", async () => {
      // Verify initial state
      const initialStory = stateManager.get("2-5-state-manager-write-through-cache");
      expect(initialStory?.status).toBe("in-progress");

      // Modify YAML directly
      let yamlContent = await readFile(testYamlPath, "utf-8");
      yamlContent = yamlContent.replace(
        "2-5-state-manager-write-through-cache: in-progress",
        "2-5-state-manager-write-through-cache: review",
      );
      await writeFile(testYamlPath, yamlContent, "utf-8");

      // Invalidate cache
      await stateManager.invalidate();

      // Check cache was reloaded with new status
      const story = stateManager.get("2-5-state-manager-write-through-cache");
      expect(story?.status).toBe("review");
    });

    it("should publish state.external_update event on invalidation", async () => {
      await stateManager.invalidate();

      expect(mockEventBus.publish).toHaveBeenCalledWith({
        eventType: "state.external_update",
        metadata: {
          storiesReloaded: expect.any(Number),
        },
      });
    });
  });

  describe("update operations (partial update)", () => {
    beforeEach(async () => {
      stateManager = createStateManager({
        yamlPath: testYamlPath,
      });
      await stateManager.initialize();
    });

    it("should update only specified fields", async () => {
      const result = await stateManager.update("2-5-state-manager-write-through-cache", {
        status: "review",
      });

      expect(result.success).toBe(true);

      const story = stateManager.get("2-5-state-manager-write-through-cache");
      expect(story?.status).toBe("review");
      expect(story?.id).toBe("2-5-state-manager-write-through-cache"); // Other fields preserved
    });

    it("should return error for non-existent story", async () => {
      const result = await stateManager.update("non-existent", { status: "done" });

      expect(result.success).toBe(false);
      expect(result.error).toContain("not found");
    });
  });

  describe("batch operations", () => {
    beforeEach(async () => {
      stateManager = createStateManager({
        yamlPath: testYamlPath,
      });
      await stateManager.initialize();
    });

    it("should update multiple stories", async () => {
      const updates = new Map<string, StoryState>();
      updates.set("2-6-yaml-file-watcher", {
        id: "2-6-yaml-file-watcher",
        status: "in-progress",
        title: "YAML File Watcher",
        version: "v1",
        updatedAt: new Date().toISOString(),
      });

      const result = await stateManager.batchSet(updates);

      expect(result.succeeded).toHaveLength(1);
      expect(result.failed).toHaveLength(0);

      const story = stateManager.get("2-6-yaml-file-watcher");
      expect(story?.status).toBe("in-progress");
    });
  });

  describe("error handling", () => {
    it("should return error on YAML parse failure", async () => {
      // Create invalid YAML
      await writeFile(testYamlPath, "invalid: yaml: content: [", "utf-8");

      stateManager = createStateManager({
        yamlPath: testYamlPath,
      });

      // Should not crash, but may fail to initialize
      await expect(stateManager.initialize()).rejects.toThrow();
    });
  });

  describe("cleanup", () => {
    it("should clear cache on close", async () => {
      stateManager = createStateManager({
        yamlPath: testYamlPath,
      });
      await stateManager.initialize();

      expect(stateManager.getAll().size).toBeGreaterThan(0);

      await stateManager.close();

      expect(stateManager.getAll().size).toBe(0);
    });
  });
});
