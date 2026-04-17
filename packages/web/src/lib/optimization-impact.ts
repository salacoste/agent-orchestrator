/**
 * Optimization impact analysis module for Story 56.10.
 *
 * Pure computation module that takes an OptimizationSuggestion and
 * OptimizationEngineInput, then produces an ImpactAnalysis with before/after
 * metrics (completion date shift, velocity delta, risk change).
 *
 * NFR-E4-1: Impact analysis completes within the 15-second optimization budget.
 * NFR-R2: Results are deterministic for identical inputs.
 */

import {
  VELOCITY_UTILIZATION_RATIO,
  type OptimizationEngineInput,
  type OptimizationSuggestion,
  type ImpactAnalysis,
  type MetricsSnapshot,
  type RiskChange,
  type SuggestionImpactDetail,
} from "./optimization-types";
import { calculateRiskScore } from "./risk-score";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Compute average utilization across all project summaries. */
function computeAvgUtilization(input: OptimizationEngineInput): number {
  if (input.projectSummaries.length === 0) return 0;
  const sum = input.projectSummaries.reduce((acc, p) => acc + p.avgUtilization, 0);
  return sum / input.projectSummaries.length;
}

/** Compute risk score using the same algorithm as the risk dashboard (risk-score.ts). */
function computeRiskScore(input: OptimizationEngineInput): number {
  if (input.riskFactors.length === 0 && input.bottlenecks.length === 0) return 0;
  // Aggregate across all projects — use first project ID as context
  const projectId =
    input.projectSummaries.length > 0 ? input.projectSummaries[0].projectId : "portfolio";
  const result = calculateRiskScore({
    projectId,
    riskFactors: input.riskFactors,
    bottlenecks: input.bottlenecks,
  });
  return result.score;
}

/** Build a metrics snapshot from the current input state. */
function buildBeforeMetrics(input: OptimizationEngineInput): MetricsSnapshot {
  const utilizationPercent = Math.round(computeAvgUtilization(input) * 10) / 10;
  const riskScore = computeRiskScore(input);
  const activeAgents = input.agentUtilizations.filter((a) => a.isActive).length;

  // Velocity: utilization * ratio gives stories/day estimate
  const velocity = Math.round((utilizationPercent / 100) * VELOCITY_UTILIZATION_RATIO * 100) / 100;

  // Stories at risk: count from bottleneck affected stories
  const storiesAtRiskSet = new Set<string>();
  for (const bn of input.bottlenecks) {
    for (const s of bn.affectedStories) {
      storiesAtRiskSet.add(s);
    }
  }
  const storiesAtRisk = storiesAtRiskSet.size;

  return { utilizationPercent, velocity, riskScore, activeAgents, storiesAtRisk };
}

/** Apply a suggestion's impact to before metrics to project after metrics. */
function buildAfterMetrics(
  before: MetricsSnapshot,
  suggestion: OptimizationSuggestion,
): MetricsSnapshot {
  const utilDelta = suggestion.impact.utilizationDeltaPercent;
  const utilizationPercent =
    Math.round(Math.max(0, Math.min(100, before.utilizationPercent + utilDelta)) * 10) / 10;

  const velocityDelta = (utilDelta / 100) * VELOCITY_UTILIZATION_RATIO;
  const velocity = Math.round((before.velocity + velocityDelta) * 100) / 100;

  const riskReduction = suggestion.impact.riskReductionPercent / 100;
  const riskScore =
    Math.round(Math.max(0, Math.min(100, before.riskScore * (1 - riskReduction))) * 10) / 10;

  // Active agents unchanged by suggestions (suggestions propose changes, don't execute them)
  const activeAgents = before.activeAgents;

  // Reduce stories at risk by the number of affected stories in the suggestion
  const storiesAtRisk = Math.max(
    0,
    before.storiesAtRisk - suggestion.impact.affectedStories.length,
  );

  return { utilizationPercent, velocity, riskScore, activeAgents, storiesAtRisk };
}

// ---------------------------------------------------------------------------
// Main entry points
// ---------------------------------------------------------------------------

/**
 * Analyze the impact of a single optimization suggestion.
 * Returns before/after metrics with derived impact dimensions.
 */
export function analyzeSuggestionImpact(
  suggestion: OptimizationSuggestion,
  input: OptimizationEngineInput,
): ImpactAnalysis {
  const beforeMetrics = buildBeforeMetrics(input);
  const afterMetrics = buildAfterMetrics(beforeMetrics, suggestion);

  const completionDateShift = suggestion.impact.daysSaved;
  const velocityDelta =
    Math.round(
      (suggestion.impact.utilizationDeltaPercent / 100) * VELOCITY_UTILIZATION_RATIO * 100,
    ) / 100;

  const riskChange: RiskChange = {
    before: beforeMetrics.riskScore,
    after: afterMetrics.riskScore,
    delta: Math.round((beforeMetrics.riskScore - afterMetrics.riskScore) * 10) / 10,
  };

  return {
    completionDateShift,
    velocityDelta,
    riskChange,
    beforeMetrics,
    afterMetrics,
  };
}

/**
 * Analyze impact for all suggestions in an optimization result.
 * Returns an array of SuggestionImpactDetail entries.
 */
export function analyzeAllSuggestions(
  suggestions: OptimizationSuggestion[],
  input: OptimizationEngineInput,
): SuggestionImpactDetail[] {
  return suggestions.map((suggestion) => ({
    suggestion,
    impactAnalysis: analyzeSuggestionImpact(suggestion, input),
  }));
}
