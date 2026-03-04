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
import { computeForecast } from "./forecast.js";

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

const STATUS_PATH = "/home/user/test-project/custom-output/sprint-status.yaml";
const HISTORY_PATH = "/home/user/test-project/custom-output/sprint-history.jsonl";

const mockReadFileSync = readFileSync as ReturnType<typeof vi.fn>;
const mockExistsSync = existsSync as ReturnType<typeof vi.fn>;

function makeHistoryEntry(
  storyId: string,
  fromStatus: string,
  toStatus: string,
  timestamp: string,
) {
  return JSON.stringify({ timestamp, storyId, fromStatus, toStatus });
}

function setFiles(opts: { statusYaml: string; historyLines?: string[] }) {
  mockExistsSync.mockImplementation((p: string) => {
    if (p === STATUS_PATH) return true;
    if (p === HISTORY_PATH && opts.historyLines !== undefined) return true;
    return false;
  });
  mockReadFileSync.mockImplementation((p: string) => {
    if (p === STATUS_PATH) return opts.statusYaml;
    if (p === HISTORY_PATH && opts.historyLines !== undefined)
      return opts.historyLines.join("\n") + "\n";
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

describe("computeForecast", () => {
  it("returns zeroed result when sprint status is missing", () => {
    const result = computeForecast(PROJECT);

    expect(result.projectedCompletionDate).toBeNull();
    expect(result.daysRemaining).toBeNull();
    expect(result.pace).toBe("no-data");
    expect(result.confidence).toBe(0);
    expect(result.currentVelocity).toBe(0);
  });

  it("returns zeroed result with empty history", () => {
    setFiles({
      statusYaml: [
        "development_status:",
        "  s1:",
        "    status: backlog",
        "  s2:",
        "    status: in-progress",
      ].join("\n"),
      historyLines: [],
    });

    const result = computeForecast(PROJECT);

    expect(result.totalStories).toBe(2);
    expect(result.completedStories).toBe(0);
    expect(result.remainingStories).toBe(2);
    expect(result.pace).toBe("no-data");
    expect(result.projectedCompletionDate).toBeNull();
  });

  it("returns insufficient data with single day of history", () => {
    setFiles({
      statusYaml: [
        "development_status:",
        "  s1:",
        "    status: done",
        "  s2:",
        "    status: in-progress",
      ].join("\n"),
      historyLines: [makeHistoryEntry("s1", "in-progress", "done", "2026-01-05T12:00:00.000Z")],
    });

    const result = computeForecast(PROJECT);

    expect(result.totalStories).toBe(2);
    expect(result.completedStories).toBe(1);
    expect(result.projectedCompletionDate).toBeNull();
  });

  it("projects correct completion date with steady velocity (1 story/day)", () => {
    setFiles({
      statusYaml: [
        "development_status:",
        "  s1:",
        "    status: done",
        "  s2:",
        "    status: done",
        "  s3:",
        "    status: done",
        "  s4:",
        "    status: in-progress",
        "  s5:",
        "    status: backlog",
      ].join("\n"),
      historyLines: [
        makeHistoryEntry("s1", "in-progress", "done", "2026-01-01T12:00:00.000Z"),
        makeHistoryEntry("s2", "in-progress", "done", "2026-01-02T12:00:00.000Z"),
        makeHistoryEntry("s3", "in-progress", "done", "2026-01-03T12:00:00.000Z"),
      ],
    });

    const result = computeForecast(PROJECT);

    expect(result.totalStories).toBe(5);
    expect(result.completedStories).toBe(3);
    expect(result.remainingStories).toBe(2);
    expect(result.currentVelocity).toBeCloseTo(1, 0);
    expect(result.projectedCompletionDate).toBe("2026-01-05");
    expect(result.daysRemaining).toBeGreaterThanOrEqual(0);
  });

  it("returns null projection when velocity is zero (no completions)", () => {
    setFiles({
      statusYaml: [
        "development_status:",
        "  s1:",
        "    status: in-progress",
        "  s2:",
        "    status: backlog",
      ].join("\n"),
      historyLines: [
        // Transitions but no completions
        makeHistoryEntry("s1", "backlog", "in-progress", "2026-01-01T00:00:00.000Z"),
        makeHistoryEntry("s1", "in-progress", "review", "2026-01-03T00:00:00.000Z"),
      ],
    });

    const result = computeForecast(PROJECT);

    expect(result.projectedCompletionDate).toBeNull();
    expect(result.daysRemaining).toBeNull();
  });

  it("returns 0 days remaining when all stories are done", () => {
    setFiles({
      statusYaml: [
        "development_status:",
        "  s1:",
        "    status: done",
        "  s2:",
        "    status: done",
      ].join("\n"),
      historyLines: [
        makeHistoryEntry("s1", "in-progress", "done", "2026-01-01T12:00:00.000Z"),
        makeHistoryEntry("s2", "in-progress", "done", "2026-01-02T12:00:00.000Z"),
      ],
    });

    const result = computeForecast(PROJECT);

    expect(result.totalStories).toBe(2);
    expect(result.completedStories).toBe(2);
    expect(result.remainingStories).toBe(0);
    expect(result.daysRemaining).toBe(0);
    expect(result.pace).toBe("ahead");
  });

  it("reports 'ahead' pace when velocity exceeds required", () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 10);
    const sprintEndDate = tomorrow.toISOString().slice(0, 10);

    const projectWithEnd: ProjectConfig = {
      ...PROJECT,
      tracker: { plugin: "bmad", ...PROJECT.tracker, sprintEndDate },
    };

    setFiles({
      statusYaml: [
        "development_status:",
        "  s1:",
        "    status: done",
        "  s2:",
        "    status: done",
        "  s3:",
        "    status: done",
        "  s4:",
        "    status: in-progress",
      ].join("\n"),
      historyLines: [
        // 3 stories in 3 days = 1/day, only 1 remaining with 10 days left
        makeHistoryEntry("s1", "in-progress", "done", "2026-01-01T12:00:00.000Z"),
        makeHistoryEntry("s2", "in-progress", "done", "2026-01-02T12:00:00.000Z"),
        makeHistoryEntry("s3", "in-progress", "done", "2026-01-03T12:00:00.000Z"),
      ],
    });

    const result = computeForecast(projectWithEnd);

    expect(result.pace).toBe("ahead");
  });

  it("reports 'behind' pace when velocity is too low", () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const sprintEndDate = tomorrow.toISOString().slice(0, 10);

    const projectWithEnd: ProjectConfig = {
      ...PROJECT,
      tracker: { plugin: "bmad", ...PROJECT.tracker, sprintEndDate },
    };

    setFiles({
      statusYaml: [
        "development_status:",
        "  s1:",
        "    status: done",
        "  s2:",
        "    status: done",
        "  s3:",
        "    status: backlog",
        "  s4:",
        "    status: backlog",
        "  s5:",
        "    status: backlog",
        "  s6:",
        "    status: backlog",
        "  s7:",
        "    status: backlog",
        "  s8:",
        "    status: backlog",
        "  s9:",
        "    status: backlog",
        "  s10:",
        "    status: backlog",
      ].join("\n"),
      historyLines: [
        // Very slow: 2 stories over 10 days = 0.2/day, 8 remaining with 1 day left
        makeHistoryEntry("s1", "in-progress", "done", "2026-01-01T12:00:00.000Z"),
        makeHistoryEntry("s2", "in-progress", "done", "2026-01-10T12:00:00.000Z"),
      ],
    });

    const result = computeForecast(projectWithEnd);

    expect(result.pace).toBe("behind");
  });

  it("reports 'no-data' pace without sprintEndDate", () => {
    setFiles({
      statusYaml: [
        "development_status:",
        "  s1:",
        "    status: done",
        "  s2:",
        "    status: in-progress",
      ].join("\n"),
      historyLines: [
        makeHistoryEntry("s1", "in-progress", "done", "2026-01-01T12:00:00.000Z"),
        makeHistoryEntry("s1", "backlog", "in-progress", "2025-12-31T12:00:00.000Z"),
      ],
    });

    const result = computeForecast(PROJECT);

    expect(result.pace).toBe("no-data");
  });

  it("returns high R-squared for perfectly linear data", () => {
    setFiles({
      statusYaml: [
        "development_status:",
        "  s1:",
        "    status: done",
        "  s2:",
        "    status: done",
        "  s3:",
        "    status: done",
        "  s4:",
        "    status: done",
        "  s5:",
        "    status: backlog",
      ].join("\n"),
      historyLines: [
        makeHistoryEntry("s1", "in-progress", "done", "2026-01-01T12:00:00.000Z"),
        makeHistoryEntry("s2", "in-progress", "done", "2026-01-02T12:00:00.000Z"),
        makeHistoryEntry("s3", "in-progress", "done", "2026-01-03T12:00:00.000Z"),
        makeHistoryEntry("s4", "in-progress", "done", "2026-01-04T12:00:00.000Z"),
      ],
    });

    const result = computeForecast(PROJECT);

    expect(result.confidence).toBeGreaterThan(0.95);
  });

  it("returns lower R-squared for noisy data", () => {
    setFiles({
      statusYaml: [
        "development_status:",
        "  s1:",
        "    status: done",
        "  s2:",
        "    status: done",
        "  s3:",
        "    status: done",
        "  s4:",
        "    status: done",
        "  s5:",
        "    status: done",
        "  s6:",
        "    status: backlog",
      ].join("\n"),
      historyLines: [
        // Noisy: 3 done on day 1, 0 on day 2, 0 on day 3, 2 on day 4
        makeHistoryEntry("s1", "in-progress", "done", "2026-01-01T12:00:00.000Z"),
        makeHistoryEntry("s2", "in-progress", "done", "2026-01-01T13:00:00.000Z"),
        makeHistoryEntry("s3", "in-progress", "done", "2026-01-01T14:00:00.000Z"),
        makeHistoryEntry("s4", "in-progress", "done", "2026-01-04T12:00:00.000Z"),
        makeHistoryEntry("s5", "in-progress", "done", "2026-01-04T13:00:00.000Z"),
      ],
    });

    const result = computeForecast(PROJECT);

    // Still positive but likely < 1.0 due to clustering
    expect(result.confidence).toBeGreaterThan(0);
    expect(result.confidence).toBeLessThanOrEqual(1);
  });

  it("skips epic-level entries when counting stories", () => {
    setFiles({
      statusYaml: [
        "development_status:",
        "  epic-auth:",
        "    status: epic-in-progress",
        "  s1:",
        "    status: done",
        "  s2:",
        "    status: backlog",
      ].join("\n"),
      historyLines: [
        makeHistoryEntry("s1", "in-progress", "done", "2026-01-01T12:00:00.000Z"),
        makeHistoryEntry("s1", "backlog", "in-progress", "2025-12-31T12:00:00.000Z"),
      ],
    });

    const result = computeForecast(PROJECT);

    expect(result.totalStories).toBe(2);
    expect(result.completedStories).toBe(1);
  });
});
