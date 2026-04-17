/**
 * Optimization suggestion types for Story 56.7.
 * Categories, impact estimates, suggestion model, feedback, and engine result.
 */

import type { RiskFactor } from "./risk-aggregation";
import type { BottleneckItem } from "./bottleneck-aggregation";
import type { ProjectUtilizationSummary } from "./utilization-metrics-types";

// ---------------------------------------------------------------------------
// Categories
// ---------------------------------------------------------------------------

export type OptimizationCategory =
  | "agent-rebalancing"
  | "wip-adjustment"
  | "priority-reorder"
  | "capacity-scaling"
  | "underutilized-detection";

// ---------------------------------------------------------------------------
// Impact estimation
// ---------------------------------------------------------------------------

export interface EstimatedImpact {
  daysSaved: number;
  riskReductionPercent: number;
  utilizationDeltaPercent: number;
  affectedAgents: string[];
  affectedProjects: string[];
  affectedStories: string[];
}

// ---------------------------------------------------------------------------
// Suggestion model
// ---------------------------------------------------------------------------

export interface OptimizationSuggestion {
  id: string;
  category: OptimizationCategory;
  title: string;
  description: string;
  impact: EstimatedImpact;
  /** 0-100 — how confident the engine is about this suggestion */
  confidence: number;
  /** Computed ranking score (higher = more impactful) */
  priority: number;
  createdAt: number;
  /** Category-specific payload */
  data: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Feedback
// ---------------------------------------------------------------------------

export interface OptimizationFeedback {
  suggestionId: string;
  category: OptimizationCategory;
  action: "accepted" | "dismissed";
  timestamp: number;
  reason?: string;
}

// ---------------------------------------------------------------------------
// Engine input / output
// ---------------------------------------------------------------------------

export interface AgentUtilRaw {
  agentId: string;
  projectId: string;
  utilizationPercent: number;
  isActive: boolean;
  isPoolAgent: boolean;
  storiesWorked: number;
}

export interface CapacityRaw {
  agentId: string;
  utilizationPercent: number;
  isAtCapacity: boolean;
  isNearCapacity: boolean;
  availableSlots: number;
  maxCapacity: number;
  currentWorkload: number;
}

export interface OptimizationEngineInput {
  projectSummaries: ProjectUtilizationSummary[];
  riskFactors: RiskFactor[];
  bottlenecks: BottleneckItem[];
  agentUtilizations: AgentUtilRaw[];
  capacityResults: CapacityRaw[];
  /** Optimization objective for downstream parametrization (Story 56-8). Ignored in 56-7. */
  objective?: string;
}

export interface OptimizationEngineResult {
  suggestions: OptimizationSuggestion[];
  analysisTimeMs: number;
  inputSummary: {
    projectCount: number;
    agentCount: number;
    overutilizedCount: number;
    underutilizedCount: number;
    bottleneckCount: number;
  };
}

// ---------------------------------------------------------------------------
// Thresholds
// ---------------------------------------------------------------------------

/** Above this utilization % an agent is considered overutilized */
export const OPT_OVERUTILIZED = 90;
/** Below this utilization % an agent is considered underutilized */
export const OPT_UNDERUTILIZED = 30;
/** Near-capacity threshold for capacity scaling suggestions */
export const OPT_NEAR_CAPACITY = 80;
/** Minimum severity bottleneck to trigger suggestions */
export const OPT_BOTTLENECK_SEVERITY_THRESHOLD = 40;
/** Ranking weights for priority score computation */
export const RANK_WEIGHT_DAYS_SAVED = 2;
export const RANK_WEIGHT_RISK_REDUCTION = 1.5;
export const RANK_WEIGHT_UTILIZATION_DELTA = 1;
/** Maximum feedback entries stored */
export const MAX_FEEDBACK_ENTRIES = 1000;

/** Data payload for underutilized-detection suggestions (Story 56.9) */
export interface UnderutilizedAgentData {
  agentId: string;
  projectId: string;
  utilizationPercent: number;
  isActive: boolean;
  isPoolAgent: boolean;
  storiesWorked: number;
  /** Idle days — 0 until time-series history is available (deferred). */
  idleDays: number;
  suggestedProjectIds: string[];
  /** Story suggestions — reserved for future agent-skill-to-story matching (deferred). */
  suggestedStoryIds: string[];
}

// ---------------------------------------------------------------------------
// Impact analysis types (Story 56.10)
// ---------------------------------------------------------------------------

/** Snapshot of system metrics at a point in time (before or after applying a suggestion). */
export interface MetricsSnapshot {
  /** Weighted average utilization across all projects */
  utilizationPercent: number;
  /** Estimated velocity (stories/day) derived from utilization */
  velocity: number;
  /** Composite risk score (0-100) from risk factors and bottlenecks */
  riskScore: number;
  /** Number of currently active agents */
  activeAgents: number;
  /** Number of stories flagged as at-risk */
  storiesAtRisk: number;
}

/** Before/after risk change for impact analysis. */
export interface RiskChange {
  before: number;
  after: number;
  delta: number;
}

/** Computed impact analysis for a single suggestion (Story 56.10). */
export interface ImpactAnalysis {
  /** Projected completion date shift in days (positive = earlier completion) */
  completionDateShift: number;
  /** Change in estimated velocity (stories/day) */
  velocityDelta: number;
  /** Before/after risk score change */
  riskChange: RiskChange;
  /** Metrics snapshot before applying suggestion */
  beforeMetrics: MetricsSnapshot;
  /** Metrics snapshot after applying suggestion (projected) */
  afterMetrics: MetricsSnapshot;
}

/** A suggestion augmented with its impact analysis. */
export interface SuggestionImpactDetail {
  suggestion: OptimizationSuggestion;
  impactAnalysis: ImpactAnalysis;
}

/** Ratio for mapping utilization percentage to velocity estimate. */
export const VELOCITY_UTILIZATION_RATIO = 0.8;

// ---------------------------------------------------------------------------
// Optimization objectives (Story 56.8)
// ---------------------------------------------------------------------------

export type OptimizationObjective =
  | "minimize-time"
  | "maximize-throughput"
  | "balance-workload"
  | "reduce-blocking";

/** Per-objective ranking weight overrides for priority score computation */
export interface ObjectiveWeights {
  daysSaved: number;
  riskReduction: number;
  utilizationDelta: number;
  /** Multiplier applied to suggestions in boosted categories */
  boostFactor: number;
  /** Multiplier applied to suggestions in suppressed categories */
  suppressFactor: number;
}

export const OBJECTIVE_RANK_WEIGHTS: Record<OptimizationObjective, ObjectiveWeights> = {
  "minimize-time": {
    daysSaved: 3.0,
    riskReduction: 1.5,
    utilizationDelta: 1.0,
    boostFactor: 1.3,
    suppressFactor: 0.7,
  },
  "maximize-throughput": {
    daysSaved: 2.5,
    riskReduction: 1.5,
    utilizationDelta: 1.5,
    boostFactor: 1.3,
    suppressFactor: 0.7,
  },
  "balance-workload": {
    daysSaved: 2.0,
    riskReduction: 1.5,
    utilizationDelta: 2.5,
    boostFactor: 1.3,
    suppressFactor: 0.7,
  },
  "reduce-blocking": {
    daysSaved: 2.0,
    riskReduction: 2.5,
    utilizationDelta: 1.0,
    boostFactor: 1.3,
    suppressFactor: 0.7,
  },
};

/** Per-objective categories to boost (higher relevance) and suppress (lower relevance) */
export interface ObjectiveCategoryConfig {
  boost: OptimizationCategory[];
  suppress: OptimizationCategory[];
}

export const OBJECTIVE_ANALYZER_PRIORITY: Record<OptimizationObjective, ObjectiveCategoryConfig> = {
  "minimize-time": {
    boost: ["agent-rebalancing", "priority-reorder"],
    suppress: ["capacity-scaling"],
  },
  "maximize-throughput": {
    boost: ["wip-adjustment", "capacity-scaling", "underutilized-detection"],
    suppress: ["priority-reorder"],
  },
  "balance-workload": {
    boost: ["agent-rebalancing", "underutilized-detection"],
    suppress: ["priority-reorder"],
  },
  "reduce-blocking": {
    boost: ["priority-reorder"],
    suppress: ["capacity-scaling"],
  },
};

// ---------------------------------------------------------------------------
// Scenario result types (Story 56.8)
// ---------------------------------------------------------------------------

export interface RankChange {
  suggestionId: string;
  baselineRank: number;
  objectiveRank: number;
  rankDelta: number;
}

export interface BaselineComparison {
  topSuggestionMoved: boolean;
  rankChanges: RankChange[];
}

export interface ObjectiveScenarioResult {
  objective: OptimizationObjective;
  suggestions: OptimizationSuggestion[];
  analysisTimeMs: number;
  inputSummary: OptimizationEngineResult["inputSummary"];
  baselineComparison: BaselineComparison;
}

export interface ObjectiveResult {
  objective: OptimizationObjective;
  topSuggestions: OptimizationSuggestion[];
  projectedImpact: EstimatedImpact;
}

export interface ObjectiveComparisonSummary {
  objectives: ObjectiveResult[];
  baselineTopSuggestions: OptimizationSuggestion[];
  analysisTimeMs: number;
}

// ---------------------------------------------------------------------------
// Learning loop types (Story 56.11)
// ---------------------------------------------------------------------------

/** Acceptance rate stats for a single optimization category. */
export interface CategoryAcceptanceRate {
  category: OptimizationCategory;
  acceptedCount: number;
  dismissedCount: number;
  total: number;
  /** 0-1 (e.g., 0.75 means 75% accepted) */
  rate: number;
}

/** Learning-derived boost/penalty multipliers per category. */
export interface LearningWeights {
  /** Map from category to multiplier (1.0 = neutral, >1 = boost, <1 = penalty) */
  categoryBoosts: Map<OptimizationCategory, number>;
  generatedAt: number;
}

/** Maximum boost multiplier for high-acceptance categories. */
export const LEARNING_BOOST_MAX = 1.5;
/** Maximum penalty multiplier for low-acceptance categories. */
export const LEARNING_PENALTY_MAX = 0.5;
/** Minimum feedback entries per category before learning adjusts rankings. */
export const LEARNING_MIN_SAMPLES = 3;
