/**
 * Risk alert types — configuration, alert state, and evaluation interfaces.
 *
 * Defines the shape of configurable alert thresholds, triggered alerts,
 * and the input consumed by the pure evaluation function.
 */

import type { RiskFactorType, RiskSeverityLabel } from "./risk-aggregation";

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

export type RiskAlertTargetType = "score" | "emerging-risk" | RiskFactorType;

export interface RiskAlertThreshold {
  /** What to watch: composite "score", "emerging-risk" severity, or a specific RiskFactorType. */
  riskType: RiskAlertTargetType;
  /** Minimum value that triggers the alert (0-100). */
  minScore: number;
  /** Optional: only trigger for a specific severity label. */
  severityLabel?: RiskSeverityLabel;
  /** Enable/disable this threshold without removing it. */
  enabled: boolean;
}

export interface RiskAlertConfig {
  /** Master switch — when false no alerts are evaluated. */
  enabled: boolean;
  /** Thresholds applied to every project unless overridden. */
  defaultThresholds: RiskAlertThreshold[];
  /** Per-project overrides keyed by projectId. */
  projectOverrides: Record<string, RiskAlertThreshold[]>;
}

// ---------------------------------------------------------------------------
// Alert state
// ---------------------------------------------------------------------------

export type RiskAlertType = "score-threshold" | "emerging-risk";

export interface RiskAlert {
  id: string;
  projectId: string;
  triggeredAt: string;
  alertType: RiskAlertType;
  severity: number;
  severityLabel: RiskSeverityLabel;
  title: string;
  details: string;
  acknowledged: boolean;
}

// ---------------------------------------------------------------------------
// Evaluation input
// ---------------------------------------------------------------------------

import type { RiskScoreResult } from "./risk-score";
import type { EmergingRisk } from "./emerging-risk-detection";

export interface RiskAlertEvaluationInput {
  scoreResults: RiskScoreResult[];
  emergingRisks: Map<string, EmergingRisk[]>;
  config: RiskAlertConfig;
  /** IDs of alerts already known — used for deduplication. */
  knownAlertIds: Set<string>;
}

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

export const DEFAULT_RISK_ALERT_CONFIG: RiskAlertConfig = {
  enabled: true,
  defaultThresholds: [
    { riskType: "score", minScore: 76, severityLabel: "critical", enabled: true },
    { riskType: "score", minScore: 51, severityLabel: "high", enabled: true },
    { riskType: "emerging-risk", minScore: 60, enabled: true },
  ],
  projectOverrides: {},
};
