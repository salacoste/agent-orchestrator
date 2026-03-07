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
import { generateStandup } from "./standup.js";
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

function storyFilePath(id: string): string {
  return `/home/user/test/_bmad-output/implementation-artifacts/story-${id}.md`;
}

function setFiles(opts: {
  statusYaml?: string;
  historyLines?: string[];
  storyFiles?: Record<string, string>;
}) {
  mockExistsSync.mockImplementation((p: string) => {
    if (p === STATUS_PATH && opts.statusYaml !== undefined) return true;
    if (p === HISTORY_PATH && opts.historyLines !== undefined) return true;
    if (opts.storyFiles) {
      for (const filePath of Object.keys(opts.storyFiles)) {
        if (p === filePath) return true;
      }
    }
    return false;
  });
  mockReadFileSync.mockImplementation((p: string) => {
    if (p === STATUS_PATH && opts.statusYaml !== undefined) return opts.statusYaml;
    if (p === HISTORY_PATH && opts.historyLines !== undefined)
      return opts.historyLines.join("\n") + "\n";
    if (opts.storyFiles && p in opts.storyFiles) return opts.storyFiles[p];
    throw new Error(`Unexpected read: ${p}`);
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockExistsSync.mockReturnValue(false);
});

describe("generateStandup", () => {
  it("returns empty standup when no sprint status exists", () => {
    const result = generateStandup(PROJECT);
    expect(result.completedYesterday).toEqual([]);
    expect(result.inProgress).toEqual([]);
    expect(result.blocked).toEqual([]);
    expect(result.reworkAlerts).toEqual([]);
    expect(result.health.pace).toBe("no-data");
    expect(result.projectName).toBe("Test");
  });

  it("finds completedYesterday from done transitions in last 24h", () => {
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();

    setFiles({
      statusYaml: ["development_status:", "  s1:", "    status: done"].join("\n"),
      historyLines: [
        JSON.stringify({
          timestamp: twoHoursAgo,
          storyId: "s1",
          fromStatus: "in-progress",
          toStatus: "done",
        }),
      ],
      storyFiles: {
        [storyFilePath("s1")]: "# Implement login flow\n\nSome description.",
      },
    });

    const result = generateStandup(PROJECT);
    expect(result.completedYesterday.length).toBe(1);
    expect(result.completedYesterday[0]!.storyId).toBe("s1");
    expect(result.completedYesterday[0]!.title).toBe("Implement login flow");
    expect(result.completedYesterday[0]!.completedAt).toBe(twoHoursAgo);
  });

  it("lists inProgress stories in active columns with age", () => {
    const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString();

    setFiles({
      statusYaml: [
        "development_status:",
        "  s1:",
        "    status: in-progress",
        "    assignedSession: agent-1",
        "  s2:",
        "    status: review",
      ].join("\n"),
      historyLines: [
        JSON.stringify({
          timestamp: threeHoursAgo,
          storyId: "s1",
          fromStatus: "backlog",
          toStatus: "in-progress",
        }),
        JSON.stringify({
          timestamp: threeHoursAgo,
          storyId: "s2",
          fromStatus: "in-progress",
          toStatus: "review",
        }),
      ],
      storyFiles: {
        [storyFilePath("s1")]: "# Build API endpoint\n",
        [storyFilePath("s2")]: "# Design dashboard\n",
      },
    });

    const result = generateStandup(PROJECT);
    expect(result.inProgress.length).toBe(2);

    const s1 = result.inProgress.find((s) => s.storyId === "s1");
    expect(s1).toBeDefined();
    expect(s1!.title).toBe("Build API endpoint");
    expect(s1!.status).toBe("in-progress");
    expect(s1!.assignedSession).toBe("agent-1");
    expect(s1!.ageMs).toBeGreaterThan(2.9 * 60 * 60 * 1000);

    const s2 = result.inProgress.find((s) => s.storyId === "s2");
    expect(s2).toBeDefined();
    expect(s2!.title).toBe("Design dashboard");
    expect(s2!.status).toBe("review");
  });

  it("detects blocked stories via dependencies", () => {
    const oneHourAgo = new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString();

    setFiles({
      statusYaml: [
        "development_status:",
        "  s1:",
        "    status: in-progress",
        "    dependsOn:",
        "      - s2",
        "  s2:",
        "    status: backlog",
      ].join("\n"),
      historyLines: [
        JSON.stringify({
          timestamp: oneHourAgo,
          storyId: "s1",
          fromStatus: "backlog",
          toStatus: "in-progress",
        }),
      ],
    });

    const result = generateStandup(PROJECT);
    expect(result.blocked.length).toBe(1);
    expect(result.blocked[0]!.storyId).toBe("s1");
    expect(result.blocked[0]!.reason).toContain("s2");
  });

  it("detects stuck stories as blocked when age > 48h", () => {
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();

    setFiles({
      statusYaml: ["development_status:", "  s1:", "    status: in-progress"].join("\n"),
      historyLines: [
        JSON.stringify({
          timestamp: threeDaysAgo,
          storyId: "s1",
          fromStatus: "backlog",
          toStatus: "in-progress",
        }),
      ],
    });

    const result = generateStandup(PROJECT);
    expect(result.blocked.length).toBe(1);
    expect(result.blocked[0]!.storyId).toBe("s1");
    expect(result.blocked[0]!.reason).toContain("Stuck");
  });

  it("detects reworkAlerts from backward transitions in last 24h", () => {
    const oneHourAgo = new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString();

    setFiles({
      statusYaml: ["development_status:", "  s1:", "    status: in-progress"].join("\n"),
      historyLines: [
        JSON.stringify({
          timestamp: oneHourAgo,
          storyId: "s1",
          fromStatus: "review",
          toStatus: "in-progress",
        }),
      ],
    });

    const result = generateStandup(PROJECT);
    expect(result.reworkAlerts.length).toBe(1);
    expect(result.reworkAlerts[0]!.storyId).toBe("s1");
    expect(result.reworkAlerts[0]!.from).toBe("review");
    expect(result.reworkAlerts[0]!.to).toBe("in-progress");
  });

  it("markdown output contains expected sections", () => {
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();

    setFiles({
      statusYaml: [
        "development_status:",
        "  s1:",
        "    status: done",
        "  s2:",
        "    status: in-progress",
      ].join("\n"),
      historyLines: [
        JSON.stringify({
          timestamp: twoHoursAgo,
          storyId: "s1",
          fromStatus: "in-progress",
          toStatus: "done",
        }),
        JSON.stringify({
          timestamp: twoHoursAgo,
          storyId: "s2",
          fromStatus: "backlog",
          toStatus: "in-progress",
        }),
      ],
    });

    const result = generateStandup(PROJECT);
    expect(result.markdown).toContain("# Standup Report: Test");
    expect(result.markdown).toContain("## Completed Yesterday");
    expect(result.markdown).toContain("## In Progress");
    expect(result.markdown).toContain("## Blocked");
    expect(result.markdown).toContain("## Sprint Health");
  });

  it("filters by epic", () => {
    const oneHourAgo = new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString();

    setFiles({
      statusYaml: [
        "development_status:",
        "  s1:",
        "    status: in-progress",
        "    epic: epic-auth",
        "  s2:",
        "    status: in-progress",
        "    epic: epic-ui",
      ].join("\n"),
      historyLines: [
        JSON.stringify({
          timestamp: oneHourAgo,
          storyId: "s1",
          fromStatus: "backlog",
          toStatus: "in-progress",
        }),
        JSON.stringify({
          timestamp: oneHourAgo,
          storyId: "s2",
          fromStatus: "backlog",
          toStatus: "in-progress",
        }),
      ],
    });

    const result = generateStandup(PROJECT, "epic-auth");
    expect(result.inProgress.length).toBe(1);
    expect(result.inProgress[0]!.storyId).toBe("s1");
  });

  it("populates health section from forecast", () => {
    setFiles({
      statusYaml: [
        "development_status:",
        "  s1:",
        "    status: done",
        "  s2:",
        "    status: in-progress",
        "  s3:",
        "    status: backlog",
      ].join("\n"),
      historyLines: [],
    });

    const result = generateStandup(PROJECT);
    expect(result.health.totalStories).toBe(3);
    expect(result.health.completedStories).toBe(1);
    expect(result.health.remainingStories).toBe(2);
  });
});
