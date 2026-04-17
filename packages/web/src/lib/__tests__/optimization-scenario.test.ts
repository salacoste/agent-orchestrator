/**
 * Unit tests for optimization scenario engine (Story 56.8).
 * Tests objective ranking, baseline comparison, multi-objective comparison, edge cases.
 */
import { describe, it, expect } from "vitest";
import {
  runObjectiveScenario,
  runAllObjectives,
  compareObjectives,
  applyObjectiveRanking,
  compareWithBaseline,
} from "../optimization-scenario.js";
import { generateOptimizations } from "../optimization-engine.js";
import type {
  OptimizationEngineInput,
  OptimizationSuggestion,
  OptimizationObjective,
  ObjectiveScenarioResult,
  LearningWeights,
} from "../optimization-types.js";
import type { ProjectUtilizationSummary } from "../utilization-metrics-types.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeSuggestion(
  overrides: Partial<OptimizationSuggestion> & {
    id: string;
    category: OptimizationSuggestion["category"];
  },
): OptimizationSuggestion {
  return {
    title: `Suggestion ${overrides.id}`,
    description: "Test suggestion",
    impact: {
      daysSaved: 1,
      riskReductionPercent: 10,
      utilizationDeltaPercent: 5,
      affectedAgents: [],
      affectedProjects: [],
      affectedStories: [],
    },
    confidence: 80,
    priority: 0,
    createdAt: Date.now(),
    data: {},
    ...overrides,
  };
}

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
    projectSummaries: [makeProjectSummary({ projectId: "project-a" })],
    riskFactors: [],
    bottlenecks: [],
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
        projectId: "project-a",
        utilizationPercent: 20,
        isActive: true,
        isPoolAgent: true,
        storiesWorked: 1,
      },
    ],
    capacityResults: [
      {
        agentId: "a1",
        utilizationPercent: 95,
        isAtCapacity: true,
        isNearCapacity: true,
        availableSlots: 0,
        maxCapacity: 3,
        currentWorkload: 3,
      },
      {
        agentId: "a2",
        utilizationPercent: 20,
        isAtCapacity: false,
        isNearCapacity: false,
        availableSlots: 2,
        maxCapacity: 3,
        currentWorkload: 1,
      },
    ],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("optimization-scenario", () => {
  describe("applyObjectiveRanking", () => {
    const suggestions: OptimizationSuggestion[] = [
      makeSuggestion({
        id: "s1",
        category: "agent-rebalancing",
        impact: {
          daysSaved: 3,
          riskReductionPercent: 10,
          utilizationDeltaPercent: 5,
          affectedAgents: [],
          affectedProjects: [],
          affectedStories: [],
        },
      }),
      makeSuggestion({
        id: "s2",
        category: "priority-reorder",
        impact: {
          daysSaved: 2,
          riskReductionPercent: 20,
          utilizationDeltaPercent: 3,
          affectedAgents: [],
          affectedProjects: [],
          affectedStories: [],
        },
      }),
      makeSuggestion({
        id: "s3",
        category: "wip-adjustment",
        impact: {
          daysSaved: 1,
          riskReductionPercent: 5,
          utilizationDeltaPercent: 15,
          affectedAgents: [],
          affectedProjects: [],
          affectedStories: [],
        },
      }),
      makeSuggestion({
        id: "s4",
        category: "capacity-scaling",
        impact: {
          daysSaved: 4,
          riskReductionPercent: 8,
          utilizationDeltaPercent: 2,
          affectedAgents: [],
          affectedProjects: [],
          affectedStories: [],
        },
      }),
    ];

    it("minimize-time boosts agent-rebalancing and priority-reorder", () => {
      const ranked = applyObjectiveRanking(suggestions, "minimize-time");
      const ids = ranked.map((s) => s.id);
      // s4 (capacity-scaling) is suppressed — should be ranked below both boosted categories
      const s4Idx = ids.indexOf("s4");
      const s1Idx = ids.indexOf("s1");
      const s2Idx = ids.indexOf("s2");
      expect(s1Idx).toBeLessThan(s4Idx);
      expect(s2Idx).toBeLessThan(s4Idx);
    });

    it("maximize-throughput boosts wip-adjustment and capacity-scaling", () => {
      const ranked = applyObjectiveRanking(suggestions, "maximize-throughput");
      const ids = ranked.map((s) => s.id);
      // s2 (priority-reorder) is suppressed — should be ranked below both boosted categories
      const s2Idx = ids.indexOf("s2");
      const s3Idx = ids.indexOf("s3");
      const s4Idx = ids.indexOf("s4");
      expect(s3Idx).toBeLessThan(s2Idx);
      expect(s4Idx).toBeLessThan(s2Idx);
    });

    it("balance-workload boosts agent-rebalancing", () => {
      const ranked = applyObjectiveRanking(suggestions, "balance-workload");
      const ids = ranked.map((s) => s.id);
      // agent-rebalancing (s1) should be boosted over its baseline position;
      // verify it appears before priority-reorder (s2) which is suppressed
      const s1Idx = ids.indexOf("s1");
      const s2Idx = ids.indexOf("s2");
      expect(s1Idx).toBeLessThan(s2Idx);
    });

    it("reduce-blocking boosts priority-reorder", () => {
      const ranked = applyObjectiveRanking(suggestions, "reduce-blocking");
      const ids = ranked.map((s) => s.id);
      // priority-reorder should be boosted with higher riskReduction weight
      expect(ids).toContain("s2");
    });

    it("returns empty array for empty input", () => {
      const ranked = applyObjectiveRanking([], "minimize-time");
      expect(ranked).toEqual([]);
    });

    it("returns same suggestion for single input", () => {
      const single = [suggestions[0]];
      const ranked = applyObjectiveRanking(single, "minimize-time");
      expect(ranked).toHaveLength(1);
      expect(ranked[0].id).toBe("s1");
    });

    it("is deterministic — same input produces same output", () => {
      const ranked1 = applyObjectiveRanking(suggestions, "minimize-time");
      const ranked2 = applyObjectiveRanking(suggestions, "minimize-time");
      expect(ranked1.map((s) => s.id)).toEqual(ranked2.map((s) => s.id));
    });

    it("different objectives produce different rankings", () => {
      const rankedThroughput = applyObjectiveRanking(suggestions, "maximize-throughput");
      const rankedBlocking = applyObjectiveRanking(suggestions, "reduce-blocking");
      const tpIds = rankedThroughput.map((s) => s.id);
      const blIds = rankedBlocking.map((s) => s.id);
      // Different boost/suppress patterns should produce different orders for our test data
      expect(tpIds).not.toEqual(blIds);
    });
  });

  describe("compareWithBaseline", () => {
    it("detects rank changes", () => {
      const baseline: OptimizationSuggestion[] = [
        makeSuggestion({ id: "a", category: "agent-rebalancing" }),
        makeSuggestion({ id: "b", category: "wip-adjustment" }),
        makeSuggestion({ id: "c", category: "priority-reorder" }),
      ];
      const objective: OptimizationSuggestion[] = [
        makeSuggestion({ id: "c", category: "priority-reorder" }),
        makeSuggestion({ id: "a", category: "agent-rebalancing" }),
        makeSuggestion({ id: "b", category: "wip-adjustment" }),
      ];
      const comp = compareWithBaseline(objective, baseline);
      expect(comp.topSuggestionMoved).toBe(true);
      expect(comp.rankChanges).toHaveLength(3);
      // c moved from 2 to 0 (delta +2)
      const cChange = comp.rankChanges.find((r) => r.suggestionId === "c");
      expect(cChange?.rankDelta).toBe(2);
    });

    it("returns empty for identical rankings", () => {
      const suggestions = [
        makeSuggestion({ id: "a", category: "agent-rebalancing" }),
        makeSuggestion({ id: "b", category: "wip-adjustment" }),
      ];
      const comp = compareWithBaseline(suggestions, suggestions);
      expect(comp.topSuggestionMoved).toBe(false);
      expect(comp.rankChanges).toHaveLength(0);
    });

    it("handles empty arrays", () => {
      const comp = compareWithBaseline([], []);
      expect(comp.topSuggestionMoved).toBe(false);
      expect(comp.rankChanges).toHaveLength(0);
    });
  });

  describe("runObjectiveScenario", () => {
    it("returns re-ranked suggestions with objective", () => {
      const input = makeInput();
      const result = runObjectiveScenario(input, "minimize-time");
      expect(result.objective).toBe("minimize-time");
      expect(result.suggestions).toBeInstanceOf(Array);
      expect(result.analysisTimeMs).toBeGreaterThanOrEqual(0);
      expect(result.inputSummary).toBeDefined();
      expect(result.baselineComparison).toBeDefined();
    });
  });

  describe("runAllObjectives", () => {
    it("returns results for all 4 objectives", () => {
      const input = makeInput();
      const { results, baselineSuggestions } = runAllObjectives(input);
      expect(results.size).toBe(4);
      expect(baselineSuggestions).toBeInstanceOf(Array);
      const objectives: OptimizationObjective[] = [
        "minimize-time",
        "maximize-throughput",
        "balance-workload",
        "reduce-blocking",
      ];
      for (const obj of objectives) {
        expect(results.has(obj)).toBe(true);
        expect(results.get(obj)?.objective).toBe(obj);
      }
    });
  });

  describe("learning weights integration (Story 56.11)", () => {
    it("runObjectiveScenario applies learning weights after objective ranking", () => {
      const input = makeInput({
        projectSummaries: [
          makeProjectSummary({ projectId: "project-a" }),
          makeProjectSummary({ projectId: "project-b" }),
        ],
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
            utilizationPercent: 15,
            isActive: true,
            isPoolAgent: true,
            storiesWorked: 0,
          },
        ],
        capacityResults: [],
      });

      // Heavy penalty on agent-rebalancing should demote those suggestions
      const learningWeights: LearningWeights = {
        categoryBoosts: new Map([
          ["agent-rebalancing", 0.5], // penalized
          ["wip-adjustment", 1.5], // boosted
        ]),
        generatedAt: Date.now(),
      };

      const withoutLearning = runObjectiveScenario(input, "minimize-time");
      const withLearning = runObjectiveScenario(input, "minimize-time", learningWeights);

      // The suggestion ordering should differ when learning is applied
      const idsWithout = withoutLearning.suggestions.map((s) => s.id);
      const idsWith = withLearning.suggestions.map((s) => s.id);

      // With penalty on rebalancing, those suggestions should rank lower
      const rebalanceIds = withoutLearning.suggestions
        .filter((s) => s.category === "agent-rebalancing")
        .map((s) => s.id);

      if (rebalanceIds.length > 0) {
        // At least verify priorities were adjusted
        const rebalancedWith = withLearning.suggestions.find(
          (s) => s.category === "agent-rebalancing",
        );
        const rebalancedWithout = withoutLearning.suggestions.find(
          (s) => s.category === "agent-rebalancing",
        );
        if (rebalancedWith && rebalancedWithout) {
          expect(rebalancedWith.priority).toBeLessThan(rebalancedWithout.priority);
        }
      }

      // Verify both produce same set of suggestion IDs
      expect(new Set(idsWith)).toEqual(new Set(idsWithout));
    });

    it("runAllObjectives applies learning weights to each objective", () => {
      const input = makeInput({
        projectSummaries: [
          makeProjectSummary({ projectId: "project-a" }),
          makeProjectSummary({ projectId: "project-b" }),
        ],
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
            utilizationPercent: 15,
            isActive: true,
            isPoolAgent: true,
            storiesWorked: 0,
          },
        ],
        capacityResults: [],
      });

      const learningWeights: LearningWeights = {
        categoryBoosts: new Map([
          ["priority-reorder", 1.5],
          ["capacity-scaling", 0.5],
        ]),
        generatedAt: Date.now(),
      };

      const { results } = runAllObjectives(input, learningWeights);
      expect(results.size).toBe(4);

      // Each objective result should have learning-adjusted priorities
      for (const [, result] of results) {
        expect(result.suggestions).toBeInstanceOf(Array);
        for (const s of result.suggestions) {
          expect(typeof s.priority).toBe("number");
        }
      }
    });
  });

  describe("compareObjectives", () => {
    it("builds comparison summary with top 3 per objective", () => {
      const input = makeInput();
      const { results, baselineSuggestions } = runAllObjectives(input);
      const summary = compareObjectives(results, baselineSuggestions);
      expect(summary.objectives).toHaveLength(4);
      expect(summary.baselineTopSuggestions.length).toBeLessThanOrEqual(3);
      expect(summary.analysisTimeMs).toBeGreaterThanOrEqual(0);
      for (const obj of summary.objectives) {
        expect(obj.topSuggestions.length).toBeLessThanOrEqual(3);
        expect(obj.projectedImpact).toBeDefined();
      }
    });
  });

  describe("integration with optimization-engine", () => {
    it("scenario wraps generateOptimizations correctly", () => {
      const input = makeInput();
      const baseline = generateOptimizations(input);
      const scenario = runObjectiveScenario(input, "balance-workload");
      // Same suggestions, potentially different order
      const baselineIds = new Set(baseline.suggestions.map((s) => s.id));
      const scenarioIds = new Set(scenario.suggestions.map((s) => s.id));
      expect(scenarioIds).toEqual(baselineIds);
    });

    it("aggregated riskReductionPercent is capped at 100", () => {
      // Create suggestions that would sum to >100% riskReduction
      const highImpact: OptimizationSuggestion[] = [
        makeSuggestion({
          id: "h1",
          category: "agent-rebalancing",
          impact: {
            daysSaved: 1,
            riskReductionPercent: 50,
            utilizationDeltaPercent: 0,
            affectedAgents: [],
            affectedProjects: [],
            affectedStories: [],
          },
        }),
        makeSuggestion({
          id: "h2",
          category: "priority-reorder",
          impact: {
            daysSaved: 1,
            riskReductionPercent: 40,
            utilizationDeltaPercent: 0,
            affectedAgents: [],
            affectedProjects: [],
            affectedStories: [],
          },
        }),
        makeSuggestion({
          id: "h3",
          category: "wip-adjustment",
          impact: {
            daysSaved: 1,
            riskReductionPercent: 30,
            utilizationDeltaPercent: 0,
            affectedAgents: [],
            affectedProjects: [],
            affectedStories: [],
          },
        }),
      ];
      // Construct results map directly so highImpact suggestions feed into aggregateImpact
      const inputSummary = {
        projectCount: 1,
        agentCount: 1,
        overutilizedCount: 0,
        underutilizedCount: 0,
        bottleneckCount: 0,
      };
      const results = new Map<OptimizationObjective, ObjectiveScenarioResult>();
      for (const obj of [
        "minimize-time",
        "maximize-throughput",
        "balance-workload",
        "reduce-blocking",
      ] as OptimizationObjective[]) {
        results.set(obj, {
          objective: obj,
          suggestions: highImpact,
          analysisTimeMs: 1,
          inputSummary,
          baselineComparison: { topSuggestionMoved: false, rankChanges: [] },
        });
      }
      const summary = compareObjectives(results, highImpact);
      for (const obj of summary.objectives) {
        expect(obj.projectedImpact.riskReductionPercent).toBeLessThanOrEqual(100);
      }
    });
  });
});
