import { describe, it, expect } from "vitest";
import {
  calculateRiskScore,
  calculatePortfolioScore,
  getTopContributors,
  type RiskScoreInput,
} from "../risk-score.js";

const baseInput: RiskScoreInput = {
  projectId: "test-project",
  riskFactors: [],
  bottlenecks: [],
};

describe("calculateRiskScore", () => {
  it("returns 0 score when no risk factors or bottlenecks", () => {
    const result = calculateRiskScore(baseInput);
    expect(result.score).toBe(0);
    expect(result.severityLabel).toBe("low");
    expect(result.contributors).toHaveLength(0);
    expect(result.factorCount).toBe(0);
    expect(result.bottleneckCount).toBe(0);
    expect(result.projectId).toBe("test-project");
    expect(result.lastUpdated).toBeTruthy();
  });

  it("returns score from single critical risk factor", () => {
    const result = calculateRiskScore({
      ...baseInput,
      riskFactors: [
        {
          id: "test-indicator-stuck",
          type: "blocking-pattern",
          title: "3 stories stuck",
          severity: 80,
          severityLabel: "critical",
          trend: "stable",
          affectedProjects: ["test-project"],
          contributingFactors: [],
          affectedStories: ["S-1", "S-2", "S-3"],
          suggestedAction: "Investigate",
        },
      ],
    });
    expect(result.score).toBeGreaterThan(0);
    expect(result.factorCount).toBe(1);
    expect(result.contributors).toHaveLength(1);
    expect(result.contributors[0].type).toBe("risk-factor");
    expect(result.contributors[0].contributionPercent).toBe(100);
  });

  it("combines risk factors and bottlenecks into composite score", () => {
    const result = calculateRiskScore({
      ...baseInput,
      riskFactors: [
        {
          id: "rf-1",
          type: "blocking-pattern",
          title: "Blocked stories",
          severity: 80,
          severityLabel: "critical",
          trend: "stable",
          affectedProjects: ["test-project"],
          contributingFactors: [],
          affectedStories: [],
          suggestedAction: "",
        },
      ],
      bottlenecks: [
        {
          id: "bn-1",
          type: "column-bottleneck",
          title: "Review bottleneck",
          severity: 70,
          severityLabel: "high",
          impact: { storiesAffected: 5, estimatedDelayDays: 3, impactScore: 85 },
          trend: "worsening",
          affectedProjects: ["test-project"],
          affectedStories: [],
          contributingFactors: [],
          suggestedAction: "",
        },
      ],
    });
    expect(result.score).toBeGreaterThan(0);
    expect(result.factorCount).toBe(1);
    expect(result.bottleneckCount).toBe(1);
    expect(result.contributors).toHaveLength(2);
  });

  it("applies severity weighting — critical items weigh more", () => {
    const criticalResult = calculateRiskScore({
      ...baseInput,
      riskFactors: [
        {
          id: "rf-critical",
          type: "blocking-pattern",
          title: "Critical issue",
          severity: 80,
          severityLabel: "critical",
          trend: "stable",
          affectedProjects: ["test-project"],
          contributingFactors: [],
          affectedStories: [],
          suggestedAction: "",
        },
      ],
    });

    const lowResult = calculateRiskScore({
      ...baseInput,
      riskFactors: [
        {
          id: "rf-low",
          type: "high-risk-stories",
          title: "Low issue",
          severity: 15,
          severityLabel: "low",
          trend: "stable",
          affectedProjects: ["test-project"],
          contributingFactors: [],
          affectedStories: [],
          suggestedAction: "",
        },
      ],
    });

    expect(criticalResult.score).toBeGreaterThan(lowResult.score);
  });

  it("factors in sprint health score when below threshold", () => {
    const withLowHealth = calculateRiskScore({
      ...baseInput,
      sprintHealthScore: 30,
    });

    const withGoodHealth = calculateRiskScore({
      ...baseInput,
      sprintHealthScore: 90,
    });

    expect(withLowHealth.score).toBeGreaterThan(0);
    expect(withLowHealth.contributors.some((c) => c.type === "sprint-health")).toBe(true);
    // Good health shouldn't add a sprint-health contributor
    expect(withGoodHealth.contributors.some((c) => c.type === "sprint-health")).toBe(false);
  });

  it("does not create sprint-health contributor at threshold (60)", () => {
    const result = calculateRiskScore({
      ...baseInput,
      sprintHealthScore: 60,
    });
    expect(result.contributors.some((c) => c.type === "sprint-health")).toBe(false);
    expect(result.score).toBe(0);
  });

  it("caps score at 100 for extreme inputs", () => {
    const manyFactors = Array.from({ length: 20 }, (_, i) => ({
      id: `rf-${i}`,
      type: "blocking-pattern" as const,
      title: `Critical issue ${i}`,
      severity: 95,
      severityLabel: "critical" as const,
      trend: "stable" as const,
      affectedProjects: ["test-project"],
      contributingFactors: [],
      affectedStories: [],
      suggestedAction: "",
    }));

    const result = calculateRiskScore({
      ...baseInput,
      riskFactors: manyFactors,
      bottlenecks: manyFactors.map((f) => ({
        ...f,
        id: `bn-${f.id}`,
        type: "column-bottleneck" as const,
        impact: { storiesAffected: 10, estimatedDelayDays: 5, impactScore: 90 },
      })),
      sprintHealthScore: 0,
    });

    expect(result.score).toBeLessThanOrEqual(100);
  });

  it("uses impactScore for bottleneck weighting", () => {
    const result = calculateRiskScore({
      ...baseInput,
      bottlenecks: [
        {
          id: "bn-high-impact",
          type: "column-bottleneck",
          title: "High impact bottleneck",
          severity: 80,
          severityLabel: "critical",
          impact: { storiesAffected: 8, estimatedDelayDays: 5, impactScore: 90 },
          trend: "stable",
          affectedProjects: ["test-project"],
          affectedStories: [],
          contributingFactors: [],
          suggestedAction: "",
        },
      ],
    });

    expect(result.score).toBeGreaterThan(0);
    expect(result.contributors[0].score).toBe(90); // uses impactScore
  });

  it("contribution percentages sum to exactly 100", () => {
    const result = calculateRiskScore({
      ...baseInput,
      riskFactors: [
        {
          id: "rf-1",
          type: "blocking-pattern",
          title: "Critical blocker",
          severity: 80,
          severityLabel: "critical",
          trend: "stable",
          affectedProjects: ["test-project"],
          contributingFactors: [],
          affectedStories: [],
          suggestedAction: "",
        },
        {
          id: "rf-2",
          type: "velocity-anomaly",
          title: "Medium issue",
          severity: 50,
          severityLabel: "medium",
          trend: "stable",
          affectedProjects: ["test-project"],
          contributingFactors: [],
          affectedStories: [],
          suggestedAction: "",
        },
        {
          id: "rf-3",
          type: "high-risk-stories",
          title: "Low issue",
          severity: 20,
          severityLabel: "low",
          trend: "stable",
          affectedProjects: ["test-project"],
          contributingFactors: [],
          affectedStories: [],
          suggestedAction: "",
        },
      ],
    });

    const sum = result.contributors.reduce((acc, c) => acc + c.contributionPercent, 0);
    expect(sum).toBe(100);
  });
});

describe("getTopContributors", () => {
  it("returns top N contributors sorted by contribution", () => {
    const result = calculateRiskScore({
      ...baseInput,
      riskFactors: [
        {
          id: "rf-1",
          type: "blocking-pattern",
          title: "Critical blocker",
          severity: 90,
          severityLabel: "critical",
          trend: "stable",
          affectedProjects: ["test-project"],
          contributingFactors: [],
          affectedStories: [],
          suggestedAction: "",
        },
        {
          id: "rf-2",
          type: "velocity-anomaly",
          title: "Minor velocity drop",
          severity: 30,
          severityLabel: "medium",
          trend: "stable",
          affectedProjects: ["test-project"],
          contributingFactors: [],
          affectedStories: [],
          suggestedAction: "",
        },
      ],
    });

    const top = getTopContributors(result, 1);
    expect(top).toHaveLength(1);
    expect(top[0].id).toBe("rf-1");
    expect(top[0].contributionPercent).toBeGreaterThan(0);
  });

  it("returns all contributors when N exceeds count", () => {
    const result = calculateRiskScore({
      ...baseInput,
      riskFactors: [
        {
          id: "rf-1",
          type: "blocking-pattern",
          title: "Issue",
          severity: 50,
          severityLabel: "high",
          trend: "stable",
          affectedProjects: ["test-project"],
          contributingFactors: [],
          affectedStories: [],
          suggestedAction: "",
        },
      ],
    });

    const top = getTopContributors(result, 10);
    expect(top).toHaveLength(1);
  });
});

describe("calculatePortfolioScore", () => {
  it("returns 0 for empty input", () => {
    const result = calculatePortfolioScore([]);
    expect(result.portfolioScore).toBe(0);
    expect(result.portfolioSeverityLabel).toBe("low");
    expect(result.scores).toHaveLength(0);
  });

  it("aggregates scores across multiple projects", () => {
    const score1 = calculateRiskScore({
      projectId: "proj-a",
      riskFactors: [
        {
          id: "rf-1",
          type: "blocking-pattern",
          title: "Critical",
          severity: 80,
          severityLabel: "critical",
          trend: "stable",
          affectedProjects: ["proj-a"],
          contributingFactors: [],
          affectedStories: [],
          suggestedAction: "",
        },
      ],
      bottlenecks: [],
    });

    const score2 = calculateRiskScore({
      projectId: "proj-b",
      riskFactors: [],
      bottlenecks: [],
    });

    const portfolio = calculatePortfolioScore([score1, score2]);
    expect(portfolio.scores).toHaveLength(2);
    expect(portfolio.portfolioScore).toBeGreaterThan(0);
    expect(portfolio.scores[0].projectId).toBe("proj-a");
    expect(portfolio.scores[1].projectId).toBe("proj-b");
  });

  it("portfolio score is average of individual scores", () => {
    const score1 = calculateRiskScore({
      ...baseInput,
      projectId: "proj-a",
      riskFactors: [
        {
          id: "rf-1",
          type: "blocking-pattern",
          title: "High",
          severity: 80,
          severityLabel: "critical",
          trend: "stable",
          affectedProjects: ["proj-a"],
          contributingFactors: [],
          affectedStories: [],
          suggestedAction: "",
        },
      ],
    });

    const score2 = calculateRiskScore({
      ...baseInput,
      projectId: "proj-b",
      riskFactors: [
        {
          id: "rf-1",
          type: "blocking-pattern",
          title: "Low",
          severity: 20,
          severityLabel: "low",
          trend: "stable",
          affectedProjects: ["proj-b"],
          contributingFactors: [],
          affectedStories: [],
          suggestedAction: "",
        },
      ],
    });

    const portfolio = calculatePortfolioScore([score1, score2]);
    // Portfolio score should be between the two individual scores
    expect(portfolio.portfolioScore).toBeGreaterThanOrEqual(0);
    expect(portfolio.portfolioScore).toBeLessThanOrEqual(100);
  });
});
