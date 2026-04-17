import {
  type UtilizationSnapshot,
  type UtilizationTimeSeries,
  type ProjectUtilizationSummary,
  type PortfolioUtilizationOverview,
  OVERUTILIZED_THRESHOLD,
  UNDERUTILIZED_THRESHOLD,
  WINDOW_1H,
  WINDOW_24H,
  WINDOW_7D,
} from "./utilization-metrics-types";

/**
 * Pure computation module for utilization snapshots, rolling averages,
 * trend detection, and summary aggregation.
 * Story 56.6 Task 2.
 */

// ---- Input types from core ----

interface AgentUtilRaw {
  agentId: string;
  utilizationPercent: number;
  isActive: boolean;
  storiesWorked?: number;
  isPoolAgent?: boolean;
  projectId?: string;
}

interface CapacityResultRaw {
  agentId: string;
  utilizationPercent: number;
  isAtCapacity: boolean;
  isNearCapacity: boolean;
}

export interface SnapshotInput {
  agentUtilizations: AgentUtilRaw[];
  capacityResults: CapacityResultRaw[];
  projectId: string;
}

// ---- Rolling average & trend ----

/**
 * Rolling average over a window (plain arithmetic mean of in-window points).
 * Returns 0 if no snapshots fall within the window.
 */
export function computeRollingAverage(
  snapshots: Array<{ timestamp: number; value: number }>,
  windowMs: number,
  nowMs: number,
): number {
  const cutoff = nowMs - windowMs;
  const inWindow = snapshots.filter((s) => s.timestamp >= cutoff);
  if (inWindow.length === 0) return 0;
  const sum = inWindow.reduce((acc, s) => acc + s.value, 0);
  return Math.round(sum / inWindow.length);
}

/**
 * Determine trend by comparing recent half vs older half of the window.
 * "improving" = utilization is decreasing (better), "declining" = increasing (worse),
 * "stable" = no significant change (< 5pp difference).
 */
export function computeTrend(
  snapshots: Array<{ timestamp: number; value: number }>,
  _nowMs: number,
): "improving" | "stable" | "declining" {
  if (snapshots.length < 2) return "stable";
  const sorted = [...snapshots].sort((a, b) => a.timestamp - b.timestamp);
  const mid = Math.floor(sorted.length / 2);
  const older = sorted.slice(0, mid);
  const newer = sorted.slice(mid);
  if (older.length === 0 || newer.length === 0) return "stable";
  const avgOlder = older.reduce((s, x) => s + x.value, 0) / older.length;
  const avgNewer = newer.reduce((s, x) => s + x.value, 0) / newer.length;
  const diff = avgNewer - avgOlder;
  if (diff > 5) return "declining";
  if (diff < -5) return "improving";
  return "stable";
}

// ---- Snapshot collection ----

/**
 * Map core utilization + capacity data to typed UtilizationSnapshot[].
 */
export function collectSnapshot(input: SnapshotInput): UtilizationSnapshot[] {
  const now = Date.now();
  const capacityMap = new Map(input.capacityResults.map((c) => [c.agentId, c]));

  return input.agentUtilizations.map((agent): UtilizationSnapshot => {
    const cap = capacityMap.get(agent.agentId);
    return {
      agentId: agent.agentId,
      projectId: input.projectId,
      timestamp: now,
      utilizationPercent: agent.utilizationPercent,
      isActive: agent.isActive,
      storiesWorked: agent.storiesWorked ?? 0,
      isPoolAgent: agent.isPoolAgent ?? false,
      isAtCapacity: cap?.isAtCapacity ?? false,
      isNearCapacity: cap?.isNearCapacity ?? false,
    };
  });
}

// ---- Time-series assembly ----

/**
 * Build UtilizationTimeSeries from stored snapshot history for an agent.
 */
export function buildTimeSeries(
  agentId: string,
  history: UtilizationSnapshot[],
  nowMs?: number,
): UtilizationTimeSeries {
  const now = nowMs ?? Date.now();
  const agentHistory = history.filter((s) => s.agentId === agentId);
  const points = agentHistory.map((s) => ({ timestamp: s.timestamp, value: s.utilizationPercent }));

  return {
    agentId,
    rollingAvg1h: computeRollingAverage(points, WINDOW_1H, now),
    rollingAvg24h: computeRollingAverage(points, WINDOW_24H, now),
    rollingAvg7d: computeRollingAverage(points, WINDOW_7D, now),
    trend: computeTrend(points, now),
  };
}

// ---- Aggregation ----

/**
 * Aggregate snapshots for a single project into a summary.
 */
export function buildProjectSummary(
  projectId: string,
  snapshots: UtilizationSnapshot[],
): ProjectUtilizationSummary {
  const projectSnaps = snapshots.filter((s) => s.projectId === projectId);
  if (projectSnaps.length === 0) {
    return {
      projectId,
      avgUtilization: 0,
      overutilizedCount: 0,
      underutilizedCount: 0,
      agentCount: 0,
      agentSnapshots: [],
    };
  }

  const avgUtil = Math.round(
    projectSnaps.reduce((sum, s) => sum + s.utilizationPercent, 0) / projectSnaps.length,
  );
  const overutilized = projectSnaps.filter(
    (s) => s.utilizationPercent > OVERUTILIZED_THRESHOLD,
  ).length;
  const underutilized = projectSnaps.filter(
    (s) => s.isActive && s.utilizationPercent < UNDERUTILIZED_THRESHOLD,
  ).length;

  const poolAgents = projectSnaps.filter((s) => s.isPoolAgent);
  const reservedAgents = poolAgents.filter((s) => !s.isActive && s.storiesWorked === 0).length;

  return {
    projectId,
    avgUtilization: avgUtil,
    overutilizedCount: overutilized,
    underutilizedCount: underutilized,
    agentCount: projectSnaps.length,
    agentSnapshots: projectSnaps,
    poolBreakdown:
      poolAgents.length > 0
        ? {
            totalPoolAgents: poolAgents.length,
            activePoolAgents: poolAgents.filter((s) => s.isActive).length,
            reservedAgents,
          }
        : undefined,
  };
}

/**
 * Aggregate across all projects into a portfolio overview.
 */
export function buildPortfolioOverview(
  projectSummaries: ProjectUtilizationSummary[],
): PortfolioUtilizationOverview {
  const totalAgents = projectSummaries.reduce((s, p) => s + p.agentCount, 0);
  const totalUtil = projectSummaries.reduce((s, p) => s + p.avgUtilization * p.agentCount, 0);
  const avgUtil = totalAgents > 0 ? Math.round(totalUtil / totalAgents) : 0;

  return {
    projectSummaries,
    totalAgents,
    avgUtilization: avgUtil,
    overutilizedAgents: projectSummaries.reduce((s, p) => s + p.overutilizedCount, 0),
    underutilizedAgents: projectSummaries.reduce((s, p) => s + p.underutilizedCount, 0),
    timestamp: Date.now(),
  };
}
