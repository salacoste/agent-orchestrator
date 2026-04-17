/**
 * Unit tests for optimization impact analysis (Story 56.10).
 * Tests before/after metrics, completion date shift, velocity delta, risk change,
 * and edge cases.
 */
import { describe, it, expect } from "vitest";
import { analyzeSuggestionImpact, analyzeAllSuggestions } from "../optimization-impact.js";
import type { OptimizationEngineInput, OptimizationSuggestion } from "../optimization-types.js";
import type { ProjectUtilizationSummary } from "../utilization-metrics-types.js";
import type { RiskFactor } from "../risk-aggregation.js";
import type { BottleneckItem } from "../bottleneck-aggregation.js";

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

function makeSuggestion(overrides: Partial<OptimizationSuggestion> = {}): OptimizationSuggestion {
  return {
    id: "opt-test-1",
    category: "agent-rebalancing",
    title: "Test suggestion",
    description: "A test optimization",
    impact: {
      daysSaved: 2.5,
      riskReductionPercent: 20,
      utilizationDeltaPercent: 15,
      affectedAgents: ["a1"],
      affectedProjects: ["project-a"],
      affectedStories: ["s1"],
    },
    confidence: 80,
    priority: 50,
    createdAt: Date.now(),
    data: {},
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("analyzeSuggestionImpact", () => {
  it("computes correct completion date shift from daysSaved", () => {
    const suggestion = makeSuggestion({ impact: { ...makeSuggestion().impact, daysSaved: 3.2 } });
    const analysis = analyzeSuggestionImpact(suggestion, makeInput());
    expect(analysis.completionDateShift).toBe(3.2);
  });

  it("computes correct velocity delta from utilization change", () => {
    const input = makeInput({
      projectSummaries: [makeProjectSummary({ avgUtilization: 50 })],
    });
    const suggestion = makeSuggestion({
      impact: { ...makeSuggestion().impact, utilizationDeltaPercent: 20 },
    });
    const analysis = analyzeSuggestionImpact(suggestion, input);
    // velocity delta = (utilDelta / 100) * 0.8 = 0.2 * 0.8 = 0.16
    expect(analysis.velocityDelta).toBeGreaterThan(0);
    expect(analysis.afterMetrics.velocity).toBeGreaterThan(analysis.beforeMetrics.velocity);
  });

  it("computes before risk score from input risk factors and bottlenecks", () => {
    const input = makeInput({
      riskFactors: [makeRiskFactor({ id: "r1", severity: 70 })],
      bottlenecks: [
        makeBottleneck({
          id: "b1",
          type: "wip-violation",
          impact: { storiesAffected: 1, estimatedDelayDays: 1, impactScore: 50 },
        }),
      ],
    });
    const suggestion = makeSuggestion();
    const analysis = analyzeSuggestionImpact(suggestion, input);
    expect(analysis.beforeMetrics.riskScore).toBeGreaterThan(0);
  });

  it("computes after risk score from risk reduction", () => {
    const input = makeInput({
      riskFactors: [makeRiskFactor({ id: "r1", severity: 80 })],
    });
    const suggestion = makeSuggestion({
      impact: { ...makeSuggestion().impact, riskReductionPercent: 50 },
    });
    const analysis = analyzeSuggestionImpact(suggestion, input);
    expect(analysis.afterMetrics.riskScore).toBeLessThan(analysis.beforeMetrics.riskScore);
    expect(analysis.riskChange.delta).toBeGreaterThan(0);
  });

  it("clamps risk scores to 0-100", () => {
    const input = makeInput({
      riskFactors: [makeRiskFactor({ id: "r1", severity: 100 })],
    });
    const suggestion = makeSuggestion({
      impact: { ...makeSuggestion().impact, riskReductionPercent: 100 },
    });
    const analysis = analyzeSuggestionImpact(suggestion, input);
    expect(analysis.afterMetrics.riskScore).toBe(0);
  });

  it("builds correct beforeMetrics snapshot", () => {
    const input = makeInput({
      projectSummaries: [makeProjectSummary({ avgUtilization: 70, agentCount: 5 })],
      agentUtilizations: [
        {
          agentId: "a1",
          projectId: "project-a",
          utilizationPercent: 70,
          isActive: true,
          isPoolAgent: false,
          storiesWorked: 2,
        },
        {
          agentId: "a2",
          projectId: "project-a",
          utilizationPercent: 50,
          isActive: true,
          isPoolAgent: false,
          storiesWorked: 1,
        },
        {
          agentId: "a3",
          projectId: "project-a",
          utilizationPercent: 0,
          isActive: false,
          isPoolAgent: false,
          storiesWorked: 0,
        },
      ],
    });
    const analysis = analyzeSuggestionImpact(makeSuggestion(), input);
    expect(analysis.beforeMetrics.utilizationPercent).toBe(70);
    expect(analysis.beforeMetrics.activeAgents).toBe(2);
  });

  it("builds correct afterMetrics snapshot", () => {
    const input = makeInput({
      projectSummaries: [makeProjectSummary({ avgUtilization: 50 })],
    });
    const suggestion = makeSuggestion({
      impact: {
        daysSaved: 1,
        riskReductionPercent: 30,
        utilizationDeltaPercent: 10,
        affectedAgents: [],
        affectedProjects: [],
        affectedStories: ["s1"],
      },
    });
    const analysis = analyzeSuggestionImpact(suggestion, input);
    expect(analysis.afterMetrics.utilizationPercent).toBeGreaterThan(
      analysis.beforeMetrics.utilizationPercent,
    );
    expect(analysis.afterMetrics.riskScore).toBeLessThanOrEqual(analysis.beforeMetrics.riskScore);
  });

  it("returns zero delta for zero-impact suggestions", () => {
    const input = makeInput();
    const suggestion = makeSuggestion({
      impact: {
        daysSaved: 0,
        riskReductionPercent: 0,
        utilizationDeltaPercent: 0,
        affectedAgents: [],
        affectedProjects: [],
        affectedStories: [],
      },
    });
    const analysis = analyzeSuggestionImpact(suggestion, input);
    expect(analysis.completionDateShift).toBe(0);
    expect(analysis.velocityDelta).toBe(0);
    expect(analysis.riskChange.delta).toBe(0);
  });

  it("handles empty risk factors and bottlenecks", () => {
    const input = makeInput();
    const analysis = analyzeSuggestionImpact(makeSuggestion(), input);
    expect(analysis.beforeMetrics.riskScore).toBe(0);
    expect(analysis.afterMetrics.riskScore).toBe(0);
  });

  it("deterministic: same inputs produce same outputs", () => {
    const input = makeInput({
      projectSummaries: [makeProjectSummary({ avgUtilization: 65 })],
      riskFactors: [makeRiskFactor({ id: "r1", severity: 40 })],
    });
    const suggestion = makeSuggestion();
    const a1 = analyzeSuggestionImpact(suggestion, input);
    const a2 = analyzeSuggestionImpact(suggestion, input);
    expect(a1).toEqual(a2);
  });

  it("counts active agents correctly in beforeMetrics", () => {
    const input = makeInput({
      agentUtilizations: [
        {
          agentId: "a1",
          projectId: "p1",
          utilizationPercent: 50,
          isActive: true,
          isPoolAgent: false,
          storiesWorked: 1,
        },
        {
          agentId: "a2",
          projectId: "p1",
          utilizationPercent: 50,
          isActive: true,
          isPoolAgent: false,
          storiesWorked: 1,
        },
        {
          agentId: "a3",
          projectId: "p1",
          utilizationPercent: 0,
          isActive: false,
          isPoolAgent: false,
          storiesWorked: 0,
        },
      ],
    });
    const analysis = analyzeSuggestionImpact(makeSuggestion(), input);
    expect(analysis.beforeMetrics.activeAgents).toBe(2);
    // Active agents unchanged by suggestion
    expect(analysis.afterMetrics.activeAgents).toBe(2);
  });

  it("counts stories at risk from bottleneck affected stories", () => {
    const input = makeInput({
      bottlenecks: [
        makeBottleneck({ id: "b1", type: "stuck-stories", affectedStories: ["s1", "s2", "s3"] }),
        makeBottleneck({ id: "b2", type: "aging-stories", affectedStories: ["s3", "s4"] }),
      ],
    });
    const analysis = analyzeSuggestionImpact(makeSuggestion(), input);
    // s1, s2, s3, s4 = 4 unique stories
    expect(analysis.beforeMetrics.storiesAtRisk).toBe(4);
  });
});

describe("analyzeAllSuggestions", () => {
  it("returns details for all suggestions", () => {
    const input = makeInput();
    const suggestions = [
      makeSuggestion({ id: "opt-1" }),
      makeSuggestion({ id: "opt-2" }),
      makeSuggestion({ id: "opt-3" }),
    ];
    const details = analyzeAllSuggestions(suggestions, input);
    expect(details).toHaveLength(3);
    expect(details[0].suggestion.id).toBe("opt-1");
    expect(details[0].impactAnalysis).toBeDefined();
    expect(details[1].suggestion.id).toBe("opt-2");
    expect(details[2].suggestion.id).toBe("opt-3");
  });

  it("returns empty array for empty suggestions", () => {
    const details = analyzeAllSuggestions([], makeInput());
    expect(details).toEqual([]);
  });

  it("each detail has a valid impact analysis", () => {
    const input = makeInput({
      projectSummaries: [makeProjectSummary({ avgUtilization: 55 })],
    });
    const suggestions = [makeSuggestion(), makeSuggestion()];
    const details = analyzeAllSuggestions(suggestions, input);
    for (const detail of details) {
      expect(detail.impactAnalysis.completionDateShift).toBeGreaterThanOrEqual(0);
      expect(detail.impactAnalysis.beforeMetrics).toBeDefined();
      expect(detail.impactAnalysis.afterMetrics).toBeDefined();
      expect(typeof detail.impactAnalysis.velocityDelta).toBe("number");
      expect(typeof detail.impactAnalysis.riskChange.before).toBe("number");
      expect(typeof detail.impactAnalysis.riskChange.after).toBe("number");
    }
  });
});
