/**
 * Confidence calculator — per-file agent certainty (Story 45.6).
 *
 * Pure function. Computes confidence indicators for modified files
 * based on session-level retry count, error categories, and file count.
 */

/** Confidence level. */
export type ConfidenceLevel = "high" | "medium" | "low";

/** Per-file confidence result. */
export interface FileConfidence {
  file: string;
  confidence: ConfidenceLevel;
  score: number;
  reasons: string[];
}

/** Input for confidence calculation. */
export interface ConfidenceInput {
  retryCount: number;
  errorCategories: string[];
  filesModified: string[];
}

/** Score thresholds. */
const HIGH_THRESHOLD = 70;
const MEDIUM_THRESHOLD = 40;

/** Penalty weights. */
const RETRY_PENALTY = 20;
const ERROR_PENALTY = 15;
const COMPLEXITY_PENALTY = 5;
const COMPLEXITY_FILE_THRESHOLD = 10;

/**
 * Compute confidence score from session data.
 * Returns 0-100 (higher = more confident).
 */
export function computeConfidenceScore(input: ConfidenceInput): {
  score: number;
  reasons: string[];
} {
  let score = 100;
  const reasons: string[] = [];

  // Retry penalty
  if (input.retryCount > 0) {
    const penalty = input.retryCount * RETRY_PENALTY;
    score -= penalty;
    reasons.push(`${input.retryCount} retries (-${penalty})`);
  }

  // Error category penalty
  if (input.errorCategories.length > 0) {
    const penalty = input.errorCategories.length * ERROR_PENALTY;
    score -= penalty;
    reasons.push(`${input.errorCategories.length} error types (-${penalty})`);
  }

  // Complexity penalty (many files = higher risk)
  if (input.filesModified.length > COMPLEXITY_FILE_THRESHOLD) {
    score -= COMPLEXITY_PENALTY;
    reasons.push(`${input.filesModified.length} files modified (-${COMPLEXITY_PENALTY})`);
  }

  if (reasons.length === 0) {
    reasons.push("No retries or errors detected");
  }

  return { score: Math.max(0, Math.min(100, score)), reasons };
}

/**
 * Map score to confidence level.
 */
export function scoreToLevel(score: number): ConfidenceLevel {
  if (score >= HIGH_THRESHOLD) return "high";
  if (score >= MEDIUM_THRESHOLD) return "medium";
  return "low";
}

/**
 * Calculate per-file confidence for a session.
 * Returns files sorted alphabetically (all share session-level score).
 *
 * Pure function — no I/O, no side effects.
 */
export function calculateConfidence(input: ConfidenceInput): FileConfidence[] {
  if (input.filesModified.length === 0) return [];

  const { score, reasons } = computeConfidenceScore(input);
  const confidence = scoreToLevel(score);

  return [...input.filesModified]
    .sort()
    .map((file) => ({ file, confidence, score, reasons: [...reasons] }));
}
