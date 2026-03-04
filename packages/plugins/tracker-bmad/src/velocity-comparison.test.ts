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
import { computeVelocityComparison } from "./velocity-comparison.js";

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

const STATUS_PATH = "/home/user/test-project/custom-output/sprint-status.yaml";
const HISTORY_PATH = "/home/user/test-project/custom-output/sprint-history.jsonl";

const mockReadFileSync = readFileSync as ReturnType<typeof vi.fn>;
const mockExistsSync = existsSync as ReturnType<typeof vi.fn>;

function makeHistoryEntry(storyId: string, from: string, to: string, timestamp: string) {
  return JSON.stringify({ timestamp, storyId, fromStatus: from, toStatus: to });
}

function setFiles(opts: { statusYaml?: string; historyLines?: string[] }) {
  mockExistsSync.mockImplementation((p: string) => {
    if (p === STATUS_PATH && opts.statusYaml !== undefined) return true;
    if (p === HISTORY_PATH && opts.historyLines !== undefined) return true;
    return false;
  });
  mockReadFileSync.mockImplementation((p: string) => {
    if (p === STATUS_PATH && opts.statusYaml !== undefined) return opts.statusYaml;
    if (p === HISTORY_PATH && opts.historyLines !== undefined)
      return opts.historyLines.join("\n") + "\n";
    throw new Error(`Unexpected read: ${p}`);
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockExistsSync.mockReturnValue(false);
});

/** Create a Monday date string for a given number of weeks ago. */
function mondayWeeksAgo(weeksAgo: number): string {
  const now = new Date();
  const d = new Date(now);
  // Go to this Monday
  const day = d.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + diff);
  // Go back N weeks
  d.setUTCDate(d.getUTCDate() - weeksAgo * 7);
  d.setUTCHours(12, 0, 0, 0);
  return d.toISOString();
}

describe("computeVelocityComparison", () => {
  it("returns empty result with no history", () => {
    setFiles({
      statusYaml: ["development_status:", "  s1:", "    status: backlog"].join("\n"),
      historyLines: [],
    });

    const result = computeVelocityComparison(PROJECT);

    expect(result.weeks).toEqual([]);
    expect(result.averageVelocity).toBe(0);
    expect(result.trend).toBe("stable");
    expect(result.completionWeeks).toBeNull();
  });

  it("computes single week correctly", () => {
    const ts = mondayWeeksAgo(1);
    setFiles({
      statusYaml: ["development_status:", "  s1:", "    status: done"].join("\n"),
      historyLines: [
        makeHistoryEntry("s1", "in-progress", "done", ts),
        makeHistoryEntry("s2", "in-progress", "done", ts),
      ],
    });

    const result = computeVelocityComparison(PROJECT);

    expect(result.weeks.length).toBe(1);
    expect(result.weeks[0]!.completedCount).toBe(2);
    expect(result.averageVelocity).toBe(2);
  });

  it("detects improving trend with increasing velocity", () => {
    const lines: string[] = [];
    // Week 4 ago: 1 story, week 3: 2, week 2: 3, week 1: 4
    for (let w = 4; w >= 1; w--) {
      const ts = mondayWeeksAgo(w);
      const count = 5 - w;
      for (let i = 0; i < count; i++) {
        lines.push(makeHistoryEntry(`s-w${w}-${i}`, "in-progress", "done", ts));
      }
    }

    setFiles({
      statusYaml: ["development_status:", "  s1:", "    status: backlog"].join("\n"),
      historyLines: lines,
    });

    const result = computeVelocityComparison(PROJECT);

    expect(result.trend).toBe("improving");
    expect(result.trendSlope).toBeGreaterThan(0.3);
  });

  it("detects declining trend with decreasing velocity", () => {
    const lines: string[] = [];
    // Week 4 ago: 4 stories, week 3: 3, week 2: 2, week 1: 1
    for (let w = 4; w >= 1; w--) {
      const ts = mondayWeeksAgo(w);
      const count = w;
      for (let i = 0; i < count; i++) {
        lines.push(makeHistoryEntry(`s-w${w}-${i}`, "in-progress", "done", ts));
      }
    }

    setFiles({
      statusYaml: ["development_status:", "  s1:", "    status: backlog"].join("\n"),
      historyLines: lines,
    });

    const result = computeVelocityComparison(PROJECT);

    expect(result.trend).toBe("declining");
    expect(result.trendSlope).toBeLessThan(-0.3);
  });

  it("detects stable trend with constant velocity", () => {
    const lines: string[] = [];
    for (let w = 4; w >= 1; w--) {
      const ts = mondayWeeksAgo(w);
      for (let i = 0; i < 3; i++) {
        lines.push(makeHistoryEntry(`s-w${w}-${i}`, "in-progress", "done", ts));
      }
    }

    setFiles({
      statusYaml: ["development_status:", "  s1:", "    status: backlog"].join("\n"),
      historyLines: lines,
    });

    const result = computeVelocityComparison(PROJECT);

    expect(result.trend).toBe("stable");
    expect(result.averageVelocity).toBe(3);
    expect(Math.abs(result.trendSlope)).toBeLessThanOrEqual(0.3);
  });

  it("computes standard deviation correctly", () => {
    const lines: string[] = [];
    // Week 2 ago: 2 stories, Week 1 ago: 4 stories → stdDev = 1
    const ts2 = mondayWeeksAgo(2);
    const ts1 = mondayWeeksAgo(1);
    lines.push(makeHistoryEntry("s1", "in-progress", "done", ts2));
    lines.push(makeHistoryEntry("s2", "in-progress", "done", ts2));
    lines.push(makeHistoryEntry("s3", "in-progress", "done", ts1));
    lines.push(makeHistoryEntry("s4", "in-progress", "done", ts1));
    lines.push(makeHistoryEntry("s5", "in-progress", "done", ts1));
    lines.push(makeHistoryEntry("s6", "in-progress", "done", ts1));

    setFiles({
      statusYaml: ["development_status:", "  s1:", "    status: done"].join("\n"),
      historyLines: lines,
    });

    const result = computeVelocityComparison(PROJECT);

    // avg = 3, values are [2, 4], variance = (1+1)/2 = 1, stdDev = 1
    expect(result.stdDeviation).toBe(1);
  });

  it("provides nextWeekEstimate from regression", () => {
    const lines: string[] = [];
    for (let w = 3; w >= 1; w--) {
      const ts = mondayWeeksAgo(w);
      const count = 4 - w; // 1, 2, 3
      for (let i = 0; i < count; i++) {
        lines.push(makeHistoryEntry(`s-w${w}-${i}`, "in-progress", "done", ts));
      }
    }

    setFiles({
      statusYaml: ["development_status:", "  s1:", "    status: backlog"].join("\n"),
      historyLines: lines,
    });

    const result = computeVelocityComparison(PROJECT);

    // Regression on [1,2,3] → slope=1, intercept=1, next=1*3+1=4
    expect(result.nextWeekEstimate).toBeGreaterThan(3);
  });

  it("completionWeeks is null when averageVelocity is 0", () => {
    setFiles({
      statusYaml: [
        "development_status:",
        "  s1:",
        "    status: backlog",
        "  s2:",
        "    status: backlog",
      ].join("\n"),
      historyLines: [],
    });

    const result = computeVelocityComparison(PROJECT);

    expect(result.completionWeeks).toBeNull();
    expect(result.remainingStories).toBe(2);
  });

  it("counts remaining stories correctly", () => {
    const ts = mondayWeeksAgo(1);
    setFiles({
      statusYaml: [
        "development_status:",
        "  s1:",
        "    status: done",
        "  s2:",
        "    status: in-progress",
        "  s3:",
        "    status: backlog",
      ].join("\n"),
      historyLines: [makeHistoryEntry("s1", "in-progress", "done", ts)],
    });

    const result = computeVelocityComparison(PROJECT);

    // s2 and s3 are remaining (not done)
    expect(result.remainingStories).toBe(2);
  });
});
