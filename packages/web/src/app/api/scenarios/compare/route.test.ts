/**
 * GET /api/scenarios/compare — route tests (Story 54.4, Task 2).
 */
import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/scenario-store", () => ({
  getScenario: vi.fn(),
}));

vi.mock("@/lib/scenario-comparison.js", () => ({
  mapToComparableScenarios: vi.fn(),
}));

vi.mock("@composio/ao-core", () => ({
  compareScenarios: vi.fn(),
}));

import { GET } from "./route.js";
import { getScenario } from "@/lib/scenario-store";
import { mapToComparableScenarios } from "@/lib/scenario-comparison";
import { compareScenarios, type SimulationResult } from "@composio/ao-core";
import type { WhatIfScenario } from "@/lib/types";

const mockGetScenario = vi.mocked(getScenario);
const mockMap = vi.mocked(mapToComparableScenarios);
const mockCompare = vi.mocked(compareScenarios);

const simResult: SimulationResult = {
  p50Days: 5,
  p80Days: 7,
  p95Days: 10,
  onTimeProbability: 0.85,
  confidence: 0.75,
  iterationsRun: 1000,
};

const baseScenario: WhatIfScenario = {
  id: "scen-1",
  name: "Test Scenario A",
  createdAt: new Date().toISOString(),
  projectIds: ["alpha"],
  stories: [
    { id: "s1", projectId: "alpha", status: "ready-for-dev", domainTags: ["backend"] },
    { id: "s2", projectId: "alpha", status: "ready-for-dev", domainTags: ["frontend"] },
  ],
  status: "simulated",
  result: simResult,
  parameters: { agentCount: 2, capacityLimit: 2, storyPriorities: [] },
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/scenarios/compare", () => {
  it("returns comparison for 2 valid scenarios", async () => {
    const scenB: WhatIfScenario = {
      ...baseScenario,
      id: "scen-2",
      name: "Test Scenario B",
      result: { ...simResult, onTimeProbability: 0.92 },
    };

    mockGetScenario.mockImplementation(async (id: string) => {
      if (id === "scen-1") return scenB;
      if (id === "scen-2") return baseScenario;
      return undefined;
    });
    mockMap.mockReturnValue({
      scenarios: [
        { name: "Test Scenario B", storyCount: 2, result: scenB.result! },
        { name: "Test Scenario A", storyCount: 2, result: simResult },
      ],
      warnings: [],
    });
    mockCompare.mockReturnValue({
      scenarios: [
        {
          name: "Test Scenario B",
          storyCount: 2,
          result: { ...simResult, onTimeProbability: 0.92 },
          rank: 1,
          color: "green" as const,
          isRecommended: true,
        },
        {
          name: "Test Scenario A",
          storyCount: 2,
          result: simResult,
          rank: 2,
          color: "green" as const,
          isRecommended: false,
        },
      ],
      recommendedIndex: 1,
    });

    const res = await GET(new Request("http://localhost/api/scenarios/compare?ids=scen-1,scen-2"));
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.scenarios).toHaveLength(2);
    expect(data.scenarios[0].rank).toBe(1);
    expect(data.scenarios[0].name).toBe("Test Scenario B");
    expect(data.scenarios[1].rank).toBe(2);
    expect(data.warnings).toEqual([]);
  });

  it("returns comparison for 4 valid scenarios", async () => {
    const scenarios = [baseScenario];
    for (let i = 1; i <= 3; i++) {
      scenarios.push({
        ...baseScenario,
        id: `scen-${i + 1}`,
        name: `Test Scenario ${String.fromCharCode(65 + i)}`,
      });
    }

    mockGetScenario.mockImplementation(async (id: string) => {
      const s = scenarios.find((sc) => sc.id === id);
      return s;
    });
    mockMap.mockReturnValue({
      scenarios: scenarios.map((s) => ({
        name: s.name,
        storyCount: s.stories.length,
        result: s.result!,
      })),
      warnings: [],
    });
    mockCompare.mockReturnValue({
      scenarios: scenarios.map((s, i) => ({
        name: s.name,
        storyCount: s.stories.length,
        result: s.result!,
        rank: i + 1,
        color: "green" as const,
        isRecommended: i === 0,
      })),
      recommendedIndex: 0,
    });

    const res = await GET(
      new Request("http://localhost/api/scenarios/compare?ids=scen-1,scen-2,scen-3,scen-4"),
    );
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.scenarios).toHaveLength(4);
  });

  it("returns 400 for fewer than 2 IDs", async () => {
    const res = await GET(new Request("http://localhost/api/scenarios/compare?ids=scen-1"));
    expect(res.status).toBe(400);

    const data = await res.json();
    expect(data.error).toContain("At least 2");
  });

  it("returns 400 for more than 4 IDs", async () => {
    const res = await GET(new Request("http://localhost/api/scenarios/compare?ids=a,b,c,d,e"));
    expect(res.status).toBe(400);

    const data = await res.json();
    expect(data.error).toContain("Maximum 4");
  });

  it("returns 404 when scenario not found", async () => {
    mockGetScenario.mockResolvedValue(undefined);

    const res = await GET(
      new Request("http://localhost/api/scenarios/compare?ids=missing1,missing2"),
    );
    expect(res.status).toBe(404);

    const data = await res.json();
    expect(data.error).toContain("not found");
  });

  it("returns warnings for scenarios without results", async () => {
    const withoutResult = { ...baseScenario, result: undefined };
    mockGetScenario.mockImplementation(async (id: string) => {
      if (id === "scen-1") return withoutResult;
      if (id === "scen-2") return baseScenario;
      return undefined;
    });
    mockMap.mockReturnValue({
      scenarios: [{ name: "Test Scenario A", storyCount: 2, result: simResult }],
      warnings: ["Scenario 'Test Scenario A' has no simulation results"],
    });
    mockCompare.mockReturnValue({
      scenarios: [],
      recommendedIndex: -1,
    });

    const res = await GET(new Request("http://localhost/api/scenarios/compare?ids=scen-1,scen-2"));
    // Only 1 valid after mapping — should be 400
    expect(res.status).toBe(400);

    const data = await res.json();
    expect(data.warnings).toHaveLength(1);
  });

  it("returns ranked scenarios in correct order", async () => {
    const highProb = { ...simResult, onTimeProbability: 0.95 };
    const lowProb = { ...simResult, onTimeProbability: 0.65 };

    mockGetScenario.mockImplementation(async (id: string) => {
      if (id === "high")
        return { ...baseScenario, id: "high", name: "High Prob", result: highProb };
      if (id === "low") return { ...baseScenario, id: "low", name: "Low Prob", result: lowProb };
      return undefined;
    });
    mockMap.mockReturnValue({
      scenarios: [
        { name: "High Prob", storyCount: 2, result: highProb },
        { name: "Low Prob", storyCount: 2, result: lowProb },
      ],
      warnings: [],
    });
    mockCompare.mockReturnValue({
      scenarios: [
        {
          name: "High Prob",
          storyCount: 2,
          result: highProb,
          rank: 1,
          color: "green" as const,
          isRecommended: true,
        },
        {
          name: "Low Prob",
          storyCount: 2,
          result: lowProb,
          rank: 2,
          color: "amber" as const,
          isRecommended: false,
        },
      ],
      recommendedIndex: 0,
    });

    const res = await GET(new Request("http://localhost/api/scenarios/compare?ids=low,high"));
    expect(res.status).toBe(200);

    const data = await res.json();
    // First scenario should be rank 1 (highest probability)
    expect(data.scenarios[0].rank).toBe(1);
  });

  it("returns 400 when missing ids parameter", async () => {
    const res = await GET(new Request("http://localhost/api/scenarios/compare"));
    expect(res.status).toBe(400);

    const data = await res.json();
    expect(data.error).toContain("Missing");
  });

  it("deduplicates duplicate IDs", async () => {
    mockGetScenario.mockImplementation(async (id: string) => {
      if (id === "scen-1") return baseScenario;
      if (id === "scen-2") return { ...baseScenario, id: "scen-2", name: "Scenario B" };
      return undefined;
    });
    mockMap.mockReturnValue({
      scenarios: [
        { name: "Test Scenario A", storyCount: 2, result: simResult },
        { name: "Scenario B", storyCount: 2, result: simResult },
      ],
      warnings: [],
    });
    mockCompare.mockReturnValue({
      scenarios: [
        {
          name: "Test Scenario A",
          storyCount: 2,
          result: simResult,
          rank: 1,
          color: "green" as const,
          isRecommended: true,
        },
        {
          name: "Scenario B",
          storyCount: 2,
          result: simResult,
          rank: 2,
          color: "green" as const,
          isRecommended: false,
        },
      ],
      recommendedIndex: 0,
    });

    // Pass duplicate scen-1 — should deduplicate to 2 unique IDs
    const res = await GET(
      new Request("http://localhost/api/scenarios/compare?ids=scen-1,scen-1,scen-2"),
    );
    expect(res.status).toBe(200);
    // getScenario should be called at most 2 times (deduplicated)
    expect(mockGetScenario).toHaveBeenCalledTimes(2);
  });

  it("returns 400 for duplicate scenario names", async () => {
    const duplicate = { ...baseScenario, id: "scen-2" };
    mockGetScenario.mockImplementation(async (id: string) => {
      if (id === "scen-1") return baseScenario;
      if (id === "scen-2") return duplicate;
      return undefined;
    });
    mockMap.mockReturnValue({
      scenarios: [
        { name: "Test Scenario A", storyCount: 2, result: simResult },
        { name: "Test Scenario A", storyCount: 2, result: simResult },
      ],
      warnings: [],
    });
    mockCompare.mockReturnValue({
      scenarios: [
        {
          name: "Test Scenario A",
          storyCount: 2,
          result: simResult,
          rank: 1,
          color: "green" as const,
          isRecommended: true,
        },
      ],
      recommendedIndex: 0,
    });

    const res = await GET(new Request("http://localhost/api/scenarios/compare?ids=scen-1,scen-2"));
    expect(res.status).toBe(400);

    const data = await res.json();
    expect(data.error).toContain("Duplicate scenario name");
  });
});
