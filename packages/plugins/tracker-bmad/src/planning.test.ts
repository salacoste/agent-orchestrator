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
import { computeSprintPlan } from "./planning.js";

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

describe("computeSprintPlan", () => {
  it("returns empty when no sprint status", () => {
    const result = computeSprintPlan(PROJECT);

    expect(result.backlogStories).toEqual([]);
    expect(result.recommended).toEqual([]);
    expect(result.loadStatus).toBe("no-data");
  });

  it("collects backlog stories", () => {
    setFiles({
      statusYaml: [
        "development_status:",
        "  s1:",
        "    status: backlog",
        "    epic: epic-auth",
        "  s2:",
        "    status: ready-for-dev",
        "  s3:",
        "    status: done",
      ].join("\n"),
      historyLines: [],
    });

    const result = computeSprintPlan(PROJECT);

    expect(result.backlogStories.length).toBe(2);
    expect(result.backlogStories.map((s) => s.id)).toContain("s1");
    expect(result.backlogStories.map((s) => s.id)).toContain("s2");
  });

  it("sorts unblocked stories before blocked ones", () => {
    setFiles({
      statusYaml: [
        "development_status:",
        "  s1:",
        "    status: backlog",
        "    dependsOn:",
        "      - s3",
        "  s2:",
        "    status: backlog",
        "  s3:",
        "    status: in-progress",
      ].join("\n"),
      historyLines: [],
    });

    const result = computeSprintPlan(PROJECT);

    // s2 is unblocked, s1 is blocked by s3
    const ids = result.backlogStories.map((s) => s.id);
    expect(ids.indexOf("s2")).toBeLessThan(ids.indexOf("s1"));
  });

  it("uses targetVelocity from config for recommended count", () => {
    const projectWithTarget: ProjectConfig = {
      ...PROJECT,
      tracker: {
        ...PROJECT.tracker,
        plugin: "bmad" as const,
        targetVelocity: 3,
      },
    };

    setFiles({
      statusYaml: [
        "development_status:",
        "  s1:",
        "    status: backlog",
        "  s2:",
        "    status: backlog",
        "  s3:",
        "    status: backlog",
        "  s4:",
        "    status: backlog",
        "  s5:",
        "    status: backlog",
      ].join("\n"),
      historyLines: [],
    });

    const result = computeSprintPlan(projectWithTarget);

    // Target 3, 0 in-progress → recommended = 3
    expect(result.recommended.length).toBe(3);
    expect(result.capacity.effectiveTarget).toBe(3);
  });

  it("reports loadStatus 'under' when capacity remains", () => {
    const projectWithTarget: ProjectConfig = {
      ...PROJECT,
      tracker: {
        ...PROJECT.tracker,
        plugin: "bmad" as const,
        targetVelocity: 5,
      },
    };

    setFiles({
      statusYaml: [
        "development_status:",
        "  s1:",
        "    status: in-progress",
        "  s2:",
        "    status: backlog",
      ].join("\n"),
      historyLines: [],
    });

    const result = computeSprintPlan(projectWithTarget);

    expect(result.loadStatus).toBe("under");
    expect(result.capacity.inProgressCount).toBe(1);
    expect(result.capacity.remainingCapacity).toBe(4);
  });

  it("reports loadStatus 'over' when in-progress exceeds target", () => {
    const projectWithTarget: ProjectConfig = {
      ...PROJECT,
      tracker: {
        ...PROJECT.tracker,
        plugin: "bmad" as const,
        targetVelocity: 2,
      },
    };

    setFiles({
      statusYaml: [
        "development_status:",
        "  s1:",
        "    status: in-progress",
        "  s2:",
        "    status: in-progress",
        "  s3:",
        "    status: in-progress",
      ].join("\n"),
      historyLines: [],
    });

    const result = computeSprintPlan(projectWithTarget);

    expect(result.loadStatus).toBe("over");
  });

  it("reports loadStatus 'no-data' when no velocity and no target", () => {
    setFiles({
      statusYaml: ["development_status:", "  s1:", "    status: backlog"].join("\n"),
      historyLines: [],
    });

    const result = computeSprintPlan(PROJECT);

    expect(result.loadStatus).toBe("no-data");
  });

  it("reads sprint config fields", () => {
    const projectWithConfig: ProjectConfig = {
      ...PROJECT,
      tracker: {
        ...PROJECT.tracker,
        plugin: "bmad" as const,
        sprintStartDate: "2026-03-01",
        sprintEndDate: "2026-03-14",
        sprintGoal: "Complete auth epic",
        targetVelocity: 8,
      },
    };

    setFiles({
      statusYaml: ["development_status:", "  s1:", "    status: backlog"].join("\n"),
      historyLines: [],
    });

    const result = computeSprintPlan(projectWithConfig);

    expect(result.sprintConfig.startDate).toBe("2026-03-01");
    expect(result.sprintConfig.endDate).toBe("2026-03-14");
    expect(result.sprintConfig.goal).toBe("Complete auth epic");
    expect(result.sprintConfig.targetVelocity).toBe(8);
  });

  it("hasPoints is false when no stories have points", () => {
    setFiles({
      statusYaml: ["development_status:", "  s1:", "    status: backlog"].join("\n"),
      historyLines: [],
    });

    const result = computeSprintPlan(PROJECT);
    expect(result.hasPoints).toBe(false);
  });

  it("includes points on stories when present", () => {
    setFiles({
      statusYaml: [
        "development_status:",
        "  s1:",
        "    status: backlog",
        "    points: 5",
        "  s2:",
        "    status: in-progress",
        "    points: 3",
      ].join("\n"),
      historyLines: [],
    });

    const result = computeSprintPlan(PROJECT);

    expect(result.hasPoints).toBe(true);
    expect(result.backlogStories[0]!.points).toBe(5);
    expect(result.capacity.inProgressPoints).toBe(3);
  });

  it("filters by epic when epicFilter is provided", () => {
    setFiles({
      statusYaml: [
        "development_status:",
        "  s1:",
        "    status: backlog",
        "    epic: epic-auth",
        "  s2:",
        "    status: backlog",
        "    epic: epic-ui",
        "  s3:",
        "    status: in-progress",
        "    epic: epic-auth",
      ].join("\n"),
      historyLines: [],
    });

    const result = computeSprintPlan(PROJECT, "epic-auth");

    expect(result.backlogStories).toHaveLength(1); // Only s1
    expect(result.backlogStories[0]!.id).toBe("s1");
    expect(result.capacity.inProgressCount).toBe(1); // Only s3
  });
});

describe("acceptPlan", () => {
  // eslint-disable-next-line @typescript-eslint/consistent-type-imports
  let acceptPlanFn: typeof import("./planning.js").acceptPlan;

  beforeEach(async () => {
    const mod = await import("./planning.js");
    acceptPlanFn = mod.acceptPlan;
  });

  it("moves recommended stories to ready-for-dev", () => {
    const projectWithTarget: ProjectConfig = {
      ...PROJECT,
      tracker: {
        ...PROJECT.tracker,
        plugin: "bmad" as const,
        targetVelocity: 5,
      },
    };

    setFiles({
      statusYaml: [
        "development_status:",
        "  s1:",
        "    status: backlog",
        "  s2:",
        "    status: backlog",
        "  s3:",
        "    status: in-progress",
      ].join("\n"),
      historyLines: [],
    });

    const result = acceptPlanFn(projectWithTarget);

    expect(result.count).toBe(2);
    expect(result.moved).toContain("s1");
    expect(result.moved).toContain("s2");
  });

  it("returns empty when no recommended stories", () => {
    setFiles({
      statusYaml: ["development_status:", "  s1:", "    status: done"].join("\n"),
      historyLines: [],
    });

    const result = acceptPlanFn(PROJECT);

    expect(result.count).toBe(0);
    expect(result.moved).toEqual([]);
  });

  it("returns empty when sprint status is missing", () => {
    // No files set — readSprintStatus will throw
    const result = acceptPlanFn(PROJECT);

    expect(result.count).toBe(0);
    expect(result.moved).toEqual([]);
  });
});
