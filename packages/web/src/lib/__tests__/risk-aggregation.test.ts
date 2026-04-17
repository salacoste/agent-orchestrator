import { describe, it, expect } from "vitest";
import { aggregateRiskFactors, type RiskAggregationInput } from "../risk-aggregation.js";

describe("aggregateRiskFactors", () => {
  const baseInput: RiskAggregationInput = {
    projectId: "test-project",
    projectName: "Test Project",
    indicators: [],
    stuckStories: [],
    wipColumns: [],
    capacityResults: [],
    agentUtilizations: [],
  };

  it("returns empty factors when no risks present", () => {
    const result = aggregateRiskFactors(baseInput);
    expect(result.riskFactors).toHaveLength(0);
    expect(result.summary.total).toBe(0);
    expect(result.summary.critical).toBe(0);
    expect(result.summary.high).toBe(0);
    expect(result.summary.medium).toBe(0);
    expect(result.summary.low).toBe(0);
    expect(result.lastUpdated).toBeTruthy();
  });

  it("skips indicators with severity 'ok'", () => {
    const result = aggregateRiskFactors({
      ...baseInput,
      indicators: [{ id: "ok-indicator", severity: "ok", message: "All good", details: [] }],
    });
    expect(result.riskFactors).toHaveLength(0);
  });

  it("maps warning indicators to severity 50 (high)", () => {
    const result = aggregateRiskFactors({
      ...baseInput,
      indicators: [
        { id: "some-warning", severity: "warning", message: "Watch out", details: ["detail1"] },
      ],
    });
    expect(result.riskFactors).toHaveLength(1);
    expect(result.riskFactors[0].severity).toBe(50);
    expect(result.riskFactors[0].severityLabel).toBe("medium"); // 50 < 51 threshold for "high"
  });

  it("maps critical indicators to severity 80 (critical)", () => {
    const result = aggregateRiskFactors({
      ...baseInput,
      indicators: [{ id: "some-critical", severity: "critical", message: "Bad!", details: [] }],
    });
    expect(result.riskFactors).toHaveLength(1);
    expect(result.riskFactors[0].severity).toBe(80);
    expect(result.riskFactors[0].severityLabel).toBe("critical");
  });

  it("classifies stuck indicators as blocking-pattern", () => {
    const result = aggregateRiskFactors({
      ...baseInput,
      indicators: [
        { id: "stuck-stories", severity: "warning", message: "Stories stuck", details: [] },
      ],
      stuckStories: ["S-1", "S-2"],
    });
    expect(result.riskFactors[0].type).toBe("blocking-pattern");
    expect(result.riskFactors[0].affectedStories).toEqual(["S-1", "S-2"]);
  });

  it("classifies throughput indicators as velocity-anomaly", () => {
    const result = aggregateRiskFactors({
      ...baseInput,
      indicators: [
        {
          id: "throughput-drop",
          severity: "warning",
          message: "Throughput declining",
          details: [],
        },
      ],
    });
    expect(result.riskFactors[0].type).toBe("velocity-anomaly");
  });

  it("classifies wip/bottleneck indicators as resource-bottleneck", () => {
    const result = aggregateRiskFactors({
      ...baseInput,
      indicators: [
        {
          id: "bottleneck-review",
          severity: "critical",
          message: "Review bottleneck",
          details: [],
        },
      ],
    });
    expect(result.riskFactors[0].type).toBe("resource-bottleneck");
  });

  it("creates capacity bottleneck factors for at-capacity agents", () => {
    const result = aggregateRiskFactors({
      ...baseInput,
      capacityResults: [
        {
          agentId: "agent-1",
          utilizationPercent: 100,
          isAtCapacity: true,
          isNearCapacity: false,
          availableSlots: 0,
        },
      ],
    });
    expect(result.riskFactors).toHaveLength(1);
    expect(result.riskFactors[0].type).toBe("resource-bottleneck");
    expect(result.riskFactors[0].severity).toBe(80);
    expect(result.riskFactors[0].title).toContain("agent-1");
  });

  it("creates capacity factor for near-capacity agents with severity 50", () => {
    const result = aggregateRiskFactors({
      ...baseInput,
      capacityResults: [
        {
          agentId: "agent-2",
          utilizationPercent: 85,
          isAtCapacity: false,
          isNearCapacity: true,
          availableSlots: 1,
        },
      ],
    });
    expect(result.riskFactors).toHaveLength(1);
    expect(result.riskFactors[0].severity).toBe(50);
  });

  it("skips capacity results that are neither at nor near capacity", () => {
    const result = aggregateRiskFactors({
      ...baseInput,
      capacityResults: [
        {
          agentId: "agent-3",
          utilizationPercent: 40,
          isAtCapacity: false,
          isNearCapacity: false,
          availableSlots: 5,
        },
      ],
    });
    expect(result.riskFactors).toHaveLength(0);
  });

  it("flags agents with utilization > 90% as overutilized", () => {
    const result = aggregateRiskFactors({
      ...baseInput,
      agentUtilizations: [{ agentId: "agent-4", utilizationPercent: 95, isActive: true }],
    });
    expect(result.riskFactors).toHaveLength(1);
    expect(result.riskFactors[0].title).toContain("overutilized");
    expect(result.riskFactors[0].severity).toBe(95);
  });

  it("flags active agents with utilization < 30% as underutilized", () => {
    const result = aggregateRiskFactors({
      ...baseInput,
      agentUtilizations: [{ agentId: "agent-5", utilizationPercent: 20, isActive: true }],
    });
    expect(result.riskFactors).toHaveLength(1);
    expect(result.riskFactors[0].title).toContain("underutilized");
    expect(result.riskFactors[0].severity).toBe(30);
    expect(result.riskFactors[0].severityLabel).toBe("low");
  });

  it("does not flag inactive underutilized agents", () => {
    const result = aggregateRiskFactors({
      ...baseInput,
      agentUtilizations: [{ agentId: "agent-6", utilizationPercent: 10, isActive: false }],
    });
    expect(result.riskFactors).toHaveLength(0);
  });

  it("creates sprint health score risk when score < 60", () => {
    const result = aggregateRiskFactors({
      ...baseInput,
      sprintHealthScore: 35,
    });
    const healthFactor = result.riskFactors.find((f) => f.id === "sprint-health-score");
    expect(healthFactor).toBeDefined();
    expect(healthFactor!.type).toBe("velocity-anomaly");
    expect(healthFactor!.severity).toBe(65); // 100 - 35
    expect(healthFactor!.severityLabel).toBe("high"); // 65 → getSeverityLabel(65) = "high"
  });

  it("labels very low sprint health as critical via getSeverityLabel", () => {
    const result = aggregateRiskFactors({
      ...baseInput,
      sprintHealthScore: 10,
    });
    const healthFactor = result.riskFactors.find((f) => f.id === "sprint-health-score");
    expect(healthFactor).toBeDefined();
    expect(healthFactor!.severity).toBe(90);
    expect(healthFactor!.severityLabel).toBe("critical"); // 90 → getSeverityLabel(90) = "critical"
  });

  it("labels moderate sprint health as medium via getSeverityLabel", () => {
    const result = aggregateRiskFactors({
      ...baseInput,
      sprintHealthScore: 50,
    });
    const healthFactor = result.riskFactors.find((f) => f.id === "sprint-health-score");
    expect(healthFactor).toBeDefined();
    expect(healthFactor!.severity).toBe(50);
    expect(healthFactor!.severityLabel).toBe("medium"); // 50 → getSeverityLabel(50) = "medium"
  });

  it("does not create sprint health score risk when score >= 60", () => {
    const result = aggregateRiskFactors({
      ...baseInput,
      sprintHealthScore: 75,
    });
    const healthFactor = result.riskFactors.find((f) => f.id === "sprint-health-score");
    expect(healthFactor).toBeUndefined();
  });

  it("sorts factors by severity descending", () => {
    const result = aggregateRiskFactors({
      ...baseInput,
      indicators: [
        { id: "low-warning", severity: "warning", message: "Mild issue", details: [] },
        { id: "critical-one", severity: "critical", message: "Big problem", details: [] },
      ],
      capacityResults: [
        {
          agentId: "agent-x",
          utilizationPercent: 100,
          isAtCapacity: true,
          isNearCapacity: false,
          availableSlots: 0,
        },
      ],
    });
    const severities = result.riskFactors.map((f) => f.severity);
    for (let i = 1; i < severities.length; i++) {
      expect(severities[i]).toBeLessThanOrEqual(severities[i - 1]);
    }
  });

  it("summary counts match the categorized factors", () => {
    const result = aggregateRiskFactors({
      ...baseInput,
      indicators: [
        { id: "crit-1", severity: "critical", message: "Critical issue", details: [] },
        { id: "warn-1", severity: "warning", message: "Warning issue", details: [] },
      ],
    });
    const expectedTotal =
      result.summary.critical + result.summary.high + result.summary.medium + result.summary.low;
    expect(result.summary.total).toBe(expectedTotal);
    expect(expectedTotal).toBeGreaterThan(0);
  });

  it("affected projects always includes the input project", () => {
    const result = aggregateRiskFactors({
      ...baseInput,
      indicators: [{ id: "test-id", severity: "warning", message: "Test", details: [] }],
    });
    expect(result.riskFactors[0].affectedProjects).toContain("test-project");
  });

  it("classifies unknown indicator IDs as high-risk-stories fallback", () => {
    const result = aggregateRiskFactors({
      ...baseInput,
      indicators: [
        { id: "unknown-indicator", severity: "warning", message: "Unknown risk", details: [] },
      ],
    });
    expect(result.riskFactors[0].type).toBe("high-risk-stories");
  });

  // deriveTrend() coverage via throughputData
  describe("deriveTrend via throughputData", () => {
    it("returns stable when throughputData is omitted", () => {
      const result = aggregateRiskFactors({
        ...baseInput,
        indicators: [
          { id: "throughput-drop", severity: "warning", message: "Throughput down", details: [] },
        ],
      });
      expect(result.riskFactors[0].trend).toBe("stable");
    });

    it("returns worsening for velocity-anomaly when more positive slopes", () => {
      const result = aggregateRiskFactors({
        ...baseInput,
        indicators: [
          { id: "throughput-drop", severity: "warning", message: "Throughput down", details: [] },
        ],
        throughputData: {
          columnTrends: [
            { column: "review", weeklyAvgMs: [], trend: "increasing", slope: 0.15 },
            { column: "dev", weeklyAvgMs: [], trend: "increasing", slope: 0.08 },
            { column: "test", weeklyAvgMs: [], trend: "decreasing", slope: -0.12 },
          ],
          bottleneckTrend: null,
        },
      });
      // 2 positive > 1 negative → worsening
      expect(result.riskFactors[0].trend).toBe("worsening");
    });

    it("returns improving for velocity-anomaly when more negative slopes", () => {
      const result = aggregateRiskFactors({
        ...baseInput,
        indicators: [
          { id: "velocity-drop", severity: "warning", message: "Velocity down", details: [] },
        ],
        throughputData: {
          columnTrends: [
            { column: "review", weeklyAvgMs: [], trend: "decreasing", slope: -0.1 },
            { column: "dev", weeklyAvgMs: [], trend: "decreasing", slope: -0.08 },
            { column: "test", weeklyAvgMs: [], trend: "increasing", slope: 0.03 },
          ],
          bottleneckTrend: null,
        },
      });
      // 2 negative > 0 positive (0.03 < 0.05 threshold) → improving
      expect(result.riskFactors[0].trend).toBe("improving");
    });

    it("returns worsening for resource-bottleneck when bottleneckTrend is increasing", () => {
      const result = aggregateRiskFactors({
        ...baseInput,
        capacityResults: [
          {
            agentId: "agent-7",
            utilizationPercent: 100,
            isAtCapacity: true,
            isNearCapacity: false,
            availableSlots: 0,
          },
        ],
        throughputData: {
          columnTrends: [],
          bottleneckTrend: "increasing",
        },
      });
      const bottleneck = result.riskFactors.find((f) => f.id === "capacity-agent-7");
      expect(bottleneck).toBeDefined();
      expect(bottleneck!.trend).toBe("worsening");
    });

    it("returns stable for resource-bottleneck when bottleneckTrend is not increasing", () => {
      const result = aggregateRiskFactors({
        ...baseInput,
        capacityResults: [
          {
            agentId: "agent-8",
            utilizationPercent: 100,
            isAtCapacity: true,
            isNearCapacity: false,
            availableSlots: 0,
          },
        ],
        throughputData: {
          columnTrends: [],
          bottleneckTrend: "stable",
        },
      });
      const bottleneck = result.riskFactors.find((f) => f.id === "capacity-agent-8");
      expect(bottleneck).toBeDefined();
      expect(bottleneck!.trend).toBe("stable");
    });
  });
});
