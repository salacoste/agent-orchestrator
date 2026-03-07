import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ProjectConfig } from "@composio/ao-core";

// Mock node:fs before importing the module under test
vi.mock("node:fs", () => ({
  readFileSync: vi.fn(),
  appendFileSync: vi.fn(),
  existsSync: vi.fn(),
  mkdirSync: vi.fn(),
  writeFileSync: vi.fn(),
  renameSync: vi.fn(),
}));

import { readFileSync, existsSync } from "node:fs";
import { computeRetrospective } from "./retrospective.js";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const PROJECT = {
  root: "/tmp/test-project",
  name: "Test Project",
  repo: "org/test-project",
  path: "/tmp/test-project",
  defaultBranch: "main",
  sessionPrefix: "test",
  tracker: { plugin: "bmad", outputDir: "_bmad-output" },
} as ProjectConfig;

const HISTORY_PATH = "/tmp/test-project/_bmad-output/sprint-history.jsonl";
const STATUS_PATH = "/tmp/test-project/_bmad-output/sprint-status.yaml";

const mockReadFileSync = readFileSync as ReturnType<typeof vi.fn>;
const mockExistsSync = existsSync as ReturnType<typeof vi.fn>;

function makeEntry(storyId: string, fromStatus: string, toStatus: string, timestamp: string) {
  return JSON.stringify({ timestamp, storyId, fromStatus, toStatus });
}

function setHistory(lines: string[]) {
  mockExistsSync.mockImplementation((p: string) => {
    if (p === HISTORY_PATH) return true;
    if (p === STATUS_PATH) return false;
    return false;
  });
  mockReadFileSync.mockImplementation((p: string) => {
    if (p === HISTORY_PATH) return lines.join("\n") + "\n";
    throw new Error(`Unexpected read: ${p}`);
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
  mockExistsSync.mockReturnValue(false);
});

describe("computeRetrospective", () => {
  it("returns zeroed result for empty history", () => {
    mockExistsSync.mockReturnValue(false);

    const result = computeRetrospective(PROJECT);

    expect(result.periods).toEqual([]);
    expect(result.velocityTrend).toEqual([]);
    expect(result.averageVelocity).toBe(0);
    expect(result.velocityChange).toBe(0);
    expect(result.totalCompleted).toBe(0);
    expect(result.overallAverageCycleTimeMs).toBe(0);
  });

  it("computes single completion in one week", () => {
    // 2026-01-05 is a Monday, 2026-01-07 is a Wednesday
    setHistory([
      makeEntry("s1", "backlog", "in-progress", "2026-01-05T00:00:00.000Z"),
      makeEntry("s1", "in-progress", "done", "2026-01-07T00:00:00.000Z"),
    ]);

    const result = computeRetrospective(PROJECT);

    expect(result.periods).toHaveLength(1);
    expect(result.periods[0]!.completedCount).toBe(1);
    expect(result.periods[0]!.storyIds).toEqual(["s1"]);
    expect(result.periods[0]!.startDate).toBe("2026-01-05");
    expect(result.periods[0]!.endDate).toBe("2026-01-11");
    // Cycle time: 2 days = 172800000 ms
    expect(result.periods[0]!.averageCycleTimeMs).toBe(2 * 24 * 60 * 60 * 1000);
    expect(result.totalCompleted).toBe(1);
  });

  it("groups multiple completions in same week into single period", () => {
    // All in the same week (Mon 2026-01-05 through Sun 2026-01-11)
    setHistory([
      makeEntry("s1", "backlog", "in-progress", "2026-01-05T00:00:00.000Z"),
      makeEntry("s1", "in-progress", "done", "2026-01-06T00:00:00.000Z"),
      makeEntry("s2", "backlog", "in-progress", "2026-01-05T00:00:00.000Z"),
      makeEntry("s2", "in-progress", "done", "2026-01-07T00:00:00.000Z"),
      makeEntry("s3", "backlog", "in-progress", "2026-01-06T00:00:00.000Z"),
      makeEntry("s3", "in-progress", "done", "2026-01-08T00:00:00.000Z"),
    ]);

    const result = computeRetrospective(PROJECT);

    expect(result.periods).toHaveLength(1);
    expect(result.periods[0]!.completedCount).toBe(3);
    expect(result.periods[0]!.storyIds).toContain("s1");
    expect(result.periods[0]!.storyIds).toContain("s2");
    expect(result.periods[0]!.storyIds).toContain("s3");
  });

  it("creates multiple sorted periods for completions in different weeks", () => {
    // Week 1: 2026-01-05 (Mon) to 2026-01-11 (Sun)
    // Week 2: 2026-01-12 (Mon) to 2026-01-18 (Sun)
    setHistory([
      makeEntry("s1", "backlog", "in-progress", "2026-01-05T00:00:00.000Z"),
      makeEntry("s1", "in-progress", "done", "2026-01-06T00:00:00.000Z"),
      makeEntry("s2", "backlog", "in-progress", "2026-01-12T00:00:00.000Z"),
      makeEntry("s2", "in-progress", "done", "2026-01-14T00:00:00.000Z"),
    ]);

    const result = computeRetrospective(PROJECT);

    expect(result.periods).toHaveLength(2);
    // Should be sorted ascending
    expect(result.periods[0]!.startDate).toBe("2026-01-05");
    expect(result.periods[0]!.completedCount).toBe(1);
    expect(result.periods[1]!.startDate).toBe("2026-01-12");
    expect(result.periods[1]!.completedCount).toBe(1);
  });

  it("detects carry-over stories that have transitions but no done", () => {
    // s1 completes, s2 has activity but never reaches done in this week
    setHistory([
      makeEntry("s1", "backlog", "in-progress", "2026-01-05T00:00:00.000Z"),
      makeEntry("s1", "in-progress", "done", "2026-01-07T00:00:00.000Z"),
      makeEntry("s2", "backlog", "in-progress", "2026-01-06T00:00:00.000Z"),
      makeEntry("s2", "in-progress", "review", "2026-01-08T00:00:00.000Z"),
    ]);

    const result = computeRetrospective(PROJECT);

    expect(result.periods).toHaveLength(1);
    expect(result.periods[0]!.completedCount).toBe(1);
    expect(result.periods[0]!.carryOverCount).toBe(1);
  });

  it("produces correct velocity trend values", () => {
    setHistory([
      // Week 1: 2 completions
      makeEntry("s1", "backlog", "done", "2026-01-05T00:00:00.000Z"),
      makeEntry("s2", "backlog", "done", "2026-01-06T00:00:00.000Z"),
      // Week 2: 3 completions
      makeEntry("s3", "backlog", "done", "2026-01-12T00:00:00.000Z"),
      makeEntry("s4", "backlog", "done", "2026-01-13T00:00:00.000Z"),
      makeEntry("s5", "backlog", "done", "2026-01-14T00:00:00.000Z"),
    ]);

    const result = computeRetrospective(PROJECT);

    expect(result.velocityTrend).toEqual([2, 3]);
    expect(result.totalCompleted).toBe(5);
  });

  it("computes velocity change percentage correctly (positive)", () => {
    setHistory([
      // Week 1: 2 completions
      makeEntry("s1", "backlog", "done", "2026-01-05T00:00:00.000Z"),
      makeEntry("s2", "backlog", "done", "2026-01-06T00:00:00.000Z"),
      // Week 2: 4 completions (above average of 3)
      makeEntry("s3", "backlog", "done", "2026-01-12T00:00:00.000Z"),
      makeEntry("s4", "backlog", "done", "2026-01-13T00:00:00.000Z"),
      makeEntry("s5", "backlog", "done", "2026-01-14T00:00:00.000Z"),
      makeEntry("s6", "backlog", "done", "2026-01-15T00:00:00.000Z"),
    ]);

    const result = computeRetrospective(PROJECT);

    // velocityTrend = [2, 4], average = 3, last = 4
    // change = ((4 - 3) / 3) * 100 = 33.33...
    expect(result.averageVelocity).toBe(3);
    expect(result.velocityChange).toBeCloseTo(33.33, 1);
  });

  it("computes velocity change percentage correctly (negative)", () => {
    setHistory([
      // Week 1: 4 completions
      makeEntry("s1", "backlog", "done", "2026-01-05T00:00:00.000Z"),
      makeEntry("s2", "backlog", "done", "2026-01-06T00:00:00.000Z"),
      makeEntry("s3", "backlog", "done", "2026-01-07T00:00:00.000Z"),
      makeEntry("s4", "backlog", "done", "2026-01-08T00:00:00.000Z"),
      // Week 2: 2 completions (below average of 3)
      makeEntry("s5", "backlog", "done", "2026-01-12T00:00:00.000Z"),
      makeEntry("s6", "backlog", "done", "2026-01-13T00:00:00.000Z"),
    ]);

    const result = computeRetrospective(PROJECT);

    // velocityTrend = [4, 2], average = 3, last = 2
    // change = ((2 - 3) / 3) * 100 = -33.33...
    expect(result.averageVelocity).toBe(3);
    expect(result.velocityChange).toBeCloseTo(-33.33, 1);
  });

  it("computes overall average cycle time correctly", () => {
    const DAY = 24 * 60 * 60 * 1000;
    // Week 1: s1 takes 2 days, s2 takes 4 days
    setHistory([
      makeEntry("s1", "backlog", "in-progress", "2026-01-05T00:00:00.000Z"),
      makeEntry("s1", "in-progress", "done", "2026-01-07T00:00:00.000Z"),
      makeEntry("s2", "backlog", "in-progress", "2026-01-05T00:00:00.000Z"),
      makeEntry("s2", "in-progress", "done", "2026-01-09T00:00:00.000Z"),
    ]);

    const result = computeRetrospective(PROJECT);

    // Period avg = (2d + 4d) / 2 = 3 days
    // Overall = weighted average = 3 days (only one period)
    expect(result.overallAverageCycleTimeMs).toBe(3 * DAY);
  });

  it("computes story cycle time as difference between first non-backlog transition and done", () => {
    const DAY = 24 * 60 * 60 * 1000;
    // Story starts from backlog on Jan 5, done on Jan 10 = 5 days
    setHistory([
      makeEntry("s1", "backlog", "ready-for-dev", "2026-01-05T00:00:00.000Z"),
      makeEntry("s1", "ready-for-dev", "in-progress", "2026-01-06T00:00:00.000Z"),
      makeEntry("s1", "in-progress", "review", "2026-01-08T00:00:00.000Z"),
      makeEntry("s1", "review", "done", "2026-01-10T00:00:00.000Z"),
    ]);

    const result = computeRetrospective(PROJECT);

    expect(result.periods).toHaveLength(1);
    // Cycle time from first backlog exit (Jan 5) to done (Jan 10) = 5 days
    expect(result.periods[0]!.averageCycleTimeMs).toBe(5 * DAY);
  });

  it("returns zero velocity change with only one period", () => {
    setHistory([makeEntry("s1", "backlog", "done", "2026-01-05T00:00:00.000Z")]);

    const result = computeRetrospective(PROJECT);

    expect(result.velocityChange).toBe(0);
  });

  it("handles story with no backlog exit — uses first entry as start", () => {
    const DAY = 24 * 60 * 60 * 1000;
    // Story goes directly from in-progress to done (no backlog transition)
    setHistory([
      makeEntry("s1", "in-progress", "review", "2026-01-05T00:00:00.000Z"),
      makeEntry("s1", "review", "done", "2026-01-07T00:00:00.000Z"),
    ]);

    const result = computeRetrospective(PROJECT);

    expect(result.periods).toHaveLength(1);
    // Cycle time from first entry (Jan 5) to done (Jan 7) = 2 days
    expect(result.periods[0]!.averageCycleTimeMs).toBe(2 * DAY);
  });

  it("hasPoints is false when sprint status has no points", () => {
    setHistory([makeEntry("s1", "in-progress", "done", "2026-01-05T10:00:00.000Z")]);

    const result = computeRetrospective(PROJECT);

    expect(result.hasPoints).toBe(false);
    expect(result.velocityTrendPoints).toBeUndefined();
  });

  it("computes points per period when stories have points", () => {
    // Set up sprint status with points
    mockExistsSync.mockImplementation((p: string) => {
      if (p === HISTORY_PATH) return true;
      if (p === STATUS_PATH) return true;
      return false;
    });
    mockReadFileSync.mockImplementation((p: string) => {
      if (p === HISTORY_PATH)
        return (
          [
            makeEntry("s1", "in-progress", "done", "2026-01-05T10:00:00.000Z"),
            makeEntry("s2", "in-progress", "done", "2026-01-06T10:00:00.000Z"),
          ].join("\n") + "\n"
        );
      if (p === STATUS_PATH)
        return [
          "development_status:",
          "  s1:",
          "    status: done",
          "    points: 3",
          "  s2:",
          "    status: done",
          "    points: 5",
        ].join("\n");
      throw new Error(`Unexpected read: ${p}`);
    });

    const result = computeRetrospective(PROJECT);

    expect(result.hasPoints).toBe(true);
    expect(result.totalCompletedPoints).toBe(8); // 3 + 5
    expect(result.periods[0]!.completedPoints).toBe(8);
  });

  it("filters by epic when epicFilter is provided", () => {
    mockExistsSync.mockImplementation((p: string) => {
      if (p === HISTORY_PATH) return true;
      if (p === STATUS_PATH) return true;
      return false;
    });
    mockReadFileSync.mockImplementation((p: string) => {
      if (p === HISTORY_PATH)
        return (
          [
            makeEntry("s1", "in-progress", "done", "2026-01-05T10:00:00.000Z"),
            makeEntry("s2", "in-progress", "done", "2026-01-06T10:00:00.000Z"),
          ].join("\n") + "\n"
        );
      if (p === STATUS_PATH)
        return [
          "development_status:",
          "  s1:",
          "    status: done",
          "    epic: epic-auth",
          "  s2:",
          "    status: done",
          "    epic: epic-ui",
        ].join("\n");
      throw new Error(`Unexpected read: ${p}`);
    });

    const result = computeRetrospective(PROJECT, "epic-auth");

    expect(result.totalCompleted).toBe(1); // Only s1
  });
});
