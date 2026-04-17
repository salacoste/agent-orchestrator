/**
 * In-memory optimization feedback store — globalThis singleton.
 * Follows utilization-history.ts singleton pattern.
 * Story 56.7 Task 3.
 */

import {
  type OptimizationFeedback,
  type OptimizationCategory,
  MAX_FEEDBACK_ENTRIES,
} from "./optimization-types";

interface FeedbackState {
  entries: OptimizationFeedback[];
}

const globalForFeedback = globalThis as typeof globalThis & {
  _aoOptimizationFeedback?: FeedbackState;
};

function getState(): FeedbackState {
  if (!globalForFeedback._aoOptimizationFeedback) {
    globalForFeedback._aoOptimizationFeedback = { entries: [] };
  }
  return globalForFeedback._aoOptimizationFeedback;
}

/**
 * Record an accept/dismiss action for an optimization suggestion.
 * Caps at MAX_FEEDBACK_ENTRIES, removing oldest first.
 */
export function recordOptimizationFeedback(feedback: OptimizationFeedback): void {
  const state = getState();
  state.entries.push(feedback);

  // Cap at MAX_FEEDBACK_ENTRIES
  if (state.entries.length > MAX_FEEDBACK_ENTRIES) {
    state.entries = state.entries.slice(-MAX_FEEDBACK_ENTRIES);
  }
}

/**
 * Retrieve feedback entries, optionally filtered by suggestion ID.
 */
export function getOptimizationFeedback(suggestionId?: string): OptimizationFeedback[] {
  const state = getState();
  if (suggestionId === undefined) return state.entries;
  return state.entries.filter((f) => f.suggestionId === suggestionId);
}

/**
 * Calculate the dismissal rate for a given category.
 * Returns 0-1 (e.g., 0.75 means 75% of suggestions in this category were dismissed).
 */
export function getDismissalRate(category: OptimizationCategory): number {
  const state = getState();
  const categoryFeedback = state.entries.filter((f) => f.category === category);
  if (categoryFeedback.length === 0) return 0;
  const dismissed = categoryFeedback.filter((f) => f.action === "dismissed").length;
  return dismissed / categoryFeedback.length;
}

/** Reset all feedback entries. Used by DELETE /api/risk/optimization and test teardown. */
export function _resetOptimizationFeedback(): void {
  globalForFeedback._aoOptimizationFeedback = undefined;
}
