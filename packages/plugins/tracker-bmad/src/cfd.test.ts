import { vi, describe, it, expect, beforeEach } from "vitest";

vi.mock("node:fs", () => ({
  readFileSync: vi.fn(),
  appendFileSync: vi.fn(),
  existsSync: vi.fn(),
  mkdirSync: vi.fn(),
  writeFileSync: vi.fn(),
  renameSync: vi.fn(),
}));

import { readFileSync, existsSync } from "node:fs";
import { computeCfd } from "./cfd.js";
import type { ProjectConfig } from "@composio/ao-core";

const PROJECT: ProjectConfig = {
  name: "Test",
  repo: "org/test",
  path: "/home/user/test",
  defaultBranch: "main",
  sessionPrefix: "test",
  tracker: { plugin: "bmad", outputDir: "_bmad-output" },
};

const STATUS_PATH = "/home/user/test/_bmad-output/sprint-status.yaml";
const HISTORY_PATH = "/home/user/test/_bmad-output/sprint-history.jsonl";

const mockReadFileSync = readFileSync as ReturnType<typeof vi.fn>;
const mockExistsSync = existsSync as ReturnType<typeof vi.fn>;

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

describe("computeCfd", () => {
  it("returns empty when no sprint status", () => {
    const result = computeCfd(PROJECT);
    expect(result.dataPoints).toEqual([]);
    expect(result.columns.length).toBe(5);
  });

  it("returns data points for current stories with no history", () => {
    setFiles({
      statusYaml: [
        "development_status:",
        "  s1:",
        "    status: backlog",
        "  s2:",
        "    status: in-progress",
        "  s3:",
        "    status: done",
      ].join("\n"),
      historyLines: [],
    });

    const result = computeCfd(PROJECT, { days: 3 });

    expect(result.dataPoints.length).toBe(3);
    // With no history, all stories stay at their initial "backlog" state
    // (since we don't know transitions)
    for (const dp of result.dataPoints) {
      expect(dp.columns).toBeDefined();
      // Total stories should equal 3
      const total = Object.values(dp.columns).reduce((s, v) => s + v, 0);
      expect(total).toBe(3);
    }
  });

  it("applies transitions from history", () => {
    const today = new Date().toISOString().slice(0, 10);

    setFiles({
      statusYaml: [
        "development_status:",
        "  s1:",
        "    status: in-progress",
        "  s2:",
        "    status: backlog",
      ].join("\n"),
      historyLines: [
        JSON.stringify({
          timestamp: `${today}T10:00:00.000Z`,
          storyId: "s1",
          fromStatus: "backlog",
          toStatus: "in-progress",
        }),
      ],
    });

    const result = computeCfd(PROJECT, { days: 1 });

    expect(result.dataPoints.length).toBe(1);
    const dp = result.dataPoints[0]!;
    // After transition: s1 in-progress, s2 backlog
    expect(dp.columns["in-progress"]).toBe(1);
    expect(dp.columns["backlog"]).toBe(1);
  });

  it("filters by epic", () => {
    setFiles({
      statusYaml: [
        "development_status:",
        "  s1:",
        "    status: backlog",
        "    epic: epic-auth",
        "  s2:",
        "    status: backlog",
        "    epic: epic-ui",
      ].join("\n"),
      historyLines: [],
    });

    const result = computeCfd(PROJECT, { epicFilter: "epic-auth", days: 1 });

    expect(result.dataPoints.length).toBe(1);
    const total = Object.values(result.dataPoints[0]!.columns).reduce((s, v) => s + v, 0);
    expect(total).toBe(1); // Only s1
  });

  it("respects days parameter", () => {
    setFiles({
      statusYaml: ["development_status:", "  s1:", "    status: backlog"].join("\n"),
      historyLines: [],
    });

    const result = computeCfd(PROJECT, { days: 7 });
    expect(result.dataPoints.length).toBe(7);
  });

  it("returns correct column ordering", () => {
    setFiles({
      statusYaml: ["development_status:", "  s1:", "    status: backlog"].join("\n"),
      historyLines: [],
    });

    const result = computeCfd(PROJECT, { days: 1 });

    expect(result.columns).toEqual(["backlog", "ready-for-dev", "in-progress", "review", "done"]);
  });

  it("handles pre-range history to set initial state", () => {
    const yesterday = new Date();
    yesterday.setUTCDate(yesterday.getUTCDate() - 1);
    const yesterdayStr = yesterday.toISOString().slice(0, 10);

    setFiles({
      statusYaml: ["development_status:", "  s1:", "    status: in-progress"].join("\n"),
      historyLines: [
        JSON.stringify({
          timestamp: `${yesterdayStr}T10:00:00.000Z`,
          storyId: "s1",
          fromStatus: "backlog",
          toStatus: "in-progress",
        }),
      ],
    });

    // Only request today
    const result = computeCfd(PROJECT, { days: 1 });

    expect(result.dataPoints.length).toBe(1);
    // s1 should be in-progress (set from pre-range history)
    expect(result.dataPoints[0]!.columns["in-progress"]).toBe(1);
    expect(result.dataPoints[0]!.columns["backlog"]).toBe(0);
  });

  it("skips epic-level entries", () => {
    setFiles({
      statusYaml: [
        "development_status:",
        "  epic-auth:",
        "    status: epic-in-progress",
        "  s1:",
        "    status: backlog",
      ].join("\n"),
      historyLines: [],
    });

    const result = computeCfd(PROJECT, { days: 1 });
    const total = Object.values(result.dataPoints[0]!.columns).reduce((s, v) => s + v, 0);
    expect(total).toBe(1); // Only s1, not epic-auth
  });
});
