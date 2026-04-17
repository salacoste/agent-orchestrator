/**
 * Tests for unified-sprint-aggregation.ts (Story 53.1, Task 2.5).
 *
 * Covers: computeSprintHealth, computeSprintSummary, countStories,
 * aggregateUnifiedSprints.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  computeSprintHealth,
  computeSprintSummary,
  computeHealthReasons,
  countStories,
  aggregateUnifiedSprints,
} from "../unified-sprint-aggregation";
import type { UnifiedSprintEntry } from "../types";

// ---------------------------------------------------------------------------
// Mock the BMAD tracker plugin (dynamic import)
// ---------------------------------------------------------------------------

vi.mock("@composio/ao-plugin-tracker-bmad", () => ({
  readSprintStatus: vi.fn(),
}));

import { readSprintStatus } from "@composio/ao-plugin-tracker-bmad";

const mockReadSprintStatus = vi.mocked(readSprintStatus);

// =============================================================================
// computeSprintHealth
// =============================================================================

describe("computeSprintHealth", () => {
  it("returns 'blocked' when stories are blocked and none in progress", () => {
    const entry = {
      stories: { total: 5, done: 0, inProgress: 0, blocked: 3, backlog: 2 },
      progressPercent: 0,
    };
    expect(computeSprintHealth(entry)).toBe("blocked");
  });

  it("returns 'blocked' even when elapsed fraction is high", () => {
    const entry = {
      stories: { total: 10, done: 0, inProgress: 0, blocked: 5, backlog: 5 },
      progressPercent: 0,
    };
    expect(computeSprintHealth(entry, 0.9)).toBe("blocked");
  });

  it("returns 'at-risk' when blocked exceeds in-progress", () => {
    const entry = {
      stories: { total: 5, done: 1, inProgress: 1, blocked: 2, backlog: 1 },
      progressPercent: 20,
    };
    expect(computeSprintHealth(entry)).toBe("at-risk");
  });

  it("returns 'at-risk' when progress < 50% and elapsed > 75%", () => {
    const entry = {
      stories: { total: 10, done: 3, inProgress: 2, blocked: 0, backlog: 5 },
      progressPercent: 30,
    };
    expect(computeSprintHealth(entry, 0.8)).toBe("at-risk");
  });

  it("returns 'on-track' when not blocked and progress is reasonable", () => {
    const entry = {
      stories: { total: 10, done: 5, inProgress: 3, blocked: 0, backlog: 2 },
      progressPercent: 50,
    };
    expect(computeSprintHealth(entry)).toBe("on-track");
  });

  it("returns 'on-track' when progress is low but no elapsed info", () => {
    const entry = {
      stories: { total: 10, done: 2, inProgress: 3, blocked: 0, backlog: 5 },
      progressPercent: 20,
    };
    expect(computeSprintHealth(entry)).toBe("on-track");
  });

  it("returns 'on-track' when progress is low but elapsed fraction is low", () => {
    const entry = {
      stories: { total: 10, done: 2, inProgress: 3, blocked: 0, backlog: 5 },
      progressPercent: 20,
    };
    expect(computeSprintHealth(entry, 0.3)).toBe("on-track");
  });

  it("returns 'on-track' when elapsed fraction is exactly 0.75 threshold", () => {
    // progressPercent 49 is just under 50, elapsed exactly 0.75 is NOT > 0.75
    const entry = {
      stories: { total: 10, done: 4, inProgress: 3, blocked: 0, backlog: 3 },
      progressPercent: 49,
    };
    expect(computeSprintHealth(entry, 0.75)).toBe("on-track");
  });
});

// =============================================================================
// computeHealthReasons
// =============================================================================

describe("computeHealthReasons", () => {
  it("returns empty array for on-track sprint", () => {
    const entry = {
      stories: { total: 10, done: 5, inProgress: 3, blocked: 0, backlog: 2 },
      progressPercent: 50,
    };
    expect(computeHealthReasons(entry)).toEqual([]);
  });

  it("returns reason when all active work is blocked (not redundant Rule 2)", () => {
    const entry = {
      stories: { total: 5, done: 0, inProgress: 0, blocked: 3, backlog: 2 },
      progressPercent: 0,
    };
    const reasons = computeHealthReasons(entry);
    expect(reasons).toContain("All 3 active stories are blocked");
    // Rule 2 ("More blocked than in-progress") should NOT fire when inProgress === 0
    expect(reasons).not.toContain(expect.stringMatching(/More blocked stories/));
  });

  it("returns reason when more blocked than in-progress", () => {
    const entry = {
      stories: { total: 5, done: 1, inProgress: 1, blocked: 2, backlog: 1 },
      progressPercent: 20,
    };
    const reasons = computeHealthReasons(entry);
    expect(reasons).toContain("More blocked stories (2) than in-progress (1)");
  });

  it("returns reason for low progress with high elapsed time", () => {
    const entry = {
      stories: { total: 10, done: 3, inProgress: 2, blocked: 0, backlog: 5 },
      progressPercent: 30,
    };
    const reasons = computeHealthReasons(entry, 0.8);
    expect(reasons).toContain("Only 30% complete with 80% of sprint elapsed");
  });

  it("returns multiple reasons when multiple rules match", () => {
    const entry = {
      stories: { total: 5, done: 0, inProgress: 1, blocked: 3, backlog: 1 },
      progressPercent: 0,
    };
    const reasons = computeHealthReasons(entry, 0.9);
    // More blocked (3) than in-progress (1) + low progress with high elapsed
    expect(reasons.length).toBeGreaterThanOrEqual(2);
    expect(reasons).toContain("More blocked stories (3) than in-progress (1)");
    expect(reasons).toContain("Only 0% complete with 90% of sprint elapsed");
  });

  it("does not return elapsed reason when elapsedFraction is undefined", () => {
    const entry = {
      stories: { total: 10, done: 2, inProgress: 3, blocked: 0, backlog: 5 },
      progressPercent: 20,
    };
    expect(computeHealthReasons(entry)).toEqual([]);
  });

  it("does not return elapsed reason when progress >= 50", () => {
    const entry = {
      stories: { total: 10, done: 5, inProgress: 3, blocked: 0, backlog: 2 },
      progressPercent: 50,
    };
    expect(computeHealthReasons(entry, 0.9)).toEqual([]);
  });

  it("does not return elapsed reason when elapsed <= 0.75", () => {
    const entry = {
      stories: { total: 10, done: 2, inProgress: 3, blocked: 0, backlog: 5 },
      progressPercent: 20,
    };
    expect(computeHealthReasons(entry, 0.75)).toEqual([]);
  });

  it("returns both rule-1 and rule-3 reasons when fully blocked with high elapsed (but NOT rule 2)", () => {
    const entry = {
      stories: { total: 10, done: 2, inProgress: 0, blocked: 5, backlog: 3 },
      progressPercent: 20,
    };
    const reasons = computeHealthReasons(entry, 0.9);
    // Rule 1: all blocked (inProgress === 0)
    expect(reasons).toContain("All 5 active stories are blocked");
    // Rule 3: low progress with high elapsed
    expect(reasons).toContain("Only 20% complete with 90% of sprint elapsed");
    // Rule 2 should NOT fire (inProgress === 0, guarded)
    expect(reasons).not.toContain(expect.stringMatching(/More blocked stories/));
  });
});

// =============================================================================
// computeSprintSummary
// =============================================================================

describe("computeSprintSummary", () => {
  it("returns zeros for empty array", () => {
    expect(computeSprintSummary([])).toEqual({
      totalSprints: 0,
      activeSprints: 0,
      completedSprints: 0,
      planningSprints: 0,
      totalStories: 0,
      storiesDone: 0,
      avgProgress: 0,
      atRiskSprints: 0,
      avgVelocity: 0,
      maxVelocity: 0,
    });
  });

  it("computes correct totals for mixed sprints", () => {
    const sprints: UnifiedSprintEntry[] = [
      {
        projectId: "a",
        projectName: "A",
        sprintName: "S1",
        startDate: null,
        endDate: null,
        stories: { total: 10, done: 5, inProgress: 3, blocked: 0, backlog: 2 },
        progressPercent: 50,
        status: "active",
        health: "on-track",
        healthReasons: [],
        velocity: 0,
        velocityTrend: "unknown" as const,
      },
      {
        projectId: "b",
        projectName: "B",
        sprintName: "S1",
        startDate: null,
        endDate: null,
        stories: { total: 8, done: 8, inProgress: 0, blocked: 0, backlog: 0 },
        progressPercent: 100,
        status: "completed",
        health: "on-track",
        healthReasons: [],
        velocity: 0,
        velocityTrend: "unknown" as const,
      },
      {
        projectId: "c",
        projectName: "C",
        sprintName: "S1",
        startDate: null,
        endDate: null,
        stories: { total: 4, done: 0, inProgress: 0, blocked: 0, backlog: 4 },
        progressPercent: 0,
        status: "planning",
        health: "on-track",
        healthReasons: [],
        velocity: 0,
        velocityTrend: "unknown" as const,
      },
    ];

    const summary = computeSprintSummary(sprints);
    expect(summary.totalSprints).toBe(3);
    expect(summary.activeSprints).toBe(1);
    expect(summary.completedSprints).toBe(1);
    expect(summary.planningSprints).toBe(1);
    expect(summary.totalStories).toBe(22);
    expect(summary.storiesDone).toBe(13);
    expect(summary.avgProgress).toBe(50); // (50 + 100 + 0) / 3 = 50
    expect(summary.atRiskSprints).toBe(0);
  });

  it("rounds avgProgress to nearest integer", () => {
    const sprints: UnifiedSprintEntry[] = [
      {
        projectId: "a",
        projectName: "A",
        sprintName: "S1",
        startDate: null,
        endDate: null,
        stories: { total: 10, done: 3, inProgress: 2, blocked: 0, backlog: 5 },
        progressPercent: 33,
        status: "active",
        health: "on-track",
        healthReasons: [],
        velocity: 0,
        velocityTrend: "unknown" as const,
      },
      {
        projectId: "b",
        projectName: "B",
        sprintName: "S1",
        startDate: null,
        endDate: null,
        stories: { total: 10, done: 6, inProgress: 2, blocked: 0, backlog: 2 },
        progressPercent: 60,
        status: "active",
        health: "on-track",
        healthReasons: [],
        velocity: 0,
        velocityTrend: "unknown" as const,
      },
    ];

    // (33 + 60) / 2 = 46.5 → rounds to 47
    expect(computeSprintSummary(sprints).avgProgress).toBe(47);
  });

  it("handles single sprint", () => {
    const sprints: UnifiedSprintEntry[] = [
      {
        projectId: "a",
        projectName: "A",
        sprintName: "S1",
        startDate: null,
        endDate: null,
        stories: { total: 10, done: 7, inProgress: 2, blocked: 1, backlog: 0 },
        progressPercent: 70,
        status: "active",
        health: "on-track",
        healthReasons: [],
        velocity: 0,
        velocityTrend: "unknown" as const,
      },
    ];

    const summary = computeSprintSummary(sprints);
    expect(summary.totalSprints).toBe(1);
    expect(summary.activeSprints).toBe(1);
    expect(summary.completedSprints).toBe(0);
    expect(summary.totalStories).toBe(10);
    expect(summary.storiesDone).toBe(7);
    expect(summary.avgProgress).toBe(70);
    expect(summary.atRiskSprints).toBe(0);
  });

  it("counts at-risk and blocked sprints", () => {
    const sprints: UnifiedSprintEntry[] = [
      {
        projectId: "a",
        projectName: "A",
        sprintName: "S1",
        startDate: null,
        endDate: null,
        stories: { total: 10, done: 5, inProgress: 3, blocked: 0, backlog: 2 },
        progressPercent: 50,
        status: "active",
        health: "on-track",
        healthReasons: [],
        velocity: 0,
        velocityTrend: "unknown" as const,
      },
      {
        projectId: "b",
        projectName: "B",
        sprintName: "S1",
        startDate: null,
        endDate: null,
        stories: { total: 5, done: 1, inProgress: 1, blocked: 3, backlog: 0 },
        progressPercent: 20,
        status: "active",
        health: "at-risk",
        healthReasons: ["More blocked stories (3) than in-progress (1)"],
        velocity: 0,
        velocityTrend: "unknown" as const,
      },
      {
        projectId: "c",
        projectName: "C",
        sprintName: "S1",
        startDate: null,
        endDate: null,
        stories: { total: 4, done: 0, inProgress: 0, blocked: 4, backlog: 0 },
        progressPercent: 0,
        status: "active",
        health: "blocked",
        healthReasons: ["All 4 active stories are blocked"],
        velocity: 0,
        velocityTrend: "unknown" as const,
      },
    ];

    const summary = computeSprintSummary(sprints);
    expect(summary.atRiskSprints).toBe(2); // at-risk + blocked
  });
});

// =============================================================================
// countStories
// =============================================================================

describe("countStories", () => {
  it("counts stories by status correctly", () => {
    const devStatus = {
      "1-1-done-story": "done",
      "1-2-in-progress-story": "in-progress",
      "1-3-review-story": "review",
      "1-4-blocked-story": "blocked",
      "1-5-backlog-story": "backlog",
    };

    expect(countStories(devStatus)).toEqual({
      total: 5,
      done: 1,
      inProgress: 2, // "in-progress" + "review"
      blocked: 1,
      backlog: 1,
    });
  });

  it("ignores epic keys", () => {
    const devStatus = {
      "epic-1": "done",
      "epic-49": "in-progress",
      "1-1-some-story": "done",
    };

    const counts = countStories(devStatus);
    expect(counts.total).toBe(1);
    expect(counts.done).toBe(1);
  });

  it("ignores retrospective keys", () => {
    const devStatus = {
      "epic-1-retrospective": "done",
      "epic-49-retrospective": "optional",
      "1-1-some-story": "done",
    };

    expect(countStories(devStatus).total).toBe(1);
  });

  it("handles object status values with .status field", () => {
    const devStatus = {
      "1-1-story": { status: "in-progress" },
      "1-2-story": { status: "done" },
    };

    expect(countStories(devStatus)).toEqual({
      total: 2,
      done: 1,
      inProgress: 1,
      blocked: 0,
      backlog: 0,
    });
  });

  it("treats unknown string status as backlog", () => {
    const devStatus = {
      "1-1-story": "unknown-status",
    };

    const counts = countStories(devStatus);
    expect(counts.backlog).toBe(1);
    expect(counts.done).toBe(0);
    expect(counts.inProgress).toBe(0);
    expect(counts.blocked).toBe(0);
  });

  it("treats object without .status as backlog", () => {
    const devStatus = {
      "1-1-story": { epic: "epic-1", points: 3 },
    };

    const counts = countStories(devStatus);
    expect(counts.backlog).toBe(1);
    expect(counts.total).toBe(1);
  });

  it("returns zeros for empty devStatus", () => {
    expect(countStories({})).toEqual({
      total: 0,
      done: 0,
      inProgress: 0,
      blocked: 0,
      backlog: 0,
    });
  });

  it("handles multi-digit story numbers", () => {
    const devStatus = {
      "49-1-portfolio-dashboard": "done",
      "49-2-aggregated-metrics": "in-progress",
      "51-3-story-unblocking": "blocked",
    };

    const counts = countStories(devStatus);
    expect(counts.total).toBe(3);
    expect(counts.done).toBe(1);
    expect(counts.inProgress).toBe(1);
    expect(counts.blocked).toBe(1);
  });

  it("counts letter-suffix epic stories (25a, 25b, 46a, 46b)", () => {
    const devStatus = {
      "25a-1-agent-recovery-api": "done",
      "25b-2-cost-sprint-clock": "in-progress",
      "46a-1-immutable-audit-log": "done",
      "46b-3-resource-pool": "review",
    };

    const counts = countStories(devStatus);
    expect(counts.total).toBe(4);
    expect(counts.done).toBe(2);
    expect(counts.inProgress).toBe(2); // in-progress + review
    expect(counts.backlog).toBe(0);
  });

  it("counts 'ready-for-dev' as backlog", () => {
    const devStatus = {
      "53-2-sprint-progress-visualization": "ready-for-dev",
      "53-3-at-risk-sprint-id": "backlog",
      "53-1-unified-sprint-dashboard": "done",
    };

    const counts = countStories(devStatus);
    expect(counts.total).toBe(3);
    expect(counts.done).toBe(1);
    expect(counts.backlog).toBe(2); // ready-for-dev + backlog both counted as backlog
  });
});

// =============================================================================
// aggregateUnifiedSprints
// =============================================================================

describe("aggregateUnifiedSprints", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns empty array when config has no projects", async () => {
    const result = await aggregateUnifiedSprints({ projects: {} });
    expect(result).toEqual([]);
  });

  it("aggregates sprint data from a single project", async () => {
    mockReadSprintStatus.mockReturnValue({
      development_status: {
        "1-1-story-a": "done",
        "1-2-story-b": "in-progress",
        "1-3-story-c": "backlog",
      },
    });

    const result = await aggregateUnifiedSprints({
      projects: { "proj-a": { name: "Project A" } },
    });

    expect(result).toHaveLength(1);
    expect(result[0].projectId).toBe("proj-a");
    expect(result[0].projectName).toBe("Project A");
    expect(result[0].stories.total).toBe(3);
    expect(result[0].stories.done).toBe(1);
    expect(result[0].stories.inProgress).toBe(1);
    expect(result[0].stories.backlog).toBe(1);
    expect(result[0].progressPercent).toBe(33); // Math.round(1/3 * 100)
    expect(result[0].status).toBe("active");
    expect(result[0].health).toBe("on-track");
  });

  it("skips projects with no development_status", async () => {
    mockReadSprintStatus.mockReturnValue({});

    const result = await aggregateUnifiedSprints({
      projects: { "proj-a": { name: "Project A" } },
    });

    expect(result).toHaveLength(0);
  });

  it("skips projects where readSprintStatus returns null", async () => {
    mockReadSprintStatus.mockReturnValue(null);

    const result = await aggregateUnifiedSprints({
      projects: { "proj-a": { name: "Project A" } },
    });

    expect(result).toHaveLength(0);
  });

  it("skips projects with no stories (only epics)", async () => {
    mockReadSprintStatus.mockReturnValue({
      development_status: {
        "epic-1": "done",
        "epic-1-retrospective": "done",
      },
    });

    const result = await aggregateUnifiedSprints({
      projects: { "proj-a": { name: "Project A" } },
    });

    expect(result).toHaveLength(0);
  });

  it("handles readSprintStatus errors gracefully", async () => {
    mockReadSprintStatus.mockImplementation(() => {
      throw new Error("read failed");
    });

    const result = await aggregateUnifiedSprints({
      projects: { "proj-a": { name: "Project A" } },
    });

    expect(result).toHaveLength(0);
  });

  it("computes completed sprint status when all stories are done", async () => {
    mockReadSprintStatus.mockReturnValue({
      development_status: {
        "1-1-story-a": "done",
        "1-2-story-b": "done",
      },
    });

    const result = await aggregateUnifiedSprints({
      projects: { "proj-a": { name: "Project A" } },
    });

    expect(result[0].status).toBe("completed");
    expect(result[0].progressPercent).toBe(100);
    expect(result[0].health).toBe("on-track");
  });

  it("computes planning status when all stories are in backlog", async () => {
    mockReadSprintStatus.mockReturnValue({
      development_status: {
        "1-1-story-a": "backlog",
        "1-2-story-b": "backlog",
      },
    });

    const result = await aggregateUnifiedSprints({
      projects: { "proj-a": { name: "Project A" } },
    });

    expect(result[0].status).toBe("planning");
    expect(result[0].progressPercent).toBe(0);
  });

  it("uses projectId as projectName when name is not set", async () => {
    mockReadSprintStatus.mockReturnValue({
      development_status: { "1-1-story": "done" },
    });

    const result = await aggregateUnifiedSprints({
      projects: { "my-proj": {} },
    });

    expect(result[0].projectName).toBe("my-proj");
  });

  it("handles multiple projects", async () => {
    mockReadSprintStatus
      .mockReturnValueOnce({
        development_status: { "1-1-story-a": "done" },
      })
      .mockReturnValueOnce({
        development_status: { "2-1-story-b": "in-progress" },
      });

    const result = await aggregateUnifiedSprints({
      projects: {
        "proj-a": { name: "Project A" },
        "proj-b": { name: "Project B" },
      },
    });

    expect(result).toHaveLength(2);
    expect(result[0].projectId).toBe("proj-a");
    expect(result[0].stories.done).toBe(1);
    expect(result[1].projectId).toBe("proj-b");
    expect(result[1].stories.inProgress).toBe(1);
  });

  it("computes blocked health when all active work is blocked", async () => {
    mockReadSprintStatus.mockReturnValue({
      development_status: {
        "1-1-story": "blocked",
        "1-2-story": "blocked",
        "1-3-story": "backlog",
      },
    });

    const result = await aggregateUnifiedSprints({
      projects: { "proj-a": { name: "Project A" } },
    });

    // 2 blocked, 0 in-progress → "blocked"
    expect(result[0].health).toBe("blocked");
  });

  it("continues processing after a failing project", async () => {
    mockReadSprintStatus
      .mockImplementationOnce(() => {
        throw new Error("fail");
      })
      .mockReturnValueOnce({
        development_status: { "2-1-story": "done" },
      });

    const result = await aggregateUnifiedSprints({
      projects: {
        "bad-proj": { name: "Bad" },
        "good-proj": { name: "Good" },
      },
    });

    expect(result).toHaveLength(1);
    expect(result[0].projectId).toBe("good-proj");
  });
});
