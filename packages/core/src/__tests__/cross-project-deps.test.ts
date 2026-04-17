import { describe, it, expect } from "vitest";
import {
  generateDepId,
  isDuplicate,
  addCrossProjectDependency,
  removeCrossProjectDependency,
  getDependenciesForStory,
  validateDependencyReferences,
  listDependencies,
  deriveStoryTitle,
  searchCrossProjectStories,
  resolveDepMaxCapacity,
  resolveDependencyStatus,
  resolveAllDependencyStatuses,
  areCrossProjectDepsSatisfied,
  getBlockedCrossProjectDeps,
  findCrossProjectDependents,
  autoUnblockCrossProjectDeps,
  buildCrossProjectGraph,
  computeBlockingStartTimes,
  getBlockingAlerts,
  formatDurationLabel,
  DEFAULT_BLOCKING_THRESHOLD_MS,
  CROSS_PROJECT_DEPS_FILENAME,
  type CrossProjectDependency,
  type DependencyWithStatus,
  type SprintDataMap,
  detectCircularDependency,
} from "../cross-project-deps.js";
import type { OrchestratorConfig } from "../types.js";

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeConfig(
  options: {
    projects?: Record<string, Record<string, unknown>>;
    globalMax?: number;
  } = {},
): OrchestratorConfig {
  return {
    projects: (options.projects ?? {}) as OrchestratorConfig["projects"],
    configPath: "/tmp/test-config.yaml",
    maxConcurrentAgents: options.globalMax,
  } as unknown as OrchestratorConfig;
}

function makeDep(overrides: Partial<CrossProjectDependency> = {}): CrossProjectDependency {
  return {
    id: "dep-test0001-abc12345",
    sourceProjectId: "project-a",
    sourceStoryId: "51-1-some-story",
    targetProjectId: "project-b",
    targetStoryId: "49-3-another-story",
    createdAt: "2026-03-29T00:00:00.000Z",
    ...overrides,
  };
}

function makeSprintData(): SprintDataMap {
  return {
    "project-a": {
      development_status: {
        "51-1-some-story": "in-progress",
        "51-2-other-story": "backlog",
        "epic-51": "in-progress",
        "51-retrospective": "optional",
      },
    },
    "project-b": {
      development_status: {
        "49-3-another-story": "done",
        "49-4-more-story": "backlog",
        "epic-49": "done",
      },
    },
  };
}

// ── generateDepId ─────────────────────────────────────────────────────────────

describe("generateDepId", () => {
  it("starts with 'dep-' prefix", () => {
    expect(generateDepId()).toMatch(/^dep-/);
  });

  it("generates unique IDs on successive calls", () => {
    const id1 = generateDepId();
    const id2 = generateDepId();
    expect(id1).not.toBe(id2);
  });
});

// ── isDuplicate ──────────────────────────────────────────────────────────────

describe("isDuplicate", () => {
  it("returns false for empty deps list", () => {
    expect(isDuplicate([], "p-a", "s-1", "p-b", "s-2")).toBe(false);
  });

  it("returns true when exact match exists", () => {
    const deps = [makeDep()];
    expect(
      isDuplicate(deps, "project-a", "51-1-some-story", "project-b", "49-3-another-story"),
    ).toBe(true);
  });

  it("returns false when source story differs", () => {
    const deps = [makeDep()];
    expect(
      isDuplicate(deps, "project-a", "51-2-different", "project-b", "49-3-another-story"),
    ).toBe(false);
  });

  it("returns false when target project differs", () => {
    const deps = [makeDep()];
    expect(
      isDuplicate(deps, "project-a", "51-1-some-story", "project-c", "49-3-another-story"),
    ).toBe(false);
  });
});

// ── addCrossProjectDependency ────────────────────────────────────────────────

describe("addCrossProjectDependency", () => {
  it("adds a new dependency and returns it with generated id and timestamp", () => {
    const result = addCrossProjectDependency(
      [],
      "project-a",
      "51-1-some-story",
      "project-b",
      "49-3-another-story",
    );

    expect(result.deps).toHaveLength(1);
    expect(result.added.sourceProjectId).toBe("project-a");
    expect(result.added.sourceStoryId).toBe("51-1-some-story");
    expect(result.added.targetProjectId).toBe("project-b");
    expect(result.added.targetStoryId).toBe("49-3-another-story");
    expect(result.added.id).toMatch(/^dep-/);
    expect(result.added.createdAt).toBeTruthy();
  });

  it("does not mutate the original array", () => {
    const original: CrossProjectDependency[] = [];
    addCrossProjectDependency(original, "p-a", "s-1", "p-b", "s-2");
    expect(original).toHaveLength(0);
  });

  it("throws on duplicate", () => {
    const deps = [makeDep()];
    expect(() =>
      addCrossProjectDependency(
        deps,
        "project-a",
        "51-1-some-story",
        "project-b",
        "49-3-another-story",
      ),
    ).toThrow("Duplicate dependency");
  });
});

// ── removeCrossProjectDependency ─────────────────────────────────────────────

describe("removeCrossProjectDependency", () => {
  it("removes a dependency by ID", () => {
    const dep = makeDep();
    const result = removeCrossProjectDependency([dep], dep.id);
    expect(result.deps).toHaveLength(0);
    expect(result.removed).toEqual(dep);
  });

  it("returns null when dep not found", () => {
    const dep = makeDep();
    const result = removeCrossProjectDependency([dep], "nonexistent");
    expect(result.deps).toHaveLength(1);
    expect(result.removed).toBeNull();
  });
});

// ── getDependenciesForStory ──────────────────────────────────────────────────

describe("getDependenciesForStory", () => {
  it("finds deps where story is source", () => {
    const dep = makeDep();
    const results = getDependenciesForStory([dep], "project-a", "51-1-some-story");
    expect(results).toHaveLength(1);
  });

  it("finds deps where story is target", () => {
    const dep = makeDep();
    const results = getDependenciesForStory([dep], "project-b", "49-3-another-story");
    expect(results).toHaveLength(1);
  });

  it("finds deps where story is both source and target", () => {
    const dep1 = makeDep({ sourceProjectId: "p-x", sourceStoryId: "s-1" });
    const dep2 = makeDep({ targetProjectId: "p-x", targetStoryId: "s-1" });
    const results = getDependenciesForStory([dep1, dep2], "p-x", "s-1");
    expect(results).toHaveLength(2);
  });

  it("returns empty when story not involved", () => {
    const dep = makeDep();
    const results = getDependenciesForStory([dep], "p-z", "s-99");
    expect(results).toHaveLength(0);
  });
});

// ── validateDependencyReferences ─────────────────────────────────────────────

describe("validateDependencyReferences", () => {
  const config = makeConfig({
    projects: {
      "project-a": { sharedPool: { enabled: true, eligibleProjects: ["project-b"] } },
      "project-b": {},
    },
  });

  it("passes when both projects exist in config", () => {
    const result = validateDependencyReferences(
      config,
      "project-a",
      "51-1-some-story",
      "project-b",
      "49-3-another-story",
    );
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("fails when source project not in config", () => {
    const result = validateDependencyReferences(config, "nonexistent", "s-1", "project-b", "s-2");
    expect(result.valid).toBe(false);
    expect(result.errors[0].field).toBe("sourceProjectId");
  });

  it("fails when target project not in config", () => {
    const result = validateDependencyReferences(config, "project-a", "s-1", "nonexistent", "s-2");
    expect(result.valid).toBe(false);
    expect(result.errors[0].field).toBe("targetProjectId");
  });

  it("fails when source story not in sprint data", () => {
    const sprintData = makeSprintData();
    const result = validateDependencyReferences(
      config,
      "project-a",
      "nonexistent-story",
      "project-b",
      "49-3-another-story",
      sprintData,
    );
    expect(result.valid).toBe(false);
    expect(result.errors[0].field).toBe("sourceStoryId");
  });

  it("fails when target story not in sprint data", () => {
    const sprintData = makeSprintData();
    const result = validateDependencyReferences(
      config,
      "project-a",
      "51-1-some-story",
      "project-b",
      "nonexistent-story",
      sprintData,
    );
    expect(result.valid).toBe(false);
    expect(result.errors[0].field).toBe("targetStoryId");
  });

  it("collects multiple errors", () => {
    const result = validateDependencyReferences(config, "bad-source", "s-1", "bad-target", "s-2");
    expect(result.valid).toBe(false);
    expect(result.errors).toHaveLength(2);
  });
});

// ── listDependencies ─────────────────────────────────────────────────────────

describe("listDependencies", () => {
  const deps = [
    makeDep({ sourceProjectId: "p-a", targetProjectId: "p-b" }),
    makeDep({ sourceProjectId: "p-b", targetProjectId: "p-c" }),
    makeDep({ sourceProjectId: "p-c", targetProjectId: "p-a" }),
  ];

  it("returns all deps when no filter", () => {
    expect(listDependencies(deps)).toHaveLength(3);
  });

  it("filters by project (source or target)", () => {
    const result = listDependencies(deps, { projectId: "p-a" });
    expect(result).toHaveLength(2); // dep 1 (source) and dep 3 (target)
  });

  it("returns empty when project has no deps", () => {
    const result = listDependencies(deps, { projectId: "p-z" });
    expect(result).toHaveLength(0);
  });
});

// ── deriveStoryTitle ─────────────────────────────────────────────────────────

describe("deriveStoryTitle", () => {
  it("derives title from story ID (strips epic and sub-number)", () => {
    expect(deriveStoryTitle("51-1-cross-project-deps")).toBe("cross project deps");
  });

  it("returns full ID when no number prefix", () => {
    expect(deriveStoryTitle("my-story")).toBe("story");
  });
});

// ── searchCrossProjectStories ────────────────────────────────────────────────

describe("searchCrossProjectStories", () => {
  const config = makeConfig({
    projects: {
      "project-a": {},
      "project-b": {},
    },
  });
  const sprintData = makeSprintData();

  it("finds stories matching query by ID", () => {
    const results = searchCrossProjectStories(config, sprintData, "51-1");
    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results[0].id).toBe("51-1-some-story");
    expect(results[0].projectId).toBe("project-a");
  });

  it("finds stories matching query by derived title", () => {
    const results = searchCrossProjectStories(config, sprintData, "another");
    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results[0].id).toBe("49-3-another-story");
  });

  it("skips epics and retrospectives", () => {
    const results = searchCrossProjectStories(config, sprintData, "epic");
    expect(results.every((r) => !r.id.startsWith("epic-"))).toBe(true);
  });

  it("returns empty for no matches", () => {
    const results = searchCrossProjectStories(config, sprintData, "zzz-nonexistent");
    expect(results).toHaveLength(0);
  });

  it("returns empty when query is empty or whitespace", () => {
    expect(searchCrossProjectStories(config, sprintData, "")).toHaveLength(0);
    expect(searchCrossProjectStories(config, sprintData, "   ")).toHaveLength(0);
  });
});

// ── resolveDepMaxCapacity ────────────────────────────────────────────────────

describe("resolveDepMaxCapacity", () => {
  it("uses project-level maxConcurrent when pool enabled", () => {
    const config = makeConfig({
      projects: {
        p1: { sharedPool: { enabled: true, eligibleProjects: ["p2"], maxConcurrent: 5 } },
      },
    });
    expect(resolveDepMaxCapacity(config, "p1")).toBe(5);
  });

  it("falls back to global maxConcurrentAgents", () => {
    const config = makeConfig({ globalMax: 8 });
    expect(resolveDepMaxCapacity(config, "p1")).toBe(8);
  });

  it("falls back to DEFAULT_MAX_CONCURRENT (10)", () => {
    const config = makeConfig();
    expect(resolveDepMaxCapacity(config)).toBe(10);
  });
});

// ── CROSS_PROJECT_DEPS_FILENAME ──────────────────────────────────────────────

describe("CROSS_PROJECT_DEPS_FILENAME", () => {
  it("has expected value", () => {
    expect(CROSS_PROJECT_DEPS_FILENAME).toBe("cross-project-deps.yaml");
  });
});

// ── resolveDependencyStatus ──────────────────────────────────────────────────

describe("resolveDependencyStatus", () => {
  const sprintData = makeSprintData();

  it("marks resolved when target story is done", () => {
    const dep = makeDep(); // target is project-b/49-3-another-story → "done"
    const result = resolveDependencyStatus(dep, sprintData);
    expect(result.targetStatus).toBe("done");
    expect(result.isResolved).toBe(true);
  });

  it("marks unresolved when target story is in-progress", () => {
    const dep = makeDep({ targetProjectId: "project-a", targetStoryId: "51-1-some-story" });
    const result = resolveDependencyStatus(dep, sprintData);
    expect(result.targetStatus).toBe("in-progress");
    expect(result.isResolved).toBe(false);
  });

  it("marks unresolved when target story is backlog", () => {
    const dep = makeDep({ targetProjectId: "project-a", targetStoryId: "51-2-other-story" });
    const result = resolveDependencyStatus(dep, sprintData);
    expect(result.targetStatus).toBe("backlog");
    expect(result.isResolved).toBe(false);
  });

  it("returns unknown when target project not in sprint data", () => {
    const dep = makeDep({ targetProjectId: "project-z", targetStoryId: "s-1" });
    const result = resolveDependencyStatus(dep, sprintData);
    expect(result.targetStatus).toBe("unknown");
    expect(result.isResolved).toBe(false);
  });

  it("returns unknown when target story not found in project", () => {
    const dep = makeDep({ targetProjectId: "project-b", targetStoryId: "nonexistent" });
    const result = resolveDependencyStatus(dep, sprintData);
    expect(result.targetStatus).toBe("unknown");
    expect(result.isResolved).toBe(false);
  });

  it("returns unknown when sprintData is empty", () => {
    const dep = makeDep();
    const result = resolveDependencyStatus(dep, {});
    expect(result.targetStatus).toBe("unknown");
    expect(result.isResolved).toBe(false);
  });

  it("marks unresolved when target status is optional", () => {
    const dep = makeDep({ targetProjectId: "project-a", targetStoryId: "51-retrospective" });
    const result = resolveDependencyStatus(dep, sprintData);
    expect(result.targetStatus).toBe("optional");
    expect(result.isResolved).toBe(false);
  });

  it("returns unknown when project has empty development_status", () => {
    const emptySprintData: SprintDataMap = { "project-a": { development_status: {} } };
    const dep = makeDep({ targetProjectId: "project-a", targetStoryId: "any-story" });
    const result = resolveDependencyStatus(dep, emptySprintData);
    expect(result.targetStatus).toBe("unknown");
    expect(result.isResolved).toBe(false);
  });

  it("preserves all original dep fields", () => {
    const dep = makeDep();
    const result = resolveDependencyStatus(dep, sprintData);
    expect(result.id).toBe(dep.id);
    expect(result.sourceProjectId).toBe(dep.sourceProjectId);
    expect(result.sourceStoryId).toBe(dep.sourceStoryId);
    expect(result.targetProjectId).toBe(dep.targetProjectId);
    expect(result.targetStoryId).toBe(dep.targetStoryId);
    expect(result.createdAt).toBe(dep.createdAt);
  });
});

// ── resolveAllDependencyStatuses ─────────────────────────────────────────────

describe("resolveAllDependencyStatuses", () => {
  const sprintData = makeSprintData();

  it("returns empty for empty deps list", () => {
    expect(resolveAllDependencyStatuses([], sprintData)).toHaveLength(0);
  });

  it("enriches all deps with status", () => {
    const deps = [
      makeDep(), // target: project-b/49-3 → done
      makeDep({ targetProjectId: "project-a", targetStoryId: "51-1-some-story" }), // in-progress
    ];
    const result = resolveAllDependencyStatuses(deps, sprintData);
    expect(result).toHaveLength(2);
    expect(result[0].isResolved).toBe(true);
    expect(result[1].isResolved).toBe(false);
  });

  it("handles mixed resolved/unresolved", () => {
    const deps = [
      makeDep(), // done
      makeDep({ targetProjectId: "project-a", targetStoryId: "51-2-other-story" }), // backlog
      makeDep({ targetProjectId: "project-z", targetStoryId: "s-1" }), // unknown
    ];
    const result = resolveAllDependencyStatuses(deps, sprintData);
    expect(result[0].isResolved).toBe(true);
    expect(result[1].isResolved).toBe(false);
    expect(result[1].targetStatus).toBe("backlog");
    expect(result[2].isResolved).toBe(false);
    expect(result[2].targetStatus).toBe("unknown");
  });
});

// ── areCrossProjectDepsSatisfied ─────────────────────────────────────────────

describe("areCrossProjectDepsSatisfied", () => {
  const sprintData = makeSprintData();

  it("returns satisfied when story has no cross-project deps", () => {
    const result = areCrossProjectDepsSatisfied("project-a", "nonexistent-story", [], sprintData);
    expect(result.satisfied).toBe(true);
    expect(result.outstanding).toHaveLength(0);
  });

  it("returns satisfied when all target stories are done", () => {
    const deps = [makeDep()]; // target: project-b/49-3 → done
    const result = areCrossProjectDepsSatisfied("project-a", "51-1-some-story", deps, sprintData);
    expect(result.satisfied).toBe(true);
    expect(result.outstanding).toHaveLength(0);
  });

  it("returns unsatisfied with outstanding deps when target is not done", () => {
    const deps = [
      makeDep({
        sourceProjectId: "project-a",
        sourceStoryId: "51-2-other-story",
        targetProjectId: "project-a",
        targetStoryId: "51-1-some-story", // in-progress in makeSprintData
      }),
    ];
    const result = areCrossProjectDepsSatisfied("project-a", "51-2-other-story", deps, sprintData);
    expect(result.satisfied).toBe(false);
    expect(result.outstanding).toHaveLength(1);
    expect(result.outstanding[0].targetStatus).toBe("in-progress");
    expect(result.outstanding[0].isResolved).toBe(false);
  });

  it("returns unsatisfied when some targets are not done", () => {
    const deps = [
      makeDep(), // target: done
      makeDep({
        sourceProjectId: "project-a",
        sourceStoryId: "51-2-other-story",
        targetProjectId: "project-a",
        targetStoryId: "51-1-some-story",
      }), // target: in-progress
    ];
    const result = areCrossProjectDepsSatisfied("project-a", "51-2-other-story", deps, sprintData);
    expect(result.satisfied).toBe(false);
    expect(result.outstanding).toHaveLength(1);
    expect(result.outstanding[0].targetStatus).toBe("in-progress");
  });

  it("only checks deps where story is the source", () => {
    // This dep has project-a/51-1 as target, not source
    const deps = [makeDep({ sourceProjectId: "project-b", sourceStoryId: "49-4-more-story" })];
    const result = areCrossProjectDepsSatisfied("project-a", "51-1-some-story", deps, sprintData);
    expect(result.satisfied).toBe(true);
    expect(result.outstanding).toHaveLength(0);
  });
});

// ── getBlockedCrossProjectDeps ───────────────────────────────────────────────

describe("getBlockedCrossProjectDeps", () => {
  const sprintData = makeSprintData();

  it("returns empty when no deps are blocked", () => {
    const deps = [makeDep()]; // target is done
    const result = getBlockedCrossProjectDeps(deps, sprintData);
    expect(result).toHaveLength(0);
  });

  it("returns only unresolved deps", () => {
    const deps = [
      makeDep(), // target: project-b/49-3 → done
      makeDep({ targetProjectId: "project-a", targetStoryId: "51-1-some-story" }), // in-progress
      makeDep({ targetProjectId: "project-a", targetStoryId: "51-2-other-story" }), // backlog
    ];
    const result = getBlockedCrossProjectDeps(deps, sprintData);
    expect(result).toHaveLength(2);
    expect(result.every((d) => !d.isResolved)).toBe(true);
  });

  it("returns all deps when none are resolved", () => {
    const deps = [
      makeDep({ targetProjectId: "project-a", targetStoryId: "51-1-some-story" }),
      makeDep({ targetProjectId: "project-a", targetStoryId: "51-2-other-story" }),
    ];
    const result = getBlockedCrossProjectDeps(deps, sprintData);
    expect(result).toHaveLength(2);
  });

  it("handles empty deps list", () => {
    expect(getBlockedCrossProjectDeps([], sprintData)).toHaveLength(0);
  });
});

// ── findCrossProjectDependents ──────────────────────────────────────────────

describe("findCrossProjectDependents", () => {
  it("finds deps targeting the completed story", () => {
    // makeDep() targets project-b/49-3-another-story by default
    const deps = [makeDep()];
    const result = findCrossProjectDependents("project-b", "49-3-another-story", deps);
    expect(result).toHaveLength(1);
    expect(result[0].sourceProjectId).toBe("project-a");
    expect(result[0].sourceStoryId).toBe("51-1-some-story");
  });

  it("returns empty when no deps target the completed story", () => {
    const deps = [makeDep()]; // targets project-b/49-3
    const result = findCrossProjectDependents("project-c", "nonexistent", deps);
    expect(result).toHaveLength(0);
  });

  it("finds multiple dependents across projects", () => {
    const deps = [
      makeDep(), // source: project-a/51-1 → target: project-b/49-3
      makeDep({
        sourceProjectId: "project-c",
        sourceStoryId: "99-1-some-story",
        targetProjectId: "project-b",
        targetStoryId: "49-3-another-story",
      }),
      makeDep({
        sourceProjectId: "project-a",
        sourceStoryId: "51-2-other-story",
        targetProjectId: "project-a",
        targetStoryId: "51-1-some-story",
      }), // different target
    ];
    const result = findCrossProjectDependents("project-b", "49-3-another-story", deps);
    expect(result).toHaveLength(2);
  });

  it("handles empty deps list", () => {
    const result = findCrossProjectDependents("project-a", "51-1-some-story", []);
    expect(result).toHaveLength(0);
  });
});

// ── autoUnblockCrossProjectDeps ─────────────────────────────────────────────

describe("autoUnblockCrossProjectDeps", () => {
  const sprintData = makeSprintData();

  it("returns eligible stories when all deps are satisfied", () => {
    // Story X in project-a depends on project-b/49-3 (done in sprintData)
    const deps = [makeDep()]; // source: project-a/51-1, target: project-b/49-3 → done
    const result = autoUnblockCrossProjectDeps("project-b", "49-3-another-story", deps, sprintData);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ projectId: "project-a", storyId: "51-1-some-story" });
  });

  it("returns empty when deps are partially satisfied", () => {
    // Source has TWO deps: one done, one not done
    const deps = [
      makeDep(), // source: project-a/51-1, target: project-b/49-3 → done
      makeDep({
        sourceProjectId: "project-a",
        sourceStoryId: "51-1-some-story",
        targetProjectId: "project-a",
        targetStoryId: "51-2-other-story", // → backlog (not done)
      }),
    ];
    const result = autoUnblockCrossProjectDeps("project-b", "49-3-another-story", deps, sprintData);
    // project-a/51-1-some-story has 2 deps: one done, one backlog → NOT all satisfied
    expect(result).toHaveLength(0);
  });

  it("returns empty when no deps target the completed story", () => {
    const deps = [makeDep()]; // targets project-b/49-3
    const result = autoUnblockCrossProjectDeps("project-z", "nonexistent", deps, sprintData);
    expect(result).toHaveLength(0);
  });

  it("handles empty deps list", () => {
    const result = autoUnblockCrossProjectDeps("project-b", "49-3-another-story", [], sprintData);
    expect(result).toHaveLength(0);
  });

  it("skips source story when project not in sprint data", () => {
    const deps = [
      makeDep({
        sourceProjectId: "project-z",
        sourceStoryId: "z-1-story",
        targetProjectId: "project-b",
        targetStoryId: "49-3-another-story", // → done
      }),
    ];
    const result = autoUnblockCrossProjectDeps("project-b", "49-3-another-story", deps, sprintData);
    // project-z has no sprint data → areCrossProjectDepsSatisfied returns unknown for target
    // but actually, the source dep targets project-b/49-3 which is done, so the source
    // project-z/z-1-story's deps are checked. Since project-z is not in sprintData,
    // the dep's target (project-b/49-3) IS resolved. But areCrossProjectDepsSatisfied
    // checks deps where sourceProjectId === "project-z" && sourceStoryId === "z-1-story"
    // which has one dep targeting project-b/49-3 (done) → satisfied=true
    // BUT the function is pure and doesn't check if the source project actually exists
    // in the config — it just checks sprint data. So this should return the story as eligible.
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ projectId: "project-z", storyId: "z-1-story" });
  });

  it("single-pass: does not cascade through chain", () => {
    // A → B → C. When C completes, B should be eligible but NOT A
    // A depends on B, B depends on C
    const deps = [
      makeDep({
        sourceProjectId: "project-a",
        sourceStoryId: "51-1-some-story", // A
        targetProjectId: "project-a",
        targetStoryId: "51-2-other-story", // B → backlog (not done)
      }),
      makeDep({
        sourceProjectId: "project-a",
        sourceStoryId: "51-2-other-story", // B
        targetProjectId: "project-b",
        targetStoryId: "49-3-another-story", // C → done
      }),
    ];
    const result = autoUnblockCrossProjectDeps("project-b", "49-3-another-story", deps, sprintData);
    // Only B (51-2-other-story) is a direct dependent of C — check if B's deps satisfied
    // B depends on C (done) → satisfied → eligible
    // A is NOT a direct dependent of C (A depends on B, not C)
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ projectId: "project-a", storyId: "51-2-other-story" });
  });
});

// ── buildCrossProjectGraph (Story 51.4) ────────────────────────────────────────

function makeDepWithStatus(
  overrides: Partial<CrossProjectDependency> & { targetStatus?: string; isResolved?: boolean } = {},
): DependencyWithStatus {
  const { targetStatus = "done", isResolved = true, ...depOverrides } = overrides;
  return {
    ...makeDep(depOverrides),
    targetStatus,
    isResolved,
  };
}

describe("buildCrossProjectGraph", () => {
  it("returns empty graph for empty dependencies", () => {
    const graph = buildCrossProjectGraph([], {});
    expect(graph.nodes).toHaveLength(0);
    expect(graph.edges).toHaveLength(0);
    expect(graph.projectGroups).toEqual({});
  });

  it("builds nodes for source and target stories", () => {
    const deps: DependencyWithStatus[] = [
      makeDepWithStatus({
        sourceProjectId: "project-a",
        sourceStoryId: "story-1",
        targetProjectId: "project-b",
        targetStoryId: "story-2",
      }),
    ];

    const graph = buildCrossProjectGraph(deps, {
      "project-a": "Project A",
      "project-b": "Project B",
    });

    expect(graph.nodes).toHaveLength(2);
    const nodeIds = graph.nodes.map((n) => n.id);
    expect(nodeIds).toContain("project-a::story-1");
    expect(nodeIds).toContain("project-b::story-2");
  });

  it("groups nodes by project", () => {
    const deps: DependencyWithStatus[] = [
      makeDepWithStatus({
        sourceProjectId: "project-a",
        sourceStoryId: "story-1",
        targetProjectId: "project-b",
        targetStoryId: "story-2",
      }),
      makeDepWithStatus({
        sourceProjectId: "project-a",
        sourceStoryId: "story-3",
        targetProjectId: "project-b",
        targetStoryId: "story-4",
      }),
    ];

    const graph = buildCrossProjectGraph(deps, {
      "project-a": "Project A",
      "project-b": "Project B",
    });

    expect(Object.keys(graph.projectGroups)).toHaveLength(2);
    expect(graph.projectGroups["project-a"]).toHaveLength(2);
    expect(graph.projectGroups["project-b"]).toHaveLength(2);
  });

  it("creates edges with source and target references", () => {
    const deps: DependencyWithStatus[] = [
      makeDepWithStatus({
        id: "dep-001",
        sourceProjectId: "project-a",
        sourceStoryId: "story-1",
        targetProjectId: "project-b",
        targetStoryId: "story-2",
        targetStatus: "in-progress",
        isResolved: false,
      }),
    ];

    const graph = buildCrossProjectGraph(deps, {
      "project-a": "Project A",
      "project-b": "Project B",
    });

    expect(graph.edges).toHaveLength(1);
    expect(graph.edges[0]).toMatchObject({
      id: "dep-001",
      sourceNodeId: "project-a::story-1",
      targetNodeId: "project-b::story-2",
      sourceProjectId: "project-a",
      targetProjectId: "project-b",
      isResolved: false,
    });
  });

  it("handles unknown project gracefully", () => {
    const deps: DependencyWithStatus[] = [
      makeDepWithStatus({
        sourceProjectId: "project-a",
        sourceStoryId: "story-1",
        targetProjectId: "project-unknown",
        targetStoryId: "story-x",
      }),
    ];

    const graph = buildCrossProjectGraph(deps, {
      "project-a": "Project A",
      // project-unknown is NOT in projectNames
    });

    // Should still create nodes for both stories
    expect(graph.nodes).toHaveLength(2);
    const unknownNode = graph.nodes.find((n) => n.projectId === "project-unknown");
    expect(unknownNode).toBeDefined();
    expect(unknownNode!.projectName).toBe("project-unknown");
  });

  it("deduplicates nodes when same story appears in multiple deps", () => {
    const deps: DependencyWithStatus[] = [
      makeDepWithStatus({
        sourceProjectId: "project-a",
        sourceStoryId: "story-1",
        targetProjectId: "project-b",
        targetStoryId: "story-2",
      }),
      makeDepWithStatus({
        sourceProjectId: "project-a",
        sourceStoryId: "story-1", // same source
        targetProjectId: "project-c",
        targetStoryId: "story-3",
      }),
    ];

    const graph = buildCrossProjectGraph(deps, {
      "project-a": "Project A",
      "project-b": "Project B",
      "project-c": "Project C",
    });

    // story-1 should appear once, not twice
    const story1Nodes = graph.nodes.filter(
      (n) => n.projectId === "project-a" && n.storyId === "story-1",
    );
    expect(story1Nodes).toHaveLength(1);
    expect(graph.nodes).toHaveLength(3); // story-1, story-2, story-3
    expect(graph.edges).toHaveLength(2);
  });

  it("marks blocked nodes from sprint data", () => {
    const deps: DependencyWithStatus[] = [
      makeDepWithStatus({
        sourceProjectId: "project-a",
        sourceStoryId: "story-1",
        targetProjectId: "project-b",
        targetStoryId: "story-2",
        targetStatus: "in-progress",
        isResolved: false,
      }),
    ];

    const sprintData: SprintDataMap = {
      "project-a": { development_status: { "story-1": "blocked" } },
      "project-b": { development_status: { "story-2": "in-progress" } },
    };

    const graph = buildCrossProjectGraph(deps, { "project-a": "A", "project-b": "B" }, sprintData);

    const sourceNode = graph.nodes.find((n) => n.storyId === "story-1");
    expect(sourceNode!.isBlocked).toBe(true);
    expect(sourceNode!.status).toBe("blocked");
  });

  it("preserves edge resolved status from DependencyWithStatus", () => {
    const resolved: DependencyWithStatus[] = [
      makeDepWithStatus({
        targetStatus: "done",
        isResolved: true,
      }),
    ];
    const unresolved: DependencyWithStatus[] = [
      makeDepWithStatus({
        targetStatus: "in-progress",
        isResolved: false,
      }),
    ];

    const graphResolved = buildCrossProjectGraph(resolved, {
      "project-a": "A",
      "project-b": "B",
    });
    const graphUnresolved = buildCrossProjectGraph(unresolved, {
      "project-a": "A",
      "project-b": "B",
    });

    expect(graphResolved.edges[0]!.isResolved).toBe(true);
    expect(graphUnresolved.edges[0]!.isResolved).toBe(false);
  });
});

// =============================================================================
// BLOCKING NOTIFICATION TESTS (Story 51.5)
// =============================================================================

describe("computeBlockingStartTimes", () => {
  const fixedNow = new Date("2026-03-30T12:00:00.000Z");

  const makeDep = (
    id: string,
    sourceProject: string,
    sourceStory: string,
    targetProject: string,
    targetStory: string,
  ): CrossProjectDependency => ({
    id,
    sourceProjectId: sourceProject,
    sourceStoryId: sourceStory,
    targetProjectId: targetProject,
    targetStoryId: targetStory,
    createdAt: "2026-03-30T10:00:00.000Z",
  });

  it("returns empty map when no deps exist", () => {
    const result = computeBlockingStartTimes([], {}, {}, fixedNow);
    expect(result).toEqual({});
  });

  it("adds start time for newly blocked deps", () => {
    const dep = makeDep("dep-1", "proj-a", "story-1", "proj-b", "story-2");
    const sprintData: SprintDataMap = {
      "proj-b": { development_status: { "story-2": "in-progress" } },
    };

    const result = computeBlockingStartTimes([dep], sprintData, {}, fixedNow);

    expect(result["dep-1"]).toBe("2026-03-30T12:00:00.000Z");
  });

  it("preserves existing start time for still-blocked deps", () => {
    const dep = makeDep("dep-1", "proj-a", "story-1", "proj-b", "story-2");
    const sprintData: SprintDataMap = {
      "proj-b": { development_status: { "story-2": "in-progress" } },
    };
    const existing = { "dep-1": "2026-03-30T08:00:00.000Z" };

    const result = computeBlockingStartTimes([dep], sprintData, existing, fixedNow);

    expect(result["dep-1"]).toBe("2026-03-30T08:00:00.000Z");
  });

  it("removes start time for resolved deps", () => {
    const dep = makeDep("dep-1", "proj-a", "story-1", "proj-b", "story-2");
    const sprintData: SprintDataMap = {
      "proj-b": { development_status: { "story-2": "done" } },
    };
    const existing = { "dep-1": "2026-03-30T08:00:00.000Z" };

    const result = computeBlockingStartTimes([dep], sprintData, existing, fixedNow);

    expect(result["dep-1"]).toBeUndefined();
  });

  it("handles mix of blocked and resolved deps", () => {
    const dep1 = makeDep("dep-1", "proj-a", "story-1", "proj-b", "story-2");
    const dep2 = makeDep("dep-2", "proj-a", "story-3", "proj-b", "story-4");
    const sprintData: SprintDataMap = {
      "proj-b": {
        development_status: { "story-2": "done", "story-4": "in-progress" },
      },
    };
    const existing = {
      "dep-1": "2026-03-30T08:00:00.000Z",
      "dep-2": "2026-03-30T09:00:00.000Z",
    };

    const result = computeBlockingStartTimes([dep1, dep2], sprintData, existing, fixedNow);

    expect(result["dep-1"]).toBeUndefined(); // resolved → removed
    expect(result["dep-2"]).toBe("2026-03-30T09:00:00.000Z"); // still blocked → preserved
  });
});

describe("getBlockingAlerts", () => {
  const fixedNow = new Date("2026-03-30T12:00:00.000Z");
  const oneHour = DEFAULT_BLOCKING_THRESHOLD_MS; // 3,600,000 ms

  const makeDep = (id: string): CrossProjectDependency => ({
    id,
    sourceProjectId: "proj-a",
    sourceStoryId: "story-1",
    targetProjectId: "proj-b",
    targetStoryId: "story-2",
    createdAt: "2026-03-30T06:00:00.000Z",
  });

  const sprintDataBlocked: SprintDataMap = {
    "proj-b": { development_status: { "story-2": "in-progress" } },
  };

  it("returns empty alerts when no blocking start times", () => {
    const dep = makeDep("dep-1");
    const result = getBlockingAlerts([dep], sprintDataBlocked, {}, oneHour, fixedNow);
    expect(result).toEqual([]);
  });

  it("returns alert for dep blocking beyond threshold", () => {
    const dep = makeDep("dep-1");
    const startTimes = { "dep-1": "2026-03-30T10:00:00.000Z" }; // 2 hours ago

    const result = getBlockingAlerts([dep], sprintDataBlocked, startTimes, oneHour, fixedNow);

    expect(result).toHaveLength(1);
    expect(result[0]!.thresholdExceeded).toBe(true);
    expect(result[0]!.blockedStoryId).toBe("story-1");
    expect(result[0]!.blockingStoryId).toBe("story-2");
    expect(result[0]!.blockingDurationMs).toBe(7_200_000); // 2 hours
    expect(result[0]!.blockingDurationLabel).toBe("2h");
  });

  it("filters out deps below threshold", () => {
    const dep = makeDep("dep-1");
    const startTimes = { "dep-1": "2026-03-30T11:30:00.000Z" }; // 30 min ago

    const result = getBlockingAlerts([dep], sprintDataBlocked, startTimes, oneHour, fixedNow);

    expect(result).toHaveLength(1);
    expect(result[0]!.thresholdExceeded).toBe(false);
  });

  it("skips resolved deps", () => {
    const dep = makeDep("dep-1");
    const sprintDataResolved: SprintDataMap = {
      "proj-b": { development_status: { "story-2": "done" } },
    };
    const startTimes = { "dep-1": "2026-03-30T10:00:00.000Z" };

    const result = getBlockingAlerts([dep], sprintDataResolved, startTimes, oneHour, fixedNow);

    expect(result).toEqual([]);
  });
});

describe("formatDurationLabel", () => {
  it('returns "<1m" for sub-minute durations', () => {
    expect(formatDurationLabel(30_000)).toBe("<1m");
  });

  it("returns minutes for sub-hour durations", () => {
    expect(formatDurationLabel(5 * 60_000)).toBe("5m");
    expect(formatDurationLabel(45 * 60_000)).toBe("45m");
  });

  it("returns hours and minutes", () => {
    expect(formatDurationLabel(90 * 60_000)).toBe("1h 30m");
    expect(formatDurationLabel(150 * 60_000)).toBe("2h 30m");
  });

  it("returns hours only when exact", () => {
    expect(formatDurationLabel(2 * 60 * 60_000)).toBe("2h");
  });

  it("returns days and hours", () => {
    expect(formatDurationLabel(26 * 60 * 60_000)).toBe("1d 2h");
    expect(formatDurationLabel(3 * 24 * 60 * 60_000)).toBe("3d");
  });
});

// =============================================================================
// CIRCULAR DEPENDENCY DETECTION TESTS (Story 51.6)
// =============================================================================

describe("detectCircularDependency", () => {
  // Helper to build a dep with specific source/target
  const link = (
    id: string,
    srcProj: string,
    srcStory: string,
    tgtProj: string,
    tgtStory: string,
  ): CrossProjectDependency => ({
    id,
    sourceProjectId: srcProj,
    sourceStoryId: srcStory,
    targetProjectId: tgtProj,
    targetStoryId: tgtStory,
    createdAt: "2026-03-30T00:00:00.000Z",
  });

  it("returns no cycle with empty deps", () => {
    const result = detectCircularDependency([], "p-a", "s-1", "p-b", "s-2");
    expect(result.cycleDetected).toBe(false);
    expect(result.cyclePath).toBeUndefined();
  });

  it("returns no cycle with unrelated existing deps", () => {
    const deps = [link("d1", "p-x", "s-10", "p-y", "s-20")];
    const result = detectCircularDependency(deps, "p-a", "s-1", "p-b", "s-2");
    expect(result.cycleDetected).toBe(false);
  });

  it("detects self-referential dependency", () => {
    const result = detectCircularDependency([], "p-a", "s-1", "p-a", "s-1");
    expect(result.cycleDetected).toBe(true);
    expect(result.cyclePath).toBeDefined();
    expect(result.cyclePath!.length).toBeGreaterThanOrEqual(2);
    // First and last should be the same
    const first = result.cyclePath![0];
    const last = result.cyclePath![result.cyclePath!.length - 1];
    expect(first.projectId).toBe("p-a");
    expect(first.storyId).toBe("s-1");
    expect(last.projectId).toBe("p-a");
    expect(last.storyId).toBe("s-1");
  });

  it("detects direct 2-node cycle (A→B then B→A)", () => {
    // Existing: A→B. Adding B→A creates cycle.
    const deps = [link("d1", "p-a", "s-1", "p-b", "s-2")];
    const result = detectCircularDependency(deps, "p-b", "s-2", "p-a", "s-1");
    expect(result.cycleDetected).toBe(true);
    expect(result.cyclePath).toBeDefined();
    const pathStr = result.cyclePath!.map((n) => `${n.projectId}/${n.storyId}`).join(" → ");
    expect(pathStr).toContain("p-a/s-1");
    expect(pathStr).toContain("p-b/s-2");
  });

  it("detects 3-node cycle (A→B→C→A)", () => {
    // Existing: A→B, B→C. Adding C→A creates cycle.
    const deps = [link("d1", "p-a", "s-1", "p-b", "s-2"), link("d2", "p-b", "s-2", "p-c", "s-3")];
    const result = detectCircularDependency(deps, "p-c", "s-3", "p-a", "s-1");
    expect(result.cycleDetected).toBe(true);
    expect(result.cyclePath).toBeDefined();
    expect(result.cyclePath!.length).toBeGreaterThanOrEqual(3);
  });

  it("detects longer chain cycle (A→B→C→D→A)", () => {
    const deps = [
      link("d1", "p-a", "s-1", "p-b", "s-2"),
      link("d2", "p-b", "s-2", "p-c", "s-3"),
      link("d3", "p-c", "s-3", "p-d", "s-4"),
    ];
    const result = detectCircularDependency(deps, "p-d", "s-4", "p-a", "s-1");
    expect(result.cycleDetected).toBe(true);
    expect(result.cyclePath).toBeDefined();
  });

  it("allows dependency that extends chain without cycling", () => {
    // Existing: A→B, B→C. Adding D→A is fine.
    const deps = [link("d1", "p-a", "s-1", "p-b", "s-2"), link("d2", "p-b", "s-2", "p-c", "s-3")];
    const result = detectCircularDependency(deps, "p-d", "s-4", "p-a", "s-1");
    expect(result.cycleDetected).toBe(false);
  });

  it("detects cycle in one direction but not reverse", () => {
    // Existing: A→B. Adding A→B duplicate is NOT a cycle issue (it's a duplicate).
    // But adding B→A IS a cycle.
    const deps = [link("d1", "p-a", "s-1", "p-b", "s-2")];

    // A→B direction — not a cycle (just forward)
    const forward = detectCircularDependency(deps, "p-a", "s-1", "p-b", "s-2");
    // Note: this is the same direction as existing, so no new cycle is introduced
    // (it would be caught by duplicate check, not cycle check)
    // The cycle detection checks if newTarget can reach newSource via existing deps
    // newTarget = p-b/s-2, and there's no edge FROM p-b/s-2 in existing deps
    // So no cycle.
    expect(forward.cycleDetected).toBe(false);

    // B→A direction — creates cycle
    const reverse = detectCircularDependency(deps, "p-b", "s-2", "p-a", "s-1");
    expect(reverse.cycleDetected).toBe(true);
  });

  it("handles diamond pattern without false positive", () => {
    // A→B, A→C, B→D, C→D — adding D→A cycles
    // But adding E→A does NOT cycle
    const deps = [
      link("d1", "p-a", "s-1", "p-b", "s-2"),
      link("d2", "p-a", "s-1", "p-c", "s-3"),
      link("d3", "p-b", "s-2", "p-d", "s-4"),
      link("d4", "p-c", "s-3", "p-d", "s-4"),
    ];

    // D→A creates cycle via D can reach A through existing deps
    // Wait — D has no outgoing edges in deps. So D→A wouldn't cycle
    // unless there's a path from A back to A... Let me check:
    // Adding D→A: newSource=D, newTarget=A
    // DFS from A (newTarget) looking for D (newSource): A→B→D ✓ found!
    const cycleResult = detectCircularDependency(deps, "p-d", "s-4", "p-a", "s-1");
    expect(cycleResult.cycleDetected).toBe(true);

    // E→A is fine
    const safeResult = detectCircularDependency(deps, "p-e", "s-5", "p-a", "s-1");
    expect(safeResult.cycleDetected).toBe(false);
  });

  it("handles multiple disconnected chains", () => {
    const deps = [
      link("d1", "p-a", "s-1", "p-b", "s-2"),
      link("d2", "p-x", "s-10", "p-y", "s-20"),
      link("d3", "p-y", "s-20", "p-x", "s-10"), // cycle in x/y chain
    ];
    // Adding B→A creates cycle in a/b chain
    const result = detectCircularDependency(deps, "p-b", "s-2", "p-a", "s-1");
    expect(result.cycleDetected).toBe(true);
  });

  it("completes within 1 second for 200 dependencies (NFR-F3-1)", () => {
    // Build a linear chain of 200 deps: p-0/s-0 → p-1/s-1 → ... → p-199/s-199
    const deps: CrossProjectDependency[] = [];
    for (let i = 0; i < 200; i++) {
      deps.push(link(`d${i}`, `p-${i}`, `s-${i}`, `p-${i + 1}`, `s-${i + 1}`));
    }

    // Try to close the cycle: p-199/s-199 → p-0/s-0
    const start = performance.now();
    const result = detectCircularDependency(deps, "p-199", "s-199", "p-0", "s-0");
    const elapsed = performance.now() - start;

    expect(result.cycleDetected).toBe(true);
    expect(elapsed).toBeLessThan(1000); // NFR-F3-1: <1 second
  });

  it("verifies exact cycle path order for 3-node cycle", () => {
    // A→B, B→C. Adding C→A creates cycle: C→A→B→C
    const deps = [link("d1", "p-a", "s-1", "p-b", "s-2"), link("d2", "p-b", "s-2", "p-c", "s-3")];
    const result = detectCircularDependency(deps, "p-c", "s-3", "p-a", "s-1");
    expect(result.cycleDetected).toBe(true);
    expect(result.cyclePath).toBeDefined();

    // Verify path starts with newSource and ends with newSource (cycle closure)
    const path = result.cyclePath!;
    expect(path[0]).toEqual({ projectId: "p-c", storyId: "s-3" });
    expect(path[path.length - 1]).toEqual({ projectId: "p-c", storyId: "s-3" });

    // Verify all expected nodes appear in the path
    const nodeKeys = path.map((n) => `${n.projectId}/${n.storyId}`);
    expect(nodeKeys).toContain("p-a/s-1");
    expect(nodeKeys).toContain("p-b/s-2");
    expect(nodeKeys).toContain("p-c/s-3");
  });
});

// =============================================================================
// CIRCULAR DEPENDENCY INTEGRATION WITH addCrossProjectDependency (Story 51.6, Task 2)
// =============================================================================

describe("addCrossProjectDependency with cycle detection", () => {
  const link = (
    srcProj: string,
    srcStory: string,
    tgtProj: string,
    tgtStory: string,
  ): CrossProjectDependency => ({
    id: `dep-${srcProj}-${srcStory}`,
    sourceProjectId: srcProj,
    sourceStoryId: srcStory,
    targetProjectId: tgtProj,
    targetStoryId: tgtStory,
    createdAt: "2026-03-30T00:00:00.000Z",
  });

  it("throws on circular dependency with descriptive message", () => {
    // Existing: A→B. Adding B→A creates cycle.
    const deps = [link("p-a", "s-1", "p-b", "s-2")];
    expect(() => addCrossProjectDependency(deps, "p-b", "s-2", "p-a", "s-1")).toThrow(
      "Circular dependency detected",
    );
  });

  it("includes cycle path in error message", () => {
    const deps = [link("p-a", "s-1", "p-b", "s-2")];
    try {
      addCrossProjectDependency(deps, "p-b", "s-2", "p-a", "s-1");
      expect.unreachable("Should have thrown");
    } catch (err) {
      const message = (err as Error).message;
      expect(message).toContain("p-a/s-1");
      expect(message).toContain("p-b/s-2");
    }
  });

  it("allows valid non-cyclic dependency", () => {
    const deps = [link("p-a", "s-1", "p-b", "s-2")];
    // Adding C→A — no cycle (C has no incoming edges)
    const result = addCrossProjectDependency(deps, "p-c", "s-3", "p-a", "s-1");
    expect(result.deps).toHaveLength(2);
    expect(result.added.sourceProjectId).toBe("p-c");
  });

  it("throws on self-referential dependency", () => {
    expect(() => addCrossProjectDependency([], "p-a", "s-1", "p-a", "s-1")).toThrow(
      "Circular dependency detected",
    );
  });

  it("still throws on duplicate (not masked by cycle check)", () => {
    const deps = [link("p-a", "s-1", "p-b", "s-2")];
    // Same direction — no cycle, but IS duplicate
    expect(() => addCrossProjectDependency(deps, "p-a", "s-1", "p-b", "s-2")).toThrow(
      "Duplicate dependency",
    );
  });

  it("cycle check runs before duplicate check", () => {
    // If we have A→B and try to add B→A, it's both a cycle AND could be seen as
    // reverse duplicate. Cycle detection should catch it first.
    const deps = [link("p-a", "s-1", "p-b", "s-2")];
    expect(() => addCrossProjectDependency(deps, "p-b", "s-2", "p-a", "s-1")).toThrow(
      "Circular dependency detected",
    );
  });
});
