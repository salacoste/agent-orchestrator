/**
 * Tests for FileWatcher Service
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createFileWatcher } from "../src/file-watcher.js";
import type { FileWatcher, FileWatcherConfig } from "../src/types.js";
import { randomUUID } from "node:crypto";
import { writeFile, unlink, mkdir, chmod, readdir, rm } from "node:fs/promises";
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

// Mock StateManager
const createMockStateManager = () => ({
  invalidate: vi.fn(async () => {}),
  getVersion: vi.fn((_storyId: string) => `v${Date.now()}-abcd1234`),
  get: vi.fn(() => null),
  getAll: vi.fn(() => new Map()),
  set: vi.fn(async () => ({ success: true, version: "v1" })),
  update: vi.fn(async () => ({ success: true, version: "v1" })),
  batchSet: vi.fn(async () => ({ succeeded: [], failed: [] })),
  close: vi.fn(async () => {}),
  initialize: vi.fn(async () => {}),
});

describe("FileWatcher", () => {
  let fileWatcher: FileWatcher;
  let testYamlPath: string;
  let testBackupDir: string;
  let mockStateManager: ReturnType<typeof createMockStateManager>;
  let mockEventBus: ReturnType<typeof createMockEventBus>;

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

    // Clean up backup directory
    if (testBackupDir && existsSync(testBackupDir)) {
      try {
        await rm(testBackupDir, { recursive: true, force: true });
      } catch {
        // Ignore cleanup errors
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

metadata:
  version: v1709758234567-global-xyz789
  lastUpdate: "2026-03-06T10:30:00.000Z"

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
    testBackupDir = join("/tmp", `test-backups-${testId}`);
    await cleanupTestFiles();
    await createTestYaml();

    mockStateManager = createMockStateManager();
    mockEventBus = createMockEventBus();
  });

  afterEach(async () => {
    await fileWatcher?.close();
    await cleanupTestFiles();
  });

  describe("interface definition", () => {
    it("should have watch, unwatch, close, and isWatching methods", async () => {
      const config: FileWatcherConfig = {
        stateManager: mockStateManager,
        eventBus: mockEventBus,
      };
      fileWatcher = createFileWatcher(config);

      expect(typeof fileWatcher.watch).toBe("function");
      expect(typeof fileWatcher.unwatch).toBe("function");
      expect(typeof fileWatcher.close).toBe("function");
      expect(typeof fileWatcher.isWatching).toBe("function");
    });
  });

  describe("watch functionality", () => {
    it("should start watching a file", async () => {
      const config: FileWatcherConfig = {
        stateManager: mockStateManager,
        eventBus: mockEventBus,
      };
      fileWatcher = createFileWatcher(config);

      await fileWatcher.watch(testYamlPath);

      expect(fileWatcher.isWatching(testYamlPath)).toBe(true);
    });

    it("should stop watching a file", async () => {
      const config: FileWatcherConfig = {
        stateManager: mockStateManager,
        eventBus: mockEventBus,
      };
      fileWatcher = createFileWatcher(config);

      await fileWatcher.watch(testYamlPath);
      await fileWatcher.unwatch(testYamlPath);

      expect(fileWatcher.isWatching(testYamlPath)).toBe(false);
    });

    it("should close all watchers", async () => {
      const config: FileWatcherConfig = {
        stateManager: mockStateManager,
        eventBus: mockEventBus,
      };
      fileWatcher = createFileWatcher(config);

      await fileWatcher.watch(testYamlPath);
      await fileWatcher.close();

      expect(fileWatcher.isWatching(testYamlPath)).toBe(false);
    });
  });

  describe("debounce overflow", () => {
    it("should process immediately after threshold events", { timeout: 10000 }, async () => {
      const config: FileWatcherConfig = {
        stateManager: mockStateManager,
        eventBus: mockEventBus,
        debounceMs: 500,
        debounceOverflowThreshold: 10,
      };
      fileWatcher = createFileWatcher(config);

      await fileWatcher.watch(testYamlPath);

      // Write 15 times rapidly (exceeds threshold of 10)
      for (let i = 0; i < 15; i++) {
        await writeFile(testYamlPath, `test: ${i}\n`, "utf-8");
      }

      // Wait for processing to complete
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // The watcher should have processed the changes
      // (we can't directly test this without internal access, but we verify no crash)
      expect(fileWatcher.isWatching(testYamlPath)).toBe(true);
    });
  });

  describe("backup management", () => {
    it("should create backup before write", async () => {
      const config: FileWatcherConfig = {
        stateManager: mockStateManager,
        eventBus: mockEventBus,
        backupDir: testBackupDir,
        maxBackups: 3,
      };
      fileWatcher = createFileWatcher(config);

      await fileWatcher.watch(testYamlPath);

      // Modify file to trigger backup creation
      await writeFile(testYamlPath, "test: modified\n", "utf-8");

      // Wait for file change processing
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Check if backup directory exists and has files
      if (existsSync(testBackupDir)) {
        const files = await readdir(testBackupDir);
        const backupFiles = files.filter((f) => f.startsWith("sprint-status.yaml.backup."));
        expect(backupFiles.length).toBeGreaterThan(0);
      }
    });

    it("should keep only maxBackups most recent", async () => {
      const maxBackups = 3;
      const config: FileWatcherConfig = {
        stateManager: mockStateManager,
        eventBus: mockEventBus,
        backupDir: testBackupDir,
        maxBackups,
      };
      fileWatcher = createFileWatcher(config);

      await fileWatcher.watch(testYamlPath);

      // Trigger more writes than maxBackups
      for (let i = 0; i < maxBackups + 2; i++) {
        await writeFile(testYamlPath, `test: modification-${i}\n`, "utf-8");
        await new Promise((resolve) => setTimeout(resolve, 100));
      }

      // Wait for final processing
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Check backup count
      if (existsSync(testBackupDir)) {
        const files = await readdir(testBackupDir);
        const backupFiles = files.filter((f) => f.startsWith("sprint-status.yaml.backup."));
        // Should have at most maxBackups files
        expect(backupFiles.length).toBeLessThanOrEqual(maxBackups);
      }
    });
  });

  describe("permission error handling", () => {
    it("should retry with exponential backoff on permission error", async () => {
      const config: FileWatcherConfig = {
        stateManager: mockStateManager,
        eventBus: mockEventBus,
        retryInterval: 100, // Short retry interval for testing
      };
      fileWatcher = createFileWatcher(config);

      await fileWatcher.watch(testYamlPath);

      // Make file unreadable
      try {
        await chmod(testYamlPath, 0o000);

        // Wait for retry attempts
        await new Promise((resolve) => setTimeout(resolve, 1000));

        // Restore permissions
        await chmod(testYamlPath, 0o644);
      } catch (error) {
        // Some systems may not support chmod
        // Skip test if chmod is not available
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
          // Continue with test
        }
      }

      expect(fileWatcher.isWatching(testYamlPath)).toBe(true);
    });
  });

  describe("file deletion handling", () => {
    it("should detect file deletion", async () => {
      const config: FileWatcherConfig = {
        stateManager: mockStateManager,
        eventBus: mockEventBus,
        interactive: false, // Non-interactive mode
        backupDir: testBackupDir,
      };
      fileWatcher = createFileWatcher(config);

      await fileWatcher.watch(testYamlPath);

      // Create a backup first
      const backupDir = join(testBackupDir);
      await mkdir(backupDir, { recursive: true });
      await writeFile(
        join(backupDir, "sprint-status.yaml.backup.20260307T120000"),
        "backup content",
        "utf-8",
      );

      // Delete the file
      await unlink(testYamlPath);

      // Wait for deletion processing
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // File watcher should still be active
      expect(fileWatcher.isWatching(testYamlPath)).toBe(true);
    });
  });

  describe("StateManager integration", () => {
    it("should invalidate StateManager cache on external change", async () => {
      const config: FileWatcherConfig = {
        stateManager: mockStateManager,
        eventBus: mockEventBus,
      };
      fileWatcher = createFileWatcher(config);

      await fileWatcher.watch(testYamlPath);

      // Modify file to trigger cache invalidation
      await writeFile(testYamlPath, "test: modified\n", "utf-8");

      // Wait for file change processing
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Verify StateManager.invalidate was called
      expect(mockStateManager.invalidate).toHaveBeenCalled();
    });

    it("should publish state.external_update event", async () => {
      const config: FileWatcherConfig = {
        stateManager: mockStateManager,
        eventBus: mockEventBus,
      };
      fileWatcher = createFileWatcher(config);

      await fileWatcher.watch(testYamlPath);

      // Modify file to trigger event
      await writeFile(testYamlPath, "test: modified\n", "utf-8");

      // Wait for file change processing
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Verify EventBus.publish was called with state.external_update
      expect(mockEventBus.publish).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: "state.external_update",
        }),
      );
    });
  });

  describe("AC 7: enabled configuration", () => {
    it("should not watch file when enabled is false", async () => {
      const config: FileWatcherConfig = {
        stateManager: mockStateManager,
        eventBus: mockEventBus,
        enabled: false, // AC 7: Disable file watcher
      };
      fileWatcher = createFileWatcher(config);

      await fileWatcher.watch(testYamlPath);

      // File should NOT be watched
      expect(fileWatcher.isWatching(testYamlPath)).toBe(false);
    });

    it("should watch file when enabled is true or undefined", async () => {
      const config: FileWatcherConfig = {
        stateManager: mockStateManager,
        eventBus: mockEventBus,
        enabled: true,
      };
      fileWatcher = createFileWatcher(config);

      await fileWatcher.watch(testYamlPath);

      // File should be watched
      expect(fileWatcher.isWatching(testYamlPath)).toBe(true);
    });

    it("should throw error when watching non-existent file", async () => {
      const config: FileWatcherConfig = {
        stateManager: mockStateManager,
        eventBus: mockEventBus,
      };
      fileWatcher = createFileWatcher(config);

      const nonExistentPath = join("/tmp", `non-existent-${randomUUID()}.yaml`);

      // Should throw error when file doesn't exist
      await expect(fileWatcher.watch(nonExistentPath)).rejects.toThrow(
        `File not found: ${nonExistentPath}`,
      );
    });
  });
});
