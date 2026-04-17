/**
 * Unit tests for optimization recommendation engine.
 * Tests all five analyzers, impact computation, ranking, and edge cases.
 */
import { describe, it, expect } from "vitest";
import {
  generateOptimizations,
  analyzeAgentRebalancing,
  analyzeWipAdjustments,
  analyzePriorityReorder,
  analyzeCapacityScaling,
  computeImpact,
  rankSuggestions,
} from "../optimization-engine.js";
import type {
  OptimizationEngineInput,
  AgentUtilRaw,
  CapacityRaw,
  OptimizationSuggestion,
} from "../optimization-types.js";
import type { RiskFactor } from "../risk-aggregation.js";
import type { BottleneckItem } from "../bottleneck-aggregation.js";
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
    overutilizedCount: 0,
    underutilizedCount: 0,
    agentCount: 3,
    agentSnapshots: [],
    ...overrides,
  };
}

function makeAgent(overrides: Partial<AgentUtilRaw> & { agentId: string }): AgentUtilRaw {
  return {
    projectId: "project-a",
    utilizationPercent: 50,
    isActive: true,
    isPoolAgent: false,
    storiesWorked: 1,
    ...overrides,
  };
}

function makeCapacity(overrides: Partial<CapacityRaw> & { agentId: string }): CapacityRaw {
  return {
    utilizationPercent: 50,
    isAtCapacity: false,
    isNearCapacity: false,
    availableSlots: 2,
    maxCapacity: 3,
    currentWorkload: 1,
    ...overrides,
  };
}

function makeBottleneck(
  overrides: Partial<BottleneckItem> & { id: string; type: BottleneckItem["type"] },
): BottleneckItem {
  return {
    title: "Test bottleneck",
    severity: 60,
    severityLabel: "high",
    impact: { storiesAffected: 3, estimatedDelayDays: 2, impactScore: 50 },
    trend: "stable",
    affectedProjects: ["project-a"],
    affectedStories: ["s1", "s2", "s3"],
    contributingFactors: ["test factor"],
    suggestedAction: "Fix it",
    ...overrides,
  };
}

function makeRiskFactor(overrides: Partial<RiskFactor> & { id: string }): RiskFactor {
  return {
    type: "blocking-pattern",
    title: "Test risk",
    severity: 50,
    severityLabel: "medium",
    trend: "stable",
    affectedProjects: ["project-a"],
    contributingFactors: [],
    affectedStories: [],
    suggestedAction: "Review",
    ...overrides,
  };
}

function makeInput(overrides: Partial<OptimizationEngineInput> = {}): OptimizationEngineInput {
  return {
    projectSummaries: [makeProjectSummary({ projectId: "project-a" })],
    riskFactors: [],
    bottlenecks: [],
    agentUtilizations: [],
    capacityResults: [],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("optimization-engine", () => {
  describe("generateOptimizations", () => {
    it("returns empty suggestions for balanced single-project system", () => {
      const result = generateOptimizations(
        makeInput({
          projectSummaries: [
            makeProjectSummary({ projectId: "p1", avgUtilization: 50, agentCount: 3 }),
          ],
          agentUtilizations: [
            makeAgent({ agentId: "a1", projectId: "p1", utilizationPercent: 50 }),
            makeAgent({ agentId: "a2", projectId: "p1", utilizationPercent: 50 }),
          ],
        }),
      );
      expect(result.suggestions).toEqual([]);
      expect(result.analysisTimeMs).toBeGreaterThanOrEqual(0);
      expect(result.inputSummary.projectCount).toBe(1);
    });

    it("produces suggestions from multiple analyzers", () => {
      const result = generateOptimizations(
        makeInput({
          projectSummaries: [
            makeProjectSummary({
              projectId: "p1",
              avgUtilization: 95,
              overutilizedCount: 2,
            }),
            makeProjectSummary({
              projectId: "p2",
              avgUtilization: 20,
              underutilizedCount: 1,
            }),
          ],
          agentUtilizations: [
            makeAgent({ agentId: "a1", projectId: "p1", utilizationPercent: 95 }),
            makeAgent({
              agentId: "a2",
              projectId: "p2",
              utilizationPercent: 15,
              isPoolAgent: true,
            }),
          ],
          bottlenecks: [makeBottleneck({ id: "bn1", type: "wip-violation", severity: 70 })],
          capacityResults: [
            makeCapacity({ agentId: "a1", utilizationPercent: 100, isAtCapacity: true }),
          ],
        }),
      );
      expect(result.suggestions.length).toBeGreaterThanOrEqual(2);
      const categories = result.suggestions.map((s) => s.category);
      expect(categories).toContain("agent-rebalancing");
      // Suggestions are sorted by priority (highest first)
      for (let i = 1; i < result.suggestions.length; i++) {
        expect(result.suggestions[i - 1].priority).toBeGreaterThanOrEqual(
          result.suggestions[i].priority,
        );
      }
    });

    it("tracks analysis time and input summary", () => {
      const result = generateOptimizations(
        makeInput({
          agentUtilizations: [
            makeAgent({ agentId: "a1", utilizationPercent: 95 }),
            makeAgent({ agentId: "a2", utilizationPercent: 15 }),
          ],
        }),
      );
      expect(result.inputSummary.agentCount).toBe(2);
      expect(result.inputSummary.overutilizedCount).toBe(1);
      expect(result.inputSummary.underutilizedCount).toBe(1);
    });

    it("produces underutilized-detection suggestions for agents below threshold", () => {
      const result = generateOptimizations(
        makeInput({
          projectSummaries: [makeProjectSummary({ projectId: "p1" })],
          agentUtilizations: [
            makeAgent({ agentId: "a1", projectId: "p1", utilizationPercent: 15, isActive: true }),
          ],
          capacityResults: [
            makeCapacity({ agentId: "a1", utilizationPercent: 15, availableSlots: 2 }),
          ],
        }),
      );
      const underutilized = result.suggestions.filter(
        (s) => s.category === "underutilized-detection",
      );
      expect(underutilized.length).toBe(1);
      expect(underutilized[0].id).toBe("opt-underutilized-a1");
      expect(underutilized[0].title).toContain("15%");
    });
  });

  describe("analyzeAgentRebalancing", () => {
    it("suggests rebalancing pool agent from underutilized to overutilized project", () => {
      const suggestions = analyzeAgentRebalancing(
        makeInput({
          projectSummaries: [
            makeProjectSummary({
              projectId: "over-p",
              avgUtilization: 95,
              overutilizedCount: 2,
            }),
            makeProjectSummary({
              projectId: "under-p",
              avgUtilization: 15,
              underutilizedCount: 1,
            }),
          ],
          agentUtilizations: [
            makeAgent({
              agentId: "pool-a",
              projectId: "under-p",
              utilizationPercent: 10,
              isPoolAgent: true,
            }),
          ],
        }),
      );
      expect(suggestions.length).toBe(1);
      expect(suggestions[0].category).toBe("agent-rebalancing");
      expect(suggestions[0].data.isPoolAgent).toBe(true);
      expect(suggestions[0].confidence).toBe(85); // Pool agents get higher confidence
    });

    it("prefers pool agents over non-pool agents", () => {
      const suggestions = analyzeAgentRebalancing(
        makeInput({
          projectSummaries: [
            makeProjectSummary({ projectId: "over-p", avgUtilization: 95, overutilizedCount: 1 }),
            makeProjectSummary({ projectId: "under-p", avgUtilization: 15, underutilizedCount: 2 }),
          ],
          agentUtilizations: [
            makeAgent({
              agentId: "reserved-a",
              projectId: "under-p",
              utilizationPercent: 10,
              isPoolAgent: false,
            }),
            makeAgent({
              agentId: "pool-b",
              projectId: "under-p",
              utilizationPercent: 5,
              isPoolAgent: true,
            }),
          ],
        }),
      );
      expect(suggestions.length).toBe(1);
      expect(suggestions[0].data.agentId).toBe("pool-b");
    });

    it("returns empty for single project", () => {
      const suggestions = analyzeAgentRebalancing(
        makeInput({
          projectSummaries: [makeProjectSummary({ projectId: "only-p" })],
        }),
      );
      expect(suggestions).toEqual([]);
    });

    it("returns empty when no overutilized projects exist", () => {
      const suggestions = analyzeAgentRebalancing(
        makeInput({
          projectSummaries: [
            makeProjectSummary({ projectId: "p1", avgUtilization: 50, overutilizedCount: 0 }),
            makeProjectSummary({ projectId: "p2", avgUtilization: 40, underutilizedCount: 1 }),
          ],
        }),
      );
      expect(suggestions).toEqual([]);
    });
  });

  describe("analyzeWipAdjustments", () => {
    it("detects WIP violation bottleneck", () => {
      const suggestions = analyzeWipAdjustments(
        makeInput({
          bottlenecks: [
            makeBottleneck({
              id: "wip-1",
              type: "wip-violation",
              severity: 70,
              title: "WIP limit exceeded in review",
              affectedStories: ["s1", "s2"],
              contributingFactors: ["review column"],
            }),
          ],
        }),
      );
      expect(suggestions.length).toBe(1);
      expect(suggestions[0].category).toBe("wip-adjustment");
      expect(suggestions[0].title).toContain("Increase WIP limit");
      expect(suggestions[0].impact.daysSaved).toBeGreaterThan(0);
    });

    it("detects column bottleneck", () => {
      const suggestions = analyzeWipAdjustments(
        makeInput({
          bottlenecks: [
            makeBottleneck({
              id: "col-1",
              type: "column-bottleneck",
              severity: 60,
              title: "Review column is slow",
            }),
          ],
        }),
      );
      expect(suggestions.length).toBe(1);
      expect(suggestions[0].title).toContain("Review column capacity");
    });

    it("skips low-severity bottlenecks", () => {
      const suggestions = analyzeWipAdjustments(
        makeInput({
          bottlenecks: [
            makeBottleneck({
              id: "low-bn",
              type: "wip-violation",
              severity: 20,
            }),
          ],
        }),
      );
      expect(suggestions).toEqual([]);
    });

    it("deduplicates same contributing factor", () => {
      const suggestions = analyzeWipAdjustments(
        makeInput({
          bottlenecks: [
            makeBottleneck({
              id: "bn-a",
              type: "wip-violation",
              severity: 60,
              contributingFactors: ["same-column"],
            }),
            makeBottleneck({
              id: "bn-b",
              type: "column-bottleneck",
              severity: 65,
              contributingFactors: ["same-column"],
            }),
          ],
        }),
      );
      expect(suggestions.length).toBe(1);
    });
  });

  describe("analyzePriorityReorder", () => {
    it("detects stuck stories bottleneck", () => {
      const suggestions = analyzePriorityReorder(
        makeInput({
          bottlenecks: [
            makeBottleneck({
              id: "stuck-1",
              type: "stuck-stories",
              severity: 70,
              affectedStories: ["s1", "s2", "s3"],
            }),
          ],
          riskFactors: [],
        }),
      );
      expect(suggestions.length).toBe(1);
      expect(suggestions[0].category).toBe("priority-reorder");
      expect(suggestions[0].title).toContain("Unblock");
    });

    it("detects aging stories bottleneck", () => {
      const suggestions = analyzePriorityReorder(
        makeInput({
          bottlenecks: [
            makeBottleneck({
              id: "aging-1",
              type: "aging-stories",
              severity: 55,
              affectedStories: ["s4"],
            }),
          ],
          riskFactors: [],
        }),
      );
      expect(suggestions.length).toBe(1);
      expect(suggestions[0].title).toContain("Escalate");
    });

    it("detects blocking pattern risk factors", () => {
      const suggestions = analyzePriorityReorder(
        makeInput({
          bottlenecks: [],
          riskFactors: [
            makeRiskFactor({
              id: "rf-1",
              type: "blocking-pattern",
              severity: 75,
              affectedStories: ["s1", "s2"],
              affectedProjects: ["project-a"],
            }),
          ],
        }),
      );
      expect(suggestions.length).toBe(1);
      expect(suggestions[0].title).toContain("blocking pattern");
    });

    it("skips low-severity risk factors", () => {
      const suggestions = analyzePriorityReorder(
        makeInput({
          bottlenecks: [],
          riskFactors: [
            makeRiskFactor({
              id: "rf-low",
              type: "blocking-pattern",
              severity: 39,
              affectedStories: ["s1"],
            }),
          ],
        }),
      );
      expect(suggestions).toEqual([]);
    });
  });

  describe("analyzeCapacityScaling", () => {
    it("detects at-capacity agent", () => {
      const suggestions = analyzeCapacityScaling(
        makeInput({
          agentUtilizations: [
            makeAgent({ agentId: "a1", projectId: "p1", utilizationPercent: 100 }),
          ],
          capacityResults: [
            makeCapacity({
              agentId: "a1",
              utilizationPercent: 100,
              isAtCapacity: true,
              currentWorkload: 5,
              maxCapacity: 3,
              availableSlots: 0,
            }),
          ],
          bottlenecks: [],
        }),
      );
      expect(suggestions.length).toBe(1);
      expect(suggestions[0].category).toBe("capacity-scaling");
      expect(suggestions[0].title).toContain("Reduce load");
    });

    it("detects near-capacity agent when capacity bottlenecks exist", () => {
      const suggestions = analyzeCapacityScaling(
        makeInput({
          agentUtilizations: [
            makeAgent({ agentId: "a1", projectId: "p1", utilizationPercent: 85 }),
          ],
          capacityResults: [
            makeCapacity({
              agentId: "a1",
              utilizationPercent: 85,
              isNearCapacity: true,
              isAtCapacity: false,
              availableSlots: 1,
            }),
          ],
          bottlenecks: [
            makeBottleneck({ id: "cap-bn", type: "capacity-bottleneck", severity: 60 }),
          ],
        }),
      );
      expect(suggestions.length).toBe(1); // near-capacity only (no at-capacity agents)
      const nearSuggestion = suggestions.find((s) => s.title.includes("approaching capacity"));
      expect(nearSuggestion).toBeDefined();
    });

    it("skips near-capacity when no capacity bottlenecks", () => {
      const suggestions = analyzeCapacityScaling(
        makeInput({
          agentUtilizations: [makeAgent({ agentId: "a1", projectId: "p1" })],
          capacityResults: [
            makeCapacity({
              agentId: "a1",
              isNearCapacity: true,
              isAtCapacity: false,
            }),
          ],
          bottlenecks: [],
        }),
      );
      // No at-capacity agents, no capacity bottlenecks, so near-capacity is skipped
      expect(suggestions).toEqual([]);
    });
  });

  describe("computeImpact", () => {
    it("rounds days saved to 1 decimal", () => {
      const impact = computeImpact({
        daysSavedEstimate: 2.567,
        riskReductionEstimate: 15,
        utilizationDelta: 10,
        affectedAgents: ["a1"],
        affectedProjects: ["p1"],
        affectedStories: [],
      });
      expect(impact.daysSaved).toBe(2.6);
    });

    it("clamps risk reduction to 0-100", () => {
      const overImpact = computeImpact({
        daysSavedEstimate: 1,
        riskReductionEstimate: 150,
        utilizationDelta: 0,
        affectedAgents: [],
        affectedProjects: [],
        affectedStories: [],
      });
      expect(overImpact.riskReductionPercent).toBe(100);

      const underImpact = computeImpact({
        daysSavedEstimate: 1,
        riskReductionEstimate: -10,
        utilizationDelta: 0,
        affectedAgents: [],
        affectedProjects: [],
        affectedStories: [],
      });
      expect(underImpact.riskReductionPercent).toBe(0);
    });
  });

  describe("rankSuggestions", () => {
    it("sorts by priority score descending", () => {
      const low: OptimizationSuggestion = {
        id: "low",
        category: "capacity-scaling",
        title: "Low",
        description: "",
        impact: {
          daysSaved: 0.5,
          riskReductionPercent: 5,
          utilizationDeltaPercent: 0,
          affectedAgents: [],
          affectedProjects: [],
          affectedStories: [],
        },
        confidence: 50,
        priority: 0,
        createdAt: 0,
        data: {},
      };
      const high: OptimizationSuggestion = {
        id: "high",
        category: "agent-rebalancing",
        title: "High",
        description: "",
        impact: {
          daysSaved: 5,
          riskReductionPercent: 30,
          utilizationDeltaPercent: 20,
          affectedAgents: ["a1"],
          affectedProjects: ["p1"],
          affectedStories: [],
        },
        confidence: 90,
        priority: 0,
        createdAt: 0,
        data: {},
      };
      const result = rankSuggestions([low, high]);
      expect(result[0].id).toBe("high");
      expect(result[0].priority).toBeGreaterThan(result[1].priority);
    });

    it("returns empty array unchanged", () => {
      expect(rankSuggestions([])).toEqual([]);
    });
  });
});
