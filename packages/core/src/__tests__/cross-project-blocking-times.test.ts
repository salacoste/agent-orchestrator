/**
 * Tests for cross-project blocking start time persistence (Story 51.5).
 * @module BlockingTimesStore.test
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, existsSync, writeFileSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  BlockingTimesFileStore,
  createBlockingTimesStore,
  BLOCKING_TIMES_FILENAME,
} from "../cross-project-blocking-times.js";
import type { CrossProjectDependency, SprintDataMap } from "../cross-project-deps.js";

// =============================================================================
// HELPERS
// =============================================================================

function makeTempDir(): string {
  return mkdtempSync(join(tmpdir(), "blocking-times-test-"));
}

function makeDep(
  id: string,
  sourceProject: string,
  sourceStory: string,
  targetProject: string,
  targetStory: string,
): CrossProjectDependency {
  return {
    id,
    sourceProjectId: sourceProject,
    sourceStoryId: sourceStory,
    targetProjectId: targetProject,
    targetStoryId: targetStory,
    createdAt: "2026-03-30T10:00:00.000Z",
  };
}

// =============================================================================
// TESTS
// =============================================================================

describe("BlockingTimesFileStore", () => {
  let tempDir: string;
  let store: BlockingTimesFileStore;

  beforeEach(() => {
    tempDir = makeTempDir();
    store = new BlockingTimesFileStore(join(tempDir, BLOCKING_TIMES_FILENAME));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  describe("load", () => {
    it("returns empty map when file does not exist", () => {
      const result = store.load();
      expect(result).toEqual({});
    });

    it("returns empty map for malformed YAML", () => {
      writeFileSync(store.filePath, "not: valid: yaml: [[[");
      const result = store.load();
      expect(result).toEqual({});
    });

    it("returns stored times from valid file", () => {
      const content = `blockingStartTimes:
  dep-abc: "2026-03-30T10:00:00.000Z"
  dep-xyz: "2026-03-29T14:30:00.000Z"
`;
      writeFileSync(store.filePath, content);

      const result = store.load();
      expect(result).toEqual({
        "dep-abc": "2026-03-30T10:00:00.000Z",
        "dep-xyz": "2026-03-29T14:30:00.000Z",
      });
    });

    it("strips non-string values from stored times", () => {
      const content = `blockingStartTimes:
  dep-valid: "2026-03-30T10:00:00.000Z"
  dep-number: 1234567890
  dep-null:
  dep-bool: true
`;
      writeFileSync(store.filePath, content);

      const result = store.load();
      expect(result).toEqual({
        "dep-valid": "2026-03-30T10:00:00.000Z",
      });
    });

    it("returns empty when blockingStartTimes is null", () => {
      writeFileSync(store.filePath, "blockingStartTimes: null\n");

      const result = store.load();
      expect(result).toEqual({});
    });

    it("returns empty when blockingStartTimes is an array", () => {
      writeFileSync(store.filePath, "blockingStartTimes:\n  - item1\n  - item2\n");

      const result = store.load();
      expect(result).toEqual({});
    });

    it("returns empty for valid YAML without blockingStartTimes key", () => {
      writeFileSync(store.filePath, "someOtherKey: value\n");

      const result = store.load();
      expect(result).toEqual({});
    });
  });

  describe("save", () => {
    it("persists and reloads times roundtrip", () => {
      const times = {
        "dep-1": "2026-03-30T10:00:00.000Z",
        "dep-2": "2026-03-30T11:00:00.000Z",
      };

      store.save(times);
      const loaded = store.load();

      expect(loaded).toEqual(times);
    });

    it("creates parent directory if needed", () => {
      const nestedDir = join(tempDir, "nested", "dir");
      const nestedStore = new BlockingTimesFileStore(join(nestedDir, BLOCKING_TIMES_FILENAME));

      nestedStore.save({ "dep-1": "2026-03-30T10:00:00.000Z" });
      expect(nestedStore.load()).toEqual({ "dep-1": "2026-03-30T10:00:00.000Z" });
    });
  });

  describe("refresh", () => {
    it("computes new start times for blocked deps", () => {
      const dep = makeDep("dep-1", "proj-a", "story-1", "proj-b", "story-2");
      const sprintData: SprintDataMap = {
        "proj-b": { development_status: { "story-2": "in-progress" } },
      };
      const now = new Date("2026-03-30T12:00:00.000Z");

      const { times, alerts } = store.refresh([dep], sprintData, 3_600_000, now);

      expect(times["dep-1"]).toBe("2026-03-30T12:00:00.000Z");
      expect(alerts).toHaveLength(1); // Alert exists but threshold not exceeded
      expect(alerts[0]!.thresholdExceeded).toBe(false); // Just started blocking
    });

    it("preserves existing times for still-blocked deps", () => {
      const dep = makeDep("dep-1", "proj-a", "story-1", "proj-b", "story-2");
      const sprintData: SprintDataMap = {
        "proj-b": { development_status: { "story-2": "in-progress" } },
      };
      const now = new Date("2026-03-30T12:00:00.000Z");

      // First refresh — creates start time
      store.refresh([dep], sprintData, 3_600_000, now);

      // Second refresh 2 hours later — preserves start time, generates alert
      const later = new Date("2026-03-30T14:00:00.000Z");
      const { times, alerts } = store.refresh([dep], sprintData, 3_600_000, later);

      expect(times["dep-1"]).toBe("2026-03-30T12:00:00.000Z"); // Preserved
      expect(alerts).toHaveLength(1);
      expect(alerts[0]!.thresholdExceeded).toBe(true);
    });

    it("clears resolved deps from times", () => {
      const dep = makeDep("dep-1", "proj-a", "story-1", "proj-b", "story-2");
      const sprintDataBlocked: SprintDataMap = {
        "proj-b": { development_status: { "story-2": "in-progress" } },
      };
      const now = new Date("2026-03-30T12:00:00.000Z");

      // First refresh — creates start time
      store.refresh([dep], sprintDataBlocked, 3_600_000, now);

      // Now resolve the dep
      const sprintDataResolved: SprintDataMap = {
        "proj-b": { development_status: { "story-2": "done" } },
      };

      const { times, alerts } = store.refresh([dep], sprintDataResolved, 3_600_000, now);

      expect(times["dep-1"]).toBeUndefined();
      expect(alerts).toHaveLength(0);
    });

    it("persists updated times to disk", () => {
      const dep = makeDep("dep-1", "proj-a", "story-1", "proj-b", "story-2");
      const sprintData: SprintDataMap = {
        "proj-b": { development_status: { "story-2": "in-progress" } },
      };
      const now = new Date("2026-03-30T12:00:00.000Z");

      store.refresh([dep], sprintData, 3_600_000, now);

      // Verify persisted
      expect(existsSync(store.filePath)).toBe(true);
      const raw = readFileSync(store.filePath, "utf-8");
      expect(raw).toContain("dep-1");
      expect(raw).toContain("2026-03-30T12:00:00.000Z");
    });

    it("does not rewrite file when times are unchanged", () => {
      const dep = makeDep("dep-1", "proj-a", "story-1", "proj-b", "story-2");
      const sprintData: SprintDataMap = {
        "proj-b": { development_status: { "story-2": "in-progress" } },
      };
      const now = new Date("2026-03-30T12:00:00.000Z");

      // First refresh
      store.refresh([dep], sprintData, 3_600_000, now);
      const firstWrite = readFileSync(store.filePath, "utf-8");

      // Second refresh with same state — file should not change
      store.refresh([dep], sprintData, 3_600_000, now);
      const secondWrite = readFileSync(store.filePath, "utf-8");

      expect(firstWrite).toBe(secondWrite);
    });

    it("computes correct alert fields with custom threshold", () => {
      const dep = makeDep("dep-1", "proj-a", "story-1", "proj-b", "story-2");
      const sprintData: SprintDataMap = {
        "proj-b": { development_status: { "story-2": "in-progress" } },
      };
      const startTime = new Date("2026-03-30T10:00:00.000Z");
      const later = new Date("2026-03-30T11:30:00.000Z"); // 1.5 hours later

      // First refresh to establish start time
      store.refresh([dep], sprintData, 3_600_000, startTime);

      // 30-minute threshold — 1.5h should exceed it
      const { alerts } = store.refresh([dep], sprintData, 1_800_000, later);

      expect(alerts).toHaveLength(1);
      expect(alerts[0]!.blockingDurationMs).toBe(5_400_000); // 1.5h
      expect(alerts[0]!.blockingDurationLabel).toBe("1h 30m");
      expect(alerts[0]!.blockedStoryId).toBe("story-1");
      expect(alerts[0]!.blockedProjectId).toBe("proj-a");
      expect(alerts[0]!.blockingStoryId).toBe("story-2");
      expect(alerts[0]!.blockingProjectId).toBe("proj-b");
      expect(alerts[0]!.thresholdExceeded).toBe(true);
    });
  });
});

describe("createBlockingTimesStore", () => {
  it("creates store with path relative to config file", () => {
    const store = createBlockingTimesStore("/path/to/agent-orchestrator.yaml");
    expect(store.filePath).toBe(`/path/to/${BLOCKING_TIMES_FILENAME}`);
  });
});
