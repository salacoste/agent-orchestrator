import { vi, describe, it, expect, beforeEach } from "vitest";

vi.mock("node:fs", () => ({
  readFileSync: vi.fn(),
  appendFileSync: vi.fn(),
  writeFileSync: vi.fn(),
  existsSync: vi.fn(),
  mkdirSync: vi.fn(),
}));

import { readFileSync, appendFileSync, writeFileSync, existsSync } from "node:fs";
import { appendForecastLog, readForecastLog, markForecastActual } from "./forecast-log.js";
import type { ProjectConfig } from "@composio/ao-core";

const PROJECT: ProjectConfig = {
  name: "Test",
  repo: "org/test",
  path: "/home/user/test",
  defaultBranch: "main",
  sessionPrefix: "test",
  tracker: { plugin: "bmad", outputDir: "_bmad-output" },
};

const LOG_PATH = "/home/user/test/_bmad-output/forecast-log.jsonl";

const mockReadFileSync = readFileSync as ReturnType<typeof vi.fn>;
const mockAppendFileSync = appendFileSync as ReturnType<typeof vi.fn>;
const mockWriteFileSync = writeFileSync as ReturnType<typeof vi.fn>;
const mockExistsSync = existsSync as ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
  mockExistsSync.mockReturnValue(false);
});

describe("appendForecastLog", () => {
  it("appends a snapshot to the JSONL file", () => {
    mockAppendFileSync.mockImplementation(() => {});

    appendForecastLog(PROJECT, {
      timestamp: "2026-04-06T10:00:00.000Z",
      projectId: "Test",
      percentiles: { p50: "2026-04-10", p80: "2026-04-15", p95: "2026-04-20" },
      remainingStories: 5,
      simulationCount: 5000,
    });

    expect(mockAppendFileSync).toHaveBeenCalledWith(
      LOG_PATH,
      expect.stringContaining('"projectId":"Test"'),
      "utf-8",
    );
  });

  it("silently catches write errors", () => {
    mockAppendFileSync.mockImplementation(() => {
      throw new Error("disk full");
    });

    // Should not throw
    expect(() =>
      appendForecastLog(PROJECT, {
        timestamp: "2026-04-06T10:00:00.000Z",
        projectId: "Test",
        percentiles: { p50: "2026-04-10", p80: "2026-04-15", p95: "2026-04-20" },
        remainingStories: 5,
        simulationCount: 5000,
      }),
    ).not.toThrow();
  });
});

describe("readForecastLog", () => {
  it("returns empty array when file does not exist", () => {
    mockExistsSync.mockReturnValue(false);
    expect(readForecastLog(PROJECT)).toEqual([]);
  });

  it("parses valid JSONL entries", () => {
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue(
      [
        JSON.stringify({
          timestamp: "2026-04-06T10:00:00.000Z",
          projectId: "Test",
          percentiles: { p50: "2026-04-10", p80: "2026-04-15", p95: "2026-04-20" },
          remainingStories: 5,
          simulationCount: 5000,
        }),
        JSON.stringify({
          timestamp: "2026-04-07T10:00:00.000Z",
          projectId: "Test",
          percentiles: { p50: "2026-04-12", p80: "2026-04-17", p95: "2026-04-22" },
          remainingStories: 3,
          simulationCount: 5000,
          actualCompletionDate: "2026-04-11",
        }),
      ].join("\n") + "\n",
    );

    const entries = readForecastLog(PROJECT);
    expect(entries).toHaveLength(2);
    expect(entries[0]!.projectId).toBe("Test");
    expect(entries[1]!.actualCompletionDate).toBe("2026-04-11");
  });

  it("skips malformed lines", () => {
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue(
      [
        "not json at all",
        JSON.stringify({
          timestamp: "2026-04-06T10:00:00.000Z",
          projectId: "Test",
          percentiles: { p50: "2026-04-10", p80: "2026-04-15", p95: "2026-04-20" },
          remainingStories: 5,
          simulationCount: 5000,
        }),
        '{"timestamp":"bad","projectId":123}', // invalid percentiles
        "", // empty line
      ].join("\n") + "\n",
    );

    const entries = readForecastLog(PROJECT);
    expect(entries).toHaveLength(1);
  });
});

describe("markForecastActual", () => {
  it("marks entry with actual date and writes file", () => {
    const snapshot = {
      timestamp: "2026-04-06T10:00:00.000Z",
      projectId: "Test",
      percentiles: { p50: "2026-04-10", p80: "2026-04-15", p95: "2026-04-20" },
      remainingStories: 5,
      simulationCount: 5000,
    };

    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue(JSON.stringify(snapshot) + "\n");
    mockWriteFileSync.mockImplementation(() => {});

    const result = markForecastActual(PROJECT, "2026-04-06T10:00:00.000Z", "2026-04-11");

    expect(result).toBe(true);
    expect(mockWriteFileSync).toHaveBeenCalledWith(
      LOG_PATH,
      expect.stringContaining('"actualCompletionDate":"2026-04-11"'),
      "utf-8",
    );
  });

  it("returns false when timestamp not found", () => {
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue(
      JSON.stringify({
        timestamp: "2026-04-06T10:00:00.000Z",
        projectId: "Test",
        percentiles: { p50: "2026-04-10", p80: "2026-04-15", p95: "2026-04-20" },
        remainingStories: 5,
        simulationCount: 5000,
      }) + "\n",
    );

    const result = markForecastActual(PROJECT, "non-existent-timestamp", "2026-04-11");
    expect(result).toBe(false);
  });
});
