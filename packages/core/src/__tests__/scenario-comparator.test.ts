/**
 * Scenario comparator tests (Story 48.3).
 */
import { describe, expect, it } from "vitest";
import { compareScenarios, type Scenario } from "../scenario-comparator.js";
import type { SimulationResult } from "../sprint-simulator.js";

function makeResult(overrides: Partial<SimulationResult> = {}): SimulationResult {
  return {
    p50Days: 5,
    p80Days: 7,
    p95Days: 10,
    onTimeProbability: 0.75,
    confidence: 0.8,
    iterationsRun: 1000,
    ...overrides,
  };
}

describe("compareScenarios", () => {
  it("ranks by on-time probability descending", () => {
    const scenarios: Scenario[] = [
      { name: "Full scope", storyCount: 20, result: makeResult({ onTimeProbability: 0.4 }) },
      { name: "Reduced", storyCount: 15, result: makeResult({ onTimeProbability: 0.85 }) },
      { name: "Minimal", storyCount: 8, result: makeResult({ onTimeProbability: 0.95 }) },
    ];

    const comparison = compareScenarios(scenarios);

    expect(comparison.scenarios[0].name).toBe("Minimal");
    expect(comparison.scenarios[0].rank).toBe(1);
    expect(comparison.scenarios[1].name).toBe("Reduced");
    expect(comparison.scenarios[2].name).toBe("Full scope");
  });

  it("recommends scenario with highest probability", () => {
    const scenarios: Scenario[] = [
      { name: "A", storyCount: 10, result: makeResult({ onTimeProbability: 0.6 }) },
      { name: "B", storyCount: 8, result: makeResult({ onTimeProbability: 0.9 }) },
    ];

    const comparison = compareScenarios(scenarios);

    expect(comparison.scenarios[0].isRecommended).toBe(true);
    expect(comparison.scenarios[0].name).toBe("B");
    expect(comparison.scenarios[1].isRecommended).toBe(false);
    expect(comparison.recommendedIndex).toBe(1); // B was at index 1 in original
  });

  it("breaks ties by fewer stories", () => {
    const scenarios: Scenario[] = [
      { name: "Large", storyCount: 20, result: makeResult({ onTimeProbability: 0.75 }) },
      { name: "Small", storyCount: 10, result: makeResult({ onTimeProbability: 0.75 }) },
    ];

    const comparison = compareScenarios(scenarios);

    expect(comparison.scenarios[0].name).toBe("Small");
  });

  it("assigns correct colors", () => {
    const scenarios: Scenario[] = [
      { name: "Green", storyCount: 5, result: makeResult({ onTimeProbability: 0.9 }) },
      { name: "Amber", storyCount: 10, result: makeResult({ onTimeProbability: 0.6 }) },
      { name: "Red", storyCount: 20, result: makeResult({ onTimeProbability: 0.3 }) },
    ];

    const comparison = compareScenarios(scenarios);

    expect(comparison.scenarios[0].color).toBe("green");
    expect(comparison.scenarios[1].color).toBe("amber");
    expect(comparison.scenarios[2].color).toBe("red");
  });

  it("handles single scenario", () => {
    const scenarios: Scenario[] = [{ name: "Only", storyCount: 10, result: makeResult() }];

    const comparison = compareScenarios(scenarios);

    expect(comparison.scenarios).toHaveLength(1);
    expect(comparison.scenarios[0].isRecommended).toBe(true);
    expect(comparison.recommendedIndex).toBe(0);
  });

  it("handles empty input", () => {
    const comparison = compareScenarios([]);

    expect(comparison.scenarios).toHaveLength(0);
    expect(comparison.recommendedIndex).toBe(-1);
  });
});
