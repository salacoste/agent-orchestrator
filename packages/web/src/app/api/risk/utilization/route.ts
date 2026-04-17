import { NextResponse } from "next/server";
import { getServices } from "@/lib/services";
import {
  computeAgentUtilization,
  getCapacityStatus,
  type OrchestratorConfig,
} from "@composio/ao-core";
import {
  collectSnapshot,
  buildTimeSeries,
  buildProjectSummary,
  buildPortfolioOverview,
  type SnapshotInput,
} from "@/lib/utilization-snapshot";
import { getProjectHistory, getAllHistory } from "@/lib/utilization-history";
import {
  type ProjectUtilizationSummary,
  type UtilizationTimeSeries,
  WINDOW_1H,
  WINDOW_24H,
  WINDOW_7D,
} from "@/lib/utilization-metrics-types";

export const dynamic = "force-dynamic";

function resolveWindowMs(windowParam: string | null): number {
  if (windowParam === "1h") return WINDOW_1H;
  if (windowParam === "7d") return WINDOW_7D;
  return WINDOW_24H; // default 24h
}

/**
 * Build capacity results for a project from sessions.
 * Extracted to avoid duplication between single-project and portfolio modes.
 */
function buildCapacityForProject(
  projectSessions: Array<{ id: string; projectId: string }>,
  config: Parameters<typeof getCapacityStatus>[1],
  projectId: string,
): Array<{
  agentId: string;
  utilizationPercent: number;
  isAtCapacity: boolean;
  isNearCapacity: boolean;
}> {
  const workloadMap = new Map<string, number>();
  const agentProjectMap = new Map<string, string>();
  for (const session of projectSessions) {
    const current = workloadMap.get(session.id) ?? 0;
    workloadMap.set(session.id, current + 1);
    agentProjectMap.set(session.id, projectId);
  }
  const capacityStatus = getCapacityStatus(workloadMap, config, agentProjectMap);
  return [...capacityStatus.values()].map((c) => ({
    agentId: c.agentId,
    utilizationPercent: c.utilizationPercent,
    isAtCapacity: c.isAtCapacity,
    isNearCapacity: c.isNearCapacity,
  }));
}

/**
 * Build a SnapshotInput for a project from agent utilizations and capacity data.
 */
function buildSnapshotInput(
  agentUtils: Array<{
    agentId: string;
    utilizationPercent: number;
    isActive: boolean;
    storiesWorked: number;
    isPoolAgent: boolean;
    projectId: string;
  }>,
  capacityArr: ReturnType<typeof buildCapacityForProject>,
  projectId: string,
): SnapshotInput {
  return {
    agentUtilizations: agentUtils
      .filter((u) => u.projectId === projectId)
      .map((u) => ({
        agentId: u.agentId,
        utilizationPercent: u.utilizationPercent,
        isActive: u.isActive,
        storiesWorked: u.storiesWorked,
        isPoolAgent: u.isPoolAgent,
        projectId: u.projectId,
      })),
    capacityResults: capacityArr,
    projectId,
  };
}

export async function GET(request: Request): Promise<Response> {
  const { searchParams } = new URL(request.url);
  const projectParam = searchParams.get("project");
  const windowParam = searchParams.get("window");
  const sinceMs = resolveWindowMs(windowParam);

  let config: OrchestratorConfig;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let sessions: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let registry: any;

  try {
    const services = await getServices();
    config = services.config;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    registry = services.registry as any;
    sessions = await services.sessionManager.list();
  } catch {
    return NextResponse.json({ error: "Failed to load services" }, { status: 500 });
  }

  // Compute fresh agent utilization data (read-only — recording happens in SSE poll)
  const allSessions = sessions as Parameters<typeof computeAgentUtilization>[0];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const agentUtils = computeAgentUtilization(allSessions, registry as any, config);
  const now = Date.now();

  if (projectParam) {
    // Single-project mode
    const projectSessions = allSessions.filter((s) => s.projectId === projectParam);
    const capacityArr = buildCapacityForProject(projectSessions, config, projectParam);
    const input = buildSnapshotInput(agentUtils, capacityArr, projectParam);
    const freshSnapshots = collectSnapshot(input);
    const history = getProjectHistory(projectParam, now - sinceMs);
    const allSnapshots = [...history, ...freshSnapshots];
    const summary = buildProjectSummary(projectParam, allSnapshots);

    // Build time-series for each agent in the project (C2)
    const timeSeries: UtilizationTimeSeries[] = [];
    const agentIds = new Set(allSnapshots.map((s) => s.agentId));
    for (const agentId of agentIds) {
      timeSeries.push(buildTimeSeries(agentId, allSnapshots, now));
    }

    return NextResponse.json({ projectSummary: summary, timeSeries, timestamp: now });
  }

  // Portfolio mode — aggregate across all projects
  const projectIds = Object.keys(config.projects ?? {});
  const portfolioSnapshots: ReturnType<typeof collectSnapshot> = [];

  for (const pid of projectIds) {
    const projectSessions = allSessions.filter((s) => s.projectId === pid);
    const capacityArr = buildCapacityForProject(projectSessions, config, pid);
    const input = buildSnapshotInput(agentUtils, capacityArr, pid);
    const freshSnapshots = collectSnapshot(input);
    portfolioSnapshots.push(...freshSnapshots);
  }

  const history = getAllHistory(now - sinceMs);
  const combined = [...history, ...portfolioSnapshots];

  const projectSummaries: ProjectUtilizationSummary[] = projectIds.map((pid) =>
    buildProjectSummary(pid, combined),
  );

  const overview = buildPortfolioOverview(projectSummaries);

  // Build time-series for each agent across the portfolio (C2)
  const timeSeries: UtilizationTimeSeries[] = [];
  const agentIds = new Set(combined.map((s) => s.agentId));
  for (const agentId of agentIds) {
    timeSeries.push(buildTimeSeries(agentId, combined, now));
  }

  return NextResponse.json({ ...overview, timeSeries });
}
