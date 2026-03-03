import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ProjectConfig } from "@composio/ao-core";

// Mock node:fs before importing the module under test
vi.mock("node:fs", () => ({
  readFileSync: vi.fn(),
  appendFileSync: vi.fn(),
  existsSync: vi.fn(),
  mkdirSync: vi.fn(),
  writeFileSync: vi.fn(),
}));

import { readFileSync, appendFileSync, existsSync, mkdirSync } from "node:fs";
import { appendHistory, readHistory } from "./history.js";

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

const PROJECT_DEFAULTS: ProjectConfig = {
  name: "Test Project",
  repo: "org/test-project",
  path: "/home/user/test-project",
  defaultBranch: "main",
  sessionPrefix: "test",
  tracker: {
    plugin: "bmad",
  },
};

const HISTORY_PATH = "/home/user/test-project/custom-output/sprint-history.jsonl";
const HISTORY_PATH_DEFAULTS = "/home/user/test-project/_bmad-output/sprint-history.jsonl";

// ---------------------------------------------------------------------------
// Typed mock helpers
// ---------------------------------------------------------------------------

const mockReadFileSync = readFileSync as ReturnType<typeof vi.fn>;
const mockAppendFileSync = appendFileSync as ReturnType<typeof vi.fn>;
const mockExistsSync = existsSync as ReturnType<typeof vi.fn>;
const mockMkdirSync = mkdirSync as ReturnType<typeof vi.fn>;

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// appendHistory
// ---------------------------------------------------------------------------

describe("appendHistory", () => {
  it("writes a JSONL line with timestamp, storyId, fromStatus, toStatus", () => {
    const before = Date.now();
    appendHistory(PROJECT, "1-1-auth", "ready-for-dev", "in-progress");
    const after = Date.now();

    expect(mockAppendFileSync).toHaveBeenCalledOnce();
    const [calledPath, calledContent, calledEncoding] = mockAppendFileSync.mock.calls[0] as [
      string,
      string,
      string,
    ];

    expect(calledPath).toBe(HISTORY_PATH);
    expect(calledEncoding).toBe("utf-8");

    // Content must end with newline (JSONL format)
    expect(calledContent).toMatch(/\n$/);

    const parsed = JSON.parse(calledContent.trim()) as {
      timestamp: string;
      storyId: string;
      fromStatus: string;
      toStatus: string;
    };

    expect(parsed.storyId).toBe("1-1-auth");
    expect(parsed.fromStatus).toBe("ready-for-dev");
    expect(parsed.toStatus).toBe("in-progress");

    // Timestamp must be a valid ISO string within the test window
    const ts = new Date(parsed.timestamp).getTime();
    expect(ts).toBeGreaterThanOrEqual(before);
    expect(ts).toBeLessThanOrEqual(after);
  });

  it("writes to the correct path derived from project config", () => {
    appendHistory(PROJECT, "2-1-payment", "in-progress", "done");

    const [calledPath] = mockAppendFileSync.mock.calls[0] as [string, ...unknown[]];
    expect(calledPath).toBe(HISTORY_PATH);
  });

  it("uses default outputDir '_bmad-output' when outputDir not configured", () => {
    appendHistory(PROJECT_DEFAULTS, "1-1-auth", "ready-for-dev", "in-progress");

    const [calledPath] = mockAppendFileSync.mock.calls[0] as [string, ...unknown[]];
    expect(calledPath).toBe(HISTORY_PATH_DEFAULTS);
  });

  it("does not throw when appendFileSync fails (non-fatal best-effort)", () => {
    mockAppendFileSync.mockImplementation(() => {
      throw new Error("ENOENT: no such file or directory");
    });

    // Must not throw — history is best-effort
    expect(() => appendHistory(PROJECT, "1-1-auth", "ready-for-dev", "in-progress")).not.toThrow();
  });

  it("does not throw when directory does not exist (error is silenced)", () => {
    mockAppendFileSync.mockImplementation(() => {
      const err = Object.assign(new Error("ENOENT"), { code: "ENOENT" });
      throw err;
    });

    expect(() => appendHistory(PROJECT, "1-1-auth", "ready-for-dev", "in-progress")).not.toThrow();
  });

  it("records each field independently for different transitions", () => {
    appendHistory(PROJECT, "story-a", "backlog", "ready-for-dev");
    appendHistory(PROJECT, "story-b", "in-progress", "done");

    expect(mockAppendFileSync).toHaveBeenCalledTimes(2);

    const firstLine = (mockAppendFileSync.mock.calls[0] as [string, string, string])[1];
    const secondLine = (mockAppendFileSync.mock.calls[1] as [string, string, string])[1];

    const first = JSON.parse(firstLine.trim()) as {
      storyId: string;
      fromStatus: string;
      toStatus: string;
    };
    const second = JSON.parse(secondLine.trim()) as {
      storyId: string;
      fromStatus: string;
      toStatus: string;
    };

    expect(first.storyId).toBe("story-a");
    expect(first.fromStatus).toBe("backlog");
    expect(first.toStatus).toBe("ready-for-dev");

    expect(second.storyId).toBe("story-b");
    expect(second.fromStatus).toBe("in-progress");
    expect(second.toStatus).toBe("done");
  });
});

// ---------------------------------------------------------------------------
// readHistory
// ---------------------------------------------------------------------------

describe("readHistory", () => {
  it("returns empty array when file does not exist", () => {
    mockExistsSync.mockReturnValue(false);

    const result = readHistory(PROJECT);

    expect(result).toEqual([]);
    expect(mockReadFileSync).not.toHaveBeenCalled();
  });

  it("parses JSONL file into array of history entries", () => {
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue(
      [
        JSON.stringify({
          timestamp: "2024-01-01T00:00:00.000Z",
          storyId: "1-1-auth",
          fromStatus: "ready-for-dev",
          toStatus: "in-progress",
        }),
        JSON.stringify({
          timestamp: "2024-01-02T00:00:00.000Z",
          storyId: "1-2-profile",
          fromStatus: "in-progress",
          toStatus: "done",
        }),
        "",
      ].join("\n"),
    );

    const result = readHistory(PROJECT);

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      timestamp: "2024-01-01T00:00:00.000Z",
      storyId: "1-1-auth",
      fromStatus: "ready-for-dev",
      toStatus: "in-progress",
    });
    expect(result[1]).toEqual({
      timestamp: "2024-01-02T00:00:00.000Z",
      storyId: "1-2-profile",
      fromStatus: "in-progress",
      toStatus: "done",
    });
  });

  it("reads from the correct path derived from project config", () => {
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue("");

    readHistory(PROJECT);

    expect(mockExistsSync).toHaveBeenCalledWith(HISTORY_PATH);
    expect(mockReadFileSync).toHaveBeenCalledWith(HISTORY_PATH, "utf-8");
  });

  it("uses default outputDir '_bmad-output' when outputDir not configured", () => {
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue("");

    readHistory(PROJECT_DEFAULTS);

    expect(mockExistsSync).toHaveBeenCalledWith(HISTORY_PATH_DEFAULTS);
  });

  it("skips malformed lines gracefully and returns valid entries", () => {
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue(
      [
        "not valid json at all",
        JSON.stringify({
          timestamp: "2024-01-01T00:00:00.000Z",
          storyId: "1-1-auth",
          fromStatus: "ready-for-dev",
          toStatus: "in-progress",
        }),
        "{truncated-bad-json",
        JSON.stringify({
          timestamp: "2024-01-02T00:00:00.000Z",
          storyId: "2-1-payment",
          fromStatus: "in-progress",
          toStatus: "done",
        }),
        "",
      ].join("\n"),
    );

    const result = readHistory(PROJECT);

    expect(result).toHaveLength(2);
    expect(result[0]?.storyId).toBe("1-1-auth");
    expect(result[1]?.storyId).toBe("2-1-payment");
  });

  it("returns empty array when file is empty", () => {
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue("");

    const result = readHistory(PROJECT);

    expect(result).toEqual([]);
  });

  it("returns empty array when file contains only blank lines", () => {
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue("\n\n\n");

    const result = readHistory(PROJECT);

    expect(result).toEqual([]);
  });

  it("skips valid JSON with missing or wrong-type fields", () => {
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue(
      [
        // Missing timestamp
        JSON.stringify({ storyId: "x", fromStatus: "a", toStatus: "done" }),
        // timestamp is a number instead of string
        JSON.stringify({ timestamp: 12345, storyId: "y", fromStatus: "a", toStatus: "done" }),
        // Valid entry
        JSON.stringify({
          timestamp: "2024-01-01T00:00:00.000Z",
          storyId: "1-1-auth",
          fromStatus: "ready-for-dev",
          toStatus: "in-progress",
        }),
        // Bare string (valid JSON but not an object)
        '"hello"',
        // Bare number
        "42",
        "",
      ].join("\n"),
    );

    const result = readHistory(PROJECT);

    expect(result).toHaveLength(1);
    expect(result[0]?.storyId).toBe("1-1-auth");
  });

  it("returns empty array when file contains only malformed lines", () => {
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue("bad\nalso bad\n{broken\n");

    const result = readHistory(PROJECT);

    expect(result).toEqual([]);
  });

  it("returns empty array when readFileSync throws", () => {
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockImplementation(() => {
      throw new Error("EACCES: permission denied");
    });

    const result = readHistory(PROJECT);

    expect(result).toEqual([]);
  });

  it("trims whitespace around lines before parsing", () => {
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue(
      "  " +
        JSON.stringify({
          timestamp: "2024-01-01T00:00:00.000Z",
          storyId: "1-1-auth",
          fromStatus: "ready-for-dev",
          toStatus: "in-progress",
        }) +
        "  \n",
    );

    const result = readHistory(PROJECT);

    expect(result).toHaveLength(1);
    expect(result[0]?.storyId).toBe("1-1-auth");
  });

  it("handles single entry without trailing newline", () => {
    const entry = {
      timestamp: "2024-01-01T00:00:00.000Z",
      storyId: "3-1-dashboard",
      fromStatus: "backlog",
      toStatus: "ready-for-dev",
    };
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue(JSON.stringify(entry));

    const result = readHistory(PROJECT);

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual(entry);
  });
});

// ---------------------------------------------------------------------------
// mkdirSync — auto-create history directory
// ---------------------------------------------------------------------------

describe("appendHistory auto-creates directory", () => {
  it("calls mkdirSync with { recursive: true } before writing", () => {
    appendHistory(PROJECT, "1-1-auth", "ready-for-dev", "in-progress");

    expect(mockMkdirSync).toHaveBeenCalledOnce();
    expect(mockMkdirSync).toHaveBeenCalledWith("/home/user/test-project/custom-output", {
      recursive: true,
    });
  });

  it("still does not throw when mkdirSync fails", () => {
    mockMkdirSync.mockImplementation(() => {
      throw new Error("EACCES: permission denied");
    });

    expect(() => appendHistory(PROJECT, "1-1-auth", "ready-for-dev", "in-progress")).not.toThrow();
  });
});
