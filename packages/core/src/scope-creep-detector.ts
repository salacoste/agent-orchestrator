/**
 * Scope Creep Detector — Token/file budget monitoring (Story 43.6).
 *
 * Compares a running agent's resource usage against historical averages.
 * Flags agents exceeding a configurable multiplier of the average.
 * Tracks METRICS (tokens, files), not session lifecycle (that's loop detector).
 */
import type { SessionLearning } from "./types.js";

/** Historical averages from completed sessions. */
export interface HistoricalAverages {
  avgTokensPerStory: number;
  avgFilesPerStory: number;
  sampleCount: number;
}

/** Scope creep warning for an agent. */
export interface ScopeCreepWarning {
  agentId: string;
  storyId: string;
  metric: "tokens" | "files";
  current: number;
  average: number;
  threshold: number;
  suggestion: string;
}

/** Session usage snapshot for scope check. */
export interface SessionUsage {
  agentId: string;
  storyId: string;
  tokensUsed: number;
  filesModified: number;
}

/**
 * Compute historical averages from completed learning records.
 */
export function computeHistoricalAverages(learnings: SessionLearning[]): HistoricalAverages {
  const completed = learnings.filter((l) => l.outcome === "completed");

  if (completed.length === 0) {
    return { avgTokensPerStory: 0, avgFilesPerStory: 0, sampleCount: 0 };
  }

  const totalTokens = completed.reduce((sum, l) => {
    // Estimate tokens from durationMs if no explicit token count
    // SessionLearning doesn't have tokens directly — use durationMs as proxy
    // 1 hour ≈ 50K tokens is a rough estimate for agent sessions
    return sum + (l.durationMs / 3_600_000) * 50_000;
  }, 0);

  const totalFiles = completed.reduce((sum, l) => sum + l.filesModified.length, 0);

  return {
    avgTokensPerStory: Math.round(totalTokens / completed.length),
    avgFilesPerStory: Math.round(totalFiles / completed.length),
    sampleCount: completed.length,
  };
}

/**
 * Check if a session's usage exceeds scope creep thresholds.
 *
 * @param usage — current session resource usage
 * @param averages — historical averages from computeHistoricalAverages
 * @param multiplier — threshold multiplier (default: 2x average)
 * @returns array of warnings (empty if no scope creep)
 */
export function checkScopeCreep(
  usage: SessionUsage,
  averages: HistoricalAverages,
  multiplier: number = 2,
): ScopeCreepWarning[] {
  const warnings: ScopeCreepWarning[] = [];

  if (averages.sampleCount === 0) {
    return warnings; // No historical data — can't detect scope creep
  }

  if (
    averages.avgTokensPerStory > 0 &&
    usage.tokensUsed > averages.avgTokensPerStory * multiplier
  ) {
    warnings.push({
      agentId: usage.agentId,
      storyId: usage.storyId,
      metric: "tokens",
      current: usage.tokensUsed,
      average: averages.avgTokensPerStory,
      threshold: averages.avgTokensPerStory * multiplier,
      suggestion: `Token usage (${usage.tokensUsed.toLocaleString()}) exceeds ${multiplier}x average (${averages.avgTokensPerStory.toLocaleString()}). Consider reviewing story scope or agent approach.`,
    });
  }

  if (
    averages.avgFilesPerStory > 0 &&
    usage.filesModified > averages.avgFilesPerStory * multiplier
  ) {
    warnings.push({
      agentId: usage.agentId,
      storyId: usage.storyId,
      metric: "files",
      current: usage.filesModified,
      average: averages.avgFilesPerStory,
      threshold: averages.avgFilesPerStory * multiplier,
      suggestion: `Files modified (${usage.filesModified}) exceeds ${multiplier}x average (${averages.avgFilesPerStory}). Agent may be touching code outside story scope.`,
    });
  }

  return warnings;
}
