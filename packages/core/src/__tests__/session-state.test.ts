/**
 * Session state reader tests (Story 60-7).
 */
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { join } from "node:path";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";

// Mock core types import for ESM
vi.mock("./types.js", () => ({}));

import { readSessionState, emptySessionState } from "../session-state.js";

describe("session-state", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "session-state-test-"));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  describe("emptySessionState", () => {
    it("returns empty default state", () => {
      const state = emptySessionState();
      expect(state).toEqual({
        executionMode: null,
        activeAgents: [],
        configured: false,
        activeModes: [],
        health: null,
      });
    });

    it("returns frozen object", () => {
      const state = emptySessionState();
      expect(Object.isFrozen(state)).toBe(true);
    });
  });

  describe("readSessionState", () => {
    it("reads state files successfully", async () => {
      const stateDir = join(tempDir, ".omc", "state");
      await mkdir(stateDir, { recursive: true });

      await writeFile(
        join(stateDir, "ralph-state.json"),
        JSON.stringify({ active: true, iteration: 3, max_iterations: 10 }),
      );
      await writeFile(
        join(stateDir, "autopilot-state.json"),
        JSON.stringify({
          active: true,
          phase: "executing",
          iteration: 1,
          max_iterations: 5,
          execution: { tasks_completed: 3, tasks_total: 7 },
        }),
      );

      const metadata = {
        "omc:executionMode": "standard",
        "omc:agents": JSON.stringify(["omc", "explore"]),
        "omc:configured": "true",
      };

      const state = await readSessionState(tempDir, metadata);

      expect(state.executionMode).toBe("standard");
      expect(state.activeAgents).toEqual(["omc", "explore"]);
      expect(state.configured).toBe(true);
      expect(state.health).toBeNull();
      expect(state.activeModes).toHaveLength(2);

      const ralph = state.activeModes.find((m) => m.mode === "ralph");
      expect(ralph).toEqual({
        mode: "ralph",
        active: true,
        iteration: 3,
        maxIterations: 10,
      });

      const autopilot = state.activeModes.find((m) => m.mode === "autopilot");
      expect(autopilot).toEqual({
        mode: "autopilot",
        active: true,
        iteration: 1,
        maxIterations: 5,
        phase: "executing",
        tasksCompleted: 3,
        tasksTotal: 7,
      });
    });

    it("handles missing state directory", async () => {
      const metadata = { "omc:executionMode": "standard" };
      const state = await readSessionState(join(tempDir, "nonexistent"), metadata);

      expect(state.activeModes).toEqual([]);
      expect(state.executionMode).toBe("standard");
    });

    it("handles malformed JSON in state files", async () => {
      const stateDir = join(tempDir, ".omc", "state");
      await mkdir(stateDir, { recursive: true });
      await writeFile(join(stateDir, "ralph-state.json"), "{ not valid json }");
      await writeFile(
        join(stateDir, "ultrawork-state.json"),
        JSON.stringify({ active: true, reinforcement_count: 5 }),
      );

      const state = await readSessionState(tempDir, {});

      // ralph should be skipped (malformed), ultrawork should be read
      expect(state.activeModes).toHaveLength(1);
      expect(state.activeModes[0].mode).toBe("ultrawork");
    });

    it("parses metadata correctly", async () => {
      const metadata = {
        "omc:executionMode": "autopilot",
        "omc:agents": JSON.stringify(["omc", "explore", "analyst"]),
        "omc:configured": "true",
        "other:key": "ignored",
      };

      const state = await readSessionState(tempDir, metadata);

      expect(state.executionMode).toBe("autopilot");
      expect(state.activeAgents).toEqual(["omc", "explore", "analyst"]);
      expect(state.configured).toBe(true);
    });

    it("returns defaults when all files missing and no metadata", async () => {
      const state = await readSessionState(tempDir, {});

      expect(state).toEqual({
        executionMode: null,
        activeAgents: [],
        configured: false,
        activeModes: [],
        health: null,
      });
    });

    it("handles partial state — some files exist, some don't", async () => {
      const stateDir = join(tempDir, ".omc", "state");
      await mkdir(stateDir, { recursive: true });

      // Only ultrawork exists
      await writeFile(
        join(stateDir, "ultrawork-state.json"),
        JSON.stringify({ active: false, reinforcement_count: 2 }),
      );

      const state = await readSessionState(tempDir, { "omc:configured": "true" });

      expect(state.configured).toBe(true);
      expect(state.activeModes).toHaveLength(1);
      expect(state.activeModes[0]).toEqual({
        mode: "ultrawork",
        active: false,
      });
    });

    it("handles malformed agents metadata gracefully", async () => {
      const metadata = {
        "omc:agents": "not-json",
        "omc:configured": "false",
      };

      const state = await readSessionState(tempDir, metadata);

      expect(state.activeAgents).toEqual([]);
      expect(state.configured).toBe(false);
    });

    it("handles valid non-array JSON for agents metadata", async () => {
      const metadata = {
        "omc:agents": JSON.stringify("just-a-string"),
        "omc:executionMode": "standard",
      };

      const state = await readSessionState(tempDir, metadata);

      // Should fall back to [] — a string is not an array
      expect(state.activeAgents).toEqual([]);
      expect(state.executionMode).toBe("standard");
    });
  });
});
