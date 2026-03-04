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
import { getStoryDetail } from "./story-detail.js";

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

const STATUS_PATH = "/tmp/test-project/_bmad-output/sprint-status.yaml";
const HISTORY_PATH = "/tmp/test-project/_bmad-output/sprint-history.jsonl";

// ---------------------------------------------------------------------------
// Typed mock helpers
// ---------------------------------------------------------------------------

const mockReadFileSync = readFileSync as ReturnType<typeof vi.fn>;
const mockExistsSync = existsSync as ReturnType<typeof vi.fn>;

// ---------------------------------------------------------------------------
// Setup helpers
// ---------------------------------------------------------------------------

function makeStatusYaml(entries: Record<string, { status: string; epic?: string }>): string {
  const lines = ["development_status:"];
  for (const [id, entry] of Object.entries(entries)) {
    lines.push(`  ${id}:`);
    lines.push(`    status: ${entry.status}`);
    if (entry.epic) {
      lines.push(`    epic: ${entry.epic}`);
    }
  }
  return lines.join("\n") + "\n";
}

function makeEntry(storyId: string, fromStatus: string, toStatus: string, timestamp: string) {
  return JSON.stringify({ timestamp, storyId, fromStatus, toStatus });
}

function setupMocks(statusYaml: string | null, historyLines: string[] | null) {
  mockExistsSync.mockImplementation((p: string) => {
    if (p === STATUS_PATH) return statusYaml !== null;
    if (p === HISTORY_PATH) return historyLines !== null;
    return false;
  });
  mockReadFileSync.mockImplementation((p: string) => {
    if (p === STATUS_PATH && statusYaml !== null) return statusYaml;
    if (p === HISTORY_PATH && historyLines !== null) return historyLines.join("\n") + "\n";
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

describe("getStoryDetail", () => {
  it("returns current status and empty transitions when story has no history", () => {
    const yaml = makeStatusYaml({ "1-1-auth": { status: "in-progress", epic: "epic-1" } });
    setupMocks(yaml, null);

    const result = getStoryDetail("1-1-auth", PROJECT);

    expect(result.storyId).toBe("1-1-auth");
    expect(result.currentStatus).toBe("in-progress");
    expect(result.epic).toBe("epic-1");
    expect(result.transitions).toEqual([]);
    expect(result.columnDwells).toEqual([]);
    expect(result.totalCycleTimeMs).toBeNull();
    expect(result.startedAt).toBeNull();
    expect(result.completedAt).toBeNull();
    expect(result.isCompleted).toBe(false);
  });

  it("returns single transition with null dwell", () => {
    const yaml = makeStatusYaml({ "1-1-auth": { status: "in-progress" } });
    const history = [makeEntry("1-1-auth", "backlog", "in-progress", "2026-01-02T00:00:00.000Z")];
    setupMocks(yaml, history);

    const result = getStoryDetail("1-1-auth", PROJECT);

    expect(result.transitions).toHaveLength(1);
    expect(result.transitions[0]!.fromStatus).toBe("backlog");
    expect(result.transitions[0]!.toStatus).toBe("in-progress");
    expect(result.transitions[0]!.dwellMs).toBeNull();
    expect(result.startedAt).toBe("2026-01-02T00:00:00.000Z");
  });

  it("computes correct dwell times between multiple transitions", () => {
    const yaml = makeStatusYaml({ s1: { status: "review" } });
    const DAY = 24 * 60 * 60 * 1000;
    const history = [
      makeEntry("s1", "backlog", "ready-for-dev", "2026-01-01T00:00:00.000Z"),
      makeEntry("s1", "ready-for-dev", "in-progress", "2026-01-02T00:00:00.000Z"),
      makeEntry("s1", "in-progress", "review", "2026-01-04T00:00:00.000Z"),
    ];
    setupMocks(yaml, history);

    const result = getStoryDetail("s1", PROJECT);

    expect(result.transitions).toHaveLength(3);
    expect(result.transitions[0]!.dwellMs).toBeNull(); // first transition
    expect(result.transitions[1]!.dwellMs).toBe(1 * DAY); // 1 day from Jan 1 to Jan 2
    expect(result.transitions[2]!.dwellMs).toBe(2 * DAY); // 2 days from Jan 2 to Jan 4
  });

  it("returns completed story with totalCycleTimeMs and completedAt", () => {
    const yaml = makeStatusYaml({ s1: { status: "done" } });
    const history = [
      makeEntry("s1", "backlog", "ready-for-dev", "2026-01-01T00:00:00.000Z"),
      makeEntry("s1", "ready-for-dev", "in-progress", "2026-01-02T00:00:00.000Z"),
      makeEntry("s1", "in-progress", "review", "2026-01-04T00:00:00.000Z"),
      makeEntry("s1", "review", "done", "2026-01-05T00:00:00.000Z"),
    ];
    setupMocks(yaml, history);

    const result = getStoryDetail("s1", PROJECT);

    expect(result.isCompleted).toBe(true);
    expect(result.completedAt).toBe("2026-01-05T00:00:00.000Z");
    expect(result.startedAt).toBe("2026-01-01T00:00:00.000Z");
    // 4 days = 345600000 ms
    expect(result.totalCycleTimeMs).toBe(4 * 24 * 60 * 60 * 1000);
  });

  it("returns in-progress story with null totalCycleTimeMs", () => {
    const yaml = makeStatusYaml({ s1: { status: "in-progress" } });
    const history = [
      makeEntry("s1", "backlog", "ready-for-dev", "2026-01-01T00:00:00.000Z"),
      makeEntry("s1", "ready-for-dev", "in-progress", "2026-01-02T00:00:00.000Z"),
    ];
    setupMocks(yaml, history);

    const result = getStoryDetail("s1", PROJECT);

    expect(result.isCompleted).toBe(false);
    expect(result.totalCycleTimeMs).toBeNull();
    expect(result.completedAt).toBeNull();
  });

  it("aggregates column dwells correctly when story revisits same column", () => {
    const yaml = makeStatusYaml({ s1: { status: "done" } });
    const DAY = 24 * 60 * 60 * 1000;
    const history = [
      makeEntry("s1", "backlog", "in-progress", "2026-01-01T00:00:00.000Z"),
      makeEntry("s1", "in-progress", "review", "2026-01-03T00:00:00.000Z"), // 2d in-progress
      makeEntry("s1", "review", "in-progress", "2026-01-04T00:00:00.000Z"), // 1d review
      makeEntry("s1", "in-progress", "review", "2026-01-06T00:00:00.000Z"), // 2d in-progress again
      makeEntry("s1", "review", "done", "2026-01-07T00:00:00.000Z"), // 1d review again
    ];
    setupMocks(yaml, history);

    const result = getStoryDetail("s1", PROJECT);

    // in-progress: 2d + 2d = 4d
    const inProgressDwell = result.columnDwells.find((d) => d.column === "in-progress");
    expect(inProgressDwell).toBeDefined();
    expect(inProgressDwell!.totalDwellMs).toBe(4 * DAY);

    // review: 1d + 1d = 2d
    const reviewDwell = result.columnDwells.find((d) => d.column === "review");
    expect(reviewDwell).toBeDefined();
    expect(reviewDwell!.totalDwellMs).toBe(2 * DAY);
  });

  it("returns unknown status and empty transitions when story not found", () => {
    const yaml = makeStatusYaml({ "other-story": { status: "in-progress" } });
    setupMocks(yaml, null);

    const result = getStoryDetail("nonexistent-story", PROJECT);

    expect(result.storyId).toBe("nonexistent-story");
    expect(result.currentStatus).toBe("unknown");
    expect(result.epic).toBeNull();
    expect(result.transitions).toEqual([]);
    expect(result.columnDwells).toEqual([]);
    expect(result.isCompleted).toBe(false);
  });

  it("populates epic field from sprint status", () => {
    const yaml = makeStatusYaml({
      s1: { status: "in-progress", epic: "epic-authentication" },
    });
    setupMocks(yaml, null);

    const result = getStoryDetail("s1", PROJECT);

    expect(result.epic).toBe("epic-authentication");
  });

  it("startedAt is first non-backlog transition timestamp", () => {
    const yaml = makeStatusYaml({ s1: { status: "review" } });
    const history = [
      // Some other story's entry to verify filtering
      makeEntry("other", "backlog", "in-progress", "2025-12-01T00:00:00.000Z"),
      // This story starts with a backlog transition
      makeEntry("s1", "backlog", "ready-for-dev", "2026-01-01T00:00:00.000Z"),
      makeEntry("s1", "ready-for-dev", "in-progress", "2026-01-03T00:00:00.000Z"),
      makeEntry("s1", "in-progress", "review", "2026-01-05T00:00:00.000Z"),
    ];
    setupMocks(yaml, history);

    const result = getStoryDetail("s1", PROJECT);

    // startedAt should be the first transition where fromStatus is backlog
    expect(result.startedAt).toBe("2026-01-01T00:00:00.000Z");
    // Only s1 transitions should be included
    expect(result.transitions).toHaveLength(3);
  });
});
