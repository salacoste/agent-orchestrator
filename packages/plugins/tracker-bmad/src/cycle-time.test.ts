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
import { computeCycleTime } from "./cycle-time.js";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const PROJECT: ProjectConfig = {
  name: "Test Project",
  repo: "org/test-project",
  path: "/home/user/test-project",
  defaultBranch: "main",
  sessionPrefix: "test",
  tracker: {
    plugin: "bmad",
    outputDir: "custom-output",
  },
};

const HISTORY_PATH = "/home/user/test-project/custom-output/sprint-history.jsonl";

const mockReadFileSync = readFileSync as ReturnType<typeof vi.fn>;
const mockExistsSync = existsSync as ReturnType<typeof vi.fn>;

function makeEntry(storyId: string, fromStatus: string, toStatus: string, timestamp: string) {
  return JSON.stringify({ timestamp, storyId, fromStatus, toStatus });
}

function setHistory(lines: string[]) {
  mockExistsSync.mockImplementation((p: string) => p === HISTORY_PATH);
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

describe("computeCycleTime", () => {
  it("returns zeroed stats for empty history", () => {
    mockExistsSync.mockReturnValue(false);

    const stats = computeCycleTime(PROJECT);

    expect(stats.stories).toEqual([]);
    expect(stats.averageCycleTimeMs).toBe(0);
    expect(stats.medianCycleTimeMs).toBe(0);
    expect(stats.averageColumnDwells).toEqual([]);
    expect(stats.bottleneckColumn).toBeNull();
    expect(stats.throughputPerDay).toBe(0);
    expect(stats.throughputPerWeek).toBe(0);
    expect(stats.completedCount).toBe(0);
  });

  it("computes correct cycle time for a single completed story", () => {
    setHistory([
      makeEntry("s1", "backlog", "ready-for-dev", "2026-01-01T00:00:00.000Z"),
      makeEntry("s1", "ready-for-dev", "in-progress", "2026-01-02T00:00:00.000Z"),
      makeEntry("s1", "in-progress", "review", "2026-01-04T00:00:00.000Z"),
      makeEntry("s1", "review", "done", "2026-01-05T00:00:00.000Z"),
    ]);

    const stats = computeCycleTime(PROJECT);

    expect(stats.completedCount).toBe(1);
    expect(stats.stories).toHaveLength(1);

    const story = stats.stories[0]!;
    expect(story.storyId).toBe("s1");
    expect(story.startedAt).toBe("2026-01-01T00:00:00.000Z");
    expect(story.completedAt).toBe("2026-01-05T00:00:00.000Z");
    // 4 days = 345600000 ms
    expect(story.cycleTimeMs).toBe(4 * 24 * 60 * 60 * 1000);

    // Column dwells: ready-for-dev (1d), in-progress (2d), review (1d)
    expect(story.columnDwells).toHaveLength(3);
    expect(story.columnDwells[0]).toEqual({
      column: "ready-for-dev",
      dwellMs: 1 * 24 * 60 * 60 * 1000,
    });
    expect(story.columnDwells[1]).toEqual({
      column: "in-progress",
      dwellMs: 2 * 24 * 60 * 60 * 1000,
    });
    expect(story.columnDwells[2]).toEqual({
      column: "review",
      dwellMs: 1 * 24 * 60 * 60 * 1000,
    });
  });

  it("computes correct averages and median for multiple stories", () => {
    setHistory([
      // Story A: 2 days
      makeEntry("a", "backlog", "in-progress", "2026-01-01T00:00:00.000Z"),
      makeEntry("a", "in-progress", "done", "2026-01-03T00:00:00.000Z"),
      // Story B: 4 days
      makeEntry("b", "backlog", "in-progress", "2026-01-01T00:00:00.000Z"),
      makeEntry("b", "in-progress", "done", "2026-01-05T00:00:00.000Z"),
      // Story C: 6 days
      makeEntry("c", "backlog", "in-progress", "2026-01-01T00:00:00.000Z"),
      makeEntry("c", "in-progress", "done", "2026-01-07T00:00:00.000Z"),
    ]);

    const stats = computeCycleTime(PROJECT);

    expect(stats.completedCount).toBe(3);

    const DAY = 24 * 60 * 60 * 1000;
    // Average: (2+4+6)/3 = 4 days
    expect(stats.averageCycleTimeMs).toBe(4 * DAY);
    // Median of [2,4,6] = 4 days
    expect(stats.medianCycleTimeMs).toBe(4 * DAY);
  });

  it("excludes stories that never reach done", () => {
    setHistory([
      // Story A: completed
      makeEntry("a", "backlog", "in-progress", "2026-01-01T00:00:00.000Z"),
      makeEntry("a", "in-progress", "done", "2026-01-03T00:00:00.000Z"),
      // Story B: stuck in progress
      makeEntry("b", "backlog", "in-progress", "2026-01-01T00:00:00.000Z"),
      makeEntry("b", "in-progress", "review", "2026-01-04T00:00:00.000Z"),
    ]);

    const stats = computeCycleTime(PROJECT);

    expect(stats.completedCount).toBe(1);
    expect(stats.stories).toHaveLength(1);
    expect(stats.stories[0]!.storyId).toBe("a");
  });

  it("handles bouncing story (done→in-progress→done) — uses last completion", () => {
    setHistory([
      makeEntry("s1", "backlog", "in-progress", "2026-01-01T00:00:00.000Z"),
      makeEntry("s1", "in-progress", "done", "2026-01-03T00:00:00.000Z"),
      makeEntry("s1", "done", "in-progress", "2026-01-04T00:00:00.000Z"),
      makeEntry("s1", "in-progress", "done", "2026-01-06T00:00:00.000Z"),
    ]);

    const stats = computeCycleTime(PROJECT);

    expect(stats.completedCount).toBe(1);
    const story = stats.stories[0]!;
    expect(story.storyId).toBe("s1");
    // Uses last done transition
    expect(story.completedAt).toBe("2026-01-06T00:00:00.000Z");
    // Cycle time from first backlog exit to last done = 5 days
    expect(story.cycleTimeMs).toBe(5 * 24 * 60 * 60 * 1000);
  });

  it("identifies bottleneck column correctly", () => {
    setHistory([
      // Story with long review phase
      makeEntry("s1", "backlog", "in-progress", "2026-01-01T00:00:00.000Z"),
      makeEntry("s1", "in-progress", "review", "2026-01-02T00:00:00.000Z"),
      makeEntry("s1", "review", "done", "2026-01-10T00:00:00.000Z"),
    ]);

    const stats = computeCycleTime(PROJECT);

    expect(stats.bottleneckColumn).toBe("review");
    // review dwell: 8 days, in-progress dwell: 1 day
    const reviewDwell = stats.averageColumnDwells.find((d) => d.column === "review");
    const ipDwell = stats.averageColumnDwells.find((d) => d.column === "in-progress");
    expect(reviewDwell!.dwellMs).toBeGreaterThan(ipDwell!.dwellMs);
  });

  it("computes throughput for trailing 7-day and 4-week windows", () => {
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000).toISOString();
    const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString();
    const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString();
    const fourDaysAgo = new Date(now.getTime() - 4 * 24 * 60 * 60 * 1000).toISOString();

    setHistory([
      makeEntry("a", "backlog", "in-progress", fourDaysAgo),
      makeEntry("a", "in-progress", "done", threeDaysAgo),
      makeEntry("b", "backlog", "in-progress", threeDaysAgo),
      makeEntry("b", "in-progress", "done", twoDaysAgo),
      makeEntry("c", "backlog", "in-progress", twoDaysAgo),
      makeEntry("c", "in-progress", "done", oneDayAgo),
    ]);

    const stats = computeCycleTime(PROJECT);

    // 3 stories completed within 7 days → throughput/day ≈ 3/7 ≈ 0.43
    expect(stats.throughputPerDay).toBeGreaterThan(0);
    expect(stats.throughputPerDay).toBeLessThan(1);
    // Weekly throughput should be ~3
    expect(stats.throughputPerWeek).toBeGreaterThan(0);
  });

  it("handles story skipping columns (backlog→done directly)", () => {
    setHistory([makeEntry("s1", "backlog", "done", "2026-01-01T00:00:00.000Z")]);

    const stats = computeCycleTime(PROJECT);

    expect(stats.completedCount).toBe(1);
    const story = stats.stories[0]!;
    expect(story.storyId).toBe("s1");
    // Single transition: start and complete at the same time → 0 cycle time
    expect(story.cycleTimeMs).toBe(0);
    // No column dwells (only 1 entry, need ≥2 for dwells)
    expect(story.columnDwells).toEqual([]);
  });

  it("returns zeroed stats when all stories are incomplete", () => {
    setHistory([
      makeEntry("a", "backlog", "in-progress", "2026-01-01T00:00:00.000Z"),
      makeEntry("b", "backlog", "review", "2026-01-02T00:00:00.000Z"),
    ]);

    const stats = computeCycleTime(PROJECT);

    expect(stats.completedCount).toBe(0);
    expect(stats.stories).toEqual([]);
    expect(stats.averageCycleTimeMs).toBe(0);
    expect(stats.bottleneckColumn).toBeNull();
  });
});
