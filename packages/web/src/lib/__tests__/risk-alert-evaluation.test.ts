import { describe, it, expect } from "vitest";
import { evaluateRiskAlerts } from "../risk-alert-evaluation.js";
import type { RiskAlertConfig, RiskAlertEvaluationInput } from "../risk-alert-types.js";
import type { RiskScoreResult } from "../risk-score.js";

function makeScoreResult(projectId: string, score: number): RiskScoreResult {
  return {
    projectId,
    score,
    severityLabel: score >= 76 ? "critical" : score >= 51 ? "high" : score >= 26 ? "medium" : "low",
    contributors: [],
    factorCount: 5,
    bottleneckCount: 3,
    lastUpdated: new Date().toISOString(),
  };
}

const defaultConfig: RiskAlertConfig = {
  enabled: true,
  defaultThresholds: [
    { riskType: "score", minScore: 76, severityLabel: "critical", enabled: true },
    { riskType: "score", minScore: 51, severityLabel: "high", enabled: true },
    { riskType: "emerging-risk", minScore: 60, enabled: true },
  ],
  projectOverrides: {},
};

function makeInput(overrides?: Partial<RiskAlertEvaluationInput>): RiskAlertEvaluationInput {
  return {
    scoreResults: [],
    emergingRisks: new Map(),
    config: defaultConfig,
    knownAlertIds: new Set(),
    ...overrides,
  };
}

describe("evaluateRiskAlerts", () => {
  it("returns no alerts when config is disabled", () => {
    const input = makeInput({
      scoreResults: [makeScoreResult("proj-1", 90)],
      config: { ...defaultConfig, enabled: false },
    });
    expect(evaluateRiskAlerts(input)).toHaveLength(0);
  });

  it("returns no alerts when scores are below thresholds", () => {
    const input = makeInput({
      scoreResults: [makeScoreResult("proj-1", 25)],
    });
    expect(evaluateRiskAlerts(input)).toHaveLength(0);
  });

  it("triggers score-threshold alert when score >= critical threshold", () => {
    const input = makeInput({
      scoreResults: [makeScoreResult("proj-1", 82)],
    });
    const alerts = evaluateRiskAlerts(input);
    expect(alerts.length).toBeGreaterThanOrEqual(1);
    expect(
      alerts.some((a) => a.alertType === "score-threshold" && a.severityLabel === "critical"),
    ).toBe(true);
  });

  it("triggers score-threshold alert when score >= high threshold", () => {
    const input = makeInput({
      scoreResults: [makeScoreResult("proj-1", 55)],
    });
    const alerts = evaluateRiskAlerts(input);
    expect(alerts.length).toBeGreaterThanOrEqual(1);
    expect(
      alerts.some((a) => a.alertType === "score-threshold" && a.severityLabel === "high"),
    ).toBe(true);
  });

  it("triggers emerging-risk alert when severity >= threshold", () => {
    const input = makeInput({
      scoreResults: [makeScoreResult("proj-1", 20)],
      emergingRisks: new Map([
        [
          "proj-1",
          [
            {
              id: "proj-1-emerging-velocity-drop",
              type: "velocity-drop",
              title: "Velocity declining",
              status: "emerging" as const,
              severity: 70,
              trajectory: "worsening" as const,
              pattern: "velocity-drop",
              detectedAt: new Date().toISOString(),
              cause: "Sprint velocity dropped 30%",
              suggestedAction: "Review recent story complexity",
              projectId: "proj-1",
              contributingFactors: [],
            },
          ],
        ],
      ]),
    });
    const alerts = evaluateRiskAlerts(input);
    expect(alerts.length).toBeGreaterThanOrEqual(1);
    expect(alerts.some((a) => a.alertType === "emerging-risk")).toBe(true);
  });

  it("does not trigger emerging-risk alert when severity below threshold", () => {
    const input = makeInput({
      emergingRisks: new Map([
        [
          "proj-1",
          [
            {
              id: "proj-1-emerging-low",
              type: "velocity-drop",
              title: "Low severity risk",
              status: "emerging" as const,
              severity: 40,
              trajectory: "stable" as const,
              pattern: "velocity-drop",
              detectedAt: new Date().toISOString(),
              cause: "Minor fluctuation",
              suggestedAction: "Monitor",
              projectId: "proj-1",
              contributingFactors: [],
            },
          ],
        ],
      ]),
    });
    const alerts = evaluateRiskAlerts(input);
    expect(alerts).toHaveLength(0);
  });

  it("applies per-project overrides", () => {
    const config: RiskAlertConfig = {
      enabled: true,
      defaultThresholds: [{ riskType: "score", minScore: 76, enabled: true }],
      projectOverrides: {
        "sensitive-proj": [{ riskType: "score", minScore: 30, enabled: true }],
      },
    };
    // Score of 35 would not trigger default (>=76) but should trigger override (>=30)
    const input = makeInput({
      scoreResults: [makeScoreResult("sensitive-proj", 35)],
      config,
    });
    const alerts = evaluateRiskAlerts(input);
    expect(alerts.length).toBeGreaterThanOrEqual(1);
    expect(alerts[0].projectId).toBe("sensitive-proj");
  });

  it("does not trigger alerts for disabled thresholds", () => {
    const config: RiskAlertConfig = {
      enabled: true,
      defaultThresholds: [
        { riskType: "score", minScore: 76, enabled: false },
        { riskType: "score", minScore: 51, enabled: false },
        { riskType: "emerging-risk", minScore: 60, enabled: false },
      ],
      projectOverrides: {},
    };
    const input = makeInput({
      scoreResults: [makeScoreResult("proj-1", 90)],
      config,
    });
    expect(evaluateRiskAlerts(input)).toHaveLength(0);
  });

  it("deduplicates alerts via knownAlertIds", () => {
    const scoreResult = makeScoreResult("proj-1", 82);
    const knownIds = new Set<string>();

    // First evaluation — should produce alerts
    const input1 = makeInput({ scoreResults: [scoreResult], knownAlertIds: knownIds });
    const alerts1 = evaluateRiskAlerts(input1);
    expect(alerts1.length).toBeGreaterThanOrEqual(1);

    // Register the IDs
    for (const a of alerts1) knownIds.add(a.id);

    // Second evaluation — should produce no new alerts
    const input2 = makeInput({ scoreResults: [scoreResult], knownAlertIds: knownIds });
    const alerts2 = evaluateRiskAlerts(input2);
    expect(alerts2).toHaveLength(0);
  });

  it("sorts alerts by severity descending", () => {
    const input = makeInput({
      scoreResults: [makeScoreResult("proj-1", 55), makeScoreResult("proj-2", 90)],
    });
    const alerts = evaluateRiskAlerts(input);
    for (let i = 1; i < alerts.length; i++) {
      expect(alerts[i - 1].severity).toBeGreaterThanOrEqual(alerts[i].severity);
    }
  });

  it("returns no alerts when config has no thresholds", () => {
    const config: RiskAlertConfig = {
      enabled: true,
      defaultThresholds: [],
      projectOverrides: {},
    };
    const input = makeInput({
      scoreResults: [makeScoreResult("proj-1", 90)],
      config,
    });
    expect(evaluateRiskAlerts(input)).toHaveLength(0);
  });

  it("produces multiple alerts for multiple projects exceeding thresholds", () => {
    const input = makeInput({
      scoreResults: [makeScoreResult("proj-1", 82), makeScoreResult("proj-2", 75)],
    });
    const alerts = evaluateRiskAlerts(input);
    const projectIds = new Set(alerts.map((a) => a.projectId));
    expect(projectIds.size).toBeGreaterThanOrEqual(2);
  });
});
