/**
 * Tests for optimization-learning module (Story 56.11).
 */
import { describe, expect, it } from "vitest";
import {
  computeCategoryAcceptanceRates,
  computeLearningWeights,
  applyLearningWeights,
} from "../optimization-learning.js";
import {
  type OptimizationFeedback,
  type OptimizationSuggestion,
  LEARNING_BOOST_MAX,
  LEARNING_PENALTY_MAX,
} from "../optimization-types.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeFeedback(
  category: OptimizationFeedback["category"],
  action: OptimizationFeedback["action"],
  count: number,
): OptimizationFeedback[] {
  return Array.from({ length: count }, (_, i) => ({
    suggestionId: `opt-${category}-${i}`,
    category,
    action,
    timestamp: Date.now() - (count - i) * 1000,
  }));
}

const baseSuggestion: OptimizationSuggestion = {
  id: "opt-test-1",
  category: "agent-rebalancing",
  title: "Test suggestion",
  description: "Test",
  impact: {
    daysSaved: 2,
    riskReductionPercent: 10,
    utilizationDeltaPercent: 5,
    affectedAgents: [],
    affectedProjects: [],
    affectedStories: [],
  },
  confidence: 80,
  priority: 50,
  createdAt: Date.now(),
  data: {},
};

// ---------------------------------------------------------------------------
// computeCategoryAcceptanceRates
// ---------------------------------------------------------------------------

describe("computeCategoryAcceptanceRates", () => {
  it("returns empty array for empty feedback", () => {
    const rates = computeCategoryAcceptanceRates([]);
    expect(rates).toEqual([]);
  });

  it("computes correct rates for single category", () => {
    const feedback: OptimizationFeedback[] = [
      ...makeFeedback("agent-rebalancing", "accepted", 3),
      ...makeFeedback("agent-rebalancing", "dismissed", 1),
    ];
    const rates = computeCategoryAcceptanceRates(feedback);
    expect(rates).toHaveLength(1);
    expect(rates[0].category).toBe("agent-rebalancing");
    expect(rates[0].acceptedCount).toBe(3);
    expect(rates[0].dismissedCount).toBe(1);
    expect(rates[0].total).toBe(4);
    expect(rates[0].rate).toBe(0.75);
  });

  it("computes rates for multiple categories independently", () => {
    const feedback: OptimizationFeedback[] = [
      ...makeFeedback("agent-rebalancing", "accepted", 4),
      ...makeFeedback("wip-adjustment", "dismissed", 3),
    ];
    const rates = computeCategoryAcceptanceRates(feedback);
    expect(rates).toHaveLength(2);

    const rebalancing = rates.find((r) => r.category === "agent-rebalancing")!;
    expect(rebalancing.rate).toBe(1.0);

    const wip = rates.find((r) => r.category === "wip-adjustment")!;
    expect(wip.rate).toBe(0.0);
  });

  it("returns rate 0 when all dismissed", () => {
    const feedback = makeFeedback("capacity-scaling", "dismissed", 5);
    const rates = computeCategoryAcceptanceRates(feedback);
    expect(rates[0].rate).toBe(0);
  });

  it("returns rate 1 when all accepted", () => {
    const feedback = makeFeedback("priority-reorder", "accepted", 5);
    const rates = computeCategoryAcceptanceRates(feedback);
    expect(rates[0].rate).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// computeLearningWeights
// ---------------------------------------------------------------------------

describe("computeLearningWeights", () => {
  it("returns empty map for empty feedback", () => {
    const weights = computeLearningWeights([]);
    expect(weights.categoryBoosts.size).toBe(0);
  });

  it("returns neutral weight for categories below minimum samples", () => {
    const feedback = makeFeedback("agent-rebalancing", "accepted", 2);
    const weights = computeLearningWeights(feedback);
    expect(weights.categoryBoosts.get("agent-rebalancing")).toBe(1.0);
  });

  it("boosts categories with high acceptance rate", () => {
    // 5 accepted, 0 dismissed → rate = 1.0 → multiplier = 1.0 * 1.5 = 1.5
    const feedback = makeFeedback("agent-rebalancing", "accepted", 5);
    const weights = computeLearningWeights(feedback);
    expect(weights.categoryBoosts.get("agent-rebalancing")).toBe(LEARNING_BOOST_MAX);
  });

  it("penalizes categories with high dismissal rate", () => {
    // 0 accepted, 5 dismissed → rate = 0.0 → multiplier = 0.0 * 1.5 = 0.0 → clamped to PENALTY_MAX
    const feedback = makeFeedback("wip-adjustment", "dismissed", 5);
    const weights = computeLearningWeights(feedback);
    expect(weights.categoryBoosts.get("wip-adjustment")).toBe(LEARNING_PENALTY_MAX);
  });

  it("returns neutral for 50/50 acceptance rate", () => {
    // 3 accepted, 3 dismissed → rate = 0.5 → multiplier = 0.5 * 1.5 = 0.75
    const feedback: OptimizationFeedback[] = [
      ...makeFeedback("priority-reorder", "accepted", 3),
      ...makeFeedback("priority-reorder", "dismissed", 3),
    ];
    const weights = computeLearningWeights(feedback);
    expect(weights.categoryBoosts.get("priority-reorder")).toBe(0.75);
  });

  it("handles mixed feedback across multiple categories", () => {
    const feedback: OptimizationFeedback[] = [
      ...makeFeedback("agent-rebalancing", "accepted", 5), // rate 1.0 → 1.5
      ...makeFeedback("wip-adjustment", "dismissed", 4), // rate 0.0 → 0.5
      ...makeFeedback("capacity-scaling", "accepted", 1), // below min → 1.0
    ];
    const weights = computeLearningWeights(feedback);
    expect(weights.categoryBoosts.get("agent-rebalancing")).toBe(1.5);
    expect(weights.categoryBoosts.get("wip-adjustment")).toBe(0.5);
    expect(weights.categoryBoosts.get("capacity-scaling")).toBe(1.0);
  });

  it("clamps multiplier to BOOST_MAX for very high acceptance", () => {
    const feedback = makeFeedback("agent-rebalancing", "accepted", 10);
    const weights = computeLearningWeights(feedback);
    expect(weights.categoryBoosts.get("agent-rebalancing")).toBeLessThanOrEqual(LEARNING_BOOST_MAX);
  });

  it("clamps multiplier to PENALTY_MAX for zero acceptance", () => {
    const feedback = makeFeedback("agent-rebalancing", "dismissed", 10);
    const weights = computeLearningWeights(feedback);
    expect(weights.categoryBoosts.get("agent-rebalancing")).toBeGreaterThanOrEqual(
      LEARNING_PENALTY_MAX,
    );
  });

  it("sets generatedAt to a timestamp", () => {
    const before = Date.now();
    const weights = computeLearningWeights([]);
    const after = Date.now();
    expect(weights.generatedAt).toBeGreaterThanOrEqual(before);
    expect(weights.generatedAt).toBeLessThanOrEqual(after);
  });

  it("is deterministic: same inputs produce same outputs", () => {
    const feedback: OptimizationFeedback[] = [
      ...makeFeedback("agent-rebalancing", "accepted", 3),
      ...makeFeedback("agent-rebalancing", "dismissed", 2),
    ];
    const w1 = computeLearningWeights(feedback);
    const w2 = computeLearningWeights(feedback);
    expect(w1.categoryBoosts.get("agent-rebalancing")).toBe(
      w2.categoryBoosts.get("agent-rebalancing"),
    );
  });
});

// ---------------------------------------------------------------------------
// applyLearningWeights
// ---------------------------------------------------------------------------

describe("applyLearningWeights", () => {
  it("returns suggestions unchanged when weights is null", () => {
    const suggestions = [{ ...baseSuggestion }];
    const result = applyLearningWeights(suggestions, null);
    expect(result[0].priority).toBe(50);
  });

  it("returns suggestions unchanged when weights is undefined", () => {
    const suggestions = [{ ...baseSuggestion }];
    const result = applyLearningWeights(suggestions, undefined);
    expect(result[0].priority).toBe(50);
  });

  it("returns suggestions unchanged when weights map is empty", () => {
    const suggestions = [{ ...baseSuggestion }];
    const weights = { categoryBoosts: new Map(), generatedAt: Date.now() };
    const result = applyLearningWeights(suggestions, weights);
    expect(result[0].priority).toBe(50);
  });

  it("multiplies priority by category weight", () => {
    const suggestions = [{ ...baseSuggestion, category: "agent-rebalancing" as const }];
    const weights = {
      categoryBoosts: new Map([["agent-rebalancing", 1.5]]),
      generatedAt: Date.now(),
    };
    const result = applyLearningWeights(suggestions, weights);
    expect(result[0].priority).toBe(75); // 50 * 1.5
  });

  it("uses 1.0 multiplier for categories not in weights", () => {
    const suggestions = [{ ...baseSuggestion, category: "wip-adjustment" as const }];
    const weights = {
      categoryBoosts: new Map([["agent-rebalancing", 1.5]]),
      generatedAt: Date.now(),
    };
    const result = applyLearningWeights(suggestions, weights);
    expect(result[0].priority).toBe(50); // unchanged
  });

  it("sorts by adjusted priority descending", () => {
    const suggestions: OptimizationSuggestion[] = [
      { ...baseSuggestion, id: "low", category: "wip-adjustment", priority: 60 },
      { ...baseSuggestion, id: "high", category: "agent-rebalancing", priority: 40 },
    ];
    const weights = {
      categoryBoosts: new Map([
        ["agent-rebalancing", 1.5],
        ["wip-adjustment", 0.5],
      ]),
      generatedAt: Date.now(),
    };
    const result = applyLearningWeights(suggestions, weights);
    // high: 40 * 1.5 = 60, low: 60 * 0.5 = 30
    expect(result[0].id).toBe("high");
    expect(result[1].id).toBe("low");
  });

  it("handles empty suggestions array", () => {
    const weights = {
      categoryBoosts: new Map([["agent-rebalancing", 1.5]]),
      generatedAt: Date.now(),
    };
    const result = applyLearningWeights([], weights);
    expect(result).toEqual([]);
  });
});
