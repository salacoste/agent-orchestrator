import { describe, it, expect } from "vitest";
import { buildSimulationInput, applyParallelismScaling } from "../scenario-simulation.js";
import type { ScenarioStorySnapshot, ScenarioParameters, StoryPriorityOverride } from "../types.js";
import type { SimulationResult } from "@composio/ao-core";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeStory(id: string, tags: string[] = ["backend"]): ScenarioStorySnapshot {
  return { id, projectId: "alpha", status: "ready-for-dev", domainTags: tags };
}

function makeParams(overrides: Partial<ScenarioParameters> = {}): ScenarioParameters {
  return {
    agentCount: 2,
    capacityLimit: 1,
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

function makeScenario(stories: ScenarioStorySnapshot[], params?: ScenarioParameters) {
  return {
    id: "test-id",
    name: "Test",
    createdAt: new Date().toISOString(),
    projectIds: ["alpha"],
    stories,
    status: "draft" as const,
    parameters: params,
  };
}

// ---------------------------------------------------------------------------
// buildSimulationInput
// ---------------------------------------------------------------------------

describe("buildSimulationInput", () => {
  it("converts stories to SimStory[] with domainTags", () => {
    const stories = [makeStory("s1", ["backend"]), makeStory("s2", ["frontend", "api"])];
    const scenario = makeScenario(stories, makeParams());
    const input = buildSimulationInput(scenario, []);
    expect(input.stories).toHaveLength(2);
    expect(input.stories[0]).toEqual({ id: "s1", domainTags: ["backend"] });
    expect(input.stories[1]).toEqual({ id: "s2", domainTags: ["frontend", "api"] });
  });

  it("applies priority ordering — high priority stories first", () => {
    const stories = [makeStory("s1"), makeStory("s2"), makeStory("s3")];
    const params = makeParams({
      storyPriorities: [makeOverride("s2", "medium", "high")],
    });
    const scenario = makeScenario(stories, params);
    const input = buildSimulationInput(scenario, []);
    // s2 has high priority → should be first
    expect(input.stories[0].id).toBe("s2");
  });

  it("maps stories without overrides as medium priority", () => {
    const stories = [makeStory("s1"), makeStory("s2")];
    const params = makeParams({
      storyPriorities: [makeOverride("s1", "medium", "high")],
    });
    const scenario = makeScenario(stories, params);
    const input = buildSimulationInput(scenario, []);
    // s1 (high) first, then s2 (medium)
    expect(input.stories[0].id).toBe("s1");
    expect(input.stories[1].id).toBe("s2");
  });

  it("sorts high before medium before low", () => {
    const stories = [makeStory("low-1"), makeStory("high-1"), makeStory("med-1")];
    const params = makeParams({
      storyPriorities: [
        makeOverride("low-1", "medium", "low"),
        makeOverride("high-1", "medium", "high"),
      ],
    });
    const scenario = makeScenario(stories, params);
    const input = buildSimulationInput(scenario, []);
    expect(input.stories.map((s) => s.id)).toEqual(["high-1", "med-1", "low-1"]);
  });

  it("uses default iterations (1000)", () => {
    const scenario = makeScenario([makeStory("s1")], makeParams());
    const input = buildSimulationInput(scenario, []);
    expect(input.iterations).toBe(1000);
  });

  it("passes learnings through", () => {
    const learnings = [
      {
        sessionId: "a",
        agentId: "a",
        storyId: "s1",
        projectId: "alpha",
        outcome: "completed" as const,
        domainTags: ["backend"],
        durationMinutes: 30,
        timestamp: "",
      },
    ];
    const scenario = makeScenario([makeStory("s1")], makeParams());
    const input = buildSimulationInput(scenario, learnings);
    expect(input.learnings).toBe(learnings);
  });

  it("handles empty stories array", () => {
    const scenario = makeScenario([], makeParams());
    const input = buildSimulationInput(scenario, []);
    expect(input.stories).toEqual([]);
  });

  it("handles empty learnings array", () => {
    const scenario = makeScenario([makeStory("s1")], makeParams());
    const input = buildSimulationInput(scenario, []);
    expect(input.learnings).toEqual([]);
  });

  it("uses default parameters when scenario has no parameters", () => {
    const scenario = makeScenario([makeStory("s1")]);
    // @ts-expect-error — testing undefined parameters
    scenario.parameters = undefined;
    const input = buildSimulationInput(scenario, []);
    expect(input.stories).toHaveLength(1);
    expect(input.iterations).toBe(1000);
  });
});

// ---------------------------------------------------------------------------
// applyParallelismScaling
// ---------------------------------------------------------------------------

describe("applyParallelismScaling", () => {
  function makeResult(days: number): SimulationResult {
    return {
      p50Days: days,
      p80Days: days * 1.3,
      p95Days: days * 1.6,
      onTimeProbability: 0.8,
      confidence: 0.75,
      iterationsRun: 1000,
    };
  }

  it("divides days by effectiveConcurrency", () => {
    const result = makeResult(20);
    // agentCount=4, capacityLimit=2 → effectiveConcurrency=8
    const scaled = applyParallelismScaling(result, 4, 2);
    expect(scaled.p50Days).toBe(20 / 8);
    expect(scaled.p80Days).toBeCloseTo((20 * 1.3) / 8);
    expect(scaled.p95Days).toBeCloseTo((20 * 1.6) / 8);
  });

  it("clamps minimum to 1 day", () => {
    const result = makeResult(0.5);
    // effectiveConcurrency = 10 * 5 = 50, raw = 0.5/50 = 0.01
    const scaled = applyParallelismScaling(result, 10, 5);
    expect(scaled.p50Days).toBe(1);
    expect(scaled.p80Days).toBe(1);
    expect(scaled.p95Days).toBe(1);
  });

  it("returns unchanged when agentCount=1 capacityLimit=1", () => {
    const result = makeResult(15);
    const scaled = applyParallelismScaling(result, 1, 1);
    expect(scaled.p50Days).toBe(15);
    expect(scaled.p80Days).toBeCloseTo(15 * 1.3);
  });

  it("preserves non-day fields unchanged", () => {
    const result = makeResult(10);
    const scaled = applyParallelismScaling(result, 2, 1);
    expect(scaled.onTimeProbability).toBe(0.8);
    expect(scaled.confidence).toBe(0.75);
    expect(scaled.iterationsRun).toBe(1000);
  });

  it("handles edge case: result with very low days (just above clamp)", () => {
    const result: SimulationResult = {
      p50Days: 3,
      p80Days: 1.5,
      p95Days: 1.1,
      onTimeProbability: 0.9,
      confidence: 0.8,
      iterationsRun: 1000,
    };
    const scaled = applyParallelismScaling(result, 1, 1);
    expect(scaled.p50Days).toBe(3);
    expect(scaled.p80Days).toBe(1.5);
    expect(scaled.p95Days).toBe(1.1);
  });
});
