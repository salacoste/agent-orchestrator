/**
 * Cross-Project Story Assignment — bridges allocation algorithm to runtime execution (Epic 50, Story 50.4).
 *
 * Provides:
 * - Multi-project story gathering for pool allocation
 * - Agent workload and project-agent map building
 * - Cross-project assignment execution (session spawning)
 * - Assignable agents API (local + pool agents)
 */

import type { OrchestratorConfig, Session, SessionManager, AgentRegistry } from "./types.js";
import type { AllocationStory, AllocationDecision, AllocationRequest } from "./pool-allocation.js";
import { getPoolProjects, canReceiveAgents, getAvailablePoolAgents } from "./shared-pool.js";
import { guardAssignment, CapacityExceededError } from "./capacity-check.js";

// =============================================================================
// TYPES
// =============================================================================

/** Sprint data reader dependency (injected for testability). */
export interface SprintDataReader {
  readSprintData(projectId: string): {
    development_status: Record<string, string>;
    priorities?: Record<string, number>;
  } | null;
}

/** An agent available for assignment, possibly from another project. */
export interface AssignableAgent {
  /** Agent / session ID. */
  agentId: string;
  /** Project the agent session lives in. */
  projectId: string;
  /** Source project for pool agents (undefined for local). */
  sourceProjectId?: string;
  /** Whether this agent comes from the shared pool. */
  isPoolAgent: boolean;
  /** Current active assignment count. */
  currentWorkload: number;
}

// =============================================================================
// STORY KEY HELPERS
// =============================================================================

/** Story keys match pattern X-Y-name (e.g. "1-2-user-auth"). Epics ("epic-X") and retrospectives never match. */
const STORY_KEY_PATTERN = /^\d+-\d+-/;

function isStoryKey(key: string): boolean {
  return STORY_KEY_PATTERN.test(key);
}

// =============================================================================
// GATHER POOL STORIES
// =============================================================================

/**
 * Gather ready-for-dev stories from all pool-enabled projects.
 *
 * Reads sprint-status for each pool project via injected reader,
 * returns stories with projectId attached for allocation scoring.
 */
export function gatherPoolStories(
  config: OrchestratorConfig,
  reader: SprintDataReader,
): AllocationStory[] {
  const poolProjects = getPoolProjects(config);
  if (poolProjects.length === 0) return [];

  const stories: AllocationStory[] = [];

  for (const projectId of poolProjects) {
    const sprintData = reader.readSprintData(projectId);
    if (!sprintData) continue;

    let position = 0;
    for (const [key, status] of Object.entries(sprintData.development_status)) {
      if (!isStoryKey(key)) continue;

      const currentPosition = position++;

      if (status !== "ready-for-dev") continue;

      const priority = sprintData.priorities?.[key] ?? 0;

      stories.push({
        storyId: key,
        projectId,
        priority,
        position: currentPosition,
      });
    }
  }

  return stories;
}

// =============================================================================
// BUILD AGENT WORKLOAD MAP
// =============================================================================

/**
 * Build a map of agentId → active assignment count from pre-fetched sessions.
 */
export function buildAgentWorkloadMap(
  sessions: Session[],
  registry: AgentRegistry,
): Map<string, number> {
  const workload = new Map<string, number>();

  for (const session of sessions) {
    const assignments = registry.getByAgent(session.id);
    if (assignments) {
      const current = workload.get(session.id) ?? 0;
      workload.set(session.id, current + 1);
    }
  }

  return workload;
}

// =============================================================================
// BUILD PROJECT AGENTS MAP
// =============================================================================

/**
 * Build a map of projectId → agent IDs from pre-fetched sessions.
 * Only includes agents from pool-enabled projects.
 */
export function buildProjectAgentsMapFromSessions(
  sessions: Session[],
  config: OrchestratorConfig,
): Map<string, string[]> {
  const result = new Map<string, string[]>();
  const poolProjects = new Set(getPoolProjects(config));

  for (const session of sessions) {
    if (poolProjects.has(session.projectId)) {
      const agents = result.get(session.projectId) ?? [];
      agents.push(session.id);
      result.set(session.projectId, agents);
    }
  }

  return result;
}

// =============================================================================
// BUILD ALLOCATION REQUEST
// =============================================================================

/**
 * Orchestrate all data gathering into a complete AllocationRequest
 * ready for the allocation algorithm.
 */
export async function buildAllocationRequest(
  config: OrchestratorConfig,
  sessionManager: SessionManager,
  registry: AgentRegistry,
  reader: SprintDataReader,
): Promise<
  AllocationRequest & { agentWorkload: Map<string, number>; projectAgents: Map<string, string[]> }
> {
  const stories = gatherPoolStories(config, reader);
  const sessions = await sessionManager.list();
  const agentWorkload = buildAgentWorkloadMap(sessions, registry);
  const projectAgents = buildProjectAgentsMapFromSessions(sessions, config);

  return {
    config,
    stories,
    agentWorkload,
    projectAgents,
  };
}

// =============================================================================
// GET ASSIGNABLE AGENTS
// =============================================================================

/**
 * Get all agents assignable to a story in the given project.
 * Returns a union of project-local idle agents and eligible pool agents.
 */
export async function getAssignableAgents(
  projectId: string,
  config: OrchestratorConfig,
  sessionManager: SessionManager,
  registry: AgentRegistry,
): Promise<AssignableAgent[]> {
  const sessions = await sessionManager.list();
  const result: AssignableAgent[] = [];

  const projectConfig = config.projects[projectId];
  const poolEnabled = projectConfig?.sharedPool?.enabled === true;

  // Local idle agents
  for (const session of sessions) {
    if (session.projectId !== projectId) continue;
    if (session.activity !== "idle" && session.activity !== "ready") continue;

    const existing = registry.getByAgent(session.id);
    if (existing) continue; // Already assigned

    result.push({
      agentId: session.id,
      projectId,
      isPoolAgent: false,
      currentWorkload: 0,
    });
  }

  // Pool agents from other projects
  if (poolEnabled) {
    const poolProjects = getPoolProjects(config);

    for (const sourceProjectId of poolProjects) {
      if (sourceProjectId === projectId) continue;

      // Check if agents from source can be sent to target
      if (!canReceiveAgents(sourceProjectId, projectId, config)) continue;

      const sourceSessions = sessions.filter(
        (s) => s.projectId === sourceProjectId && (s.activity === "idle" || s.activity === "ready"),
      );

      const knownAgents = sourceSessions.map((s) => s.id);
      const availableAgents = getAvailablePoolAgents(
        sourceProjectId,
        projectId,
        knownAgents,
        config,
      );

      const availableSet = new Set(availableAgents);

      for (const session of sourceSessions) {
        if (!availableSet.has(session.id)) continue;

        const existing = registry.getByAgent(session.id);
        if (existing) continue;

        result.push({
          agentId: session.id,
          projectId: sourceProjectId,
          sourceProjectId,
          isPoolAgent: true,
          currentWorkload: 0,
        });
      }
    }
  }

  return result;
}

// =============================================================================
// EXECUTE CROSS-PROJECT ASSIGNMENT
// =============================================================================

/**
 * Execute a cross-project assignment decision.
 *
 * Spawns a session in the target project with source project metadata,
 * and registers the assignment in the AgentRegistry.
 *
 * When `config` and `agentWorkload` are provided, guards against over-allocation
 * by checking agent capacity before spawning. Throws `CapacityExceededError` if
 * the agent is at capacity unless `options.force` is set.
 */
export async function executeCrossProjectAssignment(
  decision: AllocationDecision,
  sessionManager: SessionManager,
  registry: AgentRegistry,
  storyContext?: string,
  options?: {
    /** Orchestrator config for capacity resolution. If omitted, capacity guard is skipped. */
    config?: OrchestratorConfig;
    /** Current workload per agent: agentId → active assignment count. Required with config. */
    agentWorkload?: Map<string, number>;
    /** Force assignment even if agent is at capacity. */
    force?: boolean;
    /** Callback invoked when a force-assignment overrides capacity. Use to emit events or audit-log. */
    onForceAssignment?: (info: { agentId: string; workload: number; maxCapacity: number }) => void;
  },
): Promise<Session> {
  // Capacity guard — skip if no config provided (backward compatible)
  const { config, agentWorkload, force, onForceAssignment } = options ?? {};
  if (config && agentWorkload) {
    const currentWorkload = agentWorkload.get(decision.agentId) ?? 0;
    const guard = guardAssignment(decision.agentId, currentWorkload, config, {
      force: force ?? false,
      projectId: decision.sourceProjectId,
    });
    if (!guard.allowed) {
      throw new CapacityExceededError(guard.capacity);
    }
    if (guard.forced) {
      // Notify caller via callback (for event emission, audit logging, etc.)
      try {
        onForceAssignment?.({
          agentId: decision.agentId,
          workload: guard.capacity.currentWorkload,
          maxCapacity: guard.capacity.maxCapacity,
        });
      } catch {
        // Fire-and-forget callback — never disrupt assignment flow
      }
    }
  }
  // Spawn session in target project with story context
  const session = await sessionManager.spawn({
    projectId: decision.targetProjectId,
    issueId: decision.storyId,
    storyContext,
    priority: Math.round(decision.score * 100),
  });

  // Write cross-project traceability into session metadata.
  // Guard against undefined metadata — spawn implementations should always provide it,
  // but if missing we log a warning rather than silently dropping traceability data.
  if (!session.metadata) {
    console.warn(
      `[cross-project] session.metadata is undefined for session ${session.id}; ` +
        `cross-project traceability (sourceProjectId) will not be recorded.`,
    );
  } else {
    session.metadata["sourceProjectId"] = decision.sourceProjectId;
    session.metadata["allocationScore"] = String(decision.score);
  }

  // Register assignment in the agent registry
  registry.register({
    agentId: decision.agentId,
    storyId: decision.storyId,
    assignedAt: new Date(),
    status: "active",
    contextHash: "",
    priority: Math.round(decision.score * 100),
  });

  return session;
}
