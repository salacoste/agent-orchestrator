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
import { computeStoryAging } from "./story-aging.js";
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

describe("computeStoryAging", () => {
  it("returns empty when no sprint status", () => {
    const result = computeStoryAging(PROJECT);
    expect(result.columns).toEqual({});
    expect(result.agingStories).toEqual([]);
    expect(result.totalActive).toBe(0);
  });

  it("excludes done stories", () => {
    setFiles({
      statusYaml: [
        "development_status:",
        "  s1:",
        "    status: done",
        "  s2:",
        "    status: backlog",
      ].join("\n"),
      historyLines: [],
    });

    const result = computeStoryAging(PROJECT);
    expect(result.totalActive).toBe(1);
  });

  it("computes age from last transition in history", () => {
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();

    setFiles({
      statusYaml: ["development_status:", "  s1:", "    status: in-progress"].join("\n"),
      historyLines: [
        JSON.stringify({
          timestamp: twoHoursAgo,
          storyId: "s1",
          fromStatus: "backlog",
          toStatus: "in-progress",
        }),
      ],
    });

    const result = computeStoryAging(PROJECT);
    expect(result.totalActive).toBe(1);

    const s1 = result.columns["in-progress"]?.stories[0];
    expect(s1).toBeDefined();
    expect(s1!.storyId).toBe("s1");
    // Age should be approximately 2 hours
    expect(s1!.ageMs).toBeGreaterThan(1.9 * 60 * 60 * 1000);
    expect(s1!.ageMs).toBeLessThan(2.1 * 60 * 60 * 1000);
  });

  it("stories with no history get large age (30 days)", () => {
    setFiles({
      statusYaml: ["development_status:", "  s1:", "    status: backlog"].join("\n"),
      historyLines: [],
    });

    const result = computeStoryAging(PROJECT);
    const s1 = result.columns["backlog"]?.stories[0];
    expect(s1).toBeDefined();
    // Should be approximately 30 days
    expect(s1!.ageMs).toBeGreaterThan(29 * 24 * 60 * 60 * 1000);
  });

  it("flags stories above P90 as aging", () => {
    const now = Date.now();
    const ages = [1, 2, 3, 4, 5, 6, 7, 8, 9, 100]; // s10 is far above P90

    const statusLines = ages.map((_, i) => `  s${i + 1}:\n    status: in-progress`).join("\n");
    const historyLines = ages.map((hoursAgo, i) =>
      JSON.stringify({
        timestamp: new Date(now - hoursAgo * 60 * 60 * 1000).toISOString(),
        storyId: `s${i + 1}`,
        fromStatus: "backlog",
        toStatus: "in-progress",
      }),
    );

    setFiles({
      statusYaml: `development_status:\n${statusLines}`,
      historyLines,
    });

    const result = computeStoryAging(PROJECT);

    // s10 (100 hours old) should be flagged as aging
    expect(result.agingStories.length).toBeGreaterThanOrEqual(1);
    expect(result.agingStories.some((s) => s.storyId === "s10")).toBe(true);
  });

  it("groups stories by column with percentile stats", () => {
    const now = Date.now();

    setFiles({
      statusYaml: [
        "development_status:",
        "  s1:",
        "    status: backlog",
        "  s2:",
        "    status: in-progress",
        "  s3:",
        "    status: in-progress",
      ].join("\n"),
      historyLines: [
        JSON.stringify({
          timestamp: new Date(now - 1 * 60 * 60 * 1000).toISOString(),
          storyId: "s2",
          fromStatus: "backlog",
          toStatus: "in-progress",
        }),
        JSON.stringify({
          timestamp: new Date(now - 5 * 60 * 60 * 1000).toISOString(),
          storyId: "s3",
          fromStatus: "backlog",
          toStatus: "in-progress",
        }),
      ],
    });

    const result = computeStoryAging(PROJECT);

    expect(result.columns["in-progress"]).toBeDefined();
    expect(result.columns["in-progress"]!.stories.length).toBe(2);
    expect(result.columns["in-progress"]!.p50Ms).toBeGreaterThan(0);
    expect(result.columns["backlog"]).toBeDefined();
    expect(result.columns["backlog"]!.stories.length).toBe(1);
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

    const result = computeStoryAging(PROJECT, "epic-auth");
    expect(result.totalActive).toBe(1);
  });
});
