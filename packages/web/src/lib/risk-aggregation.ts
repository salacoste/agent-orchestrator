/**
 * Risk aggregation module — unified view of risk factors from existing sources.
 *
 * Aggregates data from tracker-bmad sprint health, capacity checks,
 * and agent utilization into a normalized RiskFactor[] with severity
 * scores (0-100), types, trends, and affected projects.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type RiskFactorType =
  | "high-risk-stories"
  | "resource-bottleneck"
  | "velocity-anomaly"
  | "blocking-pattern"
  | "scope-creep";

export type RiskSeverityLabel = "critical" | "high" | "medium" | "low";

export type RiskTrend = "improving" | "stable" | "worsening";

export interface RiskFactor {
  id: string;
  type: RiskFactorType;
  title: string;
  severity: number;
  severityLabel: RiskSeverityLabel;
  trend: RiskTrend;
  affectedProjects: string[];
  contributingFactors: string[];
  affectedStories: string[];
  suggestedAction: string;
}

export interface RiskSummary {
  critical: number;
  high: number;
  medium: number;
  low: number;
  total: number;
}

export interface RiskDashboardResponse {
  riskFactors: RiskFactor[];
  summary: RiskSummary;
  lastUpdated: string;
}

// ---------------------------------------------------------------------------
// Input (raw data the route collects and passes in)
// ---------------------------------------------------------------------------

export interface HealthIndicatorRaw {
  id: string;
  severity: "ok" | "warning" | "critical";
  message: string;
  details: string[];
}

export interface CapacityRaw {
  agentId: string;
  utilizationPercent: number;
  isAtCapacity: boolean;
  isNearCapacity: boolean;
  availableSlots: number;
}

export interface AgentUtilRaw {
  agentId: string;
  utilizationPercent: number;
  isActive: boolean;
}

export interface ThroughputDataContext {
  columnTrends: Array<{
    column: string;
    weeklyAvgMs: number[];
    trend: string;
    slope: number;
  }>;
  bottleneckTrend: string | null;
}

export interface RiskAggregationInput {
  projectId: string;
  projectName: string;
  indicators: HealthIndicatorRaw[];
  stuckStories: string[];
  wipColumns: string[];
  capacityResults: CapacityRaw[];
  agentUtilizations: AgentUtilRaw[];
  sprintHealthScore?: number;
  throughputData?: ThroughputDataContext;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mapHealthSeverity(severity: "ok" | "warning" | "critical"): number {
  switch (severity) {
    case "critical":
      return 80;
    case "warning":
      return 50;
    case "ok":
      return 15;
  }
}

function getSeverityLabel(score: number): RiskSeverityLabel {
  if (score >= 76) return "critical";
  if (score >= 51) return "high";
  if (score >= 26) return "medium";
  return "low";
}

function classifyIndicator(indicatorId: string): RiskFactorType {
  if (indicatorId.includes("stuck") || indicatorId.includes("block")) return "blocking-pattern";
  if (indicatorId.includes("throughput") || indicatorId.includes("velocity"))
    return "velocity-anomaly";
  if (indicatorId.includes("bottleneck") || indicatorId.includes("wip"))
    return "resource-bottleneck";
  if (indicatorId.includes("scope") || indicatorId.includes("creep")) return "scope-creep";
  return "high-risk-stories";
}

function getSuggestedAction(type: RiskFactorType): string {
  switch (type) {
    case "blocking-pattern":
      return "Investigate blocked stories and resolve dependencies";
    case "velocity-anomaly":
      return "Review sprint velocity trends and adjust capacity";
    case "resource-bottleneck":
      return "Consider rebalancing stories to underutilized agents";
    case "scope-creep":
      return "Review new stories added mid-sprint against sprint goals";
    default:
      return "Review story complexity and dependencies";
  }
}

function buildSummary(factors: RiskFactor[]): RiskSummary {
  const summary: RiskSummary = { critical: 0, high: 0, medium: 0, low: 0, total: factors.length };
  for (const f of factors) {
    summary[f.severityLabel]++;
  }
  return summary;
}

function deriveTrend(type: RiskFactorType, throughputData?: ThroughputDataContext): RiskTrend {
  if (!throughputData) return "stable";

  if (type === "velocity-anomaly") {
    // Positive slope = increasing dwell time = worsening throughput
    const negativeSlopes = throughputData.columnTrends.filter((ct) => ct.slope < -0.05).length;
    const positiveSlopes = throughputData.columnTrends.filter((ct) => ct.slope > 0.05).length;
    if (positiveSlopes > negativeSlopes) return "worsening";
    if (negativeSlopes > positiveSlopes) return "improving";
  }

  if (type === "resource-bottleneck" && throughputData.bottleneckTrend === "increasing") {
    return "worsening";
  }

  return "stable";
}

// ---------------------------------------------------------------------------
// Main aggregation
// ---------------------------------------------------------------------------

export function aggregateRiskFactors(input: RiskAggregationInput): RiskDashboardResponse {
  const factors: RiskFactor[] = [];
  const project = input.projectId;

  // 1. Sprint health indicators from tracker-bmad
  for (const indicator of input.indicators) {
    if (indicator.severity === "ok") continue;
    const type = classifyIndicator(indicator.id);
    const severity = mapHealthSeverity(indicator.severity);
    factors.push({
      id: `indicator-${indicator.id}`,
      type,
      title: indicator.message,
      severity,
      severityLabel: getSeverityLabel(severity),
      trend: deriveTrend(type, input.throughputData),
      affectedProjects: [project],
      contributingFactors: indicator.details,
      affectedStories: indicator.id === "stuck-stories" ? input.stuckStories : [],
      suggestedAction: getSuggestedAction(type),
    });
  }

  // 2. Capacity bottlenecks
  for (const cap of input.capacityResults) {
    if (!cap.isAtCapacity && !cap.isNearCapacity) continue;
    const severity = cap.isAtCapacity ? 80 : 50;
    factors.push({
      id: `capacity-${cap.agentId}`,
      type: "resource-bottleneck",
      title: `Agent ${cap.agentId} at ${cap.utilizationPercent}% capacity`,
      severity,
      severityLabel: getSeverityLabel(severity),
      trend: deriveTrend("resource-bottleneck", input.throughputData),
      affectedProjects: [project],
      contributingFactors: [
        `${cap.availableSlots} available slots`,
        `Utilization at ${cap.utilizationPercent}%`,
      ],
      affectedStories: [],
      suggestedAction: cap.isAtCapacity
        ? "Consider rebalancing stories to underutilized agents"
        : "Monitor workload to prevent over-allocation",
    });
  }

  // 3. Agent utilization anomalies (over/under utilized)
  for (const agent of input.agentUtilizations) {
    if (agent.utilizationPercent > 90) {
      const severity = Math.min(100, agent.utilizationPercent);
      factors.push({
        id: `util-over-${agent.agentId}`,
        type: "resource-bottleneck",
        title: `Agent ${agent.agentId} overutilized at ${agent.utilizationPercent}%`,
        severity,
        severityLabel: getSeverityLabel(severity),
        trend: deriveTrend("resource-bottleneck", input.throughputData),
        affectedProjects: [project],
        contributingFactors: [`Utilization at ${agent.utilizationPercent}%`],
        affectedStories: [],
        suggestedAction: "Redistribute workload to underutilized agents",
      });
    } else if (agent.isActive && agent.utilizationPercent < 30) {
      factors.push({
        id: `util-under-${agent.agentId}`,
        type: "resource-bottleneck",
        title: `Agent ${agent.agentId} underutilized at ${agent.utilizationPercent}%`,
        severity: 30,
        severityLabel: "low",
        trend: deriveTrend("resource-bottleneck", input.throughputData),
        affectedProjects: [project],
        contributingFactors: [`Utilization at only ${agent.utilizationPercent}%`],
        affectedStories: [],
        suggestedAction: "Consider assigning additional stories to this agent",
      });
    }
  }

  // 4. Sprint health score risk (if available and low)
  if (input.sprintHealthScore !== undefined && input.sprintHealthScore < 60) {
    const severity = 100 - input.sprintHealthScore;
    factors.push({
      id: "sprint-health-score",
      type: "velocity-anomaly",
      title: `Sprint health score is ${input.sprintHealthScore}/100`,
      severity,
      severityLabel: getSeverityLabel(severity),
      trend: deriveTrend("velocity-anomaly", input.throughputData),
      affectedProjects: [project],
      contributingFactors: [`Sprint health composite score: ${input.sprintHealthScore}/100`],
      affectedStories: [],
      suggestedAction: "Review sprint health breakdown for improvement areas",
    });
  }

  // Sort by severity descending
  factors.sort((a, b) => b.severity - a.severity);

  return {
    riskFactors: factors,
    summary: buildSummary(factors),
    lastUpdated: new Date().toISOString(),
  };
}
