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
import { queryHistory } from "./history-query.js";

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

beforeEach(() => {
  vi.clearAllMocks();
  mockExistsSync.mockReturnValue(false);
});

describe("queryHistory", () => {
  it("returns empty result when no history exists", () => {
    const result = queryHistory(PROJECT, {});
    expect(result.entries).toEqual([]);
    expect(result.total).toBe(0);
  });

  it("returns all entries without filters", () => {
    setHistory([
      makeEntry("s1", "backlog", "in-progress", "2026-01-01T00:00:00.000Z"),
      makeEntry("s1", "in-progress", "done", "2026-01-02T00:00:00.000Z"),
      makeEntry("s2", "backlog", "in-progress", "2026-01-03T00:00:00.000Z"),
    ]);

    const result = queryHistory(PROJECT, {});
    expect(result.entries).toHaveLength(3);
    expect(result.total).toBe(3);
  });

  it("filters by storyId", () => {
    setHistory([
      makeEntry("s1", "backlog", "in-progress", "2026-01-01T00:00:00.000Z"),
      makeEntry("s2", "backlog", "in-progress", "2026-01-02T00:00:00.000Z"),
      makeEntry("s1", "in-progress", "done", "2026-01-03T00:00:00.000Z"),
    ]);

    const result = queryHistory(PROJECT, { storyId: "s1" });
    expect(result.entries).toHaveLength(2);
    expect(result.entries.every((e) => e.storyId === "s1")).toBe(true);
  });

  it("filters by date range", () => {
    setHistory([
      makeEntry("s1", "backlog", "in-progress", "2026-01-01T00:00:00.000Z"),
      makeEntry("s1", "in-progress", "review", "2026-01-05T00:00:00.000Z"),
      makeEntry("s1", "review", "done", "2026-01-10T00:00:00.000Z"),
    ]);

    const result = queryHistory(PROJECT, { fromDate: "2026-01-03", toDate: "2026-01-07" });
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0]!.timestamp).toBe("2026-01-05T00:00:00.000Z");
  });

  it("filters by toStatus", () => {
    setHistory([
      makeEntry("s1", "backlog", "in-progress", "2026-01-01T00:00:00.000Z"),
      makeEntry("s1", "in-progress", "done", "2026-01-02T00:00:00.000Z"),
      makeEntry("s2", "backlog", "in-progress", "2026-01-03T00:00:00.000Z"),
    ]);

    const result = queryHistory(PROJECT, { toStatus: "done" });
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0]!.storyId).toBe("s1");
  });

  it("applies limit returning last N entries", () => {
    setHistory([
      makeEntry("s1", "backlog", "in-progress", "2026-01-01T00:00:00.000Z"),
      makeEntry("s2", "backlog", "in-progress", "2026-01-02T00:00:00.000Z"),
      makeEntry("s3", "backlog", "in-progress", "2026-01-03T00:00:00.000Z"),
    ]);

    const result = queryHistory(PROJECT, { limit: 2 });
    expect(result.entries).toHaveLength(2);
    expect(result.total).toBe(3);
    expect(result.entries[0]!.storyId).toBe("s2");
    expect(result.entries[1]!.storyId).toBe("s3");
  });

  it("filters by epic", () => {
    const historyLines = [
      makeEntry("s1", "backlog", "done", "2026-01-01T00:00:00.000Z"),
      makeEntry("s2", "backlog", "done", "2026-01-02T00:00:00.000Z"),
    ];
    mockExistsSync.mockImplementation((p: string) => {
      if (p === HISTORY_PATH) return true;
      if (p === STATUS_PATH) return true;
      return false;
    });
    mockReadFileSync.mockImplementation((p: string) => {
      if (p === HISTORY_PATH) return historyLines.join("\n") + "\n";
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

    const result = queryHistory(PROJECT, { epic: "epic-auth" });
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0]!.storyId).toBe("s1");
  });

  it("combines multiple filters", () => {
    setHistory([
      makeEntry("s1", "backlog", "in-progress", "2026-01-01T00:00:00.000Z"),
      makeEntry("s1", "in-progress", "done", "2026-01-05T00:00:00.000Z"),
      makeEntry("s2", "backlog", "done", "2026-01-03T00:00:00.000Z"),
    ]);

    const result = queryHistory(PROJECT, { storyId: "s1", toStatus: "done" });
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0]!.storyId).toBe("s1");
    expect(result.entries[0]!.toStatus).toBe("done");
  });
});
