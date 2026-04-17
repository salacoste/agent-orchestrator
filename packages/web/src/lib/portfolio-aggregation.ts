/**
 * Portfolio metrics aggregation for multi-project dashboard.
 *
 * Collects metrics from configured projects:
 * - Active agents count from sessionManager
 * - Story counts by status from sprint-status.yaml
 */

import { readFile } from "node:fs/promises";
import { parse as parseYaml } from "yaml";
import type { OrchestratorConfig, SessionManager } from "@composio/ao-core";
import type { PortfolioProject } from "./types";

/** Story keys match pattern X-Y-name (e.g. "1-2-user-auth"). Epics and retrospectives never match. */
const STORY_KEY_PATTERN = /^\d+-\d+-/;

/**
 * Count stories by status for a project from sprint-status.yaml.
 *
 * @param sprintStatusPath - Path to sprint-status.yaml
 * @returns Story counts by status
 */
async function countStoriesByStatus(sprintStatusPath: string): Promise<{
  backlog: number;
  inProgress: number;
  done: number;
  blocked: number;
}> {
  const counts = {
    backlog: 0,
    inProgress: 0,
    done: 0,
    blocked: 0,
  };

  try {
    const content = await readFile(sprintStatusPath, "utf-8");
    const data = parseYaml(content) as {
      development_status?: Record<string, string>;
    };

    if (!data.development_status) {
      return counts;
    }

    // Count stories by status
    // Story keys follow pattern: X-Y-story-name, epic-X is excluded
    for (const [key, value] of Object.entries(data.development_status)) {
      // Skip non-story keys (epics, retrospectives, etc.)
      if (!STORY_KEY_PATTERN.test(key)) {
        continue;
      }

      if (value === "backlog") {
        counts.backlog++;
      } else if (value === "in-progress") {
        counts.inProgress++;
      } else if (value === "done") {
        counts.done++;
      } else if (value === "review" || value === "blocked") {
        counts.blocked++;
      }
    }
  } catch {
    // File doesn't exist or is invalid — return zeros
  }

  return counts;
}

/**
 * Aggregate metrics for all configured projects.
 *
 * @param config - Orchestrator config with projects
 * @param sessionManager - Session manager for agent counts
 * @param sprintStatusPath - Optional path to sprint-status.yaml
 * @returns Array of PortfolioProject with aggregated metrics
 */
export async function aggregatePortfolioProjects(
  config: OrchestratorConfig,
  sessionManager: SessionManager,
  sprintStatusPath?: string,
): Promise<PortfolioProject[]> {
  const projects = config.projects || {};
  const projectIds = Object.keys(projects);

  if (projectIds.length === 0) {
    return [];
  }

  // Get all sessions to count active agents per project
  const allSessions = await sessionManager.list();

  // Count stories once for the entire sprint (all projects share same sprint-status)
  const storyCounts = sprintStatusPath
    ? await countStoriesByStatus(sprintStatusPath)
    : { backlog: 0, inProgress: 0, done: 0, blocked: 0 };

  const portfolioProjects: PortfolioProject[] = projectIds.map((id) => {
    const projectConfig = projects[id];
    const projectSessions = allSessions.filter((s) => s.projectId === id);
    const activeAgents = projectSessions.filter(
      (s) => s.activity === "active" || s.status === "working",
    ).length;
    const totalAgents = projectSessions.length;

    // Determine project status based on sessions
    let status: PortfolioProject["status"] = "idle";
    if (activeAgents > 0) {
      status = "active";
    } else if (projectSessions.some((s) => s.status === "errored")) {
      status = "error";
    }

    // Find last activity
    const lastActivity = projectSessions.reduce<string | undefined>((latest, s) => {
      const activityTime = s.lastActivityAt?.toISOString();
      if (!activityTime) return latest;
      if (!latest) return activityTime;
      return activityTime > latest ? activityTime : latest;
    }, undefined);

    // Compute pool agents available from other projects
    const poolAgentsAvailable: Array<{
      agentId: string;
      sourceProjectId: string;
      sourceProjectName: string;
    }> = [];
    if (projectConfig.sharedPool?.enabled) {
      const eligibleProjects = projectConfig.sharedPool.eligibleProjects;
      const reservedAgents = new Set(projectConfig.sharedPool.reservedAgents ?? []);
      for (const sourceId of eligibleProjects) {
        if (sourceId === id) continue;
        const sourceConfig = projects[sourceId];
        if (!sourceConfig?.sharedPool?.enabled) continue;
        const sourceSessions = allSessions.filter(
          (s) =>
            s.projectId === sourceId &&
            (s.activity === "idle" || s.activity === "ready") &&
            !reservedAgents.has(s.id),
        );
        for (const session of sourceSessions) {
          poolAgentsAvailable.push({
            agentId: session.id,
            sourceProjectId: sourceId,
            sourceProjectName: sourceConfig.name || sourceId,
          });
        }
      }
    }

    return {
      id,
      name: projectConfig.name || id,
      status,
      activeAgents,
      totalAgents,
      stories: { ...storyCounts },
      lastActivity,
      tags: projectConfig.tags || [],
      metadata: projectConfig.metadata || {},
      sharedPool: projectConfig.sharedPool?.enabled
        ? {
            enabled: true,
            eligibleProjects: projectConfig.sharedPool.eligibleProjects,
            maxConcurrent: projectConfig.sharedPool.maxConcurrent,
            reservedAgents: projectConfig.sharedPool.reservedAgents,
          }
        : undefined,
      poolAgentsAvailable: poolAgentsAvailable.length > 0 ? poolAgentsAvailable : undefined,
    };
  });

  return portfolioProjects;
}
