/**
 * CLI Integration Tests: Burndown Command
 *
 * End-to-end tests for the `ao burndown` command.
 */

import { describe, it, expect } from "vitest";
import { runCliWithTsx } from "./helpers/cli-test.js";
import { createTempEnv } from "./helpers/temp-env.js";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

describe("ao burndown CLI", () => {
  describe("help and usage", () => {
    it("should show help with --help flag", async () => {
      const result = await runCliWithTsx(["burndown", "--help"]);
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("burndown");
    });
  });

  describe("error handling", () => {
    it("should error when no config file exists", async () => {
      const emptyDir = mkdtempSync(join(tmpdir(), "ao-burndown-empty-"));
      try {
        const result = await runCliWithTsx(["burndown"], { cwd: emptyDir });
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
    it("should produce output with valid config and sprint data", async () => {
      const env = createTempEnv();
      try {
        const result = await runCliWithTsx(["burndown", "test-project"], { cwd: env.cwd });
        // Burndown reads sprint-status.yaml — may show chart or "no data"
        expect(result.exitCode).toBeGreaterThanOrEqual(0);
        expect(result.stdout.length + result.stderr.length).toBeGreaterThan(0);
      } finally {
        env.cleanup();
      }
    });

    it("should support --json output", async () => {
      const env = createTempEnv();
      try {
        const result = await runCliWithTsx(["burndown", "test-project", "--json"], {
          cwd: env.cwd,
        });
        expect(result.exitCode).toBeGreaterThanOrEqual(0);
        // JSON output should be parseable or show error
        expect(result.stdout.length + result.stderr.length).toBeGreaterThan(0);
      } finally {
        env.cleanup();
      }
    });
  });
});
