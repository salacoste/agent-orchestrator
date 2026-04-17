/**
 * Unit tests for underutilized agent analyzer (Story 56.9).
 * Tests detection, reallocation, impact, confidence, and edge cases.
 */
import { describe, it, expect } from "vitest";
import { analyzeUnderutilizedAgents } from "../underutilized-analyzer.js";
import type { OptimizationEngineInput } from "../optimization-types.js";
import type { ProjectUtilizationSummary } from "../utilization-metrics-types.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeProjectSummary(
  overrides: Partial<ProjectUtilizationSummary>,
): ProjectUtilizationSummary {
  return {
    projectId: "project-a",
    avgUtilization: 60,
    overutilizedCount: 1,
    underutilizedCount: 1,
    agentCount: 3,
    agentSnapshots: [],
    ...overrides,
  };
}

function makeInput(overrides: Partial<OptimizationEngineInput> = {}): OptimizationEngineInput {
  return {
    projectSummaries: [
      makeProjectSummary({ projectId: "project-a" }),
      makeProjectSummary({ projectId: "project-b", underutilizedCount: 0, overutilizedCount: 1 }),
    ],
    riskFactors: [],
    bottlenecks: [],
    agentUtilizations: [
      {
        agentId: "a1",
        projectId: "project-a",
        utilizationPercent: 15,
        isActive: true,
        isPoolAgent: true,
        storiesWorked: 0,
      },
      {
        agentId: "a2",
        projectId: "project-b",
        utilizationPercent: 95,
        isActive: true,
        isPoolAgent: true,
        storiesWorked: 3,
      },
    ],
    capacityResults: [
      {
        agentId: "a1",
        utilizationPercent: 15,
        isAtCapacity: false,
        isNearCapacity: false,
        availableSlots: 2,
        maxCapacity: 3,
        currentWorkload: 0,
      },
      {
        agentId: "a2",
        utilizationPercent: 95,
        isAtCapacity: true,
        isNearCapacity: true,
        availableSlots: 0,
        maxCapacity: 3,
        currentWorkload: 3,
      },
    ],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("analyzeUnderutilizedAgents", () => {
  it("identifies agents below 30% utilization", () => {
    const input = makeInput();
    const suggestions = analyzeUnderutilizedAgents(input);
    expect(suggestions.length).toBeGreaterThanOrEqual(1);
    const s1 = suggestions.find((s) => s.id === "opt-underutilized-a1");
    expect(s1).toBeDefined();
    expect(s1!.category).toBe("underutilized-detection");
    expect(s1!.title).toContain("a1");
    expect(s1!.title).toContain("15%");
  });

  it("excludes inactive agents", () => {
    const input = makeInput({
      agentUtilizations: [
        {
          agentId: "a1",
          projectId: "project-a",
          utilizationPercent: 10,
          isActive: false,
          isPoolAgent: true,
          storiesWorked: 0,
        },
      ],
      capacityResults: [],
    });
    const suggestions = analyzeUnderutilizedAgents(input);
    expect(suggestions).toHaveLength(0);
  });

  it("excludes agents above threshold", () => {
    const input = makeInput({
      agentUtilizations: [
        {
          agentId: "a1",
          projectId: "project-a",
          utilizationPercent: 50,
          isActive: true,
          isPoolAgent: false,
          storiesWorked: 2,
        },
      ],
      capacityResults: [],
    });
    const suggestions = analyzeUnderutilizedAgents(input);
    expect(suggestions).toHaveLength(0);
  });

  it("returns empty target list when no cross-project capacity available", () => {
    const input = makeInput();
    const suggestions = analyzeUnderutilizedAgents(input);
    const s1 = suggestions.find((s) => s.id === "opt-underutilized-a1");
    expect(s1).toBeDefined();
    const data = s1!.data as {
      suggestedProjectIds: string[];
    };
    // a1 is in project-a (availableSlots: 2, same project — excluded).
    // a2 in project-b has availableSlots: 0. No cross-project target.
    expect(data.suggestedProjectIds).toEqual([]);
  });

  it("finds cross-project reallocation targets", () => {
    const input = makeInput({
      capacityResults: [
        {
          agentId: "a1",
          utilizationPercent: 15,
          isAtCapacity: false,
          isNearCapacity: false,
          availableSlots: 2,
          maxCapacity: 3,
          currentWorkload: 0,
        },
        {
          agentId: "a3",
          utilizationPercent: 60,
          isAtCapacity: false,
          isNearCapacity: false,
          availableSlots: 1,
          maxCapacity: 3,
          currentWorkload: 1,
        },
      ],
      agentUtilizations: [
        {
          agentId: "a1",
          projectId: "project-a",
          utilizationPercent: 15,
          isActive: true,
          isPoolAgent: true,
          storiesWorked: 0,
        },
        {
          agentId: "a3",
          projectId: "project-b",
          utilizationPercent: 60,
          isActive: true,
          isPoolAgent: false,
          storiesWorked: 1,
        },
      ],
    });
    const suggestions = analyzeUnderutilizedAgents(input);
    const s1 = suggestions.find((s) => s.id === "opt-underutilized-a1");
    expect(s1).toBeDefined();
    const data = s1!.data as { suggestedProjectIds: string[] };
    expect(data.suggestedProjectIds).toContain("project-b");
  });

  it("computes correct utilization delta", () => {
    const input = makeInput();
    const suggestions = analyzeUnderutilizedAgents(input);
    const s1 = suggestions.find((s) => s.id === "opt-underutilized-a1");
    expect(s1).toBeDefined();
    // utilizationGap = 30 - 15 = 15
    expect(s1!.impact.utilizationDeltaPercent).toBe(15);
  });

  it("computes estimated days saved", () => {
    const input = makeInput();
    const suggestions = analyzeUnderutilizedAgents(input);
    const s1 = suggestions.find((s) => s.id === "opt-underutilized-a1");
    expect(s1).toBeDefined();
    // daysSaved = utilizationGap * 0.03 = 15 * 0.03 = 0.45
    expect(s1!.impact.daysSaved).toBe(0.5);
  });

  it("gives higher confidence for pool agents", () => {
    const input = makeInput();
    const suggestions = analyzeUnderutilizedAgents(input);
    const poolSuggestion = suggestions.find((s) => s.id === "opt-underutilized-a1");
    expect(poolSuggestion).toBeDefined();
    // a1 is a pool agent: base 50 + 20 (pool) + 0 (no targets in default input) = 70
    expect(poolSuggestion!.confidence).toBeGreaterThanOrEqual(60);
  });

  it("gives lower confidence when no reallocation targets", () => {
    const input = makeInput({
      capacityResults: [
        {
          agentId: "a1",
          utilizationPercent: 15,
          isAtCapacity: false,
          isNearCapacity: false,
          availableSlots: 2,
          maxCapacity: 3,
          currentWorkload: 0,
        },
      ],
      agentUtilizations: [
        {
          agentId: "a1",
          projectId: "project-a",
          utilizationPercent: 15,
          isActive: true,
          isPoolAgent: false,
          storiesWorked: 1,
        },
      ],
    });
    const suggestions = analyzeUnderutilizedAgents(input);
    const s1 = suggestions.find((s) => s.id === "opt-underutilized-a1");
    expect(s1).toBeDefined();
    // non-pool (50), no targets (0), storiesWorked=1 (no -10 penalty) = 50
    expect(s1!.confidence).toBe(50);
  });

  it("returns empty for empty agent list", () => {
    const input = makeInput({
      agentUtilizations: [],
      capacityResults: [],
    });
    const suggestions = analyzeUnderutilizedAgents(input);
    expect(suggestions).toHaveLength(0);
  });

  it("returns empty when all agents at full utilization", () => {
    const input = makeInput({
      agentUtilizations: [
        {
          agentId: "a1",
          projectId: "project-a",
          utilizationPercent: 95,
          isActive: true,
          isPoolAgent: true,
          storiesWorked: 3,
        },
        {
          agentId: "a2",
          projectId: "project-b",
          utilizationPercent: 100,
          isActive: true,
          isPoolAgent: false,
          storiesWorked: 2,
        },
      ],
    });
    const suggestions = analyzeUnderutilizedAgents(input);
    expect(suggestions).toHaveLength(0);
  });

  it("produces low-confidence suggestion for single agent with no targets", () => {
    const input = makeInput({
      agentUtilizations: [
        {
          agentId: "lonely",
          projectId: "solo-project",
          utilizationPercent: 5,
          isActive: true,
          isPoolAgent: false,
          storiesWorked: 0,
        },
      ],
      capacityResults: [],
      projectSummaries: [makeProjectSummary({ projectId: "solo-project" })],
    });
    const suggestions = analyzeUnderutilizedAgents(input);
    expect(suggestions).toHaveLength(1);
    // non-pool (50), no targets (0), storiesWorked=0 (-10) = 40
    expect(suggestions[0].confidence).toBe(40);
    expect(suggestions[0].description).toContain("No projects currently have available capacity");
  });

  it("suggestions integrate correctly with engine output categories", () => {
    const input = makeInput();
    const suggestions = analyzeUnderutilizedAgents(input);
    for (const s of suggestions) {
      expect(s.category).toBe("underutilized-detection");
      expect(s.id).toMatch(/^opt-underutilized-/);
      expect(s.impact).toBeDefined();
      expect(s.impact.daysSaved).toBeGreaterThanOrEqual(0);
      expect(s.confidence).toBeGreaterThanOrEqual(20);
      expect(s.confidence).toBeLessThanOrEqual(95);
    }
  });

  it("includes UnderutilizedAgentData in suggestion data", () => {
    const input = makeInput();
    const suggestions = analyzeUnderutilizedAgents(input);
    const s1 = suggestions.find((s) => s.id === "opt-underutilized-a1");
    expect(s1).toBeDefined();
    const data = s1!.data as {
      agentId: string;
      projectId: string;
      utilizationPercent: number;
      isPoolAgent: boolean;
      suggestedProjectIds: string[];
    };
    expect(data.agentId).toBe("a1");
    expect(data.projectId).toBe("project-a");
    expect(data.utilizationPercent).toBe(15);
    expect(data.isPoolAgent).toBe(true);
    expect(Array.isArray(data.suggestedProjectIds)).toBe(true);
  });
});
