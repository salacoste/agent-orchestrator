/**
 * Portfolio project filtering utilities.
 *
 * Implements AND logic for combining multiple filter criteria:
 * status, tags, and metadata. All conditions must match for a project
 * to be included in filtered results.
 */

import type { PortfolioProject, FilterState } from "./types";

/**
 * Check if any filters are active (non-default).
 */
export function hasActiveFilters(filters: FilterState): boolean {
  return (
    filters.status !== null || filters.tags.length > 0 || Object.keys(filters.metadata).length > 0
  );
}

/**
 * Filter projects by the given filter criteria using AND logic.
 *
 * All non-empty filter conditions must match for a project to be included:
 * - Status must match exactly (if set)
 * - All selected tags must be present on the project
 * - All metadata key-value pairs must match
 *
 * @param projects - Full list of portfolio projects
 * @param filters - Active filter state
 * @returns Filtered project list
 */
export function filterProjects(
  projects: PortfolioProject[],
  filters: FilterState,
): PortfolioProject[] {
  return projects.filter((project) => {
    // Status filter — exact match
    if (filters.status !== null && project.status !== filters.status) {
      return false;
    }

    // Tags filter — AND logic (all selected tags must be present)
    if (filters.tags.length > 0) {
      const projectTags = project.tags || [];
      if (!filters.tags.every((tag) => projectTags.includes(tag))) {
        return false;
      }
    }

    // Metadata filter — AND logic (all key-value pairs must match)
    for (const [key, value] of Object.entries(filters.metadata)) {
      if (project.metadata?.[key] !== value) {
        return false;
      }
    }

    return true;
  });
}

/**
 * Extract unique tags from all projects, sorted alphabetically.
 * Used to populate the tag filter dropdown options.
 */
export function extractAvailableTags(projects: PortfolioProject[]): string[] {
  const tagSet = new Set<string>();
  for (const project of projects) {
    if (project.tags) {
      for (const tag of project.tags) {
        tagSet.add(tag);
      }
    }
  }
  return Array.from(tagSet).sort();
}

/**
 * Extract unique metadata keys and their unique values from all projects.
 * Used to populate metadata filter dropdown options.
 * Returns a map of key → sorted unique values.
 */
export function extractAvailableMetadata(projects: PortfolioProject[]): Record<string, string[]> {
  const keyValues = new Map<string, Set<string>>();
  for (const project of projects) {
    if (project.metadata) {
      for (const [key, value] of Object.entries(project.metadata)) {
        let values = keyValues.get(key);
        if (!values) {
          values = new Set<string>();
          keyValues.set(key, values);
        }
        values.add(value);
      }
    }
  }
  const result: Record<string, string[]> = {};
  for (const [key, values] of keyValues) {
    result[key] = Array.from(values).sort();
  }
  return result;
}

/** Empty filter state (no filters active). */
export const EMPTY_FILTERS: FilterState = {
  status: null,
  tags: [],
  metadata: {},
};
