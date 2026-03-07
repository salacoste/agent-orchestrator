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
import { computeRework } from "./rework.js";
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

describe("computeRework", () => {
  it("returns empty result when no history exists", () => {
    const result = computeRework(PROJECT);
    expect(result.stories).toEqual([]);
    expect(result.reworkRate).toBe(0);
    expect(result.totalReworkEvents).toBe(0);
    expect(result.totalReworkTimeMs).toBe(0);
    expect(result.transitionStats).toEqual([]);
    expect(result.worstOffenders).toEqual([]);
  });

  it("returns zero rework when all transitions are forward", () => {
    setFiles({
      historyLines: [
        JSON.stringify({
          timestamp: "2026-01-10T10:00:00.000Z",
          storyId: "s1",
          fromStatus: "backlog",
          toStatus: "in-progress",
        }),
        JSON.stringify({
          timestamp: "2026-01-10T12:00:00.000Z",
          storyId: "s1",
          fromStatus: "in-progress",
          toStatus: "review",
        }),
        JSON.stringify({
          timestamp: "2026-01-10T14:00:00.000Z",
          storyId: "s1",
          fromStatus: "review",
          toStatus: "done",
        }),
      ],
    });

    const result = computeRework(PROJECT);
    expect(result.stories).toEqual([]);
    expect(result.reworkRate).toBe(0);
    expect(result.totalReworkEvents).toBe(0);
  });

  it("detects a single rework event", () => {
    setFiles({
      historyLines: [
        JSON.stringify({
          timestamp: "2026-01-10T10:00:00.000Z",
          storyId: "s1",
          fromStatus: "backlog",
          toStatus: "in-progress",
        }),
        JSON.stringify({
          timestamp: "2026-01-10T12:00:00.000Z",
          storyId: "s1",
          fromStatus: "in-progress",
          toStatus: "review",
        }),
        // Backward: review -> in-progress
        JSON.stringify({
          timestamp: "2026-01-10T14:00:00.000Z",
          storyId: "s1",
          fromStatus: "review",
          toStatus: "in-progress",
        }),
        // Forward again: in-progress -> review
        JSON.stringify({
          timestamp: "2026-01-10T16:00:00.000Z",
          storyId: "s1",
          fromStatus: "in-progress",
          toStatus: "review",
        }),
      ],
    });

    const result = computeRework(PROJECT);
    expect(result.stories).toHaveLength(1);
    expect(result.stories[0]!.storyId).toBe("s1");
    expect(result.stories[0]!.reworkCount).toBe(1);
    expect(result.reworkRate).toBe(100); // 1 out of 1 story
    expect(result.totalReworkEvents).toBe(1);
  });

  it("computes reworkCycleMs correctly", () => {
    const t1 = "2026-01-10T14:00:00.000Z"; // backward
    const t2 = "2026-01-10T16:00:00.000Z"; // forward recovery
    const expectedMs = new Date(t2).getTime() - new Date(t1).getTime();

    setFiles({
      historyLines: [
        JSON.stringify({
          timestamp: "2026-01-10T10:00:00.000Z",
          storyId: "s1",
          fromStatus: "backlog",
          toStatus: "in-progress",
        }),
        JSON.stringify({
          timestamp: "2026-01-10T12:00:00.000Z",
          storyId: "s1",
          fromStatus: "in-progress",
          toStatus: "review",
        }),
        JSON.stringify({
          timestamp: t1,
          storyId: "s1",
          fromStatus: "review",
          toStatus: "in-progress",
        }),
        JSON.stringify({
          timestamp: t2,
          storyId: "s1",
          fromStatus: "in-progress",
          toStatus: "review",
        }),
      ],
    });

    const result = computeRework(PROJECT);
    expect(result.stories[0]!.events[0]!.reworkCycleMs).toBe(expectedMs);
    expect(result.stories[0]!.totalReworkTimeMs).toBe(expectedMs);
  });

  it("sets reworkCycleMs to null when no forward transition follows", () => {
    setFiles({
      historyLines: [
        JSON.stringify({
          timestamp: "2026-01-10T10:00:00.000Z",
          storyId: "s1",
          fromStatus: "backlog",
          toStatus: "in-progress",
        }),
        JSON.stringify({
          timestamp: "2026-01-10T12:00:00.000Z",
          storyId: "s1",
          fromStatus: "in-progress",
          toStatus: "review",
        }),
        // Backward with no subsequent forward
        JSON.stringify({
          timestamp: "2026-01-10T14:00:00.000Z",
          storyId: "s1",
          fromStatus: "review",
          toStatus: "in-progress",
        }),
      ],
    });

    const result = computeRework(PROJECT);
    expect(result.stories[0]!.events[0]!.reworkCycleMs).toBeNull();
    expect(result.stories[0]!.totalReworkTimeMs).toBe(0);
  });

  it("handles multiple rework cycles on the same story", () => {
    setFiles({
      historyLines: [
        JSON.stringify({
          timestamp: "2026-01-10T08:00:00.000Z",
          storyId: "s1",
          fromStatus: "backlog",
          toStatus: "in-progress",
        }),
        JSON.stringify({
          timestamp: "2026-01-10T10:00:00.000Z",
          storyId: "s1",
          fromStatus: "in-progress",
          toStatus: "review",
        }),
        // First backward
        JSON.stringify({
          timestamp: "2026-01-10T12:00:00.000Z",
          storyId: "s1",
          fromStatus: "review",
          toStatus: "in-progress",
        }),
        JSON.stringify({
          timestamp: "2026-01-10T14:00:00.000Z",
          storyId: "s1",
          fromStatus: "in-progress",
          toStatus: "review",
        }),
        // Second backward
        JSON.stringify({
          timestamp: "2026-01-10T16:00:00.000Z",
          storyId: "s1",
          fromStatus: "review",
          toStatus: "in-progress",
        }),
        JSON.stringify({
          timestamp: "2026-01-10T18:00:00.000Z",
          storyId: "s1",
          fromStatus: "in-progress",
          toStatus: "review",
        }),
      ],
    });

    const result = computeRework(PROJECT);
    expect(result.stories).toHaveLength(1);
    expect(result.stories[0]!.reworkCount).toBe(2);
    expect(result.stories[0]!.events).toHaveLength(2);
  });

  it("caps worst offenders at 10", () => {
    // Create 12 stories each with 1 rework event
    const lines: string[] = [];
    for (let i = 1; i <= 12; i++) {
      lines.push(
        JSON.stringify({
          timestamp: "2026-01-10T10:00:00.000Z",
          storyId: `s${i}`,
          fromStatus: "backlog",
          toStatus: "in-progress",
        }),
        JSON.stringify({
          timestamp: "2026-01-10T12:00:00.000Z",
          storyId: `s${i}`,
          fromStatus: "in-progress",
          toStatus: "review",
        }),
        JSON.stringify({
          timestamp: "2026-01-10T14:00:00.000Z",
          storyId: `s${i}`,
          fromStatus: "review",
          toStatus: "in-progress",
        }),
        JSON.stringify({
          timestamp: "2026-01-10T16:00:00.000Z",
          storyId: `s${i}`,
          fromStatus: "in-progress",
          toStatus: "review",
        }),
      );
    }

    setFiles({ historyLines: lines });

    const result = computeRework(PROJECT);
    expect(result.stories).toHaveLength(12);
    expect(result.worstOffenders).toHaveLength(10);
  });

  it("filters by epic when epicFilter is provided", () => {
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
        // s1 rework (epic-auth)
        JSON.stringify({
          timestamp: "2026-01-10T10:00:00.000Z",
          storyId: "s1",
          fromStatus: "backlog",
          toStatus: "in-progress",
        }),
        JSON.stringify({
          timestamp: "2026-01-10T12:00:00.000Z",
          storyId: "s1",
          fromStatus: "in-progress",
          toStatus: "review",
        }),
        JSON.stringify({
          timestamp: "2026-01-10T14:00:00.000Z",
          storyId: "s1",
          fromStatus: "review",
          toStatus: "in-progress",
        }),
        // s2 rework (epic-ui)
        JSON.stringify({
          timestamp: "2026-01-10T10:00:00.000Z",
          storyId: "s2",
          fromStatus: "backlog",
          toStatus: "in-progress",
        }),
        JSON.stringify({
          timestamp: "2026-01-10T12:00:00.000Z",
          storyId: "s2",
          fromStatus: "in-progress",
          toStatus: "review",
        }),
        JSON.stringify({
          timestamp: "2026-01-10T14:00:00.000Z",
          storyId: "s2",
          fromStatus: "review",
          toStatus: "in-progress",
        }),
      ],
    });

    const result = computeRework(PROJECT, "epic-auth");
    expect(result.stories).toHaveLength(1);
    expect(result.stories[0]!.storyId).toBe("s1");
    // Only 1 story total in filtered set
    expect(result.reworkRate).toBe(100);
  });

  it("aggregates transition stats and sorts by count desc", () => {
    setFiles({
      historyLines: [
        // s1: review -> in-progress (2 times)
        JSON.stringify({
          timestamp: "2026-01-10T10:00:00.000Z",
          storyId: "s1",
          fromStatus: "backlog",
          toStatus: "review",
        }),
        JSON.stringify({
          timestamp: "2026-01-10T12:00:00.000Z",
          storyId: "s1",
          fromStatus: "review",
          toStatus: "in-progress",
        }),
        JSON.stringify({
          timestamp: "2026-01-10T14:00:00.000Z",
          storyId: "s1",
          fromStatus: "in-progress",
          toStatus: "review",
        }),
        JSON.stringify({
          timestamp: "2026-01-10T16:00:00.000Z",
          storyId: "s1",
          fromStatus: "review",
          toStatus: "in-progress",
        }),
        JSON.stringify({
          timestamp: "2026-01-10T18:00:00.000Z",
          storyId: "s1",
          fromStatus: "in-progress",
          toStatus: "review",
        }),
        // s2: in-progress -> backlog (1 time)
        JSON.stringify({
          timestamp: "2026-01-10T10:00:00.000Z",
          storyId: "s2",
          fromStatus: "backlog",
          toStatus: "in-progress",
        }),
        JSON.stringify({
          timestamp: "2026-01-10T12:00:00.000Z",
          storyId: "s2",
          fromStatus: "in-progress",
          toStatus: "backlog",
        }),
        JSON.stringify({
          timestamp: "2026-01-10T14:00:00.000Z",
          storyId: "s2",
          fromStatus: "backlog",
          toStatus: "in-progress",
        }),
      ],
    });

    const result = computeRework(PROJECT);
    expect(result.transitionStats.length).toBeGreaterThanOrEqual(2);
    // review -> in-progress should be first (count=2)
    expect(result.transitionStats[0]!.from).toBe("review");
    expect(result.transitionStats[0]!.to).toBe("in-progress");
    expect(result.transitionStats[0]!.count).toBe(2);
    // in-progress -> backlog should be second (count=1)
    expect(result.transitionStats[1]!.from).toBe("in-progress");
    expect(result.transitionStats[1]!.to).toBe("backlog");
    expect(result.transitionStats[1]!.count).toBe(1);
  });

  it("skips comment entries (fromStatus === toStatus)", () => {
    setFiles({
      historyLines: [
        JSON.stringify({
          timestamp: "2026-01-10T10:00:00.000Z",
          storyId: "s1",
          fromStatus: "backlog",
          toStatus: "in-progress",
        }),
        // Comment entry — should be skipped
        JSON.stringify({
          timestamp: "2026-01-10T11:00:00.000Z",
          storyId: "s1",
          fromStatus: "in-progress",
          toStatus: "in-progress",
          comment: "Updated description",
        }),
        JSON.stringify({
          timestamp: "2026-01-10T12:00:00.000Z",
          storyId: "s1",
          fromStatus: "in-progress",
          toStatus: "review",
        }),
      ],
    });

    const result = computeRework(PROJECT);
    expect(result.stories).toEqual([]);
    expect(result.totalReworkEvents).toBe(0);
  });
});
