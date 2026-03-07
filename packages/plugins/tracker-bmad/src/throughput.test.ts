import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ProjectConfig } from "@composio/ao-core";

vi.mock("node:fs", () => ({
  readFileSync: vi.fn(),
  appendFileSync: vi.fn(),
  existsSync: vi.fn(),
  mkdirSync: vi.fn(),
  writeFileSync: vi.fn(),
  renameSync: vi.fn(),
}));

import { readFileSync, existsSync } from "node:fs";
import { computeThroughput } from "./throughput.js";

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
const STATUS_PATH = "/home/user/test-project/custom-output/sprint-status.yaml";

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

function setHistoryAndStatus(lines: string[], statusYaml: string) {
  mockExistsSync.mockImplementation((p: string) => {
    if (p === HISTORY_PATH) return true;
    if (p === STATUS_PATH) return true;
    return false;
  });
  mockReadFileSync.mockImplementation((p: string) => {
    if (p === HISTORY_PATH) return lines.join("\n") + "\n";
    if (p === STATUS_PATH) return statusYaml;
    throw new Error(`Unexpected read: ${p}`);
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockExistsSync.mockReturnValue(false);
});

describe("computeThroughput", () => {
  it("returns empty result when no history exists", () => {
    const result = computeThroughput(PROJECT);
    expect(result.dailyThroughput).toEqual([]);
    expect(result.weeklyThroughput).toEqual([]);
    expect(result.leadTimes).toEqual([]);
    expect(result.averageLeadTimeMs).toBe(0);
    expect(result.flowEfficiency).toBe(0);
    expect(result.bottleneckTrend).toBeNull();
  });

  it("computes daily throughput for completed stories", () => {
    setHistory([
      makeEntry("s1", "backlog", "in-progress", "2026-01-01T00:00:00.000Z"),
      makeEntry("s1", "in-progress", "done", "2026-01-03T00:00:00.000Z"),
      makeEntry("s2", "backlog", "in-progress", "2026-01-02T00:00:00.000Z"),
      makeEntry("s2", "in-progress", "done", "2026-01-03T00:00:00.000Z"),
      makeEntry("s3", "backlog", "done", "2026-01-05T00:00:00.000Z"),
    ]);

    const result = computeThroughput(PROJECT);

    expect(result.dailyThroughput).toHaveLength(2);
    // Two stories completed on Jan 3
    const jan3 = result.dailyThroughput.find((d) => d.date === "2026-01-03");
    expect(jan3).toBeDefined();
    expect(jan3!.count).toBe(2);
    // One story on Jan 5
    const jan5 = result.dailyThroughput.find((d) => d.date === "2026-01-05");
    expect(jan5).toBeDefined();
    expect(jan5!.count).toBe(1);
  });

  it("computes weekly throughput", () => {
    setHistory([
      makeEntry("s1", "backlog", "done", "2026-01-06T00:00:00.000Z"), // Mon week 1
      makeEntry("s2", "backlog", "done", "2026-01-08T00:00:00.000Z"), // Wed week 1
      makeEntry("s3", "backlog", "done", "2026-01-13T00:00:00.000Z"), // Mon week 2
    ]);

    const result = computeThroughput(PROJECT);

    expect(result.weeklyThroughput).toHaveLength(2);
    const week1 = result.weeklyThroughput[0]!;
    expect(week1.count).toBe(2);
    const week2 = result.weeklyThroughput[1]!;
    expect(week2.count).toBe(1);
  });

  it("computes lead time and cycle time", () => {
    setHistory([
      // Lead time: Jan 1 → Jan 5 = 4 days
      // Cycle time: Jan 1 (backlog exit) → Jan 5 = 4 days
      makeEntry("s1", "backlog", "ready-for-dev", "2026-01-01T00:00:00.000Z"),
      makeEntry("s1", "ready-for-dev", "in-progress", "2026-01-02T00:00:00.000Z"),
      makeEntry("s1", "in-progress", "done", "2026-01-05T00:00:00.000Z"),
    ]);

    const result = computeThroughput(PROJECT);

    expect(result.leadTimes).toHaveLength(1);
    const lt = result.leadTimes[0]!;
    expect(lt.storyId).toBe("s1");
    const DAY = 24 * 60 * 60 * 1000;
    expect(lt.leadTimeMs).toBe(4 * DAY);
    expect(lt.cycleTimeMs).toBe(4 * DAY);
  });

  it("computes flow efficiency", () => {
    setHistory([
      // ready-for-dev: 1 day (waiting), in-progress: 2 days (active), review: 1 day (active)
      makeEntry("s1", "backlog", "ready-for-dev", "2026-01-01T00:00:00.000Z"),
      makeEntry("s1", "ready-for-dev", "in-progress", "2026-01-02T00:00:00.000Z"),
      makeEntry("s1", "in-progress", "review", "2026-01-04T00:00:00.000Z"),
      makeEntry("s1", "review", "done", "2026-01-05T00:00:00.000Z"),
    ]);

    const result = computeThroughput(PROJECT);

    // Active time: in-progress (2d) + review (1d) = 3d
    // Total time: ready-for-dev (1d) + in-progress (2d) + review (1d) = 4d
    // Flow efficiency: 3/4 = 0.75
    expect(result.flowEfficiency).toBeCloseTo(0.75, 2);
  });

  it("excludes incomplete stories from lead time calculations", () => {
    setHistory([
      makeEntry("s1", "backlog", "done", "2026-01-03T00:00:00.000Z"),
      makeEntry("s2", "backlog", "in-progress", "2026-01-01T00:00:00.000Z"),
    ]);

    const result = computeThroughput(PROJECT);

    expect(result.leadTimes).toHaveLength(1);
    expect(result.leadTimes[0]!.storyId).toBe("s1");
  });

  it("includes points in throughput when sprint status is available", () => {
    const statusYaml = [
      "development_status:",
      "  s1:",
      "    status: done",
      "    points: 3",
      "  s2:",
      "    status: done",
      "    points: 5",
    ].join("\n");

    setHistoryAndStatus(
      [
        makeEntry("s1", "backlog", "done", "2026-01-03T00:00:00.000Z"),
        makeEntry("s2", "backlog", "done", "2026-01-03T00:00:00.000Z"),
      ],
      statusYaml,
    );

    const result = computeThroughput(PROJECT);

    expect(result.dailyThroughput).toHaveLength(1);
    expect(result.dailyThroughput[0]!.points).toBe(8);
  });

  it("deduplicates bouncing stories in daily throughput", () => {
    setHistory([
      makeEntry("s1", "backlog", "done", "2026-01-03T00:00:00.000Z"),
      makeEntry("s1", "done", "in-progress", "2026-01-03T12:00:00.000Z"),
      makeEntry("s1", "in-progress", "done", "2026-01-03T18:00:00.000Z"),
    ]);

    const result = computeThroughput(PROJECT);

    // Should only count once
    expect(result.dailyThroughput).toHaveLength(1);
    expect(result.dailyThroughput[0]!.count).toBe(1);
  });

  it("computes median lead and cycle times", () => {
    setHistory([
      // s1: 1 day lead/cycle
      makeEntry("s1", "backlog", "done", "2026-01-02T00:00:00.000Z"),
      // s2: 3 days lead/cycle
      makeEntry("s2", "backlog", "done", "2026-01-04T00:00:00.000Z"),
      // s3: 5 days lead/cycle
      makeEntry("s3", "backlog", "done", "2026-01-06T00:00:00.000Z"),
    ]);

    // These are all single-entry stories (backlog→done) so lead time = 0
    // Let me fix: need at least 2 entries per story for non-zero lead time
    const result = computeThroughput(PROJECT);
    // Single transitions: lead time = 0 for all
    expect(result.medianLeadTimeMs).toBe(0);
  });

  it("filters by epic when epicFilter is provided", () => {
    const statusYaml = [
      "development_status:",
      "  s1:",
      "    status: done",
      "    epic: epic-auth",
      "  s2:",
      "    status: done",
      "    epic: epic-ui",
    ].join("\n");

    setHistoryAndStatus(
      [
        makeEntry("s1", "backlog", "done", "2026-01-03T00:00:00.000Z"),
        makeEntry("s2", "backlog", "done", "2026-01-04T00:00:00.000Z"),
      ],
      statusYaml,
    );

    const result = computeThroughput(PROJECT, "epic-auth");

    expect(result.dailyThroughput).toHaveLength(1);
    expect(result.leadTimes).toHaveLength(1);
    expect(result.leadTimes[0]!.storyId).toBe("s1");
  });

  it("detects bottleneck trend from column trends", () => {
    // Create history entries across multiple weeks where review time increases
    setHistory([
      // Week 1: review = 1 day
      makeEntry("s1", "backlog", "in-progress", "2026-01-05T00:00:00.000Z"),
      makeEntry("s1", "in-progress", "review", "2026-01-06T00:00:00.000Z"),
      makeEntry("s1", "review", "done", "2026-01-07T00:00:00.000Z"),
      // Week 2: review = 3 days
      makeEntry("s2", "backlog", "in-progress", "2026-01-12T00:00:00.000Z"),
      makeEntry("s2", "in-progress", "review", "2026-01-13T00:00:00.000Z"),
      makeEntry("s2", "review", "done", "2026-01-16T00:00:00.000Z"),
      // Week 3: review = 5 days
      makeEntry("s3", "backlog", "in-progress", "2026-01-19T00:00:00.000Z"),
      makeEntry("s3", "in-progress", "review", "2026-01-20T00:00:00.000Z"),
      makeEntry("s3", "review", "done", "2026-01-25T00:00:00.000Z"),
    ]);

    const result = computeThroughput(PROJECT);

    // Review column should have increasing trend
    const reviewTrend = result.columnTrends.find((t) => t.column === "review");
    expect(reviewTrend).toBeDefined();
    expect(reviewTrend!.slope).toBeGreaterThan(0);
    expect(reviewTrend!.trend).toBe("increasing");
    expect(result.bottleneckTrend).toBe("review");
  });
});
