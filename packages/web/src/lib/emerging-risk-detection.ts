/**
 * Emerging risk detection module — detects developing risks from time-series patterns.
 *
 * Analyzes throughput trends, sprint health indicators, agent utilization,
 * and story aging to identify risks that are emerging but not yet critical.
 * Pure computation — no I/O or side effects.
 */

import type { AgentUtilRaw, RiskFactor, RiskTrend } from "./risk-aggregation";
import { computeRollingAverage, computeTrend } from "./utilization-snapshot";
import { getAgentHistory } from "./utilization-history";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type EmergingRiskPattern =
  | "velocity-drop"
  | "throughput-decline"
  | "capacity-trend"
  | "blocker-accumulation"
  | "aging-acceleration";

export interface EmergingRisk {
  id: string;
  type: EmergingRiskPattern;
  title: string;
  status: "emerging";
  severity: number;
  trajectory: RiskTrend;
  pattern: string;
  detectedAt: string;
  cause: string;
  suggestedAction: string;
  projectId: string;
  contributingFactors: string[];
}

export interface EmergingRiskInput {
  projectId: string;
  throughput: {
    dailyThroughput: Array<{ date: string; count: number }>;
    weeklyThroughput: Array<{ weekStart: string; count: number }>;
    columnTrends: Array<{
      column: string;
      weeklyAvgMs: number[];
      trend: string;
      slope: number;
    }>;
    bottleneckTrend: string | null;
    leadTimes: Array<{ storyId: string; leadTimeMs: number; cycleTimeMs: number }>;
    averageLeadTimeMs: number;
    medianLeadTimeMs: number;
    averageCycleTimeMs: number;
    medianCycleTimeMs: number;
    flowEfficiency: number;
  };
  sprintHealth: {
    overall: string;
    indicators: Array<{
      id: string;
      severity: string;
      message: string;
      details: string[];
    }>;
    stuckStories: string[];
    wipColumns: string[];
  };
  agentUtilizations: AgentUtilRaw[];
  riskFactors: RiskFactor[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Detection: velocity-drop
// Compare recent 2-week throughput average vs 4-week baseline
// ---------------------------------------------------------------------------

function detectVelocityDrop(input: EmergingRiskInput): EmergingRisk | null {
  const weekly = input.throughput.weeklyThroughput;
  if (weekly.length < 4) return null;

  // 4-week baseline: all weeks except the most recent 2
  const baselineWeeks = weekly.slice(0, -2);
  const recentWeeks = weekly.slice(-2);

  const baselineAvg = baselineWeeks.reduce((sum, w) => sum + w.count, 0) / baselineWeeks.length;
  if (baselineAvg === 0) return null;

  const recentAvg = recentWeeks.reduce((sum, w) => sum + w.count, 0) / recentWeeks.length;
  const ratio = recentAvg / baselineAvg;

  // Only flag if ratio drops below 75%
  if (ratio >= 0.75) return null;

  let severity: number;
  if (ratio < 0.4) severity = 70;
  else if (ratio < 0.6) severity = 50;
  else severity = 30;

  const trajectory: RiskTrend = ratio < 0.5 ? "worsening" : "stable";

  return {
    id: `${input.projectId}-emerging-velocity-drop`,
    type: "velocity-drop",
    title: `Velocity dropping — ${recentAvg.toFixed(1)} stories/week recent vs ${baselineAvg.toFixed(1)} baseline`,
    status: "emerging",
    severity,
    trajectory,
    pattern: `2-week avg (${recentAvg.toFixed(1)}/week) is ${Math.round(ratio * 100)}% of 4-week baseline (${baselineAvg.toFixed(1)}/week)`,
    detectedAt: new Date().toISOString(),
    cause: `Recent throughput at ${Math.round(ratio * 100)}% of baseline capacity`,
    suggestedAction: "Investigate throughput decline, check for blockers or capacity issues",
    projectId: input.projectId,
    contributingFactors: input.riskFactors
      .filter((f) => f.type === "velocity-anomaly")
      .map((f) => f.id),
  };
}

// ---------------------------------------------------------------------------
// Detection: throughput-decline
// Check column trends for positive slopes (increasing dwell = worsening)
// ---------------------------------------------------------------------------

function detectThroughputDecline(input: EmergingRiskInput): EmergingRisk | null {
  const decliningColumns = input.throughput.columnTrends.filter((ct) => ct.slope > 0.05);
  if (decliningColumns.length === 0) return null;

  // Pick the worst column
  const worst = decliningColumns.reduce((max, ct) => (ct.slope > max.slope ? ct : max));

  const severity = Math.min(100, Math.round(40 + worst.slope * 100));
  const trajectory: RiskTrend = worst.slope > 0.3 ? "worsening" : "stable";

  return {
    id: `${input.projectId}-emerging-throughput-decline`,
    type: "throughput-decline",
    title: `Throughput declining in "${worst.column}" column`,
    status: "emerging",
    severity,
    trajectory,
    pattern: `"${worst.column}" column dwell time increasing (slope: +${worst.slope.toFixed(2)} ms/week)`,
    detectedAt: new Date().toISOString(),
    cause: `Throughput decline detected in "${worst.column}" column (dwell time increasing)`,
    suggestedAction: `Investigate "${worst.column}" bottleneck, consider adding capacity or splitting the workflow step`,
    projectId: input.projectId,
    contributingFactors: decliningColumns.map(
      (ct) => `${input.projectId}-column-${ct.column.replace(/\s+/g, "-")}`,
    ),
  };
}

// ---------------------------------------------------------------------------
// Detection: capacity-trend
// Agents approaching capacity (>70% utilization)
// ---------------------------------------------------------------------------

function detectCapacityTrend(input: EmergingRiskInput): EmergingRisk | null {
  const highUtilAgents = input.agentUtilizations.filter(
    (a) => a.isActive && a.utilizationPercent > 70,
  );
  if (highUtilAgents.length === 0) return null;

  const worst = highUtilAgents.reduce((max, a) =>
    a.utilizationPercent > max.utilizationPercent ? a : max,
  );

  // Enhance with rolling average and trend from utilization history (Story 56.6)
  const agentHistory = getAgentHistory(worst.agentId);
  const now = Date.now();

  // If we have history, use rolling 1h average instead of point-in-time value
  const points = agentHistory.map((s) => ({
    timestamp: s.timestamp,
    value: s.utilizationPercent,
  }));
  const rollingAvg =
    points.length >= 2 ? computeRollingAverage(points, 3600_000, now) : worst.utilizationPercent;

  // Determine trajectory from trend computation or fallback to threshold
  let trajectory: RiskTrend;
  if (points.length >= 2) {
    const trend = computeTrend(points, now);
    trajectory =
      trend === "declining" ? "worsening" : trend === "improving" ? "improving" : "stable";
  } else {
    trajectory = worst.utilizationPercent > 85 ? "worsening" : "stable";
  }

  // Use rolling average for severity when available
  const effectiveUtil = rollingAvg > 0 ? rollingAvg : worst.utilizationPercent;
  const severity = Math.min(100, Math.round(effectiveUtil));

  const patternDesc =
    points.length >= 2
      ? `Agent "${worst.agentId}" rolling 1h avg ${rollingAvg}%, trend: ${trajectory}`
      : `Agent "${worst.agentId}" at ${worst.utilizationPercent}% utilization and trending upward`;

  return {
    id: `${input.projectId}-emerging-capacity-trend`,
    type: "capacity-trend",
    title: `Capacity trending to limit — ${highUtilAgents.length} agent(s) above 70%`,
    status: "emerging",
    severity,
    trajectory,
    pattern: patternDesc,
    detectedAt: new Date().toISOString(),
    cause: `Agent "${worst.agentId}" approaching capacity at ${effectiveUtil}% (rolling avg)`,
    suggestedAction: "Consider adding agents or rebalancing workload across the pool",
    projectId: input.projectId,
    contributingFactors: highUtilAgents.map((a) => `capacity-${a.agentId}`),
  };
}

// ---------------------------------------------------------------------------
// Detection: blocker-accumulation
// Stuck stories accumulating + throughput-drop indicator
// ---------------------------------------------------------------------------

function detectBlockerAccumulation(input: EmergingRiskInput): EmergingRisk | null {
  const stuckCount = input.sprintHealth.stuckStories.length;
  if (stuckCount < 3) return null;

  const hasThroughputDrop = input.sprintHealth.indicators.some(
    (i) => i.id === "throughput-drop" && i.severity !== "ok",
  );
  if (!hasThroughputDrop) return null;

  const severity = Math.min(100, 60 + (stuckCount - 3) * 5);
  const trajectory: RiskTrend = stuckCount > 5 ? "worsening" : "stable";

  return {
    id: `${input.projectId}-emerging-blocker-accumulation`,
    type: "blocker-accumulation",
    title: `Blockers accumulating — ${stuckCount} stuck stories with throughput drop`,
    status: "emerging",
    severity,
    trajectory,
    pattern: `${stuckCount} stuck stories combined with throughput drop indicator`,
    detectedAt: new Date().toISOString(),
    cause: `${stuckCount} stories stuck while throughput is declining — possible systemic blocker`,
    suggestedAction:
      "Review stuck stories for common blockers, resolve dependencies to unblock flow",
    projectId: input.projectId,
    contributingFactors: input.sprintHealth.stuckStories.slice(0, 5),
  };
}

// ---------------------------------------------------------------------------
// Detection: aging-acceleration
// Stories aging faster when throughput slopes are increasing
// ---------------------------------------------------------------------------

function detectAgingAcceleration(input: EmergingRiskInput): EmergingRisk | null {
  // Need both: aging risk factor from risk-aggregation AND increasing column trends
  const hasAgingFactor = input.riskFactors.some(
    (f) => f.type === "high-risk-stories" && f.title.toLowerCase().includes("aging"),
  );
  const hasIncreasingTrend = input.throughput.columnTrends.some((ct) => ct.slope > 0.1);
  if (!hasAgingFactor && !hasIncreasingTrend) return null;

  // Count contributing risk factors related to aging/stuck
  const agingFactors = input.riskFactors.filter(
    (f) => f.type === "high-risk-stories" || f.type === "blocking-pattern",
  );
  if (agingFactors.length === 0) return null;

  const severity = Math.min(100, 50 + agingFactors.length * 10);
  const trajectory: RiskTrend = hasIncreasingTrend ? "worsening" : "stable";

  return {
    id: `${input.projectId}-emerging-aging-acceleration`,
    type: "aging-acceleration",
    title: `Stories aging faster — ${agingFactors.length} risk factor(s) with increasing dwell times`,
    status: "emerging",
    severity,
    trajectory,
    pattern: `Story aging accelerating with ${agingFactors.length} contributing factor(s) and throughput slopes increasing`,
    detectedAt: new Date().toISOString(),
    cause: "Column dwell times increasing — stories spending longer in workflow stages",
    suggestedAction: "Review workflow stages for bottlenecks, check if stories are properly scoped",
    projectId: input.projectId,
    contributingFactors: agingFactors.map((f) => f.id),
  };
}

// ---------------------------------------------------------------------------
// Main detection
// ---------------------------------------------------------------------------

export function detectEmergingRisks(input: EmergingRiskInput): EmergingRisk[] {
  const risks: EmergingRisk[] = [];

  const velocityDrop = detectVelocityDrop(input);
  if (velocityDrop) risks.push(velocityDrop);

  const throughputDecline = detectThroughputDecline(input);
  if (throughputDecline) risks.push(throughputDecline);

  const capacityTrend = detectCapacityTrend(input);
  if (capacityTrend) risks.push(capacityTrend);

  const blockerAccum = detectBlockerAccumulation(input);
  if (blockerAccum) risks.push(blockerAccum);

  const agingAccel = detectAgingAcceleration(input);
  if (agingAccel) risks.push(agingAccel);

  // Sort by severity descending
  risks.sort((a, b) => b.severity - a.severity);

  return risks;
}
