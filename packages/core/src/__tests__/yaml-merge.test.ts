/**
 * Tests for YAML Three-Way Merge Utility
 */

import { describe, it, expect, beforeEach } from "vitest";
import { YamlMerger, threeWayMerge, type MergeConflict } from "../utils/yaml-merge.js";

describe("YamlMerger", () => {
  let merger: YamlMerger;

  beforeEach(() => {
    merger = new YamlMerger();
  });

  describe("threeWayMerge", () => {
    it("should merge non-conflicting changes from both sides", async () => {
      const base = {
        story1: { status: "backlog" },
        story2: { status: "backlog" },
      };
      const ours = {
        story1: { status: "in-progress" },
        story2: { status: "backlog" },
      };
      const theirs = {
        story1: { status: "backlog" },
        story2: { status: "in-progress" },
      };

      const result = await merger.threeWayMerge(base, ours, theirs);

      expect(result.success).toBe(true);
      expect(result.merged).toEqual({
        story1: { status: "in-progress" },
        story2: { status: "in-progress" },
      });
      expect(result.conflictCount).toBe(0);
      expect(result.autoMergedCount).toBeGreaterThan(0);
    });

    it("should return base when no changes made", async () => {
      const base = { story1: { status: "backlog" } };
      const ours = { story1: { status: "backlog" } };
      const theirs = { story1: { status: "backlog" } };

      const result = await merger.threeWayMerge(base, ours, theirs);

      expect(result.success).toBe(true);
      expect(result.merged).toEqual(base);
    });

    it("should accept our changes when theirs unchanged", async () => {
      const base = { status: "backlog", priority: "high" };
      const ours = { status: "in-progress", priority: "high" };
      const theirs = { status: "backlog", priority: "high" };

      const result = await merger.threeWayMerge(base, ours, theirs);

      expect(result.success).toBe(true);
      expect((result.merged as Record<string, unknown>).status).toBe("in-progress");
    });

    it("should accept their changes when ours unchanged", async () => {
      const base = { status: "backlog", priority: "high" };
      const ours = { status: "backlog", priority: "high" };
      const theirs = { status: "backlog", priority: "low" };

      const result = await merger.threeWayMerge(base, ours, theirs);

      expect(result.success).toBe(true);
      expect((result.merged as Record<string, unknown>).priority).toBe("low");
    });

    it("should detect conflicts when both sides modify same field differently", async () => {
      const base = { story1: { status: "backlog" } };
      const ours = { story1: { status: "in-progress" } };
      const theirs = { story1: { status: "blocked" } };

      const result = await merger.threeWayMerge(base, ours, theirs);

      expect(result.success).toBe(false);
      expect(result.conflicts).toHaveLength(1);
      expect(result.conflicts![0].path).toBe("story1.status");
      expect(result.conflicts![0].base).toBe("backlog");
      expect(result.conflicts![0].ours).toBe("in-progress");
      expect(result.conflicts![0].theirs).toBe("blocked");
    });

    it("should not conflict when both sides make same change", async () => {
      const base = { status: "backlog" };
      const ours = { status: "in-progress" };
      const theirs = { status: "in-progress" };

      const result = await merger.threeWayMerge(base, ours, theirs);

      expect(result.success).toBe(true);
      expect((result.merged as Record<string, unknown>).status).toBe("in-progress");
    });

    it("should handle nested object merges", async () => {
      const base = {
        epic1: {
          story1: { status: "backlog", priority: "high" },
          story2: { status: "backlog", priority: "low" },
        },
      };
      const ours = {
        epic1: {
          story1: { status: "in-progress", priority: "high" },
          story2: { status: "backlog", priority: "low" },
        },
      };
      const theirs = {
        epic1: {
          story1: { status: "backlog", priority: "high" },
          story2: { status: "done", priority: "low" },
        },
      };

      const result = await merger.threeWayMerge(base, ours, theirs);

      expect(result.success).toBe(true);
      const merged = result.merged as {
        epic1: { story1: { status: string }; story2: { status: string } };
      };
      expect(merged.epic1.story1.status).toBe("in-progress");
      expect(merged.epic1.story2.status).toBe("done");
    });

    it("should handle null and undefined values", async () => {
      const base = { field: null };
      const ours = { field: "value" };
      const theirs = { field: null };

      const result = await merger.threeWayMerge(base, ours, theirs);

      expect(result.success).toBe(true);
      expect((result.merged as Record<string, unknown>).field).toBe("value");
    });

    it("should handle array conflicts", async () => {
      const base = { tags: ["a", "b"] };
      const ours = { tags: ["a", "b", "c"] };
      const theirs = { tags: ["a", "b", "d"] };

      const result = await merger.threeWayMerge(base, ours, theirs);

      expect(result.success).toBe(false);
      expect(result.conflicts).toHaveLength(1);
      expect(result.conflicts![0].path).toBe("tags");
    });

    it("should accept array change from one side", async () => {
      const base = { tags: ["a", "b"] };
      const ours = { tags: ["a", "b", "c"] };
      const theirs = { tags: ["a", "b"] };

      const result = await merger.threeWayMerge(base, ours, theirs);

      expect(result.success).toBe(true);
      expect((result.merged as Record<string, string[]>).tags).toEqual(["a", "b", "c"]);
    });

    it("should handle added fields from both sides", async () => {
      const base = { field1: "value1" };
      const ours = { field1: "value1", field2: "ours-value" };
      const theirs = { field1: "value1", field3: "theirs-value" };

      const result = await merger.threeWayMerge(base, ours, theirs);

      expect(result.success).toBe(true);
      const merged = result.merged as Record<string, unknown>;
      expect(merged.field2).toBe("ours-value");
      expect(merged.field3).toBe("theirs-value");
    });

    it("should respect maxDepth option", async () => {
      const base = { level1: { level2: { level3: { value: "base" } } } };
      const ours = { level1: { level2: { level3: { value: "ours" } } } };
      const theirs = { level1: { level2: { level3: { value: "theirs" } } } };

      const result = await merger.threeWayMerge(base, ours, theirs, { maxDepth: 2 });

      // At depth 2, the nested object should be treated as a primitive and conflict
      expect(result.conflicts).toBeDefined();
    });
  });

  describe("resolveConflicts", () => {
    it("should resolve conflict using ours", async () => {
      const base = { status: "backlog" };
      const ours = { status: "in-progress" };
      const theirs = { status: "blocked" };

      const mergeResult = await merger.threeWayMerge(base, ours, theirs);
      expect(mergeResult.conflicts).toBeDefined();

      const resolutions = new Map([["status", "ours" as const]]);
      const resolved = await merger.resolveConflicts(
        base,
        ours,
        theirs,
        mergeResult.conflicts!,
        resolutions,
      );

      expect((resolved as Record<string, unknown>).status).toBe("in-progress");
    });

    it("should resolve conflict using theirs", async () => {
      const base = { status: "backlog" };
      const ours = { status: "in-progress" };
      const theirs = { status: "blocked" };

      const mergeResult = await merger.threeWayMerge(base, ours, theirs);

      const resolutions = new Map([["status", "theirs" as const]]);
      const resolved = await merger.resolveConflicts(
        base,
        ours,
        theirs,
        mergeResult.conflicts!,
        resolutions,
      );

      expect((resolved as Record<string, unknown>).status).toBe("blocked");
    });

    it("should resolve conflict using base", async () => {
      const base = { status: "backlog" };
      const ours = { status: "in-progress" };
      const theirs = { status: "blocked" };

      const mergeResult = await merger.threeWayMerge(base, ours, theirs);

      const resolutions = new Map([["status", "base" as const]]);
      const resolved = await merger.resolveConflicts(
        base,
        ours,
        theirs,
        mergeResult.conflicts!,
        resolutions,
      );

      expect((resolved as Record<string, unknown>).status).toBe("backlog");
    });

    it("should resolve conflict using manual value", async () => {
      const base = { status: "backlog" };
      const ours = { status: "in-progress" };
      const theirs = { status: "blocked" };

      const mergeResult = await merger.threeWayMerge(base, ours, theirs);

      const resolutions = new Map([["status", { resolution: "manual" as const, value: "done" }]]);
      const resolved = await merger.resolveConflicts(
        base,
        ours,
        theirs,
        mergeResult.conflicts!,
        resolutions,
      );

      expect((resolved as Record<string, unknown>).status).toBe("done");
    });
  });

  describe("formatConflictMarkers", () => {
    it("should format conflict in git-style markers", () => {
      const conflict: MergeConflict = {
        path: "status",
        base: "backlog",
        ours: "in-progress",
        theirs: "blocked",
      };

      const markers = merger.formatConflictMarkers(conflict);

      expect(markers).toContain("<<<<<<< ours");
      expect(markers).toContain("in-progress");
      expect(markers).toContain("=======");
      expect(markers).toContain("blocked");
      expect(markers).toContain(">>>>>>> theirs");
      expect(markers).toContain("||||||| base");
      expect(markers).toContain("backlog");
    });
  });

  describe("mergeHistory", () => {
    it("should track merge history", async () => {
      const base = { status: "backlog" };
      const ours = { status: "in-progress" };
      const theirs = { status: "backlog" };

      await merger.threeWayMerge(base, ours, theirs);

      const history = merger.getHistory();
      expect(history).toHaveLength(1);
      expect(history[0].success).toBe(true);
      expect(history[0].autoMergedCount).toBeGreaterThan(0);
    });

    it("should track conflict history", async () => {
      const base = { status: "backlog" };
      const ours = { status: "in-progress" };
      const theirs = { status: "blocked" };

      await merger.threeWayMerge(base, ours, theirs);

      const history = merger.getHistory();
      expect(history).toHaveLength(1);
      expect(history[0].success).toBe(false);
      expect(history[0].conflictCount).toBe(1);
    });

    it("should clear history", async () => {
      const base = { status: "backlog" };

      await merger.threeWayMerge(base, { status: "done" }, base);
      expect(merger.getHistory()).toHaveLength(1);

      merger.clearHistory();
      expect(merger.getHistory()).toHaveLength(0);
    });

    it("should limit history size", async () => {
      const base = { count: 0 };

      // Add more than maxHistorySize entries
      for (let i = 0; i < 150; i++) {
        await merger.threeWayMerge(base, { count: i }, base);
      }

      const history = merger.getHistory();
      expect(history.length).toBeLessThanOrEqual(100);
    });
  });
});

describe("threeWayMerge convenience function", () => {
  it("should work as standalone function", async () => {
    const base = { a: 1 };
    const ours = { a: 2 };
    const theirs = { a: 1 };

    const result = await threeWayMerge(base, ours, theirs);

    expect(result.success).toBe(true);
    expect((result.merged as Record<string, number>).a).toBe(2);
  });
});

describe("complex merge scenarios", () => {
  let merger: YamlMerger;

  beforeEach(() => {
    merger = new YamlMerger();
  });

  it("should handle sprint status YAML merge", async () => {
    const base = {
      development_status: {
        "story-1": "backlog",
        "story-2": "backlog",
      },
      limitations: {},
    };

    const ours = {
      development_status: {
        "story-1": "in-progress",
        "story-2": "backlog",
      },
      limitations: {},
    };

    const theirs = {
      development_status: {
        "story-1": "backlog",
        "story-2": "done",
      },
      limitations: {},
    };

    const result = await merger.threeWayMerge(base, ours, theirs);

    expect(result.success).toBe(true);
    const merged = result.merged as {
      development_status: Record<string, string>;
    };
    expect(merged.development_status["story-1"]).toBe("in-progress");
    expect(merged.development_status["story-2"]).toBe("done");
  });

  it("should handle multiple conflicts", async () => {
    // Create a scenario where BOTH story1.status AND story2.status are changed by both sides
    const base = {
      story1: { status: "backlog", priority: "high" },
      story2: { status: "backlog", priority: "low" },
    };

    const ours = {
      story1: { status: "in-progress", priority: "high" },
      story2: { status: "review", priority: "low" },
    };

    const theirs = {
      story1: { status: "blocked", priority: "high" },
      story2: { status: "done", priority: "low" },
    };

    const result = await merger.threeWayMerge(base, ours, theirs);

    expect(result.success).toBe(false);
    // Both story1.status and story2.status are changed by both sides differently
    expect(result.conflicts).toHaveLength(2);
    const paths = result.conflicts!.map((c) => c.path);
    expect(paths).toContain("story1.status");
    expect(paths).toContain("story2.status");
  });

  it("should handle empty objects", async () => {
    const base = {};
    const ours = { field: "value" };
    const theirs = {};

    const result = await merger.threeWayMerge(base, ours, theirs);

    expect(result.success).toBe(true);
    expect((result.merged as Record<string, string>).field).toBe("value");
  });

  it("should handle deleted fields", async () => {
    const base = { keep: "value", remove: "value" };
    const ours = { keep: "value" }; // remove field deleted
    const theirs = { keep: "value", remove: "value" };

    const result = await merger.threeWayMerge(base, ours, theirs);

    // When we delete a field and theirs doesn't change, deletion should be kept
    expect(result.success).toBe(true);
  });
});
