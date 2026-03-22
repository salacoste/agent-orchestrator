/**
 * Sprint Forecaster — Predictive completion probability (Story 43.2).
 *
 * Estimates sprint completion dates using percentile analysis
 * of historical session durations from the learning store.
 * Domain-matched sampling for accuracy.
 */
import type { SessionLearning } from "./types.js";

/** Confidence level based on sample count. */
export type ConfidenceLevel = "high" | "medium" | "low" | "insufficient";

/** Forecast result with percentile estimates. */
export interface SprintForecast {
  /** Estimated total remaining duration at P50 (median). */
  p50Ms: number;
  /** Estimated total remaining duration at P80. */
  p80Ms: number;
  /** Estimated total remaining duration at P95. */
  p95Ms: number;
  /** Number of backlog stories used in forecast. */
  backlogCount: number;
  /** Number of historical samples used. */
  sampleCount: number;
  /** Data quality confidence. */
  confidence: ConfidenceLevel;
  /** Estimated completion dates (now + duration). */
  p50Date: string;
  p80Date: string;
  p95Date: string;
}

/** Backlog story with optional domain tags for matching. */
export interface BacklogStory {
  storyId: string;
  domainTags?: string[];
}

/**
 * Compute sprint forecast from historical learning data.
 *
 * @param backlogStories — stories remaining to complete
 * @param learnings — historical session records
 * @param defaultDurationMs — fallback duration when no matching data (default: 2h)
 */
export function computeForecast(
  backlogStories: BacklogStory[],
  learnings: SessionLearning[],
  defaultDurationMs: number = 2 * 60 * 60 * 1000,
): SprintForecast {
  if (backlogStories.length === 0) {
    const now = new Date().toISOString();
    return {
      p50Ms: 0,
      p80Ms: 0,
      p95Ms: 0,
      backlogCount: 0,
      sampleCount: 0,
      confidence: "high",
      p50Date: now,
      p80Date: now,
      p95Date: now,
    };
  }

  // Collect duration samples per story, domain-matched
  const allDurations: number[] = [];

  for (const story of backlogStories) {
    const storyDuration = estimateStoryDuration(
      story.domainTags ?? [],
      learnings,
      defaultDurationMs,
    );
    allDurations.push(storyDuration.duration);
  }

  const totalSampleCount = learnings.filter((l) => l.outcome === "completed").length;
  const confidence = getConfidence(totalSampleCount);

  // Sum durations for total remaining work estimate
  const totalMs = allDurations.reduce((sum, d) => sum + d, 0);

  // Apply variance factor for percentile spread
  // P50 = base estimate, P80 = 1.3x, P95 = 1.7x (empirical software estimation factors)
  const p50Ms = Math.round(totalMs);
  const p80Ms = Math.round(totalMs * 1.3);
  const p95Ms = Math.round(totalMs * 1.7);

  const now = Date.now();

  return {
    p50Ms,
    p80Ms,
    p95Ms,
    backlogCount: backlogStories.length,
    sampleCount: totalSampleCount,
    confidence,
    p50Date: new Date(now + p50Ms).toISOString(),
    p80Date: new Date(now + p80Ms).toISOString(),
    p95Date: new Date(now + p95Ms).toISOString(),
  };
}

/** Estimate duration for a single story based on domain-matched historical data. */
function estimateStoryDuration(
  domainTags: string[],
  learnings: SessionLearning[],
  defaultDurationMs: number,
): { duration: number; matched: number } {
  const completed = learnings.filter((l) => l.outcome === "completed" && l.durationMs > 0);

  if (completed.length === 0) {
    return { duration: defaultDurationMs, matched: 0 };
  }

  // Domain-matched: find sessions with overlapping domain tags
  let matched: SessionLearning[] = [];
  if (domainTags.length > 0) {
    matched = completed.filter((l) => l.domainTags.some((tag) => domainTags.includes(tag)));
  }

  // Fall back to all completed sessions if no domain matches
  const pool = matched.length >= 3 ? matched : completed;

  // Use median duration from the pool
  const durations = pool.map((l) => l.durationMs).sort((a, b) => a - b);
  const median = durations[Math.floor(durations.length / 2)];

  return { duration: median, matched: matched.length };
}

/** Determine confidence level from sample count. */
function getConfidence(sampleCount: number): ConfidenceLevel {
  if (sampleCount >= 20) return "high";
  if (sampleCount >= 10) return "medium";
  if (sampleCount >= 5) return "low";
  return "insufficient";
}
