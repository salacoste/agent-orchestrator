/**
 * Tests for sprint filtering utilities (Story 53.5, Task 2).
 *
 * Covers: filterSprints, hasActiveSprintFilters, extractAvailableProjects.
 */

import { describe, it, expect } from "vitest";
import { filterSprints, hasActiveSprintFilters, extractAvailableProjects } from "../sprint-filter";
import { type UnifiedSprintEntry, EMPTY_SPRINT_FILTERS } from "../types";

function createMockSprint(overrides: Partial<UnifiedSprintEntry> = {}): UnifiedSprintEntry {
  return {
    projectId: "proj-a",
    projectName: "Project A",
    sprintName: "Sprint 1",
    startDate: "2026-01-01",
    endDate: "2026-01-14",
    stories: { total: 10, done: 5, inProgress: 3, blocked: 0, backlog: 2 },
    progressPercent: 50,
    status: "active",
    health: "on-track",
    healthReasons: [],
    velocity: 0.5,
    velocityTrend: "improving",
    ...overrides,
  };
}

const sprints: UnifiedSprintEntry[] = [
  createMockSprint({
    projectId: "alpha",
    projectName: "Alpha",
    startDate: "2026-01-01",
    endDate: "2026-01-14",
    status: "active",
    health: "on-track",
  }),
  createMockSprint({
    projectId: "beta",
    projectName: "Beta",
    startDate: "2026-02-01",
    endDate: "2026-02-14",
    status: "completed",
    health: "on-track",
  }),
  createMockSprint({
    projectId: "gamma",
    projectName: "Gamma",
    startDate: "2026-03-01",
    endDate: "2026-03-14",
    status: "active",
    health: "at-risk",
  }),
  createMockSprint({
    projectId: "delta",
    projectName: "Delta",
    startDate: null,
    endDate: null,
    status: "planning",
    health: "on-track",
  }),
];

// =============================================================================
// hasActiveSprintFilters
// =============================================================================

describe("hasActiveSprintFilters", () => {
  it("returns false for empty filters", () => {
    expect(hasActiveSprintFilters(EMPTY_SPRINT_FILTERS)).toBe(false);
  });

  it("returns false for all-null filters", () => {
    expect(
      hasActiveSprintFilters({ status: null, health: null, projectId: null, dateRange: null }),
    ).toBe(false);
  });

  it("returns true when status is set", () => {
    expect(hasActiveSprintFilters({ ...EMPTY_SPRINT_FILTERS, status: "active" })).toBe(true);
  });

  it("returns true when health is set", () => {
    expect(hasActiveSprintFilters({ ...EMPTY_SPRINT_FILTERS, health: "at-risk" })).toBe(true);
  });

  it("returns true when projectId is set", () => {
    expect(hasActiveSprintFilters({ ...EMPTY_SPRINT_FILTERS, projectId: "alpha" })).toBe(true);
  });

  it("returns true when dateRange is set", () => {
    expect(
      hasActiveSprintFilters({
        ...EMPTY_SPRINT_FILTERS,
        dateRange: { start: "2026-01-01", end: "2026-01-31" },
      }),
    ).toBe(true);
  });

  it("returns false for phantom dateRange with both empty strings", () => {
    expect(
      hasActiveSprintFilters({
        ...EMPTY_SPRINT_FILTERS,
        dateRange: { start: "", end: "" },
      }),
    ).toBe(false);
  });
});

// =============================================================================
// filterSprints
// =============================================================================

describe("filterSprints", () => {
  it("returns all sprints when no filters active", () => {
    const result = filterSprints(sprints, EMPTY_SPRINT_FILTERS);
    expect(result).toHaveLength(4);
  });

  it("filters by status — active", () => {
    const result = filterSprints(sprints, { ...EMPTY_SPRINT_FILTERS, status: "active" });
    expect(result).toHaveLength(2); // Alpha, Gamma
    expect(result.every((s) => s.status === "active")).toBe(true);
  });

  it("filters by status — completed", () => {
    const result = filterSprints(sprints, { ...EMPTY_SPRINT_FILTERS, status: "completed" });
    expect(result).toHaveLength(1);
    expect(result[0].projectId).toBe("beta");
  });

  it("filters by status — planning", () => {
    const result = filterSprints(sprints, { ...EMPTY_SPRINT_FILTERS, status: "planning" });
    expect(result).toHaveLength(1);
    expect(result[0].projectId).toBe("delta");
  });

  it("filters by health — on-track", () => {
    const result = filterSprints(sprints, { ...EMPTY_SPRINT_FILTERS, health: "on-track" });
    expect(result).toHaveLength(3); // Alpha, Beta, Delta
  });

  it("filters by health — at-risk", () => {
    const result = filterSprints(sprints, { ...EMPTY_SPRINT_FILTERS, health: "at-risk" });
    expect(result).toHaveLength(1);
    expect(result[0].projectId).toBe("gamma");
  });

  it("filters by projectId", () => {
    const result = filterSprints(sprints, { ...EMPTY_SPRINT_FILTERS, projectId: "alpha" });
    expect(result).toHaveLength(1);
    expect(result[0].projectId).toBe("alpha");
  });

  it("filters by dateRange — overlapping range", () => {
    const result = filterSprints(sprints, {
      ...EMPTY_SPRINT_FILTERS,
      dateRange: { start: "2026-01-10", end: "2026-01-20" },
    });
    // Only Alpha (Jan 1-14) overlaps with Jan 10-20
    expect(result).toHaveLength(1);
    expect(result[0].projectId).toBe("alpha");
  });

  it("filters by dateRange — wide range matches multiple", () => {
    const result = filterSprints(sprints, {
      ...EMPTY_SPRINT_FILTERS,
      dateRange: { start: "2026-01-01", end: "2026-03-31" },
    });
    // Alpha, Beta, Gamma all overlap with Q1 2026. Delta excluded (no dates).
    expect(result).toHaveLength(3);
  });

  it("excludes sprints without dates when dateRange filter is active", () => {
    const result = filterSprints(sprints, {
      ...EMPTY_SPRINT_FILTERS,
      dateRange: { start: "2026-01-01", end: "2026-12-31" },
    });
    // Delta has no dates → excluded
    expect(result.every((s) => s.startDate !== null && s.endDate !== null)).toBe(true);
  });

  it("dateRange with only start — shows sprints ending after start", () => {
    const result = filterSprints(sprints, {
      ...EMPTY_SPRINT_FILTERS,
      dateRange: { start: "2026-02-10", end: "" },
    });
    // Beta (Feb 1-14) ends after Feb 10, Gamma (Mar 1-14) ends after Feb 10
    expect(result).toHaveLength(2);
    expect(result.map((s) => s.projectId).sort()).toEqual(["beta", "gamma"]);
  });

  it("dateRange with only end — shows sprints starting before end", () => {
    const result = filterSprints(sprints, {
      ...EMPTY_SPRINT_FILTERS,
      dateRange: { start: "", end: "2026-01-31" },
    });
    // Alpha (Jan 1-14) starts before Jan 31
    expect(result).toHaveLength(1);
    expect(result[0].projectId).toBe("alpha");
  });

  it("combines multiple filters (AND logic)", () => {
    const result = filterSprints(sprints, {
      ...EMPTY_SPRINT_FILTERS,
      status: "active",
      health: "on-track",
    });
    // Only Alpha is both active AND on-track
    expect(result).toHaveLength(1);
    expect(result[0].projectId).toBe("alpha");
  });

  it("returns empty when no matches", () => {
    const result = filterSprints(sprints, {
      ...EMPTY_SPRINT_FILTERS,
      status: "completed",
      health: "at-risk",
    });
    // No sprint is both completed AND at-risk
    expect(result).toHaveLength(0);
  });

  it("combines project and dateRange filter", () => {
    const result = filterSprints(sprints, {
      ...EMPTY_SPRINT_FILTERS,
      projectId: "gamma",
      dateRange: { start: "2026-03-01", end: "2026-03-14" },
    });
    expect(result).toHaveLength(1);
    expect(result[0].projectId).toBe("gamma");
  });
});

// =============================================================================
// extractAvailableProjects
// =============================================================================

describe("extractAvailableProjects", () => {
  it("returns unique projects sorted by name", () => {
    const projects = extractAvailableProjects(sprints);
    expect(projects).toEqual([
      { id: "alpha", name: "Alpha" },
      { id: "beta", name: "Beta" },
      { id: "delta", name: "Delta" },
      { id: "gamma", name: "Gamma" },
    ]);
  });

  it("returns empty array for no sprints", () => {
    expect(extractAvailableProjects([])).toEqual([]);
  });

  it("deduplicates same project appearing in multiple sprints", () => {
    const multiSprints = [
      createMockSprint({ projectId: "a", projectName: "Project A" }),
      createMockSprint({ projectId: "a", projectName: "Project A" }),
      createMockSprint({ projectId: "b", projectName: "Project B" }),
    ];
    const projects = extractAvailableProjects(multiSprints);
    expect(projects).toHaveLength(2);
  });
});
