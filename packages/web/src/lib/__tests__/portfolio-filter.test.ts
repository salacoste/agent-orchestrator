import { describe, it, expect } from "vitest";
import {
  filterProjects,
  hasActiveFilters,
  extractAvailableTags,
  EMPTY_FILTERS,
} from "../portfolio-filter.js";
import type { PortfolioProject } from "../types.js";

function makeProject(overrides: Partial<PortfolioProject> & { id: string }): PortfolioProject {
  return {
    name: overrides.id,
    status: "active",
    activeAgents: 0,
    stories: { backlog: 0, inProgress: 0, done: 0, blocked: 0 },
    ...overrides,
  };
}

const mockProjects: PortfolioProject[] = [
  makeProject({
    id: "prod-api",
    status: "active",
    tags: ["production", "api"],
    metadata: { team: "backend", priority: "high" },
  }),
  makeProject({
    id: "staging-web",
    status: "idle",
    tags: ["staging", "web"],
    metadata: { team: "frontend" },
  }),
  makeProject({
    id: "prod-web",
    status: "active",
    tags: ["production", "web"],
    metadata: { team: "frontend", priority: "high" },
  }),
  makeProject({
    id: "error-svc",
    status: "error",
    tags: ["production"],
    metadata: { team: "backend" },
  }),
  makeProject({
    id: "no-tags",
    status: "idle",
  }),
];

describe("filterProjects", () => {
  it("returns all projects when no filters are active", () => {
    const result = filterProjects(mockProjects, EMPTY_FILTERS);
    expect(result).toHaveLength(mockProjects.length);
  });

  it("filters by status", () => {
    const result = filterProjects(mockProjects, { ...EMPTY_FILTERS, status: "active" });
    expect(result).toHaveLength(2);
    expect(result.every((p) => p.status === "active")).toBe(true);
  });

  it("filters by status returning error projects", () => {
    const result = filterProjects(mockProjects, { ...EMPTY_FILTERS, status: "error" });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("error-svc");
  });

  it("filters by single tag", () => {
    const result = filterProjects(mockProjects, { ...EMPTY_FILTERS, tags: ["production"] });
    expect(result).toHaveLength(3);
    expect(result.every((p) => p.tags?.includes("production"))).toBe(true);
  });

  it("applies AND logic for multiple tags", () => {
    const result = filterProjects(mockProjects, { ...EMPTY_FILTERS, tags: ["production", "api"] });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("prod-api");
  });

  it("returns empty when tag combination matches nothing", () => {
    const result = filterProjects(mockProjects, {
      ...EMPTY_FILTERS,
      tags: ["production", "staging"],
    });
    expect(result).toHaveLength(0);
  });

  it("includes projects with no tags when filtering by other criteria", () => {
    const result = filterProjects(mockProjects, { ...EMPTY_FILTERS, status: "idle" });
    expect(result).toHaveLength(2);
    expect(result.some((p) => p.id === "no-tags")).toBe(true);
  });

  it("filters by single metadata key-value", () => {
    const result = filterProjects(mockProjects, {
      ...EMPTY_FILTERS,
      metadata: { team: "backend" },
    });
    expect(result).toHaveLength(2);
    expect(result.every((p) => p.metadata?.team === "backend")).toBe(true);
  });

  it("filters by multiple metadata key-values with AND logic", () => {
    const result = filterProjects(mockProjects, {
      ...EMPTY_FILTERS,
      metadata: { team: "frontend", priority: "high" },
    });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("prod-web");
  });

  it("combines status + tag filters with AND logic", () => {
    const result = filterProjects(mockProjects, {
      ...EMPTY_FILTERS,
      status: "active",
      tags: ["production"],
    });
    expect(result).toHaveLength(2);
    expect(result.every((p) => p.status === "active" && p.tags?.includes("production"))).toBe(true);
  });

  it("combines status + metadata filters with AND logic", () => {
    const result = filterProjects(mockProjects, {
      ...EMPTY_FILTERS,
      status: "active",
      metadata: { team: "frontend" },
    });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("prod-web");
  });

  it("combines all three filter types with AND logic", () => {
    const result = filterProjects(mockProjects, {
      status: "active",
      tags: ["production"],
      metadata: { team: "backend" },
    });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("prod-api");
  });

  it("handles projects without tags gracefully", () => {
    const result = filterProjects(mockProjects, { ...EMPTY_FILTERS, tags: ["production"] });
    expect(result.every((p) => p.tags?.includes("production"))).toBe(true);
    expect(result.some((p) => p.id === "no-tags")).toBe(false);
  });

  it("handles projects without metadata gracefully", () => {
    const result = filterProjects(mockProjects, {
      ...EMPTY_FILTERS,
      metadata: { team: "backend" },
    });
    expect(result.every((p) => p.metadata?.team === "backend")).toBe(true);
    expect(result.some((p) => p.id === "no-tags")).toBe(false);
  });
});

describe("hasActiveFilters", () => {
  it("returns false for empty filters", () => {
    expect(hasActiveFilters(EMPTY_FILTERS)).toBe(false);
  });

  it("returns true when status is set", () => {
    expect(hasActiveFilters({ ...EMPTY_FILTERS, status: "active" })).toBe(true);
  });

  it("returns true when tags are set", () => {
    expect(hasActiveFilters({ ...EMPTY_FILTERS, tags: ["production"] })).toBe(true);
  });

  it("returns true when metadata is set", () => {
    expect(hasActiveFilters({ ...EMPTY_FILTERS, metadata: { team: "backend" } })).toBe(true);
  });
});

describe("extractAvailableTags", () => {
  it("extracts unique tags sorted alphabetically", () => {
    const tags = extractAvailableTags(mockProjects);
    expect(tags).toEqual(["api", "production", "staging", "web"]);
  });

  it("returns empty array for projects with no tags", () => {
    const noTagProjects = [makeProject({ id: "a" }), makeProject({ id: "b" })];
    expect(extractAvailableTags(noTagProjects)).toEqual([]);
  });

  it("deduplicates tags across projects", () => {
    const tags = extractAvailableTags(mockProjects);
    const productionCount = tags.filter((t) => t === "production").length;
    expect(productionCount).toBe(1);
  });
});
