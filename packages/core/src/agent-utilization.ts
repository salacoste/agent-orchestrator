/**
 * Agent Utilization Tracking — computes per-agent, per-project, and pool-level utilization (Epic 50, Story 50.5).
 *
 * Provides:
 * - Per-agent utilization (active/idle, stories worked, cross-project assignments)
 * - Per-project agent utilization (active/total ratio)
 * - Pool-level utilization overview (cross-project pool metrics)
 *
 * FR-F2-5: Tracks agent utilization across projects with per-project breakdown.
 *
 * Design: Pure sync functions accepting pre-fetched sessions and registry (same pattern as
 * cross-project-assignment.ts). No I/O, fully testable.
 */

import type { Session, AgentRegistry, OrchestratorConfig } from "./types.js";
import { getPoolProjects, getReservedAgents } from "./shared-pool.js";

// =============================================================================
// TYPES
// =============================================================================

/** Per-project time entry in an agent's utilization breakdown. */
export interface ProjectTimeBreakdown {
  /** Project ID. */
  projectId: string;
  /** Time spent in this project (ms). 0 if duration unknown (e.g., source project before reassignment). */
  durationMs: number;
  /** Percentage of total tracked time spent in this project. */
  percent: number;
  /** Whether this is a local (home) project assignment vs. a cross-project pool assignment. */
  isLocal: boolean;
}

/** Utilization metrics for a single agent. */
export interface AgentUtilization {
  /** Agent / session ID. */
  agentId: string;
  /** Project the agent session lives in. */
  projectId: string;
  /** Whether the agent is currently active. */
  isActive: boolean;
  /** Utilization percentage: 100 if active, 0 if idle. */
  utilizationPercent: number;
  /** Time since session creation in ms. */
  sessionDurationMs: number;
  /** Number of stories currently assigned to this agent (from registry). 0 or 1 for current assignments. */
  storiesWorked: number;
  /** Number of cross-project assignments (non-home project assignments). */
  crossProjectAssignments: number;
  /** Whether this agent belongs to a pool-enabled project. */
  isPoolAgent: boolean;
  /** Per-project time allocation breakdown for this agent. */
  projectTimeBreakdown: ProjectTimeBreakdown[];
}

/** Per-project agent utilization summary. */
export interface ProjectAgentUtilization {
  /** Project ID. */
  projectId: string;
  /** Total agents (sessions) in this project. */
  totalAgents: number;
  /** Agents currently active. */
  activeAgents: number;
  /** Utilization percentage (activeAgents / totalAgents * 100). */
  utilizationPercent: number;
  /** Per-agent breakdown. */
  agentDetails: AgentUtilization[];
  /** Total pool-enabled agents in this project. */
  poolAgentsTotal: number;
  /** Pool agents currently active. */
  poolAgentsActive: number;
  /** Aggregated active time (ms) across all agents in this project. */
  totalActiveTimeMs: number;
  /** Aggregated idle time (ms) across all agents in this project. */
  totalIdleTimeMs: number;
}

/** Cross-project pool utilization overview. */
export interface PoolUtilizationOverview {
  /** Total agents across all pool-enabled projects. */
  totalPoolAgents: number;
  /** Pool agents currently active. */
  activePoolAgents: number;
  /** Overall pool utilization percentage. */
  utilizationPercent: number;
  /** Total reserved agents (excluded from pool sharing). */
  reservedAgentCount: number;
  /** Number of pool-enabled projects. */
  poolProjectCount: number;
  /** Per-project breakdown for pool-enabled projects. */
  projectBreakdown: ProjectAgentUtilization[];
}

// =============================================================================
// HELPERS
// =============================================================================

/** Compute session duration in ms from createdAt to lastActivityAt (or now). */
function computeSessionDurationMs(session: Session): number {
  const start = session.createdAt?.getTime();
  const end = session.lastActivityAt?.getTime();
  if (!start || !end) return 0;
  return Math.max(end - start, 0);
}

// =============================================================================
// AGENT UTILIZATION
// =============================================================================

/**
 * Compute utilization metrics for all agents.
 *
 * Iterates sessions to build per-agent utilization, including activity state,
 * stories worked, and cross-project assignment tracking.
 */
export function computeAgentUtilization(
  sessions: Session[],
  registry: AgentRegistry,
  config: OrchestratorConfig,
): AgentUtilization[] {
  const poolProjectSet = new Set(getPoolProjects(config));
  const results: AgentUtilization[] = [];

  // Deduplicate sessions by agent ID
  const agentSessions = new Map<string, Session>();
  for (const session of sessions) {
    if (!agentSessions.has(session.id)) {
      agentSessions.set(session.id, session);
    }
  }

  // Build cross-project session map: group sessions by sourceProjectId metadata
  // to count actual cross-project assignments per agent
  const crossProjectSessionCount = new Map<string, number>();
  for (const session of sessions) {
    const sourceProjectId = session.metadata?.["sourceProjectId"];
    if (sourceProjectId) {
      const count = crossProjectSessionCount.get(session.id) ?? 0;
      crossProjectSessionCount.set(session.id, count + 1);
    }
  }

  for (const [agentId, session] of agentSessions) {
    // "active" activity OR "working" status both indicate an in-use agent
    // (matches portfolio-aggregation.ts definition)
    const isActive = session.activity === "active" || session.status === "working";
    const isPoolAgent = poolProjectSet.has(session.projectId);

    // Check registry for active assignments — storiesWorked is 0 or 1
    // (current assignments only; historical tracking is a future enhancement)
    const assignment = registry.getByAgent(agentId);
    const storiesWorked = assignment !== null ? 1 : 0;

    // Cross-project: session has sourceProjectId metadata indicating it was spawned
    // from another project's allocation
    const sourceProjectId = session.metadata?.["sourceProjectId"] as string | undefined;
    const crossProjectAssignments = sourceProjectId ? 1 : 0;

    // Build per-project time breakdown
    const durationMs = computeSessionDurationMs(session);
    const projectTimeBreakdown: ProjectTimeBreakdown[] = [
      {
        projectId: session.projectId,
        durationMs,
        percent: 100,
        isLocal: !sourceProjectId,
      },
    ];
    if (sourceProjectId) {
      // Source project duration unknown (separate session); include for visibility
      projectTimeBreakdown.push({
        projectId: sourceProjectId,
        durationMs: 0,
        percent: 0,
        isLocal: false,
      });
    }

    results.push({
      agentId,
      projectId: session.projectId,
      isActive,
      utilizationPercent: isActive ? 100 : 0,
      sessionDurationMs: durationMs,
      storiesWorked,
      crossProjectAssignments,
      isPoolAgent,
      projectTimeBreakdown,
    });
  }

  return results;
}

// =============================================================================
// PROJECT UTILIZATION
// =============================================================================

/**
 * Compute utilization metrics for all agents in a specific project.
 *
 * Returns aggregated project-level metrics plus per-agent breakdown.
 */
export function computeProjectUtilization(
  projectId: string,
  sessions: Session[],
  registry: AgentRegistry,
  config: OrchestratorConfig,
): ProjectAgentUtilization {
  const projectSessions = sessions.filter((s) => s.projectId === projectId);
  const poolProjectSet = new Set(getPoolProjects(config));
  const isPoolProject = poolProjectSet.has(projectId);

  const totalAgents = projectSessions.length;
  const activeAgents = projectSessions.filter(
    (s) => s.activity === "active" || s.status === "working",
  ).length;

  const agentDetails: AgentUtilization[] = projectSessions.map((session) => {
    const isActive = session.activity === "active" || session.status === "working";
    const isPoolAgent = isPoolProject;
    const assignment = registry.getByAgent(session.id);
    const sourceProjectId = session.metadata?.["sourceProjectId"] as string | undefined;
    const durationMs = computeSessionDurationMs(session);

    // Per-project time breakdown
    const projectTimeBreakdown: ProjectTimeBreakdown[] = [
      {
        projectId: session.projectId,
        durationMs,
        percent: 100,
        isLocal: !sourceProjectId,
      },
    ];
    if (sourceProjectId) {
      projectTimeBreakdown.push({
        projectId: sourceProjectId,
        durationMs: 0,
        percent: 0,
        isLocal: false,
      });
    }

    return {
      agentId: session.id,
      projectId: session.projectId,
      isActive,
      utilizationPercent: isActive ? 100 : 0,
      sessionDurationMs: durationMs,
      storiesWorked: assignment !== null ? 1 : 0,
      crossProjectAssignments: sourceProjectId ? 1 : 0,
      isPoolAgent,
      projectTimeBreakdown,
    };
  });

  const poolAgentsTotal = isPoolProject ? totalAgents : 0;
  const poolAgentsActive = isPoolProject ? activeAgents : 0;

  // Aggregate active/idle time from agent details
  const totalActiveTimeMs = agentDetails
    .filter((a) => a.isActive)
    .reduce((sum, a) => sum + a.sessionDurationMs, 0);
  const totalIdleTimeMs = agentDetails
    .filter((a) => !a.isActive)
    .reduce((sum, a) => sum + a.sessionDurationMs, 0);

  return {
    projectId,
    totalAgents,
    activeAgents,
    utilizationPercent: totalAgents > 0 ? Math.round((activeAgents / totalAgents) * 100) : 0,
    agentDetails,
    poolAgentsTotal,
    poolAgentsActive,
    totalActiveTimeMs,
    totalIdleTimeMs,
  };
}

// =============================================================================
// POOL UTILIZATION OVERVIEW
// =============================================================================

/**
 * Compute cross-project pool utilization overview.
 *
 * Aggregates utilization metrics across all pool-enabled projects.
 * Returns undefined when no pool projects are configured.
 */
export function computePoolUtilizationOverview(
  config: OrchestratorConfig,
  sessions: Session[],
  registry: AgentRegistry,
): PoolUtilizationOverview | undefined {
  const poolProjects = getPoolProjects(config);

  if (poolProjects.length === 0) return undefined;

  // Filter sessions to only those in pool-enabled projects
  const poolProjectSet = new Set(poolProjects);
  const poolSessions = sessions.filter((s) => poolProjectSet.has(s.projectId));

  const totalPoolAgents = poolSessions.length;
  const activePoolAgents = poolSessions.filter(
    (s) => s.activity === "active" || s.status === "working",
  ).length;

  // Count reserved agents across all pool projects
  let reservedAgentCount = 0;
  for (const projectId of poolProjects) {
    reservedAgentCount += getReservedAgents(projectId, config).length;
  }

  // Build per-project breakdown for pool-enabled projects
  const projectBreakdown = poolProjects.map((projectId) =>
    computeProjectUtilization(projectId, sessions, registry, config),
  );

  return {
    totalPoolAgents,
    activePoolAgents,
    utilizationPercent:
      totalPoolAgents > 0 ? Math.round((activePoolAgents / totalPoolAgents) * 100) : 0,
    reservedAgentCount,
    poolProjectCount: poolProjects.length,
    projectBreakdown,
  };
}
