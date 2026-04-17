/**
 * Sprint filtering utilities for the unified sprint view (Epic 53, Story 53.5).
 *
 * Implements AND logic for combining multiple filter criteria:
 * status, health, project, and date range. All conditions must match for a sprint
 * to be included in filtered results.
 *
 * Pattern: Pure sync functions, follows portfolio-filter.ts pattern.
 */

import type { UnifiedSprintEntry, SprintFilterState } from "./types";

/**
 * Check if any sprint filters are active (non-default).
 */
export function hasActiveSprintFilters(filters: SprintFilterState): boolean {
  const hasDateRange =
    filters.dateRange !== null && (filters.dateRange.start !== "" || filters.dateRange.end !== "");
  return (
    filters.status !== null || filters.health !== null || filters.projectId !== null || hasDateRange
  );
}

/**
 * Filter sprints by the given filter criteria using AND logic.
 *
 * All non-null filter conditions must match for a sprint to be included:
 * - Status must match exactly (if set)
 * - Health must match exactly (if set)
 * - Project ID must match exactly (if set)
 * - Date range must overlap with sprint's date range (if set)
 *   Sprints without dates are excluded when dateRange filter is active.
 *
 * @param sprints - Full list of unified sprint entries
 * @param filters - Active filter state
 * @returns Filtered sprint list
 */
export function filterSprints(
  sprints: UnifiedSprintEntry[],
  filters: SprintFilterState,
): UnifiedSprintEntry[] {
  return sprints.filter((sprint) => {
    // Status filter — exact match
    if (filters.status !== null && sprint.status !== filters.status) {
      return false;
    }

    // Health filter — exact match
    if (filters.health !== null && sprint.health !== filters.health) {
      return false;
    }

    // Project filter — exact match on projectId
    if (filters.projectId !== null && sprint.projectId !== filters.projectId) {
      return false;
    }

    // Date range filter — overlap check
    if (filters.dateRange !== null) {
      // Sprints without dates are excluded when date filter is active
      if (!sprint.startDate || !sprint.endDate) {
        return false;
      }

      const sprintStart = sprint.startDate;
      const sprintEnd = sprint.endDate;
      const filterStart = filters.dateRange.start;
      const filterEnd = filters.dateRange.end;

      // Overlap: sprint.start <= filter.end AND sprint.end >= filter.start
      // Empty string in filter = unbounded (treat as no bound)
      const afterFilterStart = filterStart === "" || sprintEnd >= filterStart;
      const beforeFilterEnd = filterEnd === "" || sprintStart <= filterEnd;

      if (!afterFilterStart || !beforeFilterEnd) {
        return false;
      }
    }

    return true;
  });
}

/**
 * Extract unique projects from all sprints, sorted by name.
 * Returns { id, name } pairs for the project dropdown.
 */
export function extractAvailableProjects(
  sprints: UnifiedSprintEntry[],
): { id: string; name: string }[] {
  const seen = new Map<string, string>();
  for (const sprint of sprints) {
    if (!seen.has(sprint.projectId)) {
      seen.set(sprint.projectId, sprint.projectName);
    }
  }
  return Array.from(seen.entries())
    .map(([id, name]) => ({ id, name }))
    .sort((a, b) => a.name.localeCompare(b.name));
}
