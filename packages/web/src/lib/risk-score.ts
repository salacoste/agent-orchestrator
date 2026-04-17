/**
 * Risk score calculation module — composite risk scoring from risk factors and bottlenecks.
 *
 * Takes the outputs of risk-aggregation and bottleneck-aggregation and produces
 * a single composite risk score (0-100) per project with contributor breakdown.
 * Pure computation — no I/O or side effects.
 */

import type { RiskFactor, RiskSeverityLabel } from "./risk-aggregation";
import type { BottleneckItem } from "./bottleneck-aggregation";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ContributorType = "risk-factor" | "bottleneck" | "sprint-health";

export interface RiskScoreContributor {
  id: string;
  title: string;
  type: ContributorType;
  score: number;
  weight: number;
  contributionPercent: number;
}

export interface RiskScoreResult {
  projectId: string;
  score: number;
  severityLabel: RiskSeverityLabel;
  contributors: RiskScoreContributor[];
  factorCount: number;
  bottleneckCount: number;
  lastUpdated: string;
}

export interface PortfolioRiskResult {
  scores: Array<{
    projectId: string;
    score: number;
    severityLabel: RiskSeverityLabel;
    factorCount: number;
    bottleneckCount: number;
  }>;
  portfolioScore: number;
  portfolioSeverityLabel: RiskSeverityLabel;
  lastUpdated: string;
}

export interface RiskScoreInput {
  projectId: string;
  riskFactors: RiskFactor[];
  bottlenecks: BottleneckItem[];
  sprintHealthScore?: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const SEVERITY_WEIGHTS: Record<string, number> = {
  critical: 1.5,
  high: 1.0,
  medium: 0.6,
  low: 0.3,
};

const SPRINT_HEALTH_THRESHOLD = 60;

// Normalization constant: a single critical factor (severity 80, weight 1.5 → 120)
// maps to 120/150*100 = 80 — a clear "critical" score.  3–4 critical issues push
// toward 100.  The old value (520) was ~3× too conservative.
const NORMALIZATION_CONSTANT = 150;

function getSeverityLabel(score: number): RiskSeverityLabel {
  if (score >= 76) return "critical";
  if (score >= 51) return "high";
  if (score >= 26) return "medium";
  return "low";
}

function getWeight(label: string): number {
  return SEVERITY_WEIGHTS[label] ?? 0.3;
}

// ---------------------------------------------------------------------------
// Main scoring
// ---------------------------------------------------------------------------

export function calculateRiskScore(input: RiskScoreInput): RiskScoreResult {
  const contributors: RiskScoreContributor[] = [];

  // 1. Risk factors
  for (const factor of input.riskFactors) {
    const weight = getWeight(factor.severityLabel);
    contributors.push({
      id: factor.id,
      title: factor.title,
      type: "risk-factor",
      score: factor.severity,
      weight,
      contributionPercent: 0, // filled after normalization
    });
  }

  // 2. Bottlenecks — use impactScore if available, else severity
  for (const bn of input.bottlenecks) {
    const bnScore = bn.impact.impactScore;
    const bnLabel = getSeverityLabel(bnScore);
    const weight = getWeight(bnLabel);
    contributors.push({
      id: bn.id,
      title: bn.title,
      type: "bottleneck",
      score: bnScore,
      weight,
      contributionPercent: 0,
    });
  }

  // 3. Sprint health — inverted (lower health = higher risk contribution)
  if (input.sprintHealthScore !== undefined && input.sprintHealthScore < SPRINT_HEALTH_THRESHOLD) {
    const healthRisk = 100 - input.sprintHealthScore;
    const label = getSeverityLabel(healthRisk);
    const weight = getWeight(label);
    contributors.push({
      id: "sprint-health",
      title: `Sprint health score: ${input.sprintHealthScore}/100`,
      type: "sprint-health",
      score: healthRisk,
      weight,
      contributionPercent: 0,
    });
  }

  // 4. Compute weighted sum
  const weightedSum = contributors.reduce((acc, c) => acc + c.score * c.weight, 0);
  const rawScore = NORMALIZATION_CONSTANT > 0 ? (weightedSum / NORMALIZATION_CONSTANT) * 100 : 0;
  const score = Math.min(100, Math.max(0, Math.round(rawScore)));

  // 5. Compute contribution percentages (largest-remainder so they sum to 100)
  if (weightedSum > 0 && contributors.length > 0) {
    const rawPercents = contributors.map((c) => ((c.score * c.weight) / weightedSum) * 100);
    const floored = rawPercents.map((p) => Math.floor(p));
    const remainderSum = floored.reduce((a, b) => a + b, 0);
    const deficit = 100 - remainderSum;
    // Distribute the deficit to the items with the largest fractional remainders
    const indexed = rawPercents
      .map((p, i) => ({ i, rem: p - Math.floor(p) }))
      .sort((a, b) => b.rem - a.rem);
    for (let d = 0; d < deficit; d++) {
      floored[indexed[d].i]++;
    }
    for (let i = 0; i < contributors.length; i++) {
      contributors[i].contributionPercent = floored[i];
    }
  }

  // 6. Sort contributors by contribution descending
  contributors.sort((a, b) => b.contributionPercent - a.contributionPercent);

  return {
    projectId: input.projectId,
    score,
    severityLabel: getSeverityLabel(score),
    contributors,
    factorCount: input.riskFactors.length,
    bottleneckCount: input.bottlenecks.length,
    lastUpdated: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Portfolio scoring
// ---------------------------------------------------------------------------

export function calculatePortfolioScore(projectScores: RiskScoreResult[]): PortfolioRiskResult {
  const scores = projectScores.map((ps) => ({
    projectId: ps.projectId,
    score: ps.score,
    severityLabel: ps.severityLabel,
    factorCount: ps.factorCount,
    bottleneckCount: ps.bottleneckCount,
  }));

  const portfolioScore =
    scores.length > 0 ? Math.round(scores.reduce((acc, s) => acc + s.score, 0) / scores.length) : 0;

  return {
    scores,
    portfolioScore,
    portfolioSeverityLabel: getSeverityLabel(portfolioScore),
    lastUpdated: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Top contributors helper
// ---------------------------------------------------------------------------

export function getTopContributors(result: RiskScoreResult, limit: number): RiskScoreContributor[] {
  return result.contributors.slice(0, limit);
}
