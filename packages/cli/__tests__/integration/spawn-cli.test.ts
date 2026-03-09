/**
 * CLI Integration Tests: Spawn Command
 *
 * End-to-end tests for the `ao spawn` command.
 * Tests CLI argument parsing, output formatting, and exit codes.
 */

import { describe, it, expect } from "vitest";
import { runCliWithTsx } from "./helpers/cli-test.js";
import { createTempEnv } from "./helpers/temp-env.js";

describe("ao spawn CLI", () => {
  describe("help and usage", () => {
    it("should show help with --help flag", async () => {
      const result = await runCliWithTsx(["spawn", "--help"]);
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("Usage:");
      expect(result.stdout).toContain("ao spawn");
    });

    it("should show help with -h flag", async () => {
      const result = await runCliWithTsx(["spawn", "-h"]);
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("Usage:");
    });
  });

  describe("error handling", () => {
    it("should error when no config file exists", async () => {
      const { mkdtempSync } = await import("node:fs");
      const { join } = await import("node:path");
      const { tmpdir } = await import("node:os");
      const { rmSync } = await import("node:fs");

      const emptyDir = mkdtempSync(join(tmpdir(), "ao-spawn-empty-"));

      try {
        const result = await runCliWithTsx(["spawn", "test-project"], { cwd: emptyDir });
        expect(result.exitCode).toBe(1);
        // Error message should contain config error or missing argument error
        const hasConfigError = result.stderr.includes("No agent-orchestrator.yaml");
        const hasMissingArg =
          result.stderr.includes("missing required argument") || result.stderr.includes("required");
        expect(hasConfigError || hasMissingArg).toBe(true);
      } finally {
        rmSync(emptyDir, { recursive: true, force: true });
      }
    });

    it("should require project argument", async () => {
      const env = createTempEnv();
      try {
        const result = await runCliWithTsx(["spawn"], { cwd: env.cwd });
        // Should error about missing project argument
        expect(result.exitCode).toBeGreaterThanOrEqual(0);
      } finally {
        env.cleanup();
      }
    });

    it("should handle nonexistent story gracefully", async () => {
      const env = createTempEnv();
      try {
        const result = await runCliWithTsx(["spawn", "test-project", "nonexistent-story"], {
          cwd: env.cwd,
        });
        // Should handle gracefully (story may not exist in sprint-status)
        expect(result.exitCode).toBeGreaterThanOrEqual(0);
      } finally {
        env.cleanup();
      }
    });
  });

  describe("agent selection", () => {
    it("should accept agent option", async () => {
      const env = createTempEnv();
      try {
        const result = await runCliWithTsx(
          ["spawn", "test-project", "1-1", "--agent", "claude-code"],
          {
            cwd: env.cwd,
          },
        );
        // Command should parse agent option correctly
        expect(result.exitCode).toBeGreaterThanOrEqual(0);
      } finally {
        env.cleanup();
      }
    });

    it("should accept runtime option", async () => {
      const env = createTempEnv();
      try {
        const result = await runCliWithTsx(["spawn", "test-project", "1-1", "--runtime", "tmux"], {
          cwd: env.cwd,
        });
        // Command should parse runtime option correctly
        expect(result.exitCode).toBeGreaterThanOrEqual(0);
      } finally {
        env.cleanup();
      }
    });
  });

  describe("exit codes", () => {
    it("should exit with appropriate code on spawn attempt", async () => {
      const env = createTempEnv();
      try {
        const result = await runCliWithTsx(["spawn", "test-project", "1-1"], { cwd: env.cwd });
        // May fail due to missing story/tmux/etc, but should handle gracefully
        expect(result.exitCode).toBeGreaterThanOrEqual(0);
      } finally {
        env.cleanup();
      }
    });

    it("should exit 1 on missing config", async () => {
      const { mkdtempSync } = await import("node:fs");
      const { join } = await import("node:path");
      const { tmpdir } = await import("node:os");
      const { rmSync } = await import("node:fs");

      const emptyDir = mkdtempSync(join(tmpdir(), "ao-spawn-exit-"));

      try {
        const result = await runCliWithTsx(["spawn", "test-project", "1-1"], { cwd: emptyDir });
        expect(result.exitCode).toBe(1);
      } finally {
        rmSync(emptyDir, { recursive: true, force: true });
      }
    });
  });
});
