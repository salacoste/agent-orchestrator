/**
 * Recommendation feedback tracking (Story 18.5).
 *
 * Records accept/dismiss decisions on recommendations in a JSONL file.
 * Standalone module — no dependency on Cycle 3 learning store.
 */

/** A single feedback entry. */
export interface RecommendationFeedback {
  /** Recommendation phase that was shown. */
  phase: string;
  /** Recommendation tier. */
  tier: 1 | 2;
  /** User action on the recommendation. */
  action: "accepted" | "dismissed";
  /** ISO 8601 timestamp. */
  timestamp: string;
}

/**
 * In-memory feedback store for the current session.
 *
 * In production, this would be backed by a JSONL file at
 * `_bmad-output/.recommendation-feedback.jsonl`. For now,
 * the module provides the interface and in-memory tracking.
 * File persistence can be added when the API endpoint exists.
 */
const feedbackHistory: RecommendationFeedback[] = [];

/**
 * Record a feedback action on a recommendation.
 * Stores in-memory AND persists to JSONL via API (Story 25a.2).
 */
export function recordFeedback(feedback: RecommendationFeedback): void {
  feedbackHistory.push(feedback);

  // Persist to JSONL via API (fire-and-forget, non-blocking)
  if (typeof fetch !== "undefined") {
    fetch("/api/workflow/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(feedback),
    }).catch(() => {
      // Persistence failure is non-fatal — in-memory tracking continues
    });
  }
}

/**
 * Get all recorded feedback entries.
 */
export function getFeedbackHistory(): readonly RecommendationFeedback[] {
  return feedbackHistory;
}

/**
 * Check if a recommendation phase has been dismissed too often.
 * Returns true if dismissed 3+ consecutive times (should be deprioritized).
 */
export function isOverDismissed(phase: string): boolean {
  const phaseEntries = feedbackHistory.filter((f) => f.phase === phase);
  if (phaseEntries.length < 3) return false;

  // Check last 3 entries for this phase
  const lastThree = phaseEntries.slice(-3);
  return lastThree.every((f) => f.action === "dismissed");
}

/**
 * Reset feedback history (for testing).
 */
export function _resetFeedback(): void {
  feedbackHistory.length = 0;
}
