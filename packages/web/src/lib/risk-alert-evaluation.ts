/**
 * Risk alert evaluation — pure computation that compares current risk state
 * against configured thresholds and produces RiskAlert[].
 *
 * No I/O or side effects. All evaluation is deterministic from inputs.
 */

import type { RiskSeverityLabel } from "./risk-aggregation";
import type {
  RiskAlert,
  RiskAlertConfig,
  RiskAlertEvaluationInput,
  RiskAlertThreshold,
} from "./risk-alert-types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getSeverityLabel(score: number): RiskSeverityLabel {
  if (score >= 76) return "critical";
  if (score >= 51) return "high";
  if (score >= 26) return "medium";
  return "low";
}

function getThresholdsForProject(config: RiskAlertConfig, projectId: string): RiskAlertThreshold[] {
  const overrides = config.projectOverrides[projectId];
  return overrides && overrides.length > 0 ? overrides : config.defaultThresholds;
}

// ---------------------------------------------------------------------------
// Score threshold evaluation
// ---------------------------------------------------------------------------

function evaluateScoreThresholds(
  projectId: string,
  score: number,
  factorCount: number,
  bottleneckCount: number,
  thresholds: RiskAlertThreshold[],
  knownIds: Set<string>,
): RiskAlert[] {
  const alerts: RiskAlert[] = [];

  for (const t of thresholds) {
    if (!t.enabled || t.riskType !== "score") continue;
    if (score < t.minScore) continue;

    // If threshold specifies a severity label, only trigger when score label matches
    if (t.severityLabel && getSeverityLabel(score) !== t.severityLabel) continue;

    const label = getSeverityLabel(t.minScore);
    const alertId = `${projectId}-alert-score-${label}`;

    if (knownIds.has(alertId)) continue;

    alerts.push({
      id: alertId,
      projectId,
      triggeredAt: new Date().toISOString(),
      alertType: "score-threshold",
      severity: score,
      severityLabel: getSeverityLabel(score),
      title: `Risk score ${score} (${getSeverityLabel(score)}) exceeds ${label} threshold (${t.minScore})`,
      details: `${factorCount} risk factors and ${bottleneckCount} bottlenecks contributing`,
      acknowledged: false,
    });
  }

  return alerts;
}

// ---------------------------------------------------------------------------
// Emerging risk evaluation
// ---------------------------------------------------------------------------

function evaluateEmergingRiskThresholds(
  projectId: string,
  emergingRiskSeverity: number,
  emergingRiskTitle: string,
  emergingRiskId: string,
  thresholds: RiskAlertThreshold[],
  knownIds: Set<string>,
): RiskAlert | null {
  for (const t of thresholds) {
    if (!t.enabled || t.riskType !== "emerging-risk") continue;
    if (emergingRiskSeverity < t.minScore) continue;

    const alertId = `${projectId}-alert-emerging-${emergingRiskId}`;

    if (knownIds.has(alertId)) continue;

    return {
      id: alertId,
      projectId,
      triggeredAt: new Date().toISOString(),
      alertType: "emerging-risk",
      severity: emergingRiskSeverity,
      severityLabel: getSeverityLabel(emergingRiskSeverity),
      title: `Emerging risk: ${emergingRiskTitle}`,
      details: `Severity ${emergingRiskSeverity} exceeds threshold (${t.minScore})`,
      acknowledged: false,
    };
  }

  return null;
}

// ---------------------------------------------------------------------------
// Main evaluation
// ---------------------------------------------------------------------------

export function evaluateRiskAlerts(input: RiskAlertEvaluationInput): RiskAlert[] {
  if (!input.config.enabled) return [];

  const alerts: RiskAlert[] = [];

  for (const scoreResult of input.scoreResults) {
    const thresholds = getThresholdsForProject(input.config, scoreResult.projectId);

    // 1. Score threshold alerts
    const scoreAlerts = evaluateScoreThresholds(
      scoreResult.projectId,
      scoreResult.score,
      scoreResult.factorCount,
      scoreResult.bottleneckCount,
      thresholds,
      input.knownAlertIds,
    );
    alerts.push(...scoreAlerts);

    // 2. Emerging risk alerts
    const emerging = input.emergingRisks.get(scoreResult.projectId) ?? [];
    for (const er of emerging) {
      const alert = evaluateEmergingRiskThresholds(
        scoreResult.projectId,
        er.severity,
        er.title,
        er.id,
        thresholds,
        input.knownAlertIds,
      );
      if (alert) alerts.push(alert);
    }
  }

  // Sort by severity descending
  alerts.sort((a, b) => b.severity - a.severity);

  return alerts;
}
