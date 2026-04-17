/**
 * Shared utility for enriching project sessions with PR data.
 * Extracted from project detail page to avoid code duplication.
 */

import type { DashboardSession } from "./types";
import type { Session, OrchestratorConfig, PluginRegistry } from "@composio/ao-core";
import { getSCM } from "./services";
import {
  sessionToDashboard,
  resolveProject,
  enrichSessionPR,
  enrichSessionsMetadata,
} from "./serialize";
import { prCache, prCacheKey } from "./cache";

/** Terminal session statuses that don't need PR refresh */
const TERMINAL_STATUSES = new Set(["merged", "killed", "cleanup", "done", "terminated"]);

export interface EnrichedProjectData {
  sessions: DashboardSession[];
  projectName: string;
  orchestratorId: string | null;
}

/**
 * Enrich project sessions with live SCM data and metadata.
 * Reusable across project detail page and future features.
 */
export async function enrichProjectSessions(
  projectSessions: Session[],
  config: OrchestratorConfig,
  registry: PluginRegistry,
  metaTimeout: number = 3_000,
  enrichTimeout: number = 4_000,
): Promise<DashboardSession[]> {
  const sessions: DashboardSession[] = projectSessions.map(sessionToDashboard);

  // Enrich metadata (issue labels, agent summaries, issue titles)
  const metaTimeoutPromise = new Promise<void>((resolve) => setTimeout(resolve, metaTimeout));
  await Promise.race([
    enrichSessionsMetadata(projectSessions, sessions, config, registry),
    metaTimeoutPromise,
  ]);

  // Enrich sessions that have PRs with live SCM data
  const enrichPromises = projectSessions.map((core, i) => {
    if (!core.pr) return Promise.resolve();

    const cacheKey = prCacheKey(core.pr.owner, core.pr.repo, core.pr.number);
    const cached = prCache.get(cacheKey);

    if (cached) {
      if (sessions[i].pr) {
        sessions[i].pr.state = cached.state;
        sessions[i].pr.title = cached.title;
        sessions[i].pr.additions = cached.additions;
        sessions[i].pr.deletions = cached.deletions;
        sessions[i].pr.ciStatus = cached.ciStatus as "none" | "pending" | "passing" | "failing";
        sessions[i].pr.reviewDecision = cached.reviewDecision as
          | "none"
          | "pending"
          | "approved"
          | "changes_requested";
        sessions[i].pr.ciChecks = cached.ciChecks.map((c) => ({
          name: c.name,
          status: c.status as "pending" | "running" | "passed" | "failed" | "skipped",
          url: c.url,
        }));
        sessions[i].pr.mergeability = cached.mergeability;
        sessions[i].pr.unresolvedThreads = cached.unresolvedThreads;
        sessions[i].pr.unresolvedComments = cached.unresolvedComments;
      }

      if (
        TERMINAL_STATUSES.has(core.status) ||
        cached.state === "merged" ||
        cached.state === "closed"
      ) {
        return Promise.resolve();
      }
    }

    const resolvedProject = resolveProject(core, config.projects);
    const scm = getSCM(registry, resolvedProject);
    if (!scm) return Promise.resolve();
    return enrichSessionPR(sessions[i], scm, core.pr);
  });

  const enrichTimeoutPromise = new Promise<void>((resolve) => setTimeout(resolve, enrichTimeout));
  await Promise.race([Promise.allSettled(enrichPromises), enrichTimeoutPromise]);

  return sessions;
}
