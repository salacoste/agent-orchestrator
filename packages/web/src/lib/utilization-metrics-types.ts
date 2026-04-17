/**
 * Utilization metrics types for Story 56.6.
 * Snapshots, time-series, trend data, and aggregated summaries.
 */

/** Thresholds — reuse same values as risk-aggregation.ts */
export const OVERUTILIZED_THRESHOLD = 90;
export const UNDERUTILIZED_THRESHOLD = 30;

/** Rolling average window durations in ms */
export const WINDOW_1H = 3600_000;
export const WINDOW_24H = 86_400_000;
export const WINDOW_7D = 604_800_000;

/** Single point-in-time utilization reading for one agent */
export interface UtilizationSnapshot {
  agentId: string;
  projectId: string;
  timestamp: number; // epoch ms
  utilizationPercent: number; // 0-100
  isActive: boolean;
  storiesWorked: number;
  isPoolAgent: boolean;
  isAtCapacity: boolean;
  isNearCapacity: boolean;
}

/** Time-series data for a single agent across a window */
export interface UtilizationTimeSeries {
  agentId: string;
  rollingAvg1h: number;
  rollingAvg24h: number;
  rollingAvg7d: number;
  trend: "improving" | "stable" | "declining";
}

/** Per-project utilization summary */
export interface ProjectUtilizationSummary {
  projectId: string;
  avgUtilization: number;
  overutilizedCount: number;
  underutilizedCount: number;
  agentCount: number;
  agentSnapshots: UtilizationSnapshot[];
  poolBreakdown?: {
    totalPoolAgents: number;
    activePoolAgents: number;
    reservedAgents: number;
  };
}

/** Portfolio-level utilization overview */
export interface PortfolioUtilizationOverview {
  projectSummaries: ProjectUtilizationSummary[];
  totalAgents: number;
  avgUtilization: number;
  overutilizedAgents: number;
  underutilizedAgents: number;
  timestamp: number;
}
