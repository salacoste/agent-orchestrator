import { describe, it, expect } from "vitest";
import {
  validateParameters,
  computeParameterDiff,
  applyParameterDefaults,
  MIN_AGENT_COUNT,
  MAX_AGENT_COUNT,
  MIN_CAPACITY,
  MAX_CAPACITY,
} from "../scenario-params.js";
import type { ScenarioParameters, StoryPriorityOverride } from "../types.js";

function makeParams(overrides: Partial<ScenarioParameters> = {}): ScenarioParameters {
  return {
    agentCount: 3,
    capacityLimit: 2,
    storyPriorities: [],
    ...overrides,
  };
}

function makeOverride(
  storyId: string,
  orig: "high" | "medium" | "low" = "medium",
  next: "high" | "medium" | "low" = "high",
): StoryPriorityOverride {
  return { storyId, originalPriority: orig, newPriority: next };
}

// ---------------------------------------------------------------------------
// validateParameters
// ---------------------------------------------------------------------------

describe("validateParameters", () => {
  it("returns empty array for valid parameters", () => {
    expect(validateParameters(makeParams())).toEqual([]);
  });

  it("returns error for agentCount below minimum", () => {
    const errors = validateParameters(makeParams({ agentCount: 0 }));
    expect(errors).toContain(`Agent count must be at least ${MIN_AGENT_COUNT}`);
  });

  it("returns error for non-integer agentCount", () => {
    const errors = validateParameters(makeParams({ agentCount: 1.5 }));
    expect(errors.some((e) => e.includes("Agent count"))).toBe(true);
  });

  it("returns error for agentCount above maximum", () => {
    const errors = validateParameters(makeParams({ agentCount: MAX_AGENT_COUNT + 1 }));
    expect(errors).toContain(`Agent count must be at most ${MAX_AGENT_COUNT}`);
  });

  it("returns error for capacityLimit below minimum", () => {
    const errors = validateParameters(makeParams({ capacityLimit: 0 }));
    expect(errors).toContain(`Capacity limit must be at least ${MIN_CAPACITY}`);
  });

  it("returns error for non-integer capacityLimit", () => {
    const errors = validateParameters(makeParams({ capacityLimit: 2.5 }));
    expect(errors.some((e) => e.includes("Capacity limit"))).toBe(true);
  });

  it("returns error for capacityLimit above maximum", () => {
    const errors = validateParameters(makeParams({ capacityLimit: MAX_CAPACITY + 1 }));
    expect(errors).toContain(`Capacity limit must be at most ${MAX_CAPACITY}`);
  });

  it("returns error for unknown story ID in overrides", () => {
    const params = makeParams({
      storyPriorities: [makeOverride("nonexistent-story")],
    });
    const errors = validateParameters(params, ["story-1", "story-2"]);
    expect(errors.some((e) => e.includes("not found in scenario"))).toBe(true);
  });

  it("skips story ID check when storyIds not provided", () => {
    const params = makeParams({
      storyPriorities: [makeOverride("any-story-id")],
    });
    expect(validateParameters(params)).toEqual([]);
  });

  it("returns error for duplicate story IDs in overrides", () => {
    const params = makeParams({
      storyPriorities: [
        makeOverride("story-1", "medium", "high"),
        makeOverride("story-1", "medium", "low"),
      ],
    });
    const errors = validateParameters(params);
    expect(errors.some((e) => e.includes("Duplicate story ID"))).toBe(true);
  });

  it("returns error for invalid priority value", () => {
    const params = makeParams({
      storyPriorities: [
        { storyId: "s1", originalPriority: "medium", newPriority: "urgent" as "high" },
      ],
    });
    const errors = validateParameters(params);
    expect(errors.some((e) => e.includes("Invalid priority value"))).toBe(true);
  });

  it("returns error for invalid originalPriority value", () => {
    const params = makeParams({
      storyPriorities: [
        { storyId: "s1", originalPriority: "critical" as "high", newPriority: "high" },
      ],
    });
    const errors = validateParameters(params);
    expect(errors.some((e) => e.includes("Invalid original priority"))).toBe(true);
  });

  it("accepts valid priority overrides", () => {
    const params = makeParams({
      storyPriorities: [
        makeOverride("story-1", "medium", "high"),
        makeOverride("story-2", "medium", "low"),
      ],
    });
    expect(validateParameters(params, ["story-1", "story-2"])).toEqual([]);
  });

  it("returns multiple errors simultaneously", () => {
    const errors = validateParameters({ agentCount: -1, capacityLimit: 0, storyPriorities: [] });
    expect(errors.length).toBeGreaterThanOrEqual(2);
  });
});

// ---------------------------------------------------------------------------
// computeParameterDiff
// ---------------------------------------------------------------------------

describe("computeParameterDiff", () => {
  it("returns no changes for identical parameters", () => {
    const params = makeParams();
    const diff = computeParameterDiff(params, params);
    expect(diff.agentCount).toBeNull();
    expect(diff.capacityLimit).toBeNull();
    expect(diff.priorityChanges).toEqual([]);
    expect(diff.hasChanges).toBe(false);
  });

  it("detects agentCount change", () => {
    const orig = makeParams({ agentCount: 3 });
    const mod = makeParams({ agentCount: 5 });
    const diff = computeParameterDiff(orig, mod);
    expect(diff.agentCount).toEqual({ original: 3, modified: 5 });
    expect(diff.hasChanges).toBe(true);
  });

  it("detects capacityLimit change", () => {
    const orig = makeParams({ capacityLimit: 1 });
    const mod = makeParams({ capacityLimit: 4 });
    const diff = computeParameterDiff(orig, mod);
    expect(diff.capacityLimit).toEqual({ original: 1, modified: 4 });
    expect(diff.hasChanges).toBe(true);
  });

  it("detects priority changes", () => {
    const orig = makeParams();
    const mod = makeParams({
      storyPriorities: [makeOverride("story-1", "medium", "high")],
    });
    const diff = computeParameterDiff(orig, mod);
    expect(diff.priorityChanges).toHaveLength(1);
    expect(diff.priorityChanges[0].storyId).toBe("story-1");
    expect(diff.hasChanges).toBe(true);
  });

  it("uses defaults when original is undefined", () => {
    const mod = makeParams({ agentCount: 5, capacityLimit: 3 });
    const diff = computeParameterDiff(undefined, mod);
    expect(diff.agentCount).toEqual({ original: 1, modified: 5 });
    expect(diff.capacityLimit).toEqual({ original: 1, modified: 3 });
    expect(diff.hasChanges).toBe(true);
  });

  it("returns no changes when modified matches defaults and original is undefined", () => {
    const mod: ScenarioParameters = { agentCount: 1, capacityLimit: 1, storyPriorities: [] };
    const diff = computeParameterDiff(undefined, mod);
    expect(diff.hasChanges).toBe(false);
  });

  it("only reports changed priorities, not unchanged ones", () => {
    const orig = makeParams({
      storyPriorities: [makeOverride("story-1", "medium", "high")],
    });
    const mod = makeParams({
      storyPriorities: [
        makeOverride("story-1", "medium", "high"), // unchanged
        makeOverride("story-2", "medium", "low"), // new change
      ],
    });
    const diff = computeParameterDiff(orig, mod);
    expect(diff.priorityChanges).toHaveLength(1);
    expect(diff.priorityChanges[0].storyId).toBe("story-2");
  });
});

// ---------------------------------------------------------------------------
// applyParameterDefaults
// ---------------------------------------------------------------------------

describe("applyParameterDefaults", () => {
  it("returns existing parameters unchanged", () => {
    const existing = makeParams({ agentCount: 7, capacityLimit: 3 });
    const result = applyParameterDefaults(existing, 2);
    expect(result).toBe(existing);
  });

  it("returns defaults when no existing parameters", () => {
    const result = applyParameterDefaults(undefined, 4);
    expect(result.agentCount).toBe(4);
    expect(result.capacityLimit).toBe(1);
    expect(result.storyPriorities).toEqual([]);
  });

  it("uses fallback agentCount of 1 when no config default", () => {
    const result = applyParameterDefaults(undefined, 1);
    expect(result.agentCount).toBe(1);
  });
});
