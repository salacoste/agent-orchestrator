/**
 * State Manager Corruption Detection Tests
 *
 * Test coverage for Story 4.7:
 * - YAML parse error detection on load
 * - Backup creation before writes
 * - Corruption recovery from backup
 * - Rebuilding from sources when no backup
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdtemp, rm, readFile, writeFile, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createStateManager } from "../state-manager.js";

describe("StateManager Corruption Detection", () => {
  let tempDir: string;
  let yamlPath: string;
  let backupPath: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "state-manager-test-"));
    yamlPath = join(tempDir, "sprint-status.yaml");
    backupPath = join(tempDir, "sprint-status.yaml.backup");

    // Write initial valid YAML
    const initialYaml = `generated: 2026-03-07
project: test-project
project_key: TEST

development_status:
  epic-1: in-progress
  story-1: done
  story-2: in-progress
`;
    await writeFile(yamlPath, initialYaml, "utf-8");
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  describe("YAML Parse Error Detection", () => {
    it("should log error and recover when YAML is corrupted on initialize", async () => {
      // Write corrupted YAML
      const corruptedYaml = `generated: 2026-03-07
project: test-project
development_status:
  epic-1: in-progress
  story-1: done
  story-2: [invalid yaml syntax {{{ broken
`;
      await writeFile(yamlPath, corruptedYaml, "utf-8");

      const manager = createStateManager({
        yamlPath,
      });

      // Should not throw - should recover with default template
      await expect(manager.initialize()).resolves.not.toThrow();

      // Manager should be functional after recovery
      expect(manager.get("story-1")).toBeNull(); // No stories in default template
    });

    it("should log file path in corruption error", async () => {
      const corruptedYaml = `development_status:
  story-1: [broken
`;
      await writeFile(yamlPath, corruptedYaml, "utf-8");

      const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      const manager = createStateManager({
        yamlPath,
      });

      await manager.initialize();

      // Console error should have been called with file path
      const errorCalls = consoleErrorSpy.mock.calls.flat().join(" ");
      expect(errorCalls).toContain(yamlPath);
      expect(errorCalls).toMatch(/corrupted|invalid/i);

      consoleErrorSpy.mockRestore();
    });

    it("should detect empty file as corruption and rebuild", async () => {
      await writeFile(yamlPath, "", "utf-8");

      const manager = createStateManager({
        yamlPath,
      });

      // Should rebuild with default template
      await expect(manager.initialize()).resolves.not.toThrow();

      // File should now exist with valid content
      const content = await readFile(yamlPath, "utf-8");
      expect(content).toContain("generated:");
      expect(content).toContain("development_status:");
    });

    it("should handle truncated but valid YAML", async () => {
      const truncatedYaml = `generated: 2026-03-07
project: test-project
development_status:
  epic-1: in-progress
`;
      await writeFile(yamlPath, truncatedYaml, "utf-8");

      const manager = createStateManager({
        yamlPath,
      });

      // This should work - truncated but valid YAML
      await expect(manager.initialize()).resolves.not.toThrow();
    });
  });

  describe("Backup Creation", () => {
    it("should create backup before first write", async () => {
      const manager = createStateManager({
        yamlPath,
        createBackup: true,
      });

      await manager.initialize();

      // Perform a write operation
      await manager.set("story-3", {
        id: "story-3",
        status: "backlog",
        title: "Test Story 3",
        version: "",
        updatedAt: new Date().toISOString(),
      });

      // Check backup was created
      const backupExists = await stat(backupPath)
        .then(() => true)
        .catch(() => false);
      expect(backupExists).toBe(true);
    });

    it("should not create backup when createBackup is false", async () => {
      const manager = createStateManager({
        yamlPath,
        createBackup: false,
      });

      await manager.initialize();
      await manager.set("story-3", {
        id: "story-3",
        status: "backlog",
        title: "Test Story 3",
        version: "",
        updatedAt: new Date().toISOString(),
      });

      // Check backup was NOT created
      const backupExists = await stat(backupPath)
        .then(() => true)
        .catch(() => false);
      expect(backupExists).toBe(false);
    });

    it("should update existing backup on subsequent writes", async () => {
      const manager = createStateManager({
        yamlPath,
        createBackup: true,
      });

      await manager.initialize();

      // First write
      await manager.set("story-3", {
        id: "story-3",
        status: "backlog",
        title: "Test Story 3",
        version: "",
        updatedAt: new Date().toISOString(),
      });

      const firstBackup = await readFile(backupPath, "utf-8");

      // Second write
      await manager.set("story-3", {
        id: "story-3",
        status: "in-progress",
        title: "Test Story 3",
        version: "",
        updatedAt: new Date().toISOString(),
      });

      const secondBackup = await readFile(backupPath, "utf-8");

      // Backup should have different content
      expect(firstBackup).not.toBe(secondBackup);
    });
  });

  describe("Corruption Recovery from Backup", () => {
    it("should recover from backup when main file is corrupted", async () => {
      const manager = createStateManager({
        yamlPath,
        createBackup: true,
        backupPath,
      });

      // Initialize to create initial state
      await manager.initialize();
      await manager.set("story-1", {
        id: "story-1",
        status: "done",
        title: "Story 1",
        version: "v1",
        updatedAt: new Date().toISOString(),
      });

      // Verify backup exists
      const backupExists = await stat(backupPath)
        .then(() => true)
        .catch(() => false);
      expect(backupExists).toBe(true);

      // Corrupt the main file
      await writeFile(yamlPath, "corrupted: [invalid {{{", "utf-8");

      // Create new manager instance and initialize
      const recoveredManager = createStateManager({
        yamlPath,
        createBackup: true,
        backupPath,
      });

      // Should recover from backup
      await expect(recoveredManager.initialize()).resolves.not.toThrow();

      // Verify data was recovered
      const story = recoveredManager.get("story-1");
      expect(story).not.toBeNull();
      expect(story?.status).toBe("done");
    });

    it("should restore corrupted file from backup", async () => {
      const manager = createStateManager({
        yamlPath,
        createBackup: true,
        backupPath,
      });

      await manager.initialize();
      await manager.set("story-1", {
        id: "story-1",
        status: "done",
        title: "Story 1",
        version: "v1",
        updatedAt: new Date().toISOString(),
      });

      // Corrupt main file
      await writeFile(yamlPath, "corrupted: [invalid {{{", "utf-8");

      // Create new manager
      const recoveredManager = createStateManager({
        yamlPath,
        createBackup: true,
        backupPath,
      });

      await recoveredManager.initialize();

      // Main file should now be valid again
      const content = await readFile(yamlPath, "utf-8");
      expect(content).not.toContain("corrupted");
      expect(content).toContain("story-1");
    });
  });

  describe("Rebuild from Sources", () => {
    it("should rebuild when no backup available", async () => {
      const manager = createStateManager({
        yamlPath,
        createBackup: true,
        backupPath,
      });

      await manager.initialize();

      // Delete backup
      await rm(backupPath, { force: true });

      // Corrupt main file
      await writeFile(yamlPath, "corrupted: [invalid {{{", "utf-8");

      const recoveredManager = createStateManager({
        yamlPath,
        createBackup: true,
        backupPath,
      });

      // Should rebuild with default template instead of throwing
      await expect(recoveredManager.initialize()).resolves.not.toThrow();

      // File should now contain valid YAML
      const content = await readFile(yamlPath, "utf-8");
      expect(content).toContain("generated:");
      expect(content).toContain("development_status:");
    });

    it("should use default template when rebuilding with no sources", async () => {
      const manager = createStateManager({
        yamlPath,
        createBackup: false,
      });

      // Start with corrupted file
      await writeFile(yamlPath, "corrupted: [invalid {{{", "utf-8");

      // Initialize should rebuild with default template
      await expect(manager.initialize()).resolves.not.toThrow();

      // Verify file was rebuilt with default template
      const content = await readFile(yamlPath, "utf-8");
      expect(content).toContain("generated:");
      expect(content).toContain("project:");
      expect(content).toContain("development_status:");
    });
  });

  describe("CLI Integration", () => {
    it("should provide verify method for manual checks", async () => {
      const manager = createStateManager({
        yamlPath,
      });

      await manager.initialize();

      // Verify method should exist and report status
      expect(typeof manager.verify).toBe("function");
    });

    it("should report corruption via verify method", async () => {
      const manager = createStateManager({
        yamlPath,
      });

      // Corrupt the file
      await writeFile(yamlPath, "corrupted: [invalid {{{", "utf-8");

      if (manager.verify) {
        const result = await manager.verify();
        expect(result.valid).toBe(false);
        expect(result.error).toBeDefined();
      }
    });

    it("should report valid state via verify method", async () => {
      const manager = createStateManager({
        yamlPath,
      });

      await manager.initialize();

      if (manager.verify) {
        const result = await manager.verify();
        expect(result.valid).toBe(true);
        expect(result.error).toBeUndefined();
      }
    });
  });
});
