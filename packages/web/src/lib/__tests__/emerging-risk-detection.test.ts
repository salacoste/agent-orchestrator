/**
 * Unit tests for emerging risk detection module.
 * Tests pattern detection logic with threshold-based heuristics.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { detectEmergingRisks, type EmergingRiskInput } from "../emerging-risk-detection.js";
import type { RiskFactor, RiskTrend } from "../risk-aggregation.js";
import { recordSnapshots, _resetUtilizationHistory } from "../utilization-history.js";
import type { UtilizationSnapshot } from "../utilization-metrics-types.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeWeeklyThroughput(weeks: Array<{ weekStart: string; count: number }>) {
  return weeks;
}

function makeColumnTrends(
  trends: Array<{ column: string; slope: number; weeklyAvgMs?: number[] }>,
) {
  return trends.map((t) => ({
    column: t.column,
    weeklyAvgMs: t.weeklyAvgMs ?? [100, 200, 300],
    trend: t.slope > 0.05 ? "increasing" : t.slope < -0.05 ? "decreasing" : "stable",
    slope: t.slope,
  }));
}

function makeInput(overrides: Partial<EmergingRiskInput> = {}): EmergingRiskInput {
  return {
    projectId: "test-project",
    throughput: {
      dailyThroughput: [],
      weeklyThroughput: makeWeeklyThroughput([
        { weekStart: "2026-03-10", count: 10 },
        { weekStart: "2026-03-17", count: 10 },
        { weekStart: "2026-03-24", count: 10 },
        { weekStart: "2026-03-31", count: 10 },
        { weekStart: "2026-04-07", count: 10 },
      ]),
      columnTrends: [],
      bottleneckTrend: null,
      leadTimes: [],
      averageLeadTimeMs: 0,
      medianLeadTimeMs: 0,
      averageCycleTimeMs: 0,
      medianCycleTimeMs: 0,
      flowEfficiency: 0,
    },
    sprintHealth: {
      overall: "ok" as const,
      indicators: [],
      stuckStories: [],
      wipColumns: [],
    },
    agentUtilizations: [],
    riskFactors: [],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("emerging-risk-detection", () => {
  describe("healthy state — no emerging risks", () => {
    it("returns empty array when throughput is stable and healthy", () => {
      const input = makeInput();
      const result = detectEmergingRisks(input);
      expect(result).toEqual([]);
    });

    it("returns empty array when weekly throughput is empty", () => {
      const input = makeInput({
        throughput: {
          dailyThroughput: [],
          weeklyThroughput: [],
          columnTrends: [],
          bottleneckTrend: null,
          leadTimes: [],
          averageLeadTimeMs: 0,
          medianLeadTimeMs: 0,
          averageCycleTimeMs: 0,
          medianCycleTimeMs: 0,
          flowEfficiency: 0,
        },
      });
      const result = detectEmergingRisks(input);
      expect(result).toEqual([]);
    });
  });

  describe("velocity-drop detection", () => {
    it("detects velocity drop when recent 2 weeks are below 40% of baseline", () => {
      const input = makeInput({
        throughput: {
          ...makeInput().throughput,
          weeklyThroughput: makeWeeklyThroughput([
            { weekStart: "2026-03-03", count: 10 },
            { weekStart: "2026-03-10", count: 10 },
            { weekStart: "2026-03-17", count: 10 },
            { weekStart: "2026-03-24", count: 10 },
            { weekStart: "2026-03-31", count: 3 },
            { weekStart: "2026-04-07", count: 2 },
          ]),
        },
      });

      const result = detectEmergingRisks(input);
      const velocityRisk = result.find((r) => r.type === "velocity-drop");
      expect(velocityRisk).toBeDefined();
      expect(velocityRisk!.status).toBe("emerging");
      expect(velocityRisk!.severity).toBe(70); // <40% = severity 70
      expect(velocityRisk!.trajectory).toBe("worsening");
      expect(velocityRisk!.id).toContain("test-project-emerging-velocity-drop");
    });

    it("detects velocity drop at medium severity when recent is 50-60% of baseline", () => {
      const input = makeInput({
        throughput: {
          ...makeInput().throughput,
          weeklyThroughput: makeWeeklyThroughput([
            { weekStart: "2026-03-03", count: 10 },
            { weekStart: "2026-03-10", count: 10 },
            { weekStart: "2026-03-17", count: 10 },
            { weekStart: "2026-03-24", count: 10 },
            { weekStart: "2026-03-31", count: 5 },
            { weekStart: "2026-04-07", count: 6 },
          ]),
        },
      });

      const result = detectEmergingRisks(input);
      const velocityRisk = result.find((r) => r.type === "velocity-drop");
      expect(velocityRisk).toBeDefined();
      expect(velocityRisk!.severity).toBe(50); // <60% = severity 50
    });

    it("does not detect velocity drop when recent throughput is within normal range", () => {
      const input = makeInput({
        throughput: {
          ...makeInput().throughput,
          weeklyThroughput: makeWeeklyThroughput([
            { weekStart: "2026-03-10", count: 10 },
            { weekStart: "2026-03-17", count: 10 },
            { weekStart: "2026-03-24", count: 10 },
            { weekStart: "2026-03-31", count: 10 },
            { weekStart: "2026-04-07", count: 9 },
          ]),
        },
      });

      const result = detectEmergingRisks(input);
      const velocityRisk = result.find((r) => r.type === "velocity-drop");
      expect(velocityRisk).toBeUndefined();
    });
  });

  describe("throughput-decline detection", () => {
    it("detects throughput decline from positive column slope", () => {
      const input = makeInput({
        throughput: {
          ...makeInput().throughput,
          columnTrends: makeColumnTrends([
            { column: "review", slope: 0.5, weeklyAvgMs: [100, 200, 400] },
          ]),
        },
      });

      const result = detectEmergingRisks(input);
      const declineRisk = result.find((r) => r.type === "throughput-decline");
      expect(declineRisk).toBeDefined();
      expect(declineRisk!.status).toBe("emerging");
      expect(declineRisk!.severity).toBeGreaterThan(40);
      expect(declineRisk!.cause).toContain("review");
    });

    it("does not detect decline when all column slopes are negative (improving)", () => {
      const input = makeInput({
        throughput: {
          ...makeInput().throughput,
          columnTrends: makeColumnTrends([
            { column: "dev", slope: -0.3 },
            { column: "review", slope: -0.1 },
          ]),
        },
      });

      const result = detectEmergingRisks(input);
      const declineRisk = result.find((r) => r.type === "throughput-decline");
      expect(declineRisk).toBeUndefined();
    });
  });

  describe("capacity-trend detection", () => {
    it("detects capacity trend when agent utilization exceeds 70%", () => {
      const input = makeInput({
        agentUtilizations: [{ agentId: "agent-1", utilizationPercent: 78, isActive: true }],
      });

      const result = detectEmergingRisks(input);
      const capRisk = result.find((r) => r.type === "capacity-trend");
      expect(capRisk).toBeDefined();
      expect(capRisk!.severity).toBeGreaterThan(0);
      expect(capRisk!.cause).toContain("agent-1");
    });

    it("does not detect capacity trend when utilization is healthy", () => {
      const input = makeInput({
        agentUtilizations: [{ agentId: "agent-1", utilizationPercent: 45, isActive: true }],
      });

      const result = detectEmergingRisks(input);
      const capRisk = result.find((r) => r.type === "capacity-trend");
      expect(capRisk).toBeUndefined();
    });
  });

  describe("blocker-accumulation detection", () => {
    it("detects blocker accumulation when stuck stories >3 and throughput-drop indicator present", () => {
      const input = makeInput({
        sprintHealth: {
          overall: "warning" as const,
          indicators: [
            {
              id: "throughput-drop",
              severity: "warning" as const,
              message: "Throughput dropping",
              details: ["7-day throughput below 70% of 4-week average"],
            },
          ],
          stuckStories: ["story-1", "story-2", "story-3", "story-4"],
          wipColumns: [],
        },
      });

      const result = detectEmergingRisks(input);
      const blockerRisk = result.find((r) => r.type === "blocker-accumulation");
      expect(blockerRisk).toBeDefined();
      expect(blockerRisk!.severity).toBeGreaterThanOrEqual(60);
      expect(blockerRisk!.pattern).toContain("4 stuck stories");
    });

    it("does not detect blocker accumulation when stuck stories are few", () => {
      const input = makeInput({
        sprintHealth: {
          overall: "ok" as const,
          indicators: [
            {
              id: "throughput-drop",
              severity: "warning" as const,
              message: "Throughput dropping",
              details: [],
            },
          ],
          stuckStories: ["story-1", "story-2"],
          wipColumns: [],
        },
      });

      const result = detectEmergingRisks(input);
      const blockerRisk = result.find((r) => r.type === "blocker-accumulation");
      expect(blockerRisk).toBeUndefined();
    });
  });

  describe("aging-acceleration detection", () => {
    it("detects aging acceleration when stories age beyond threshold", () => {
      const riskFactors: RiskFactor[] = [
        {
          id: "aging-factor",
          type: "high-risk-stories",
          title: "5 aging stories",
          severity: 60,
          severityLabel: "high",
          trend: "worsening" as RiskTrend,
          affectedProjects: ["test-project"],
          contributingFactors: ["Stories aging beyond P90"],
          affectedStories: ["s1", "s2", "s3", "s4", "s5"],
          suggestedAction: "Review aging stories",
        },
      ];

      const input = makeInput({
        throughput: {
          ...makeInput().throughput,
          columnTrends: makeColumnTrends([
            { column: "dev", slope: 0.3, weeklyAvgMs: [1000, 2000, 4000] },
          ]),
        },
        riskFactors,
      });

      const result = detectEmergingRisks(input);
      const agingRisk = result.find((r) => r.type === "aging-acceleration");
      expect(agingRisk).toBeDefined();
      expect(agingRisk!.severity).toBeGreaterThan(0);
    });
  });

  describe("multiple emerging risks simultaneously", () => {
    it("detects velocity-drop AND throughput-decline together", () => {
      const input = makeInput({
        throughput: {
          ...makeInput().throughput,
          weeklyThroughput: makeWeeklyThroughput([
            { weekStart: "2026-03-10", count: 10 },
            { weekStart: "2026-03-17", count: 10 },
            { weekStart: "2026-03-24", count: 10 },
            { weekStart: "2026-03-31", count: 10 },
            { weekStart: "2026-04-07", count: 2 },
          ]),
          columnTrends: makeColumnTrends([{ column: "review", slope: 0.8 }]),
        },
        agentUtilizations: [{ agentId: "agent-1", utilizationPercent: 82, isActive: true }],
      });

      const result = detectEmergingRisks(input);
      expect(result.length).toBeGreaterThanOrEqual(3);
      const types = result.map((r) => r.type);
      expect(types).toContain("velocity-drop");
      expect(types).toContain("throughput-decline");
      expect(types).toContain("capacity-trend");
    });
  });

  describe("severity calculation", () => {
    it("caps severity at 100", () => {
      const input = makeInput({
        throughput: {
          ...makeInput().throughput,
          columnTrends: makeColumnTrends([
            { column: "dev", slope: 10.0, weeklyAvgMs: [100, 5000, 50000] },
          ]),
        },
      });

      const result = detectEmergingRisks(input);
      const declineRisk = result.find((r) => r.type === "throughput-decline");
      expect(declineRisk).toBeDefined();
      expect(declineRisk!.severity).toBeLessThanOrEqual(100);
    });
  });

  describe("project-prefixed IDs", () => {
    it("uses project prefix in all emerging risk IDs", () => {
      const input = makeInput({
        projectId: "my-special-project",
        throughput: {
          ...makeInput().throughput,
          weeklyThroughput: makeWeeklyThroughput([
            { weekStart: "2026-03-10", count: 10 },
            { weekStart: "2026-03-17", count: 10 },
            { weekStart: "2026-03-24", count: 10 },
            { weekStart: "2026-03-31", count: 10 },
            { weekStart: "2026-04-07", count: 1 },
          ]),
        },
      });

      const result = detectEmergingRisks(input);
      for (const risk of result) {
        expect(risk.id).toMatch(/^my-special-project-emerging-/);
      }
    });
  });

  describe("suggested actions", () => {
    it("includes a suggestedAction for every detected risk", () => {
      const input = makeInput({
        throughput: {
          ...makeInput().throughput,
          weeklyThroughput: makeWeeklyThroughput([
            { weekStart: "2026-03-10", count: 10 },
            { weekStart: "2026-03-17", count: 10 },
            { weekStart: "2026-03-24", count: 10 },
            { weekStart: "2026-03-31", count: 10 },
            { weekStart: "2026-04-07", count: 2 },
          ]),
          columnTrends: makeColumnTrends([{ column: "review", slope: 0.5 }]),
        },
        agentUtilizations: [{ agentId: "agent-1", utilizationPercent: 85, isActive: true }],
      });

      const result = detectEmergingRisks(input);
      for (const risk of result) {
        expect(risk.suggestedAction).toBeTruthy();
        expect(typeof risk.suggestedAction).toBe("string");
        expect(risk.suggestedAction.length).toBeGreaterThan(10);
      }
    });
  });

  // Enhanced capacity-trend tests with utilization history (Story 56.6 — H5)
  describe("capacity-trend with utilization history", () => {
    beforeEach(() => {
      _resetUtilizationHistory();
    });

    function makeUtilSnapshot(
      overrides: Partial<UtilizationSnapshot> & { agentId: string; projectId: string },
    ): UtilizationSnapshot {
      return {
        timestamp: Date.now(),
        utilizationPercent: 50,
        isActive: true,
        storiesWorked: 0,
        isPoolAgent: false,
        isAtCapacity: false,
        isNearCapacity: false,
        ...overrides,
      };
    }

    it("uses rolling average when history is available", () => {
      const now = Date.now();
      // Seed history with high utilization for agent-1
      recordSnapshots(
        [
          makeUtilSnapshot({
            agentId: "agent-1",
            projectId: "test-project",
            utilizationPercent: 80,
            timestamp: now - 2000,
          }),
          makeUtilSnapshot({
            agentId: "agent-1",
            projectId: "test-project",
            utilizationPercent: 90,
            timestamp: now - 1000,
          }),
        ],
        604_800_000,
      );

      const input = makeInput({
        agentUtilizations: [{ agentId: "agent-1", utilizationPercent: 75, isActive: true }],
      });
      const result = detectEmergingRisks(input);
      const capRisk = result.find((r) => r.type === "capacity-trend");
      expect(capRisk).toBeDefined();
      expect(capRisk!.pattern).toContain("rolling 1h avg");
    });

    it("detects worsening trajectory from history trend", () => {
      const now = Date.now();
      // Build a declining trend: older values low, newer values high
      recordSnapshots(
        [
          makeUtilSnapshot({
            agentId: "agent-1",
            projectId: "test-project",
            utilizationPercent: 40,
            timestamp: now - 4000,
          }),
          makeUtilSnapshot({
            agentId: "agent-1",
            projectId: "test-project",
            utilizationPercent: 60,
            timestamp: now - 3000,
          }),
          makeUtilSnapshot({
            agentId: "agent-1",
            projectId: "test-project",
            utilizationPercent: 80,
            timestamp: now - 2000,
          }),
          makeUtilSnapshot({
            agentId: "agent-1",
            projectId: "test-project",
            utilizationPercent: 95,
            timestamp: now - 1000,
          }),
        ],
        604_800_000,
      );

      const input = makeInput({
        agentUtilizations: [{ agentId: "agent-1", utilizationPercent: 95, isActive: true }],
      });
      const result = detectEmergingRisks(input);
      const capRisk = result.find((r) => r.type === "capacity-trend");
      expect(capRisk).toBeDefined();
      expect(capRisk!.trajectory).toBe("worsening");
    });

    it("detects improving trajectory when utilization is decreasing", () => {
      const now = Date.now();
      // Build an improving trend: older values high, newer values lower
      recordSnapshots(
        [
          makeUtilSnapshot({
            agentId: "agent-1",
            projectId: "test-project",
            utilizationPercent: 95,
            timestamp: now - 4000,
          }),
          makeUtilSnapshot({
            agentId: "agent-1",
            projectId: "test-project",
            utilizationPercent: 85,
            timestamp: now - 3000,
          }),
          makeUtilSnapshot({
            agentId: "agent-1",
            projectId: "test-project",
            utilizationPercent: 75,
            timestamp: now - 2000,
          }),
          makeUtilSnapshot({
            agentId: "agent-1",
            projectId: "test-project",
            utilizationPercent: 72,
            timestamp: now - 1000,
          }),
        ],
        604_800_000,
      );

      const input = makeInput({
        agentUtilizations: [{ agentId: "agent-1", utilizationPercent: 72, isActive: true }],
      });
      const result = detectEmergingRisks(input);
      const capRisk = result.find((r) => r.type === "capacity-trend");
      expect(capRisk).toBeDefined();
      expect(capRisk!.trajectory).toBe("improving");
    });
  });
});
