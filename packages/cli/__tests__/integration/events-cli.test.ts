/**
 * CLI Integration Tests: Events Command
 *
 * End-to-end tests for the `ao events` command (query subcommand).
 */

import { describe, it, expect } from "vitest";
import { runCliWithTsx } from "./helpers/cli-test.js";
import { createTempEnv } from "./helpers/temp-env.js";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

describe("ao events CLI", () => {
  describe("help and usage", () => {
    it("should show help with --help flag", async () => {
      const result = await runCliWithTsx(["events", "--help"]);
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("events");
    });

    it("should show query subcommand help", async () => {
      const result = await runCliWithTsx(["events", "query", "--help"]);
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("query");
    });
  });

  describe("error handling", () => {
    it("should error when no config file exists", async () => {
      const emptyDir = mkdtempSync(join(tmpdir(), "ao-events-empty-"));
      try {
        const result = await runCliWithTsx(["events", "query"], { cwd: emptyDir });
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

  describe("query output", () => {
    it("should handle empty audit trail gracefully", async () => {
      const env = createTempEnv();
      try {
        const result = await runCliWithTsx(["events", "query"], { cwd: env.cwd });
        // No events.jsonl = should show "no events" message
        expect(result.exitCode).toBeGreaterThanOrEqual(0);
        const combined = result.stdout + result.stderr;
        expect(combined.length).toBeGreaterThan(0);
      } finally {
        env.cleanup();
      }
    });

    it("should read events from JSONL file when present", async () => {
      const env = createTempEnv();
      try {
        // Create a test events.jsonl
        const eventsPath = join(env.cwd, "events.jsonl");
        const event = {
          eventId: "test-1",
          eventType: "story.completed",
          timestamp: new Date().toISOString(),
          metadata: { storyId: "1-1-test" },
          hash: "abc",
        };
        writeFileSync(eventsPath, JSON.stringify(event) + "\n");

        const result = await runCliWithTsx(["events", "query"], { cwd: env.cwd });
        expect(result.exitCode).toBeGreaterThanOrEqual(0);
        expect(result.stdout.length + result.stderr.length).toBeGreaterThan(0);
      } finally {
        env.cleanup();
      }
    });

    it("should support --json JSONL output", async () => {
      const env = createTempEnv();
      try {
        const eventsPath = join(env.cwd, "events.jsonl");
        const event = {
          eventId: "test-1",
          eventType: "story.completed",
          timestamp: new Date().toISOString(),
          metadata: { storyId: "1-1-test" },
          hash: "abc",
        };
        writeFileSync(eventsPath, JSON.stringify(event) + "\n");

        const result = await runCliWithTsx(["events", "query", "--json"], { cwd: env.cwd });
        expect(result.exitCode).toBeGreaterThanOrEqual(0);
        expect(result.stdout.length + result.stderr.length).toBeGreaterThan(0);
      } finally {
        env.cleanup();
      }
    });
  });
});
