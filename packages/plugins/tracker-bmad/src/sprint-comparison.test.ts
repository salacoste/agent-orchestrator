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
import { computeSprintComparison } from "./sprint-comparison.js";
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

describe("computeSprintComparison", () => {
  it("returns empty when no history", () => {
    const result = computeSprintComparison(PROJECT);
    expect(result.periods).toEqual([]);
    expect(result.trends.velocity).toBe("stable");
  });

  it("returns correct number of weeks", () => {
    const now = Date.now();
    // Create completions spread across 4 weeks
    const historyLines: string[] = [];

    for (let w = 0; w < 4; w++) {
      const ts = new Date(now - w * 7 * 24 * 60 * 60 * 1000).toISOString();
      historyLines.push(
        JSON.stringify({
          timestamp: ts,
          storyId: `s${w + 1}`,
          fromStatus: "in-progress",
          toStatus: "done",
        }),
      );
    }

    setFiles({
      statusYaml: [
        "development_status:",
        "  s1:",
        "    status: done",
        "  s2:",
        "    status: done",
        "  s3:",
        "    status: done",
        "  s4:",
        "    status: done",
      ].join("\n"),
      historyLines,
    });

    const result = computeSprintComparison(PROJECT, { weeks: 4 });
    expect(result.periods.length).toBe(4);
  });

  it("counts completed stories per week", () => {
    const now = new Date();
    const thisWeekTs = now.toISOString();

    setFiles({
      statusYaml: [
        "development_status:",
        "  s1:",
        "    status: done",
        "  s2:",
        "    status: done",
      ].join("\n"),
      historyLines: [
        JSON.stringify({
          timestamp: thisWeekTs,
          storyId: "s1",
          fromStatus: "in-progress",
          toStatus: "done",
        }),
        JSON.stringify({
          timestamp: thisWeekTs,
          storyId: "s2",
          fromStatus: "review",
          toStatus: "done",
        }),
      ],
    });

    const result = computeSprintComparison(PROJECT, { weeks: 1 });

    // Current week should have 2 completed
    expect(result.periods.length).toBe(1);
    expect(result.periods[0]!.completedCount).toBe(2);
  });

  it("computes average cycle time", () => {
    const now = Date.now();
    const startTs = new Date(now - 48 * 60 * 60 * 1000).toISOString(); // 48h ago
    const endTs = new Date(now - 1 * 60 * 60 * 1000).toISOString(); // 1h ago

    setFiles({
      statusYaml: ["development_status:", "  s1:", "    status: done"].join("\n"),
      historyLines: [
        JSON.stringify({
          timestamp: startTs,
          storyId: "s1",
          fromStatus: "backlog",
          toStatus: "in-progress",
        }),
        JSON.stringify({
          timestamp: endTs,
          storyId: "s1",
          fromStatus: "in-progress",
          toStatus: "done",
        }),
      ],
    });

    const result = computeSprintComparison(PROJECT, { weeks: 1 });

    expect(result.periods[0]!.avgCycleTimeMs).toBeGreaterThan(0);
  });

  it("filters by epic", () => {
    const now = new Date().toISOString();

    setFiles({
      statusYaml: [
        "development_status:",
        "  s1:",
        "    status: done",
        "    epic: epic-auth",
        "  s2:",
        "    status: done",
        "    epic: epic-ui",
      ].join("\n"),
      historyLines: [
        JSON.stringify({
          timestamp: now,
          storyId: "s1",
          fromStatus: "review",
          toStatus: "done",
        }),
        JSON.stringify({
          timestamp: now,
          storyId: "s2",
          fromStatus: "review",
          toStatus: "done",
        }),
      ],
    });

    const result = computeSprintComparison(PROJECT, { epicFilter: "epic-auth", weeks: 1 });

    expect(result.periods[0]!.completedCount).toBe(1);
  });

  it("includes points when present", () => {
    const now = new Date().toISOString();

    setFiles({
      statusYaml: ["development_status:", "  s1:", "    status: done", "    points: 5"].join("\n"),
      historyLines: [
        JSON.stringify({
          timestamp: now,
          storyId: "s1",
          fromStatus: "review",
          toStatus: "done",
        }),
      ],
    });

    const result = computeSprintComparison(PROJECT, { weeks: 1 });

    expect(result.hasPoints).toBe(true);
    expect(result.periods[0]!.completedPoints).toBe(5);
  });

  it("returns stable trends when too few periods", () => {
    setFiles({
      statusYaml: ["development_status:", "  s1:", "    status: done"].join("\n"),
      historyLines: [
        JSON.stringify({
          timestamp: new Date().toISOString(),
          storyId: "s1",
          fromStatus: "review",
          toStatus: "done",
        }),
      ],
    });

    const result = computeSprintComparison(PROJECT, { weeks: 1 });

    expect(result.trends.velocity).toBe("stable");
    expect(result.trends.cycleTime).toBe("stable");
  });

  it("returns empty when no sprint status", () => {
    setFiles({
      historyLines: [
        JSON.stringify({
          timestamp: new Date().toISOString(),
          storyId: "s1",
          fromStatus: "review",
          toStatus: "done",
        }),
      ],
    });

    // No statusYaml — readSprintStatus will throw but history is still loaded
    const result = computeSprintComparison(PROJECT, { weeks: 1 });

    // Should still produce results from history alone
    expect(result.periods.length).toBe(1);
  });
});
