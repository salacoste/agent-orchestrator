/**
 * Pre-flight check — agent success prediction (Story 47.6).
 *
 * Pure function. Predicts spawn success from historical learning data.
 * Advisory only — never blocks spawning, only warns.
 */

import type { SessionLearning } from "./types.js";

/** Risk severity. */
export type RiskSeverity = "low" | "medium" | "high";

/** A risk factor identified in pre-flight. */
export interface RiskFactor {
  name: string;
  severity: RiskSeverity;
  description: string;
}

/** Pre-flight check result. */
export interface PreFlightResult {
  successRate: number;
  estimatedDurationMs: number;
  riskFactors: RiskFactor[];
  matchingSessionCount: number;
  advisory: string;
}

/** Default optimistic success rate when no history. */
const DEFAULT_SUCCESS_RATE = 0.8;

/** Thresholds. */
const HIGH_COMPLEXITY_AC_COUNT = 7;
const HIGH_FAILURE_RATE = 0.4;
const LOW_SAMPLE_THRESHOLD = 3;

/**
 * Run a pre-flight check before spawning an agent.
 *
 * Matches historical sessions by overlapping domainTags, computes
 * success rate and duration estimates, identifies risk factors.
 *
 * Pure function — no I/O, advisory only.
 */
export function preFlightCheck(
  domainTags: string[],
  acCount: number,
  learnings: SessionLearning[],
): PreFlightResult {
  const riskFactors: RiskFactor[] = [];

  // Match sessions by overlapping domain tags
  const domainSet = new Set(domainTags);
  const matching = learnings.filter((l) => l.domainTags.some((tag) => domainSet.has(tag)));

  // Compute success rate
  let successRate: number;
  let estimatedDurationMs: number;

  if (matching.length === 0) {
    successRate = DEFAULT_SUCCESS_RATE;
    estimatedDurationMs = 0;

    riskFactors.push({
      name: "Domain novelty",
      severity: "high",
      description: `No historical sessions match domains: ${domainTags.join(", ")}`,
    });
  } else {
    const completed = matching.filter((l) => l.outcome === "completed").length;
    successRate = Math.round((completed / matching.length) * 100) / 100;

    const completedSessions = matching.filter((l) => l.outcome === "completed");
    estimatedDurationMs =
      completedSessions.length > 0
        ? Math.round(
            completedSessions.reduce((sum, l) => sum + l.durationMs, 0) / completedSessions.length,
          )
        : 0;
  }

  // Risk: high complexity
  if (acCount > HIGH_COMPLEXITY_AC_COUNT) {
    riskFactors.push({
      name: "High complexity",
      severity: "medium",
      description: `${acCount} acceptance criteria — above average complexity`,
    });
  }

  // Risk: recent failures
  if (matching.length > 0) {
    const recent = matching.slice(-10);
    const recentFailed = recent.filter(
      (l) => l.outcome === "failed" || l.outcome === "blocked",
    ).length;
    const recentFailRate = recentFailed / recent.length;

    if (recentFailRate > HIGH_FAILURE_RATE) {
      riskFactors.push({
        name: "Recent failures",
        severity: "high",
        description: `${Math.round(recentFailRate * 100)}% failure rate in last ${recent.length} matching sessions`,
      });
    }
  }

  // Risk: low sample size
  if (matching.length > 0 && matching.length < LOW_SAMPLE_THRESHOLD) {
    riskFactors.push({
      name: "Low sample",
      severity: "low",
      description: `Only ${matching.length} matching session${matching.length !== 1 ? "s" : ""} — prediction may be unreliable`,
    });
  }

  // Build advisory message
  const pct = Math.round(successRate * 100);
  let advisory: string;
  if (riskFactors.some((r) => r.severity === "high")) {
    advisory = `Caution: ${pct}% predicted success with high-risk factors.`;
  } else if (successRate >= 0.7) {
    advisory = `Good to go: ${pct}% predicted success.`;
  } else {
    advisory = `Moderate risk: ${pct}% predicted success.`;
  }

  return {
    successRate,
    estimatedDurationMs,
    riskFactors,
    matchingSessionCount: matching.length,
    advisory,
  };
}
