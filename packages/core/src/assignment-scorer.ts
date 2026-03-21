/**
 * Assignment Scorer — Score agent-story affinity based on past performance
 *
 * Default scoring formula:
 *   score = (successRate * 0.4) + (domainMatch * 0.3) + (speedFactor * 0.2) + (retryPenalty * -0.1)
 *
 * Pluggable via registerAssignmentScorer() — custom scorers override default.
 * No ML dependency — pure rule-based arithmetic (AC-AI-4, NFR-AI-D3).
 */

import type { SessionLearning } from "./types.js";

/** Score result for a single agent-story pair */
export interface AffinityScore {
  agentId: string;
  score: number;
  successRate: number;
  domainMatch: number;
  speedFactor: number;
  retryPenalty: number;
}

/** Custom scorer function signature */
export type AssignmentScorerFn = (
  agentId: string,
  storyDomainTags: string[],
  agentLearnings: SessionLearning[],
) => number;

// =============================================================================
// Pluggable Scorer Registry
// =============================================================================

let customScorer: AssignmentScorerFn | null = null;

/**
 * Register a custom assignment scorer (replaces default).
 * Follows registerReplayHandler / registerClassificationRule pattern.
 */
export function registerAssignmentScorer(scorer: AssignmentScorerFn): void {
  customScorer = scorer;
}

/** Clear custom scorer — reset to default (for testing) */
export function clearAssignmentScorers(): void {
  customScorer = null;
}

// =============================================================================
// Default Scoring
// =============================================================================

/**
 * Score agent-story affinity based on learning history.
 *
 * @param agentId - Agent to score
 * @param storyDomainTags - Domain tags of the target story
 * @param agentLearnings - All learning records for this agent
 * @returns AffinityScore with breakdown
 */
export function scoreAffinity(
  agentId: string,
  storyDomainTags: string[],
  agentLearnings: SessionLearning[],
): AffinityScore {
  // Use custom scorer if registered
  if (customScorer) {
    const score = customScorer(agentId, storyDomainTags, agentLearnings);
    return { agentId, score, successRate: 0, domainMatch: 0, speedFactor: 0, retryPenalty: 0 };
  }

  // No history → neutral score
  if (agentLearnings.length === 0) {
    return {
      agentId,
      score: 0.5,
      successRate: 0.5,
      domainMatch: 0,
      speedFactor: 0.5,
      retryPenalty: 0,
    };
  }

  // Success rate (0-1)
  const completed = agentLearnings.filter((l) => l.outcome === "completed").length;
  const successRate = completed / agentLearnings.length;

  // Domain match (0-1): fraction of story domains the agent has experience with
  let domainMatch = 0;
  if (storyDomainTags.length > 0) {
    const agentDomains = new Set(agentLearnings.flatMap((l) => l.domainTags));
    const matches = storyDomainTags.filter((tag) => agentDomains.has(tag)).length;
    domainMatch = matches / storyDomainTags.length;
  }

  // Speed factor (0-1): smooth ratio of median to max duration (faster = higher)
  const durations = agentLearnings
    .filter((l) => l.outcome === "completed")
    .map((l) => l.durationMs);
  let speedFactor = 0.5;
  if (durations.length >= 2) {
    durations.sort((a, b) => a - b);
    const median = durations[Math.floor(durations.length / 2)];
    const maxDuration = durations[durations.length - 1];
    speedFactor = maxDuration > 0 ? Math.max(0.1, Math.min(0.9, 1 - median / maxDuration)) : 0.5;
  }

  // Retry penalty (0-1): higher retries = worse
  const totalRetries = agentLearnings.reduce((sum, l) => sum + l.retryCount, 0);
  const retryPenalty = Math.min(totalRetries / (agentLearnings.length * 3), 1);

  // Weighted score
  const score = successRate * 0.4 + domainMatch * 0.3 + speedFactor * 0.2 - retryPenalty * 0.1;

  return {
    agentId,
    score: Math.max(0, Math.min(1, score)),
    successRate,
    domainMatch,
    speedFactor,
    retryPenalty,
  };
}
