/**
 * Optimization learning loop module for Story 56.11.
 *
 * Pure computation module that takes OptimizationFeedback[] and derives
 * learning weights that boost categories with high acceptance rates and
 * penalize categories with high dismissal rates.
 *
 * NFR-E4-1: Learning computation completes within the 15-second optimization budget.
 * NFR-R2: Results are deterministic for identical inputs.
 */

import {
  LEARNING_BOOST_MAX,
  LEARNING_PENALTY_MAX,
  LEARNING_MIN_SAMPLES,
  type OptimizationCategory,
  type OptimizationFeedback,
  type OptimizationSuggestion,
  type CategoryAcceptanceRate,
  type LearningWeights,
} from "./optimization-types";

// ---------------------------------------------------------------------------
// Acceptance rates
// ---------------------------------------------------------------------------

/**
 * Compute acceptance rates per category from feedback entries.
 * Returns one entry per category that has at least one feedback entry.
 */
export function computeCategoryAcceptanceRates(
  feedback: OptimizationFeedback[],
): CategoryAcceptanceRate[] {
  const byCategory = new Map<OptimizationCategory, { accepted: number; dismissed: number }>();

  for (const entry of feedback) {
    const stats = byCategory.get(entry.category) ?? { accepted: 0, dismissed: 0 };
    if (entry.action === "accepted") {
      stats.accepted++;
    } else {
      stats.dismissed++;
    }
    byCategory.set(entry.category, stats);
  }

  const results: CategoryAcceptanceRate[] = [];
  for (const [category, stats] of byCategory) {
    const total = stats.accepted + stats.dismissed;
    results.push({
      category,
      acceptedCount: stats.accepted,
      dismissedCount: stats.dismissed,
      total,
      rate: total > 0 ? stats.accepted / total : 0,
    });
  }

  return results;
}

// ---------------------------------------------------------------------------
// Learning weights
// ---------------------------------------------------------------------------

/**
 * Derive learning weights from feedback entries.
 * Categories with >= LEARNING_MIN_SAMPLES entries receive a multiplier
 * based on acceptance rate: rate * LEARNING_BOOST_MAX, clamped to
 * [LEARNING_PENALTY_MAX, LEARNING_BOOST_MAX].
 * Categories below the minimum sample threshold get 1.0 (neutral).
 */
export function computeLearningWeights(feedback: OptimizationFeedback[]): LearningWeights {
  const rates = computeCategoryAcceptanceRates(feedback);
  const categoryBoosts = new Map<OptimizationCategory, number>();

  for (const { category, total, rate } of rates) {
    if (total < LEARNING_MIN_SAMPLES) {
      categoryBoosts.set(category, 1.0);
      continue;
    }
    // Map acceptance rate to multiplier:
    // rate = 1.0 → BOOST_MAX (e.g., 1.5)
    // rate = 0.5 → 1.0 (neutral — half of BOOST_MAX)
    // rate = 0.0 → PENALTY_MAX (e.g., 0.5) — clamped
    const rawMultiplier = rate * LEARNING_BOOST_MAX;
    const multiplier = Math.max(LEARNING_PENALTY_MAX, Math.min(LEARNING_BOOST_MAX, rawMultiplier));
    categoryBoosts.set(category, Math.round(multiplier * 1000) / 1000);
  }

  return {
    categoryBoosts,
    generatedAt: Date.now(),
  };
}

// ---------------------------------------------------------------------------
// Apply weights to suggestions
// ---------------------------------------------------------------------------

/**
 * Apply learning weights to suggestion priority scores.
 * Multiplies each suggestion's priority by its category's weight.
 * Returns a new sorted array (highest priority first).
 * If weights is null/undefined, returns suggestions unchanged.
 */
export function applyLearningWeights(
  suggestions: OptimizationSuggestion[],
  weights: LearningWeights | null | undefined,
): OptimizationSuggestion[] {
  if (!weights || weights.categoryBoosts.size === 0) {
    return suggestions;
  }

  return suggestions
    .map((s) => {
      const multiplier = weights.categoryBoosts.get(s.category) ?? 1.0;
      return {
        ...s,
        priority: Math.round(s.priority * multiplier * 100) / 100,
      };
    })
    .sort((a, b) => b.priority - a.priority);
}
