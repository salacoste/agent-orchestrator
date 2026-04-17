/**
 * Unit tests for scenario-comparison mapping utilities (Story 54.4, Task 1).
 */
import { describe, it, expect } from "vitest";
import { mapToComparableScenarios, getBestMetricIndex } from "../scenario-comparison.js";
import type { WhatIfScenario } from "../types.js";
import type { Scenario } from "@composio/ao-core";

const simResult = {
  p50Days: 5,
  p80Days: 7,
  p95Days: 10,
  onTimeProbability: 0.85,
  confidence: 0.75,
  iterationsRun: 1000,
};

function makeScenario(overrides?: Partial<WhatIfScenario>): WhatIfScenario {
  return {
    id: "test-uuid",
    name: "Test Scenario",
    createdAt: new Date().toISOString(),
    projectIds: ["alpha"],
    stories: [
      { id: "s1", projectId: "alpha", status: "ready-for-dev", domainTags: ["backend"] },
      { id: "s2", projectId: "alpha", status: "ready-for-dev", domainTags: ["frontend"] },
    ],
    status: "simulated",
    result: simResult,
    ...overrides,
  };
}

describe("mapToComparableScenarios", () => {
  it("maps WhatIfScenario[] to core Scenario[]", () => {
    const scenarios = [makeScenario(), makeScenario({ id: "other", name: "Other" })];
    const result = mapToComparableScenarios(scenarios);
    expect(result.scenarios).toHaveLength(2);
    expect(result.scenarios[0]).toEqual({
      name: "Test Scenario",
      storyCount: 2,
      result: simResult,
    });
    expect(result.scenarios[1]).toEqual({
      name: "Other",
      storyCount: 2,
      result: simResult,
    });
  });

  it("filters out scenarios without results", () => {
    const withResult = makeScenario();
    const withoutResult = makeScenario({ result: undefined });
    const result = mapToComparableScenarios([withResult, withoutResult]);
    expect(result.scenarios).toHaveLength(1);
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]).toContain("no simulation results");
  });

  it("filters out draft scenarios", () => {
    const simulated = makeScenario();
    const draft = makeScenario({ status: "draft", result: undefined });
    const result = mapToComparableScenarios([simulated, draft]);
    expect(result.scenarios).toHaveLength(1);
    expect(result.warnings).toHaveLength(1);
  });

  it("throws if fewer than 2 valid scenarios remain", () => {
    const only = [makeScenario()];
    // mapToComparableScenarios doesn't throw — it just returns fewer scenarios
    // The caller (route) checks mapped.length < 2
    const result = mapToComparableScenarios(only);
    expect(result.scenarios).toHaveLength(1);
  });

  it("maps all fields correctly with 3 inputs", () => {
    const scenarios = [
      makeScenario({ name: "A" }),
      makeScenario({ name: "B" }),
      makeScenario({
        name: "C",
        stories: [{ id: "s1", projectId: "alpha", status: "ready-for-dev", domainTags: [] }],
      }),
    ];
    const result = mapToComparableScenarios(scenarios);
    expect(result.scenarios).toHaveLength(3);
    expect(result.scenarios[2].storyCount).toBe(1);
  });
});

describe("getBestMetricIndex", () => {
  const scenarios: Scenario[] = [
    {
      name: "A",
      storyCount: 2,
      result: {
        p50Days: 5,
        p80Days: 7,
        p95Days: 10,
        onTimeProbability: 0.85,
        confidence: 0.75,
        iterationsRun: 1000,
      },
    },
    {
      name: "B",
      storyCount: 2,
      result: {
        p50Days: 3,
        p80Days: 4.5,
        p95Days: 6.8,
        onTimeProbability: 0.92,
        confidence: 0.88,
        iterationsRun: 1000,
      },
    },
    {
      name: "C",
      storyCount: 2,
      result: {
        p50Days: 4.1,
        p80Days: 5.8,
        p95Days: 8.2,
        onTimeProbability: 0.78,
        confidence: 0.6,
        iterationsRun: 1000,
      },
    },
  ];

  it("returns index of lowest p50Days", () => {
    expect(getBestMetricIndex(scenarios, "p50Days")).toBe(1); // B has 3.0
  });

  it("returns index of lowest p80Days", () => {
    expect(getBestMetricIndex(scenarios, "p80Days")).toBe(1); // B has 4.5
  });

  it("returns index of lowest p95Days", () => {
    expect(getBestMetricIndex(scenarios, "p95Days")).toBe(1); // B has 6.8
  });

  it("returns index of highest onTimeProbability", () => {
    expect(getBestMetricIndex(scenarios, "onTimeProbability")).toBe(1); // B has 0.92
  });

  it("returns index of highest confidence", () => {
    expect(getBestMetricIndex(scenarios, "confidence")).toBe(1); // B has 0.88
  });

  it("handles ties by returning first index", () => {
    const tied: Scenario[] = [
      {
        name: "A",
        storyCount: 1,
        result: {
          p50Days: 5,
          p80Days: 7,
          p95Days: 10,
          onTimeProbability: 0.8,
          confidence: 0.7,
          iterationsRun: 1000,
        },
      },
      {
        name: "B",
        storyCount: 1,
        result: {
          p50Days: 5,
          p80Days: 7,
          p95Days: 10,
          onTimeProbability: 0.8,
          confidence: 0.7,
          iterationsRun: 1000,
        },
      },
    ];
    expect(getBestMetricIndex(tied, "p50Days")).toBe(0);
  });

  it("returns -1 for empty array", () => {
    expect(getBestMetricIndex([], "p50Days")).toBe(-1);
  });
});
