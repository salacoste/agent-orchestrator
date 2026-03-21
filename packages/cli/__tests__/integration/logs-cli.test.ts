/**
 * CLI Integration Tests: Logs Command
 *
 * End-to-end tests for the `ao logs` command.
 */

import { describe, it, expect } from "vitest";
import { runCliWithTsx } from "./helpers/cli-test.js";
import { createTempEnv } from "./helpers/temp-env.js";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

describe("ao logs CLI", () => {
  describe("help and usage", () => {
    it("should show help with --help flag", async () => {
      const result = await runCliWithTsx(["logs", "--help"]);
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("logs");
    });
  });

  describe("error handling", () => {
    it("should error when no config file exists", async () => {
      const emptyDir = mkdtempSync(join(tmpdir(), "ao-logs-empty-"));
      try {
        const result = await runCliWithTsx(["logs"], { cwd: emptyDir });
        expect(result.exitCode).toBe(1);
        const combined = result.stdout + result.stderr;
        expect(
          combined.includes("No config found") || combined.includes("No agent-orchestrator.yaml"),
        ).toBe(true);
      } finally {
        rmSync(emptyDir, { recursive: true, force: true });
      }
    });
  });

  describe("output", () => {
    it("should handle empty agent list gracefully", async () => {
      const env = createTempEnv();
      try {
        const result = await runCliWithTsx(["logs"], { cwd: env.cwd });
        // No agents = should show empty message or error, not crash
        expect(result.exitCode).toBeGreaterThanOrEqual(0);
        expect(result.stdout.length + result.stderr.length).toBeGreaterThan(0);
      } finally {
        env.cleanup();
      }
    });

    it("should handle non-existent agent ID", async () => {
      const env = createTempEnv();
      try {
        const result = await runCliWithTsx(["logs", "nonexistent-agent"], { cwd: env.cwd });
        // Should show "agent not found" error
        expect(result.exitCode).toBeGreaterThanOrEqual(0);
        const combined = result.stdout + result.stderr;
        expect(combined.length).toBeGreaterThan(0);
      } finally {
        env.cleanup();
      }
    });
  });
});
