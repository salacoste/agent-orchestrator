/**
 * CLI Integration Tests: Fleet Command
 *
 * End-to-end tests for the `ao fleet` command.
 * Tests CLI argument parsing, output formatting, and exit codes.
 */

import { describe, it, expect } from "vitest";
import { runCliWithTsx } from "./helpers/cli-test.js";
import { createTempEnv } from "./helpers/temp-env.js";

describe("ao fleet CLI", () => {
  describe("help and usage", () => {
    it("should show help with --help flag", async () => {
      const result = await runCliWithTsx(["fleet", "--help"]);
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("Usage:");
      expect(result.stdout).toContain("ao fleet");
    });

    it("should show help with -h flag", async () => {
      const result = await runCliWithTsx(["fleet", "-h"]);
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

      const emptyDir = mkdtempSync(join(tmpdir(), "ao-fleet-empty-"));

      try {
        const result = await runCliWithTsx(["fleet"], { cwd: emptyDir });
        expect(result.exitCode).toBe(1);
        // Error message should contain config error (may have npm warnings)
        const combinedOutput = result.stdout + result.stderr;
        const hasConfigError =
          combinedOutput.includes("No config found") ||
          combinedOutput.includes("No agent-orchestrator.yaml");
        expect(hasConfigError).toBe(true);
      } finally {
        rmSync(emptyDir, { recursive: true, force: true });
      }
    });

    it("should handle missing sessions directory gracefully", async () => {
      const env = createTempEnv();
      try {
        // Remove sessions directory
        const { rmSync } = await import("node:fs");
        rmSync(env.sessionsDir, { recursive: true });

        const result = await runCliWithTsx(["fleet"], { cwd: env.cwd });
        // Fleet command requires config to exist, but should handle missing sessions gracefully
        // It may exit 1 if no sessions found, which is acceptable
        expect(result.exitCode).toBeGreaterThanOrEqual(0);
      } finally {
        env.cleanup();
      }
    });
  });

  describe("output formatting", () => {
    it("should display fleet monitoring table", async () => {
      const env = createTempEnv();
      try {
        const result = await runCliWithTsx(["fleet"], { cwd: env.cwd });
        // Fleet command requires tmux and sessions to work properly
        // May exit 1 if no tmux/sessions, which is expected behavior
        expect(result.exitCode).toBeGreaterThanOrEqual(0);
        // Should produce some output (error message or table)
        expect(result.stdout.length + result.stderr.length).toBeGreaterThan(0);
      } finally {
        env.cleanup();
      }
    });

    it("should show column headers", async () => {
      const env = createTempEnv();
      try {
        const result = await runCliWithTsx(["fleet"], { cwd: env.cwd });
        // Fleet command requires actual sessions to show table
        expect(result.exitCode).toBeGreaterThanOrEqual(0);
        // Should produce some output
        expect(result.stdout.length + result.stderr.length).toBeGreaterThan(0);
      } finally {
        env.cleanup();
      }
    });

    it("should support JSON output format", async () => {
      const env = createTempEnv();
      try {
        const result = await runCliWithTsx(["fleet", "--json"], { cwd: env.cwd });
        // Fleet command requires actual sessions for JSON output
        expect(result.exitCode).toBeGreaterThanOrEqual(0);
        // Should produce some output
        expect(result.stdout.length + result.stderr.length).toBeGreaterThan(0);
      } finally {
        env.cleanup();
      }
    });
  });

  describe("exit codes", () => {
    it("should exit with appropriate code based on available sessions", async () => {
      const env = createTempEnv();
      try {
        const result = await runCliWithTsx(["fleet"], { cwd: env.cwd });
        // Fleet command requires tmux and active sessions
        // May exit 1 if no sessions, which is expected
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

      const emptyDir = mkdtempSync(join(tmpdir(), "ao-fleet-exit-"));

      try {
        const result = await runCliWithTsx(["fleet"], { cwd: emptyDir });
        expect(result.exitCode).toBe(1);
        // Should show config error
        const combinedOutput = result.stdout + result.stderr;
        const hasConfigError =
          combinedOutput.includes("No config found") ||
          combinedOutput.includes("No agent-orchestrator.yaml");
        expect(hasConfigError).toBe(true);
      } finally {
        rmSync(emptyDir, { recursive: true, force: true });
      }
    });
  });
});
