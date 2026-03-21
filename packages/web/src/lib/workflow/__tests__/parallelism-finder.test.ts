/**
 * Parallelism opportunity finder tests (Story 20.3).
 */
import { describe, expect, it } from "vitest";

import { findParallelOpportunities } from "../parallelism-finder";

describe("findParallelOpportunities", () => {
  it("finds independent stories that can run in parallel", () => {
    const stories = [
      { id: "1-1", title: "Story A", status: "ready-for-dev", dependencies: [] },
      { id: "1-2", title: "Story B", status: "ready-for-dev", dependencies: [] },
      { id: "1-3", title: "Story C", status: "ready-for-dev", dependencies: [] },
    ];
    const groups = findParallelOpportunities(stories);
    expect(groups).toHaveLength(1);
    expect(groups[0].stories).toHaveLength(3);
    expect(groups[0].savingsDescription).toContain("3 stories");
  });

  it("excludes stories with dependencies", () => {
    const stories = [
      { id: "1-1", title: "Foundation", status: "ready-for-dev", dependencies: [] },
      { id: "1-2", title: "Depends on 1-1", status: "ready-for-dev", dependencies: ["1-1"] },
      { id: "1-3", title: "Independent", status: "ready-for-dev", dependencies: [] },
    ];
    const groups = findParallelOpportunities(stories);
    // 1-1 is depended on by 1-2, so excluded. Only 1-3 is truly independent → not enough for parallel
    expect(groups).toHaveLength(0);
  });

  it("returns empty for single story", () => {
    const stories = [{ id: "1-1", title: "Solo", status: "ready-for-dev", dependencies: [] }];
    expect(findParallelOpportunities(stories)).toHaveLength(0);
  });

  it("returns empty for no stories", () => {
    expect(findParallelOpportunities([])).toHaveLength(0);
  });

  it("only considers actionable stories (backlog/ready-for-dev)", () => {
    const stories = [
      { id: "1-1", title: "Done", status: "done", dependencies: [] },
      { id: "1-2", title: "In progress", status: "in-progress", dependencies: [] },
      { id: "1-3", title: "Ready", status: "ready-for-dev", dependencies: [] },
    ];
    // Only 1 actionable → not enough for parallel
    expect(findParallelOpportunities(stories)).toHaveLength(0);
  });

  it("handles complex dependency graph", () => {
    const stories = [
      { id: "1-1", title: "A", status: "backlog", dependencies: [] },
      { id: "1-2", title: "B", status: "backlog", dependencies: [] },
      { id: "1-3", title: "C", status: "backlog", dependencies: ["1-1"] },
      { id: "1-4", title: "D", status: "backlog", dependencies: ["1-2"] },
      { id: "1-5", title: "E", status: "backlog", dependencies: [] },
    ];
    const groups = findParallelOpportunities(stories);
    // 1-1 and 1-2 are depended on. Only 1-5 is truly independent → not enough
    // Actually: 1-1 is depended on by 1-3, 1-2 by 1-4. 1-5 is alone.
    expect(groups).toHaveLength(0);
  });
});
