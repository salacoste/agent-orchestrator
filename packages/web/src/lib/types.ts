/**
 * Dashboard-specific types for the web UI.
 *
 * Core types (SessionStatus, ActivityState, CIStatus, ReviewDecision, etc.)
 * are re-exported from @composio/ao-core. Dashboard-specific types
 * extend/flatten the core types for client-side rendering (e.g. DashboardPR
 * flattens core PRInfo + MergeReadiness + CICheck[] + ReviewComment[]).
 */

// Re-export core types used directly by the dashboard
export type {
  SessionStatus,
  ActivityState,
  CIStatus,
  ReviewDecision,
  MergeReadiness,
  PRState,
} from "@composio/ao-core/types";

import {
  ACTIVITY_STATE,
  SESSION_STATUS,
  CI_STATUS,
  TERMINAL_STATUSES,
  TERMINAL_ACTIVITIES,
  NON_RESTORABLE_STATUSES,
  type CICheck as CoreCICheck,
  type MergeReadiness,
  type CIStatus,
  type SessionStatus,
  type ActivityState,
  type ReviewDecision,
} from "@composio/ao-core/types";
import type { SimulationResult } from "@composio/ao-core";

// Re-export for use in client components
export { TERMINAL_STATUSES, TERMINAL_ACTIVITIES, NON_RESTORABLE_STATUSES };

/**
 * Attention zone priority level, ordered by human action urgency:
 *
 * 1. merge   — PR approved + CI green. One click to clear. Highest ROI.
 * 2. respond — Agent waiting for human input. Quick unblock, agent resumes.
 * 3. review  — CI failed, changes requested, conflicts. Needs investigation.
 * 4. pending — Waiting on external (reviewer, CI). Nothing to do right now.
 * 5. working — Agents doing their thing. Don't interrupt.
 * 6. done    — Merged or terminated. Archive.
 */
export type AttentionLevel = "merge" | "respond" | "review" | "pending" | "working" | "done";

/**
 * Flattened session for dashboard rendering.
 * Maps to core Session but uses string dates (JSON-serializable for SSR/client boundary)
 * and inlines PR state.
 *
 * TODO: When wiring to real data, add a serialization layer that converts
 * core Session (Date objects) → DashboardSession (string dates).
 */
export interface DashboardSession {
  id: string;
  projectId: string;
  status: SessionStatus;
  activity: ActivityState | null;
  branch: string | null;
  issueId: string | null; // Deprecated: use issueUrl instead
  issueUrl: string | null; // Full issue URL
  issueLabel: string | null; // Human-readable label (e.g., "INT-1327", "#42")
  issueTitle: string | null; // Full issue title (e.g., "Add user authentication flow")
  summary: string | null;
  /** True when the summary is a low-quality fallback (e.g. truncated spawn prompt) */
  summaryIsFallback: boolean;
  createdAt: string;
  lastActivityAt: string;
  pr: DashboardPR | null;
  workspacePath: string | null;
  metadata: Record<string, string>;
}

/**
 * Flattened PR for dashboard rendering.
 * Aggregates core PRInfo + PRState + CICheck[] + MergeReadiness + ReviewComment[].
 */
export interface DashboardPR {
  number: number;
  url: string;
  title: string;
  owner: string;
  repo: string;
  branch: string;
  baseBranch: string;
  isDraft: boolean;
  state: "open" | "merged" | "closed";
  additions: number;
  deletions: number;
  ciStatus: CIStatus;
  ciChecks: DashboardCICheck[];
  reviewDecision: ReviewDecision;
  mergeability: DashboardMergeability;
  unresolvedThreads: number;
  unresolvedComments: DashboardUnresolvedComment[];
}

/**
 * Mirrors core CICheck but omits Date fields (not JSON-serializable).
 * Core CICheck also has conclusion, startedAt, completedAt.
 */
export interface DashboardCICheck {
  name: string;
  status: CoreCICheck["status"];
  url?: string;
}

/**
 * Same shape as core MergeReadiness — re-exported for convenience.
 */
export type DashboardMergeability = MergeReadiness;

export interface DashboardUnresolvedComment {
  url: string;
  path: string;
  author: string;
  body: string;
}

export interface DashboardStats {
  totalSessions: number;
  workingSessions: number;
  openPRs: number;
  needsReview: number;
}

/**
 * Project summary for portfolio dashboard.
 * Aggregated metrics for a single configured project.
 */
export interface PortfolioProject {
  id: string;
  name: string;
  status: "active" | "idle" | "error";
  activeAgents: number;
  /** Total agents (sessions) for this project, including idle ones */
  totalAgents: number;
  stories: {
    backlog: number;
    inProgress: number;
    done: number;
    blocked: number;
  };
  lastActivity?: string; // ISO date string
  /** Timestamp when this project was last updated via SSE (for highlight animation) */
  lastUpdated?: number;
  /** User-defined tags for filtering (e.g., ["production", "api"]) */
  tags?: string[];
  /** Custom metadata key-value pairs for filtering */
  metadata?: Record<string, string>;
  /** Shared pool configuration if this project participates in cross-project agent sharing */
  sharedPool?: {
    enabled: boolean;
    eligibleProjects: string[];
    maxConcurrent?: number;
    /** Agents reserved for exclusive use by this project (not shared with others) */
    reservedAgents?: string[];
  };
  /** Pool agents from other projects available for cross-project assignment */
  poolAgentsAvailable?: Array<{
    agentId: string;
    sourceProjectId: string;
    sourceProjectName: string;
  }>;
  /** Capacity status for this project's agents (from pool capacity API) */
  capacityStatus?: {
    /** Maximum concurrent assignments allowed per agent */
    maxCapacity: number;
    /** Available assignment slots across all agents */
    availableSlots: number;
    /** Whether any agent is at capacity */
    isAtCapacity: boolean;
    /** Whether any agent is near capacity (≥80%) */
    isNearCapacity: boolean;
    /** Overall utilization percentage */
    utilizationPercent: number;
  };
}

/**
 * Cross-project dependency between stories in different projects.
 * Source is blocked until target completes.
 */
export type { CrossProjectDependency, DependencyWithStatus } from "@composio/ao-core";

/** Filter state for portfolio project filtering */
export interface FilterState {
  status: PortfolioProject["status"] | null;
  tags: string[];
  metadata: Record<string, string>;
}

/**
 * Aggregated metrics for the entire portfolio dashboard.
 * Summarizes health and utilization across all projects.
 */
export interface PortfolioMetrics {
  /** Total active agents across all projects */
  totalAgents: number;
  /** Total agents configured (for utilization calculation) */
  totalConfiguredAgents: number;
  /** Story counts aggregated from all projects */
  stories: {
    backlog: number;
    inProgress: number;
    done: number;
    blocked: number;
    total: number;
  };
  /** Sprint health score 0-100 (completion % - blocked penalty) */
  sprintHealthScore: number;
  /** Resource utilization percentage 0-100 (active/configured) */
  utilizationPercent: number;
  /** Shared pool utilization: how many agents are reserved vs total pool agents */
  poolUtilization?: {
    /** Total agents across all pool-enabled projects */
    totalPoolAgents: number;
    /** Active (working) agents across pool-enabled projects */
    activePoolAgents: number;
    /** Total agents reserved for exclusive use */
    totalReservedAgents: number;
    /** Projects with shared pool enabled */
    poolProjectCount: number;
  };
}

/** SSE snapshot event from /api/events */
export interface SSESnapshotEvent {
  type: "snapshot";
  sessions: Array<{
    id: string;
    status: SessionStatus;
    activity: ActivityState | null;
    attentionLevel: AttentionLevel;
    lastActivityAt: string;
  }>;
}

/** SSE activity update event from /api/events */
export interface SSEActivityEvent {
  type: "session.activity";
  sessionId: string;
  activity: ActivityState | null;
  status: SessionStatus;
  attentionLevel: AttentionLevel;
  timestamp: string;
}

/** SSE workflow-change event from /api/events (notification-only, no payload) */
export interface SSEWorkflowChangeEvent {
  type: "workflow-change";
}

/** SSE event: a BMAD artifact was created or updated on disk (Story 16.5). */
export interface SSEWorkflowArtifactEvent {
  type: "workflow.artifact";
  filename: string;
  phase: string | null;
  artifactType: string;
  action: "created" | "updated";
  timestamp: string;
}

/** SSE event: a BMAD workflow phase changed state (Story 16.5). */
export interface SSEWorkflowPhaseEvent {
  type: "workflow.phase";
  phase: string;
  previousState: "not-started" | "done" | "active";
  newState: "not-started" | "done" | "active";
  timestamp: string;
}

/**
 * Returns true when this PR's enrichment data couldn't be fetched due to
 * API rate limiting. When true, CI status / review decision / mergeability
 * may be stale defaults — don't make decisions based on them.
 */
export function isPRRateLimited(pr: DashboardPR): boolean {
  return pr.mergeability.blockers.includes("API rate limited or unavailable");
}

/**
 * Returns true when a PR is open and all merge criteria are met.
 * Does NOT return true for merged or closed PRs — those are already done.
 */
export function isPRMergeReady(pr: DashboardPR): boolean {
  return (
    pr.state === "open" &&
    pr.mergeability.mergeable &&
    pr.mergeability.ciPassing &&
    pr.mergeability.approved &&
    pr.mergeability.noConflicts
  );
}

/** Determines which attention zone a session belongs to */
export function getAttentionLevel(session: DashboardSession): AttentionLevel {
  // ── Done: terminal states ─────────────────────────────────────────
  if (
    session.status === "merged" ||
    session.status === "killed" ||
    session.status === "cleanup" ||
    session.status === "done" ||
    session.status === "terminated"
  ) {
    return "done";
  }
  if (session.pr) {
    if (session.pr.state === "merged" || session.pr.state === "closed") {
      return "done";
    }
  }

  // ── Merge: PR is ready — one click to clear ───────────────────────
  // Check this early: if the PR is mergeable, that's the most valuable
  // action for the human regardless of agent activity.
  if (session.status === "mergeable" || session.status === "approved") {
    return "merge";
  }
  if (session.pr?.mergeability.mergeable) {
    return "merge";
  }

  // ── Respond: agent is waiting for human input ─────────────────────
  // Check status-based error conditions first — these are authoritative
  // and should not be masked by a stale activity value.
  if (
    session.status === SESSION_STATUS.ERRORED ||
    session.status === SESSION_STATUS.NEEDS_INPUT ||
    session.status === SESSION_STATUS.STUCK
  ) {
    return "respond";
  }
  if (
    session.activity === ACTIVITY_STATE.WAITING_INPUT ||
    session.activity === ACTIVITY_STATE.BLOCKED
  ) {
    return "respond";
  }
  // Exited agent with non-terminal status = crashed, needs human attention
  if (session.activity === ACTIVITY_STATE.EXITED) {
    return "respond";
  }

  // ── Review: problems that need investigation ──────────────────────
  if (session.status === "ci_failed" || session.status === "changes_requested") {
    return "review";
  }
  if (session.pr && !isPRRateLimited(session.pr)) {
    const pr = session.pr;
    if (pr.ciStatus === CI_STATUS.FAILING) return "review";
    if (pr.reviewDecision === "changes_requested") return "review";
    if (!pr.mergeability.noConflicts) return "review";
  }

  // ── Pending: waiting on external (reviewer, CI) ───────────────────
  if (session.status === "review_pending") {
    return "pending";
  }
  if (session.pr && !isPRRateLimited(session.pr)) {
    const pr = session.pr;
    if (!pr.isDraft && pr.unresolvedThreads > 0) return "pending";
    if (!pr.isDraft && (pr.reviewDecision === "pending" || pr.reviewDecision === "none")) {
      return "pending";
    }
  }

  // ── Working: agents doing their thing ─────────────────────────────
  return "working";
}

// =============================================================================
// Unified Sprint Dashboard Types (Epic 53)
// =============================================================================

/** Health status for a sprint across a single project. */
export type SprintHealthStatus = "on-track" | "at-risk" | "blocked";

/** A single project's sprint entry in the unified view. */
export interface UnifiedSprintEntry {
  /** Project identifier from config. */
  projectId: string;
  /** Human-readable project name. */
  projectName: string;
  /** Sprint name (derived from config or default "Sprint N"). */
  sprintName: string;
  /** ISO date string when sprint started, or null if unknown. */
  startDate: string | null;
  /** ISO date string when sprint ends, or null if unknown. */
  endDate: string | null;
  /** Story counts by status. */
  stories: {
    total: number;
    done: number;
    inProgress: number;
    blocked: number;
    backlog: number;
  };
  /** Completion percentage: done / total * 100. */
  progressPercent: number;
  /** Sprint lifecycle status. */
  status: "active" | "completed" | "planning";
  /** Computed health indicator. */
  health: SprintHealthStatus;
  /** Human-readable reasons for the health status. */
  healthReasons: string[];
  /** Stories completed per day of sprint time. 0 when dates unavailable or sprint is planning. */
  velocity: number;
  /** Inferred direction of sprint progress. */
  velocityTrend: "improving" | "declining" | "stable" | "unknown";
}

/** Aggregated summary across all unified sprint entries. */
export interface UnifiedSprintSummary {
  /** Total number of projects with sprint data. */
  totalSprints: number;
  /** Projects with status "active". */
  activeSprints: number;
  /** Projects with status "completed". */
  completedSprints: number;
  /** Projects with status "planning". */
  planningSprints: number;
  /** Aggregate story counts. */
  totalStories: number;
  /** Stories marked done across all sprints. */
  storiesDone: number;
  /** Mean progress percentage across all sprints. */
  avgProgress: number;
  /** Count of sprints flagged as at-risk or blocked. */
  atRiskSprints: number;
  /** Average velocity (stories/day) across all sprints with velocity > 0. */
  avgVelocity: number;
  /** Maximum velocity across all sprints. */
  maxVelocity: number;
}

// =============================================================================
// Sprint Filtering Types (Story 53.5)
// =============================================================================

/** Filter state for the unified sprint view. All filters are optional (null = no filter). */
export interface SprintFilterState {
  /** Filter by sprint lifecycle status. */
  status: UnifiedSprintEntry["status"] | null;
  /** Filter by health indicator. */
  health: SprintHealthStatus | null;
  /** Filter by project ID. */
  projectId: string | null;
  /** Filter by date range overlap. Start/end are ISO date strings. */
  dateRange: { start: string; end: string } | null;
}

/** Empty sprint filter state — no filters active. */
export const EMPTY_SPRINT_FILTERS: SprintFilterState = {
  status: null,
  health: null,
  projectId: null,
  dateRange: null,
};

// =============================================================================
// What-If Scenario Types (Epic 54)
// =============================================================================

/** Lifecycle status for a what-if scenario. */
export type ScenarioStatus = "draft" | "simulated" | "applied";

/** Snapshot of a single story captured at scenario creation time. */
export interface ScenarioStorySnapshot {
  /** Story key (e.g., "54-1-scenario-creation-interface"). */
  id: string;
  /** Project this story belongs to. */
  projectId: string;
  /** Story status at snapshot time. */
  status: string;
  /** Domain tags from the story's sprint status entry. */
  domainTags: string[];
}

/** Priority level for a story within a scenario. */
export type StoryPriority = "high" | "medium" | "low";

/** Priority override for a specific story in a scenario. */
export interface StoryPriorityOverride {
  /** Story key (e.g., "54-1-scenario-creation-interface"). */
  storyId: string;
  /** Original priority (always "medium" — the default). */
  originalPriority: StoryPriority;
  /** New priority set by the user. */
  newPriority: StoryPriority;
}

/** Parameters that can be modified in a what-if scenario. */
export interface ScenarioParameters {
  /** Number of agents to simulate. */
  agentCount: number;
  /** Maximum concurrent stories per agent. */
  capacityLimit: number;
  /** Story priority overrides (only stories with changed priorities). */
  storyPriorities: StoryPriorityOverride[];
}

/** Diff between original and modified scenario parameters. */
export interface ParameterDiff {
  agentCount: { original: number; modified: number } | null;
  capacityLimit: { original: number; modified: number } | null;
  priorityChanges: StoryPriorityOverride[];
  hasChanges: boolean;
}

/**
 * A what-if scenario — a sandboxed copy of current state for experimentation.
 * File persistence added in 54.5.
 */
export interface WhatIfScenario {
  /** UUID (crypto.randomUUID()). */
  id: string;
  /** User-provided name. */
  name: string;
  /** ISO 8601 creation timestamp. */
  createdAt: string;
  /** ISO 8601 last-modified timestamp (updated on create, parameter change, simulate). */
  updatedAt?: string;
  /** Projects included in this scenario. */
  projectIds: string[];
  /** Captured story state at creation time. */
  stories: ScenarioStorySnapshot[];
  /** Lifecycle status. */
  status: ScenarioStatus;
  /** Configured parameters — undefined until user edits parameters (54.2). */
  parameters?: ScenarioParameters;
  /** Simulation result — null until 54.3 runs the simulation. */
  result?: SimulationResult;
}

/** Project info for the scenario creator form. */
export interface ScenarioProjectInfo {
  id: string;
  name: string;
  storyCounts: {
    total: number;
    done: number;
    inProgress: number;
    backlog: number;
  };
}
