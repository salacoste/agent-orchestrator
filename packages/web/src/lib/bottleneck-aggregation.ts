/**
 * Bottleneck aggregation module — unified view of flow bottlenecks from existing sources.
 *
 * Aggregates data from tracker-bmad sprint health, cycle time, throughput,
 * team workload, story aging, capacity checks, and resource conflicts into
 * a normalized BottleneckItem[] with impact scores, types, and trends.
 */

import { getAgentHistory } from "./utilization-history";
import { computeRollingAverage, computeTrend } from "./utilization-snapshot";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type BottleneckType =
  | "column-bottleneck"
  | "stuck-stories"
  | "wip-violation"
  | "throughput-drop"
  | "agent-overload"
  | "capacity-bottleneck"
  | "resource-conflict"
  | "unassigned-stories"
  | "aging-stories"
  | "bottleneck-trend";

export type BottleneckSeverityLabel = "critical" | "high" | "medium" | "low";

export type BottleneckTrend = "improving" | "stable" | "worsening";

export interface BottleneckImpact {
  storiesAffected: number;
  estimatedDelayDays: number;
  impactScore: number;
}

export interface BottleneckItem {
  id: string;
  type: BottleneckType;
  title: string;
  severity: number;
  severityLabel: BottleneckSeverityLabel;
  impact: BottleneckImpact;
  trend: BottleneckTrend;
  affectedProjects: string[];
  affectedStories: string[];
  contributingFactors: string[];
  suggestedAction: string;
}

export interface BottleneckSummary {
  stuckStories: number;
  wipViolations: number;
  agingStories: number;
  overloadedAgents: number;
  resourceConflicts: number;
  totalBottlenecks: number;
}

export interface BottleneckDashboardResponse {
  bottlenecks: BottleneckItem[];
  summary: BottleneckSummary;
  lastUpdated: string;
}

// ---------------------------------------------------------------------------
// Input types (raw data the route collects)
// ---------------------------------------------------------------------------

export interface SprintHealthRaw {
  indicators: Array<{
    id: string;
    severity: "ok" | "warning" | "critical";
    message: string;
    details: string[];
  }>;
  stuckStories: string[];
  wipColumns: string[];
}

export interface CycleTimeRaw {
  bottleneckColumn: string | null;
  averageColumnDwells: Array<{ column: string; dwellMs: number }>;
  completedCount: number;
}

export interface ThroughputRaw {
  bottleneckTrend: string | null;
  columnTrends: Array<{
    column: string;
    weeklyAvgMs: number[];
    trend: string;
    slope: number;
  }>;
}

export interface TeamWorkloadRaw {
  overloaded: string[];
  unassigned: Array<{ storyId: string; column: string; points?: number }>;
  members: Array<{
    sessionId: string;
    storiesByColumn: Record<string, string[]>;
    totalInFlight: number;
    isOverloaded: boolean;
  }>;
  overloadThreshold: number;
}

export interface StoryAgingRaw {
  agingStories: Array<{
    storyId: string;
    column: string;
    ageMs: number;
    isAging: boolean;
  }>;
}

export interface CapacityRaw {
  agentId: string;
  utilizationPercent: number;
  isAtCapacity: boolean;
  isNearCapacity: boolean;
  availableSlots: number;
}

export interface ConflictRaw {
  id: string;
  resourceType: string;
  resourceIdentifier: string;
  competingProjects: string[];
  severity: string;
}

export interface BottleneckAggregationInput {
  projectId: string;
  projectName: string;
  sprintHealth: SprintHealthRaw;
  cycleTime: CycleTimeRaw;
  throughput: ThroughputRaw;
  teamWorkload: TeamWorkloadRaw;
  storyAging: StoryAgingRaw;
  capacityResults: CapacityRaw[];
  conflicts: ConflictRaw[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const SEVERITY_WEIGHT = 10;
const DELAY_WEIGHT = 5;
const MS_PER_DAY = 24 * 60 * 60 * 1000;
const STUCK_WARNING_MS = 48 * 60 * 60 * 1000;
const STUCK_CRITICAL_MS = 96 * 60 * 60 * 1000;

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

function getSeverityLabel(score: number): BottleneckSeverityLabel {
  if (score >= 76) return "critical";
  if (score >= 51) return "high";
  if (score >= 26) return "medium";
  return "low";
}

function computeImpact(
  storiesAffected: number,
  delayDays: number,
  severityNum: number,
): BottleneckImpact {
  const raw = storiesAffected * SEVERITY_WEIGHT + delayDays * DELAY_WEIGHT + severityNum * 0.3;
  const impactScore = Math.min(100, Math.round(raw));
  return {
    storiesAffected,
    estimatedDelayDays: Math.round(delayDays * 10) / 10,
    impactScore,
  };
}

function getSuggestedAction(type: BottleneckType): string {
  switch (type) {
    case "column-bottleneck":
      return "Consider adding capacity to the bottleneck column or splitting the workflow step";
    case "stuck-stories":
      return "Investigate blocked stories and resolve dependencies";
    case "wip-violation":
      return "Reduce work in progress to stay within WIP limits";
    case "throughput-drop":
      return "Review sprint velocity trends and adjust capacity";
    case "agent-overload":
      return "Redistribute stories from overloaded agents";
    case "capacity-bottleneck":
      return "Consider adding agents or rebalancing workload";
    case "resource-conflict":
      return "Resolve resource contention between competing projects";
    case "unassigned-stories":
      return "Assign unassigned stories to available agents";
    case "aging-stories":
      return "Review aging stories for blockers or scope issues";
    case "bottleneck-trend":
      return "Monitor the worsening trend and investigate root cause";
    default:
      return "Review bottleneck details for improvement opportunities";
  }
}

function classifyIndicatorType(indicatorId: string): BottleneckType {
  if (indicatorId === "bottleneck") return "column-bottleneck";
  if (indicatorId === "stuck-stories") return "stuck-stories";
  if (indicatorId === "throughput-drop") return "throughput-drop";
  if (indicatorId.includes("wip") || indicatorId === "wip-alert") return "wip-violation";
  if (indicatorId.includes("block")) return "stuck-stories";
  return "column-bottleneck";
}

function deriveBottleneckTrend(
  type: BottleneckType,
  input: BottleneckAggregationInput,
): BottleneckTrend {
  const { throughput } = input;

  // If we have throughput data with column trends, use slopes
  if (throughput.columnTrends.length > 0) {
    const positiveSlopes = throughput.columnTrends.filter((ct) => ct.slope > 0.05).length;
    const negativeSlopes = throughput.columnTrends.filter((ct) => ct.slope < -0.05).length;

    if (type === "column-bottleneck" || type === "bottleneck-trend") {
      return positiveSlopes > negativeSlopes
        ? "worsening"
        : negativeSlopes > positiveSlopes
          ? "improving"
          : "stable";
    }

    if (type === "throughput-drop") {
      return positiveSlopes > 0 ? "worsening" : "stable";
    }

    if (type === "aging-stories") {
      return positiveSlopes > negativeSlopes ? "worsening" : "stable";
    }
  }

  // For capacity bottlenecks, check if agents are trending toward capacity.
  // Enhanced with utilization history (Story 56.6 — C4).
  if (type === "capacity-bottleneck" || type === "agent-overload") {
    const nearCapacity = input.capacityResults.filter((c) => c.isNearCapacity).length;
    const atCapacity = input.capacityResults.filter((c) => c.isAtCapacity).length;
    if (atCapacity > nearCapacity) return "worsening";

    // Use utilization history to detect trending direction
    const highUtilAgents = input.capacityResults.filter(
      (c) => c.utilizationPercent > 70 && c.agentId,
    );
    let worseningFromHistory = false;
    for (const agent of highUtilAgents) {
      const history = getAgentHistory(agent.agentId);
      if (history.length >= 2) {
        const points = history.map((s) => ({
          timestamp: s.timestamp,
          value: s.utilizationPercent,
        }));
        const now = Date.now();
        const rollingAvg = computeRollingAverage(points, 3600_000, now);
        const trend = computeTrend(points, now);
        if (trend === "declining" && rollingAvg > 70) {
          worseningFromHistory = true;
          break;
        }
      }
    }
    if (worseningFromHistory) return "worsening";
  }

  return "stable";
}

function buildSummary(items: BottleneckItem[]): BottleneckSummary {
  let stuckStories = 0;
  let wipViolations = 0;
  let agingStories = 0;
  let overloadedAgents = 0;
  let resourceConflicts = 0;

  for (const item of items) {
    switch (item.type) {
      case "stuck-stories":
        stuckStories++;
        break;
      case "wip-violation":
        wipViolations++;
        break;
      case "aging-stories":
        agingStories++;
        break;
      case "agent-overload":
      case "capacity-bottleneck":
        overloadedAgents++;
        break;
      case "resource-conflict":
        resourceConflicts++;
        break;
    }
  }

  return {
    stuckStories,
    wipViolations,
    agingStories,
    overloadedAgents,
    resourceConflicts,
    totalBottlenecks: items.length,
  };
}

// ---------------------------------------------------------------------------
// Main aggregation
// ---------------------------------------------------------------------------

export function aggregateBottlenecks(
  input: BottleneckAggregationInput,
): BottleneckDashboardResponse {
  const items: BottleneckItem[] = [];
  const project = input.projectId;

  // 1. Sprint health indicators (bottleneck, stuck, throughput-drop, wip)
  for (const indicator of input.sprintHealth.indicators) {
    if (indicator.severity === "ok") continue;
    const type = classifyIndicatorType(indicator.id);
    const severityNum = mapHealthSeverity(indicator.severity);

    let storiesAffected: number;
    let delayDays: number;
    const affectedStories: string[] = [];

    if (indicator.id === "stuck-stories") {
      storiesAffected = input.sprintHealth.stuckStories.length;
      affectedStories.push(...input.sprintHealth.stuckStories);
      delayDays =
        indicator.severity === "critical"
          ? STUCK_CRITICAL_MS / MS_PER_DAY
          : STUCK_WARNING_MS / MS_PER_DAY;
    } else if (indicator.id.includes("wip") || indicator.id === "wip-alert") {
      storiesAffected = input.sprintHealth.wipColumns.length;
      delayDays = 0;
    } else {
      storiesAffected = 1;
      delayDays = 0;
    }

    items.push({
      id: `${project}-indicator-${indicator.id}`,
      type,
      title: indicator.message,
      severity: severityNum,
      severityLabel: getSeverityLabel(severityNum),
      impact: computeImpact(storiesAffected, delayDays, severityNum),
      trend: deriveBottleneckTrend(type, input),
      affectedProjects: [project],
      affectedStories,
      contributingFactors: indicator.details,
      suggestedAction: getSuggestedAction(type),
    });
  }

  // 2. Cycle time bottleneck column
  if (input.cycleTime.bottleneckColumn && input.cycleTime.averageColumnDwells.length >= 2) {
    const bnCol = input.cycleTime.bottleneckColumn;
    const sortedDwells = [...input.cycleTime.averageColumnDwells].sort(
      (a, b) => b.dwellMs - a.dwellMs,
    );
    const bottleneckDwell = sortedDwells.find((d) => d.column === bnCol);
    const secondHighest = sortedDwells.find((d) => d.column !== bnCol);
    const ratio =
      bottleneckDwell && secondHighest
        ? bottleneckDwell.dwellMs / Math.max(1, secondHighest.dwellMs)
        : 1;

    if (ratio >= 2) {
      const dwellDays = (bottleneckDwell?.dwellMs ?? 0) / MS_PER_DAY;
      const severityNum = Math.min(100, Math.round(ratio * 20));
      const storiesInCol = input.sprintHealth.stuckStories.length; // Approximation
      const trendInfo = input.throughput.columnTrends.find((t) => t.column === bnCol);
      const trend: BottleneckTrend = trendInfo && trendInfo.slope > 0 ? "worsening" : "stable";

      items.push({
        id: `${project}-bn-column-${bnCol.replace(/\s+/g, "-")}`,
        type: "column-bottleneck",
        title: `"${bnCol}" is a flow bottleneck (${ratio.toFixed(1)}x next column)`,
        severity: severityNum,
        severityLabel: getSeverityLabel(severityNum),
        impact: computeImpact(storiesInCol, dwellDays * 0.5, severityNum),
        trend,
        affectedProjects: [project],
        affectedStories: [],
        contributingFactors: [
          `Column dwell time is ${ratio.toFixed(1)}x the next slowest column`,
          `Average dwell: ${dwellDays.toFixed(1)} days`,
        ],
        suggestedAction: getSuggestedAction("column-bottleneck"),
      });
    }
  }

  // 3. Throughput trend (worsening bottleneck)
  if (input.throughput.bottleneckTrend) {
    const trendCol = input.throughput.bottleneckTrend;
    const trendData = input.throughput.columnTrends.find((t) => t.column === trendCol);
    const slope = trendData?.slope ?? 0;
    const severityNum = Math.min(100, Math.round(slope * 100 + 30));

    items.push({
      id: `${project}-bn-trend-${trendCol.replace(/\s+/g, "-")}`,
      type: "bottleneck-trend",
      title: `${trendCol} dwell time increasing`,
      severity: severityNum,
      severityLabel: getSeverityLabel(severityNum),
      impact: computeImpact(1, slope * 7, severityNum),
      trend: "worsening",
      affectedProjects: [project],
      affectedStories: [],
      contributingFactors: [
        `Trend slope: +${slope.toFixed(2)} ms/week`,
        `Weekly averages: ${(trendData?.weeklyAvgMs ?? []).map((ms) => `${(ms / MS_PER_DAY).toFixed(1)}d`).join(", ")}`,
      ],
      suggestedAction: getSuggestedAction("bottleneck-trend"),
    });
  }

  // 4. Agent overload (from team workload)
  for (const sessionId of input.teamWorkload.overloaded) {
    const member = input.teamWorkload.members.find((m) => m.sessionId === sessionId);
    if (!member) continue;

    const inFlight = member.totalInFlight;
    const allStories = Object.values(member.storiesByColumn).flat();
    const severityNum = Math.min(100, inFlight * 15);
    const delayDays = inFlight * 0.5;

    items.push({
      id: `${project}-bn-overload-${sessionId}`,
      type: "agent-overload",
      title: `Agent ${sessionId} has ${inFlight} in-flight stories`,
      severity: severityNum,
      severityLabel: getSeverityLabel(severityNum),
      impact: computeImpact(inFlight, delayDays, severityNum),
      trend: deriveBottleneckTrend("agent-overload", input),
      affectedProjects: [project],
      affectedStories: allStories,
      contributingFactors: [
        `${inFlight} stories in flight (threshold: ${input.teamWorkload.overloadThreshold})`,
      ],
      suggestedAction: getSuggestedAction("agent-overload"),
    });
  }

  // 5. Unassigned stories
  if (input.teamWorkload.unassigned.length > 0) {
    const count = input.teamWorkload.unassigned.length;
    const severityNum = Math.min(100, count * 10);
    const storyIds = input.teamWorkload.unassigned.map((s) => s.storyId);

    items.push({
      id: `${project}-bn-unassigned`,
      type: "unassigned-stories",
      title: `${count} stories have no assigned agent`,
      severity: severityNum,
      severityLabel: getSeverityLabel(severityNum),
      impact: computeImpact(count, 1, severityNum),
      trend: deriveBottleneckTrend("unassigned-stories", input),
      affectedProjects: [project],
      affectedStories: storyIds,
      contributingFactors: [`${count} stories waiting for agent assignment`],
      suggestedAction: getSuggestedAction("unassigned-stories"),
    });
  }

  // 6. Story aging
  const agingStories = input.storyAging.agingStories.filter((a) => a.isAging);
  if (agingStories.length > 0) {
    const maxAgeMs = Math.max(...agingStories.map((a) => a.ageMs));
    const delayDays = maxAgeMs / MS_PER_DAY;
    const severityNum = Math.min(100, Math.round(delayDays * 8));
    const storyIds = agingStories.map((a) => a.storyId);

    items.push({
      id: `${project}-bn-aging`,
      type: "aging-stories",
      title: `${agingStories.length} stories aging beyond P90 threshold`,
      severity: severityNum,
      severityLabel: getSeverityLabel(severityNum),
      impact: computeImpact(agingStories.length, delayDays, severityNum),
      trend: deriveBottleneckTrend("aging-stories", input),
      affectedProjects: [project],
      affectedStories: storyIds,
      contributingFactors: agingStories
        .slice(0, 5)
        .map((a) => `${a.storyId} in "${a.column}" for ${(a.ageMs / MS_PER_DAY).toFixed(1)} days`),
      suggestedAction: getSuggestedAction("aging-stories"),
    });
  }

  // 7. Capacity bottlenecks
  for (const cap of input.capacityResults) {
    if (!cap.isAtCapacity && !cap.isNearCapacity) continue;
    const severityNum = cap.isAtCapacity ? 80 : 50;

    items.push({
      id: `${project}-bn-capacity-${cap.agentId}`,
      type: "capacity-bottleneck",
      title: `Agent ${cap.agentId} at ${cap.utilizationPercent}% capacity`,
      severity: severityNum,
      severityLabel: getSeverityLabel(severityNum),
      impact: computeImpact(1, cap.utilizationPercent / 20, severityNum),
      trend: deriveBottleneckTrend("capacity-bottleneck", input),
      affectedProjects: [project],
      affectedStories: [],
      contributingFactors: [
        `${cap.availableSlots} available slots`,
        `Utilization at ${cap.utilizationPercent}%`,
      ],
      suggestedAction: getSuggestedAction("capacity-bottleneck"),
    });
  }

  // 8. Resource conflicts
  for (const conflict of input.conflicts) {
    const severityNum =
      conflict.severity === "critical"
        ? 90
        : conflict.severity === "high"
          ? 70
          : conflict.severity === "medium"
            ? 50
            : 25;
    const competingCount = conflict.competingProjects.length;

    items.push({
      id: `${project}-bn-conflict-${conflict.id}`,
      type: "resource-conflict",
      title: `${conflict.resourceType} conflict: ${conflict.resourceIdentifier}`,
      severity: severityNum,
      severityLabel: getSeverityLabel(severityNum),
      impact: computeImpact(competingCount, 1, severityNum),
      trend: deriveBottleneckTrend("resource-conflict", input),
      affectedProjects: conflict.competingProjects,
      affectedStories: [],
      contributingFactors: [
        `${competingCount} projects competing for ${conflict.resourceType}`,
        `Resource: ${conflict.resourceIdentifier}`,
      ],
      suggestedAction: getSuggestedAction("resource-conflict"),
    });
  }

  // Sort by impact score descending
  items.sort((a, b) => b.impact.impactScore - a.impact.impactScore);

  return {
    bottlenecks: items,
    summary: buildSummary(items),
    lastUpdated: new Date().toISOString(),
  };
}
