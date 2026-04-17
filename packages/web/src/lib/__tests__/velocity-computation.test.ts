/**
 * Tests for velocity computation functions (Story 53.4, Task 4).
 *
 * Covers: computeVelocity, computeVelocityTrend, computeSprintSummary velocity fields.
 */

import { describe, it, expect } from "vitest";
import {
  computeVelocity,
  computeVelocityTrend,
  computeSprintSummary,
} from "../unified-sprint-aggregation";
import type { UnifiedSprintEntry } from "../types";

// =============================================================================
// computeVelocity
// =============================================================================

describe("computeVelocity", () => {
  it("returns correct stories/day with valid dates for active sprint", () => {
    const start = new Date("2026-01-01");
    const now = Date.now();
    const elapsedDays = (now - start.getTime()) / (1000 * 60 * 60 * 24);
    const entry = {
      stories: { total: 10, done: 5, inProgress: 2, blocked: 0, backlog: 3 },
      status: "active" as const,
      startDate: "2026-01-01",
      endDate: null as string | null,
    };
    const velocity = computeVelocity(entry);
    // velocity = 5 / elapsedDays, clamped to min 1 day
    const expected = 5 / Math.max(1, elapsedDays);
    expect(velocity).toBeCloseTo(expected, 2);
  });

  it("returns correct stories/day for completed sprint using endDate", () => {
    const entry = {
      stories: { total: 10, done: 10, inProgress: 0, blocked: 0, backlog: 0 },
      status: "completed" as const,
      startDate: "2026-01-01",
      endDate: "2026-01-11",
    };
    // 10 stories / 10 days = 1.0 stories/day
    expect(computeVelocity(entry)).toBeCloseTo(1.0, 2);
  });

  it("returns 0 when no dates available", () => {
    const entry = {
      stories: { total: 10, done: 5, inProgress: 2, blocked: 0, backlog: 3 },
      status: "active" as const,
      startDate: null as string | null,
      endDate: null as string | null,
    };
    expect(computeVelocity(entry)).toBe(0);
  });

  it("returns 0 for planning sprints", () => {
    const entry = {
      stories: { total: 10, done: 0, inProgress: 0, blocked: 0, backlog: 10 },
      status: "planning" as const,
      startDate: "2026-01-01",
      endDate: null as string | null,
    };
    expect(computeVelocity(entry)).toBe(0);
  });

  it("clamps sprint days to minimum 1 (division by zero prevention)", () => {
    // Same start and end date = 0 days → clamped to 1
    const entry = {
      stories: { total: 10, done: 5, inProgress: 2, blocked: 0, backlog: 3 },
      status: "completed" as const,
      startDate: "2026-01-01",
      endDate: "2026-01-01",
    };
    // 5 / max(1, 0) = 5 / 1 = 5
    expect(computeVelocity(entry)).toBe(5);
  });

  it("returns 0 for invalid startDate", () => {
    const entry = {
      stories: { total: 10, done: 5, inProgress: 2, blocked: 0, backlog: 3 },
      status: "active" as const,
      startDate: "not-a-date",
      endDate: null as string | null,
    };
    expect(computeVelocity(entry)).toBe(0);
  });

  it("returns 0 for invalid endDate on completed sprint", () => {
    const entry = {
      stories: { total: 10, done: 10, inProgress: 0, blocked: 0, backlog: 0 },
      status: "completed" as const,
      startDate: "2026-01-01",
      endDate: "not-a-date",
    };
    expect(computeVelocity(entry)).toBe(0);
  });

  it("handles fractional day correctly", () => {
    // 2-day sprint, 4 stories done = 2.0 stories/day
    const entry = {
      stories: { total: 10, done: 4, inProgress: 2, blocked: 0, backlog: 4 },
      status: "completed" as const,
      startDate: "2026-01-01",
      endDate: "2026-01-03",
    };
    expect(computeVelocity(entry)).toBeCloseTo(2.0, 2);
  });

  it("uses endDate for completed vs elapsed time for active", () => {
    // Completed: uses startDate→endDate span
    const completed = {
      stories: { total: 10, done: 8, inProgress: 0, blocked: 0, backlog: 2 },
      status: "completed" as const,
      startDate: "2026-01-01",
      endDate: "2026-01-11",
    };
    // 8 stories / 10 days = 0.8
    expect(computeVelocity(completed)).toBeCloseTo(0.8, 2);

    // Active: would use startDate→now, which varies; just verify it's > 0 with a past start
    const active = {
      stories: { total: 10, done: 8, inProgress: 2, blocked: 0, backlog: 0 },
      status: "active" as const,
      startDate: "2026-01-01",
      endDate: null as string | null,
    };
    // Active sprint velocity depends on current date, just ensure non-zero
    expect(computeVelocity(active)).toBeGreaterThan(0);
  });
});

// =============================================================================
// computeVelocityTrend
// =============================================================================

describe("computeVelocityTrend", () => {
  it("returns 'unknown' when no startDate", () => {
    const entry = {
      health: "on-track" as const,
      progressPercent: 60,
      status: "active" as const,
      startDate: null as string | null,
    };
    expect(computeVelocityTrend(entry)).toBe("unknown");
  });

  it("returns 'unknown' for planning status", () => {
    const entry = {
      health: "on-track" as const,
      progressPercent: 0,
      status: "planning" as const,
      startDate: "2026-01-01",
    };
    expect(computeVelocityTrend(entry)).toBe("unknown");
  });

  it("returns 'stable' when progressPercent >= 70", () => {
    const entry = {
      health: "on-track" as const,
      progressPercent: 70,
      status: "active" as const,
      startDate: "2026-01-01",
    };
    expect(computeVelocityTrend(entry)).toBe("stable");
  });

  it("returns 'stable' when progressPercent >= 70 even with at-risk health", () => {
    const entry = {
      health: "at-risk" as const,
      progressPercent: 80,
      status: "active" as const,
      startDate: "2026-01-01",
    };
    expect(computeVelocityTrend(entry)).toBe("stable");
  });

  it("returns 'improving' for on-track with >= 50% progress", () => {
    const entry = {
      health: "on-track" as const,
      progressPercent: 50,
      status: "active" as const,
      startDate: "2026-01-01",
    };
    expect(computeVelocityTrend(entry)).toBe("improving");
  });

  it("returns 'improving' for on-track with 65% progress", () => {
    const entry = {
      health: "on-track" as const,
      progressPercent: 65,
      status: "active" as const,
      startDate: "2026-01-01",
    };
    expect(computeVelocityTrend(entry)).toBe("improving");
  });

  it("returns 'declining' for at-risk with < 50% progress", () => {
    const entry = {
      health: "at-risk" as const,
      progressPercent: 40,
      status: "active" as const,
      startDate: "2026-01-01",
    };
    expect(computeVelocityTrend(entry)).toBe("declining");
  });

  it("returns 'declining' for blocked with < 50% progress", () => {
    const entry = {
      health: "blocked" as const,
      progressPercent: 10,
      status: "active" as const,
      startDate: "2026-01-01",
    };
    expect(computeVelocityTrend(entry)).toBe("declining");
  });

  it("returns 'stable' for on-track with < 50% progress (default case)", () => {
    const entry = {
      health: "on-track" as const,
      progressPercent: 40,
      status: "active" as const,
      startDate: "2026-01-01",
    };
    expect(computeVelocityTrend(entry)).toBe("stable");
  });

  it("returns 'stable' for at-risk with >= 50% progress", () => {
    const entry = {
      health: "at-risk" as const,
      progressPercent: 55,
      status: "active" as const,
      startDate: "2026-01-01",
    };
    expect(computeVelocityTrend(entry)).toBe("stable");
  });
});

// =============================================================================
// computeSprintSummary velocity fields
// =============================================================================

describe("computeSprintSummary velocity aggregation", () => {
  it("computes avgVelocity and maxVelocity from sprints with velocity > 0", () => {
    const sprints: UnifiedSprintEntry[] = [
      {
        projectId: "a",
        projectName: "A",
        sprintName: "S1",
        startDate: "2026-01-01",
        endDate: "2026-01-11",
        stories: { total: 10, done: 10, inProgress: 0, blocked: 0, backlog: 0 },
        progressPercent: 100,
        status: "completed",
        health: "on-track",
        healthReasons: [],
        velocity: 1.0,
        velocityTrend: "stable" as const,
      },
      {
        projectId: "b",
        projectName: "B",
        sprintName: "S2",
        startDate: "2026-01-01",
        endDate: "2026-01-08",
        stories: { total: 6, done: 3, inProgress: 1, blocked: 0, backlog: 2 },
        progressPercent: 50,
        status: "active",
        health: "on-track",
        healthReasons: [],
        velocity: 0.5,
        velocityTrend: "improving" as const,
      },
      {
        projectId: "c",
        projectName: "C",
        sprintName: "S3",
        startDate: null,
        endDate: null,
        stories: { total: 5, done: 0, inProgress: 0, blocked: 0, backlog: 5 },
        progressPercent: 0,
        status: "planning",
        health: "on-track",
        healthReasons: [],
        velocity: 0,
        velocityTrend: "unknown" as const,
      },
    ];

    const summary = computeSprintSummary(sprints);
    // Only 2 sprints have velocity > 0: (1.0 + 0.5) / 2 = 0.75
    expect(summary.avgVelocity).toBeCloseTo(0.75, 2);
    expect(summary.maxVelocity).toBeCloseTo(1.0, 2);
  });

  it("returns 0 avgVelocity and maxVelocity when no sprints have velocity", () => {
    const sprints: UnifiedSprintEntry[] = [
      {
        projectId: "a",
        projectName: "A",
        sprintName: "S1",
        startDate: null,
        endDate: null,
        stories: { total: 5, done: 0, inProgress: 0, blocked: 0, backlog: 5 },
        progressPercent: 0,
        status: "planning",
        health: "on-track",
        healthReasons: [],
        velocity: 0,
        velocityTrend: "unknown" as const,
      },
    ];

    const summary = computeSprintSummary(sprints);
    expect(summary.avgVelocity).toBe(0);
    expect(summary.maxVelocity).toBe(0);
  });
});
