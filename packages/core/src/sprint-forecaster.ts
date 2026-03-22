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

  // Filter completed sessions once (M1 fix — avoid re-filtering per story)
  const completed = learnings.filter((l) => l.outcome === "completed" && l.durationMs > 0);
  const confidence = getConfidence(completed.length);

  // Compute per-story percentiles from actual data distribution (H1 fix)
  let totalP50 = 0;
  let totalP80 = 0;
  let totalP95 = 0;

  for (const story of backlogStories) {
    const percentiles = estimateStoryPercentiles(
      story.domainTags ?? [],
      completed,
      defaultDurationMs,
    );
    totalP50 += percentiles.p50;
    totalP80 += percentiles.p80;
    totalP95 += percentiles.p95;
  }

  const p50Ms = Math.round(totalP50);
  const p80Ms = Math.round(totalP80);
  const p95Ms = Math.round(totalP95);

  const now = Date.now();

  return {
    p50Ms,
    p80Ms,
    p95Ms,
    backlogCount: backlogStories.length,
    sampleCount: completed.length,
    confidence,
    p50Date: new Date(now + p50Ms).toISOString(),
    p80Date: new Date(now + p80Ms).toISOString(),
    p95Date: new Date(now + p95Ms).toISOString(),
  };
}

/** Estimate P50/P80/P95 duration for a single story from actual data distribution. */
function estimateStoryPercentiles(
  domainTags: string[],
  completed: SessionLearning[],
  defaultDurationMs: number,
): { p50: number; p80: number; p95: number } {
  if (completed.length === 0) {
    return { p50: defaultDurationMs, p80: defaultDurationMs, p95: defaultDurationMs };
  }

  // Domain-matched: find sessions with overlapping domain tags
  let matched: SessionLearning[] = [];
  if (domainTags.length > 0) {
    matched = completed.filter((l) => l.domainTags.some((tag) => domainTags.includes(tag)));
  }

  // Fall back to all completed sessions if fewer than 3 domain matches
  const pool = matched.length >= 3 ? matched : completed;

  // Sort durations and compute actual percentiles
  const durations = pool.map((l) => l.durationMs).sort((a, b) => a - b);
  const len = durations.length;

  return {
    p50: durations[Math.floor(0.5 * (len - 1))],
    p80: durations[Math.floor(0.8 * (len - 1))],
    p95: durations[Math.min(Math.floor(0.95 * (len - 1)), len - 1)],
  };
}

/** Determine confidence level from sample count. */
function getConfidence(sampleCount: number): ConfidenceLevel {
  if (sampleCount >= 20) return "high";
  if (sampleCount >= 10) return "medium";
  if (sampleCount >= 5) return "low";
  return "insufficient";
}
