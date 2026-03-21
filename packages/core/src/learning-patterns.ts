/**
 * Learning Patterns — Detect recurring failure patterns across agent sessions
 *
 * Analyzes SessionLearning records to find error categories that recur 3+ times,
 * indicating systemic issues that should be addressed.
 */

import type { SessionLearning } from "./types.js";

/** A recurring failure pattern detected from learning data */
export interface FailurePattern {
  /** Error category that recurs */
  category: string;
  /** Number of times this category appeared */
  occurrenceCount: number;
  /** Story IDs affected by this pattern */
  affectedStories: string[];
  /** ISO timestamp of most recent occurrence */
  lastOccurrence: string;
  /** Suggested action to address the pattern */
  suggestedAction: string;
}

/** Minimum occurrences to consider a pattern */
const MIN_PATTERN_THRESHOLD = 3;

/** Map error categories to suggested actions */
function suggestAction(category: string): string {
  if (/ECONNREFUSED|ETIMEDOUT|timeout/i.test(category)) {
    return "Check network connectivity and service availability";
  }
  if (/parse|syntax|YAML/i.test(category)) {
    return "Review input data format and validation";
  }
  if (/permission|EACCES|auth/i.test(category)) {
    return "Verify file permissions and authentication credentials";
  }
  if (/ENOSPC|disk|memory/i.test(category)) {
    return "Check available disk space and memory";
  }
  if (/exit_code/i.test(category)) {
    return "Review agent logs for root cause of non-zero exit";
  }
  return "Investigate recurring error and consider adding preventive checks";
}

/**
 * Detect recurring failure patterns from learning records.
 *
 * Groups failed sessions by error category, filters to those with 3+ occurrences,
 * and returns patterns sorted by count descending.
 *
 * @param learnings - All learning records (typically from store.list())
 * @returns Detected patterns sorted by occurrence count (most frequent first)
 */
export function detectPatterns(learnings: SessionLearning[]): FailurePattern[] {
  // Only analyze failures
  const failures = learnings.filter((l) => l.outcome === "failed");

  // Group by error category
  const categoryMap = new Map<
    string,
    { count: number; stories: Set<string>; lastOccurrence: string }
  >();

  for (const l of failures) {
    for (const cat of l.errorCategories) {
      const existing = categoryMap.get(cat);
      if (existing) {
        existing.count++;
        existing.stories.add(l.storyId);
        if (l.capturedAt > existing.lastOccurrence) {
          existing.lastOccurrence = l.capturedAt;
        }
      } else {
        categoryMap.set(cat, {
          count: 1,
          stories: new Set([l.storyId]),
          lastOccurrence: l.capturedAt,
        });
      }
    }
  }

  // Filter to patterns (3+ occurrences) and convert
  const patterns: FailurePattern[] = [];

  for (const [category, data] of categoryMap) {
    if (data.count >= MIN_PATTERN_THRESHOLD) {
      patterns.push({
        category,
        occurrenceCount: data.count,
        affectedStories: [...data.stories],
        lastOccurrence: data.lastOccurrence,
        suggestedAction: suggestAction(category),
      });
    }
  }

  // Sort by count descending
  patterns.sort((a, b) => b.occurrenceCount - a.occurrenceCount);

  return patterns;
}
