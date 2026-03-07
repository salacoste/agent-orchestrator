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
import { computeSprintGoals } from "./sprint-goals.js";

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

describe("computeSprintGoals", () => {
  it("returns empty goals when no sprintGoals config", () => {
    const result = computeSprintGoals(PROJECT);

    expect(result.goals).toEqual([]);
    expect(result.overallProgress).toBe(0);
    expect(result.onTrack).toBe(true);
    expect(result.sprintEndDate).toBeNull();
  });

  it("computes epic goal progress", () => {
    const project: ProjectConfig = {
      ...PROJECT,
      tracker: {
        ...PROJECT.tracker,
        plugin: "bmad",
        sprintGoals: [{ title: "Complete Auth Epic", type: "epic", target: "epic-auth" }],
      },
    };

    setFiles({
      statusYaml: [
        "development_status:",
        "  s1:",
        "    status: done",
        "    epic: epic-auth",
        "  s2:",
        "    status: in-progress",
        "    epic: epic-auth",
        "  s3:",
        "    status: done",
        "    epic: epic-ui",
      ].join("\n"),
      historyLines: [
        makeHistoryEntry("s1", "in-progress", "done", "2026-01-01T12:00:00.000Z"),
        makeHistoryEntry("s3", "in-progress", "done", "2026-01-02T12:00:00.000Z"),
      ],
    });

    const result = computeSprintGoals(project);

    expect(result.goals).toHaveLength(1);
    const goal = result.goals[0];
    expect(goal.type).toBe("epic");
    expect(goal.current).toBe(1); // s1 done, s2 not
    expect(goal.progress).toBe(50); // 1/2 = 50%
    expect(goal.details).toBe("1/2 stories done");
    expect(goal.status).toBe("in-progress");
  });

  it("computes points goal progress", () => {
    const project: ProjectConfig = {
      ...PROJECT,
      tracker: {
        ...PROJECT.tracker,
        plugin: "bmad",
        sprintGoals: [{ title: "Complete 10 Points", type: "points", target: 10 }],
      },
    };

    setFiles({
      statusYaml: [
        "development_status:",
        "  s1:",
        "    status: done",
        "    points: 3",
        "  s2:",
        "    status: done",
        "    points: 5",
        "  s3:",
        "    status: backlog",
        "    points: 8",
      ].join("\n"),
      historyLines: [
        makeHistoryEntry("s1", "in-progress", "done", "2026-01-01T12:00:00.000Z"),
        makeHistoryEntry("s2", "in-progress", "done", "2026-01-02T12:00:00.000Z"),
      ],
    });

    const result = computeSprintGoals(project);

    expect(result.goals).toHaveLength(1);
    const goal = result.goals[0];
    expect(goal.type).toBe("points");
    expect(goal.current).toBe(8); // 3 + 5
    expect(goal.progress).toBe(80); // 8/10 = 80%
    expect(goal.details).toBe("8/10 points");
    expect(goal.status).toBe("in-progress");
  });

  it("computes stories goal progress", () => {
    const project: ProjectConfig = {
      ...PROJECT,
      tracker: {
        ...PROJECT.tracker,
        plugin: "bmad",
        sprintGoals: [{ title: "Complete 3 Stories", type: "stories", target: 3 }],
      },
    };

    setFiles({
      statusYaml: [
        "development_status:",
        "  s1:",
        "    status: done",
        "  s2:",
        "    status: done",
        "  s3:",
        "    status: in-progress",
        "  s4:",
        "    status: backlog",
      ].join("\n"),
      historyLines: [
        makeHistoryEntry("s1", "in-progress", "done", "2026-01-01T12:00:00.000Z"),
        makeHistoryEntry("s2", "in-progress", "done", "2026-01-02T12:00:00.000Z"),
      ],
    });

    const result = computeSprintGoals(project);

    expect(result.goals).toHaveLength(1);
    const goal = result.goals[0];
    expect(goal.type).toBe("stories");
    expect(goal.current).toBe(2); // s1, s2
    expect(goal.progress).toBe(67); // 2/3 ~= 67%
    expect(goal.details).toBe("2/3 stories");
    expect(goal.status).toBe("in-progress");
  });

  it("handles custom goal with manual status", () => {
    const project: ProjectConfig = {
      ...PROJECT,
      tracker: {
        ...PROJECT.tracker,
        plugin: "bmad",
        sprintGoals: [
          { title: "Deploy to Staging", type: "custom", status: "done" },
          { title: "Code Freeze", type: "custom", status: "in-progress" },
          { title: "Release Notes", type: "custom", status: "pending" },
        ],
      },
    };

    setFiles({
      statusYaml: ["development_status:", "  s1:", "    status: done"].join("\n"),
      historyLines: [makeHistoryEntry("s1", "in-progress", "done", "2026-01-01T12:00:00.000Z")],
    });

    const result = computeSprintGoals(project);

    expect(result.goals).toHaveLength(3);

    expect(result.goals[0].status).toBe("done");
    expect(result.goals[0].progress).toBe(100);
    expect(result.goals[0].details).toBe("Manual: done");

    expect(result.goals[1].status).toBe("in-progress");
    expect(result.goals[1].progress).toBe(50);
    expect(result.goals[1].details).toBe("Manual: in-progress");

    expect(result.goals[2].status).toBe("pending");
    expect(result.goals[2].progress).toBe(0);
    expect(result.goals[2].details).toBe("Manual: pending");
  });

  it("marks goals at-risk when forecast is behind", () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const sprintEndDate = tomorrow.toISOString().slice(0, 10);

    const project: ProjectConfig = {
      ...PROJECT,
      tracker: {
        ...PROJECT.tracker,
        plugin: "bmad",
        sprintEndDate,
        sprintGoals: [{ title: "Complete 5 Stories", type: "stories", target: 5 }],
      },
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

    const result = computeSprintGoals(project);

    expect(result.goals).toHaveLength(1);
    expect(result.goals[0].status).toBe("at-risk");
    expect(result.onTrack).toBe(false);
  });

  it("computes overall progress as average of all goals", () => {
    const project: ProjectConfig = {
      ...PROJECT,
      tracker: {
        ...PROJECT.tracker,
        plugin: "bmad",
        sprintGoals: [
          { title: "Deploy to Staging", type: "custom", status: "done" },
          { title: "Code Freeze", type: "custom", status: "pending" },
        ],
      },
    };

    setFiles({
      statusYaml: ["development_status:", "  s1:", "    status: done"].join("\n"),
      historyLines: [makeHistoryEntry("s1", "in-progress", "done", "2026-01-01T12:00:00.000Z")],
    });

    const result = computeSprintGoals(project);

    // (100 + 0) / 2 = 50
    expect(result.overallProgress).toBe(50);
  });

  it("returns onTrack=true when all goals are healthy", () => {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 30);
    const sprintEndDate = futureDate.toISOString().slice(0, 10);

    const project: ProjectConfig = {
      ...PROJECT,
      tracker: {
        ...PROJECT.tracker,
        plugin: "bmad",
        sprintEndDate,
        sprintGoals: [
          { title: "Deploy to Staging", type: "custom", status: "done" },
          { title: "Complete Stories", type: "stories", target: 3 },
        ],
      },
    };

    setFiles({
      statusYaml: [
        "development_status:",
        "  s1:",
        "    status: done",
        "  s2:",
        "    status: done",
        "  s3:",
        "    status: in-progress",
      ].join("\n"),
      historyLines: [
        // Steady velocity: 2 stories in 2 days = 1/day, 1 remaining with 30 days left
        makeHistoryEntry("s1", "in-progress", "done", "2026-01-01T12:00:00.000Z"),
        makeHistoryEntry("s2", "in-progress", "done", "2026-01-02T12:00:00.000Z"),
      ],
    });

    const result = computeSprintGoals(project);

    expect(result.onTrack).toBe(true);
    // No goals should be at-risk
    for (const goal of result.goals) {
      expect(goal.status).not.toBe("at-risk");
    }
  });
});
