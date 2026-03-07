import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ProjectConfig } from "@composio/ao-core";

vi.mock("node:fs", () => ({
  readFileSync: vi.fn(),
  existsSync: vi.fn(),
  appendFileSync: vi.fn(),
  mkdirSync: vi.fn(),
  writeFileSync: vi.fn(),
  renameSync: vi.fn(),
}));

import { readFileSync, existsSync } from "node:fs";
import {
  readSprintStatus,
  hasPointsData,
  getPoints,
  getEpicStoryIds,
} from "./sprint-status-reader.js";

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

const mockReadFileSync = readFileSync as ReturnType<typeof vi.fn>;
const mockExistsSync = existsSync as ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
  mockExistsSync.mockReturnValue(false);
});

describe("readSprintStatus", () => {
  it("throws when sprint-status.yaml is missing", () => {
    expect(() => readSprintStatus(PROJECT)).toThrow("sprint-status.yaml not found");
  });

  it("parses valid sprint-status.yaml", () => {
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue(
      ["development_status:", "  s1:", "    status: in-progress", "    epic: epic-auth"].join("\n"),
    );

    const result = readSprintStatus(PROJECT);
    expect(result.development_status["s1"]).toEqual({
      status: "in-progress",
      epic: "epic-auth",
    });
  });

  it("coerces numeric status to string", () => {
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue(
      ["development_status:", "  s1:", "    status: 123"].join("\n"),
    );

    const result = readSprintStatus(PROJECT);
    expect(result.development_status["s1"]!.status).toBe("123");
  });

  it("coerces points to number", () => {
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue(
      [
        "development_status:",
        "  s1:",
        "    status: backlog",
        "    points: 3",
        "  s2:",
        "    status: done",
        '    points: "5"',
      ].join("\n"),
    );

    const result = readSprintStatus(PROJECT);
    expect(result.development_status["s1"]!.points).toBe(3);
    expect(result.development_status["s2"]!.points).toBe(5);
  });

  it("sets invalid points to undefined", () => {
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue(
      ["development_status:", "  s1:", "    status: backlog", "    points: abc"].join("\n"),
    );

    const result = readSprintStatus(PROJECT);
    expect(result.development_status["s1"]!.points).toBeUndefined();
  });
});

describe("hasPointsData", () => {
  it("returns true when entries have points", () => {
    const sprint = {
      development_status: {
        s1: { status: "done", points: 3 },
        s2: { status: "backlog" },
      },
    };
    expect(hasPointsData(sprint)).toBe(true);
  });

  it("returns false when no entries have points", () => {
    const sprint = {
      development_status: {
        s1: { status: "done" },
        s2: { status: "backlog" },
      },
    };
    expect(hasPointsData(sprint)).toBe(false);
  });

  it("returns false when points are 0", () => {
    const sprint = {
      development_status: {
        s1: { status: "done", points: 0 },
      },
    };
    expect(hasPointsData(sprint)).toBe(false);
  });
});

describe("getPoints", () => {
  it("returns entry.points when defined", () => {
    expect(getPoints({ status: "done", points: 5 })).toBe(5);
  });

  it("returns 1 when points is undefined", () => {
    expect(getPoints({ status: "done" })).toBe(1);
  });

  it("returns 0 when points is 0", () => {
    expect(getPoints({ status: "done", points: 0 })).toBe(0);
  });
});

describe("getEpicStoryIds", () => {
  it("returns story IDs for a given epic", () => {
    const sprint = {
      development_status: {
        s1: { status: "done", epic: "epic-auth" },
        s2: { status: "backlog", epic: "epic-ui" },
        s3: { status: "in-progress", epic: "epic-auth" },
        s4: { status: "backlog" },
      },
    };
    const ids = getEpicStoryIds(sprint, "epic-auth");
    expect(ids).toEqual(new Set(["s1", "s3"]));
  });

  it("returns empty set for unknown epic", () => {
    const sprint = {
      development_status: {
        s1: { status: "done", epic: "epic-auth" },
      },
    };
    const ids = getEpicStoryIds(sprint, "epic-unknown");
    expect(ids.size).toBe(0);
  });
});
