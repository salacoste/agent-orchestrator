import { NextResponse } from "next/server";
import { getServices } from "@/lib/services";
import {
  computeSprintHealth as computeTrackerHealth,
  type SprintHealthResult,
} from "@composio/ao-plugin-tracker-bmad";
import { computeAgentUtilization, getCapacityStatus } from "@composio/ao-core";
import { aggregateRiskFactors, type RiskDashboardResponse } from "@/lib/risk-aggregation";

export const dynamic = "force-dynamic";

const EMPTY_HEALTH: SprintHealthResult = {
  overall: "ok",
  indicators: [],
  stuckStories: [],
  wipColumns: [],
};

export async function GET(request: Request) {
  try {
    const { config, registry, sessionManager } = await getServices();

    // Determine project filter
    const url = new URL(request.url);
    const projectParam = url.searchParams.get("project") || undefined;

    // Resolve target projects
    const projects = config.projects || {};
    const projectIds = projectParam ? [projectParam] : Object.keys(projects);

    if (projectParam && !projects[projectParam]) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    // Collect sessions once
    const allSessions = await sessionManager.list();

    // Aggregate risk factors across all target projects
    const allFactors: RiskDashboardResponse[] = [];

    for (const projectId of projectIds) {
      const project = projects[projectId];
      if (!project) continue;

      // 1. Sprint health indicators from tracker-bmad
      const sprintHealth =
        project.tracker?.plugin === "bmad" ? computeTrackerHealth(project) : EMPTY_HEALTH;

      // 2. Build capacity data from sessions
      const projectSessions = allSessions.filter((s) => s.projectId === projectId);
      const workloadMap = new Map<string, number>();
      const agentProjectMap = new Map<string, string>();
      for (const session of projectSessions) {
        const current = workloadMap.get(session.id) ?? 0;
        workloadMap.set(session.id, current + 1);
        agentProjectMap.set(session.id, projectId);
      }

      const capacityStatus = getCapacityStatus(workloadMap, config, agentProjectMap);
      const capacityResults = [...capacityStatus.values()].map((c) => ({
        agentId: c.agentId,
        utilizationPercent: c.utilizationPercent,
        isAtCapacity: c.isAtCapacity,
        isNearCapacity: c.isNearCapacity,
        availableSlots: c.availableSlots,
      }));

      // 3. Agent utilization
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const agentUtils = computeAgentUtilization(allSessions, registry as any, config);
      const projectAgentUtils = agentUtils
        .filter((u) => u.projectId === projectId)
        .map((u) => ({
          agentId: u.agentId,
          utilizationPercent: u.utilizationPercent,
          isActive: u.isActive,
        }));

      // 4. Sprint health score heuristic from indicators
      const criticalCount = sprintHealth.indicators.filter((i) => i.severity === "critical").length;
      const warningCount = sprintHealth.indicators.filter((i) => i.severity === "warning").length;
      const blockedCount = sprintHealth.stuckStories.length;
      let sprintHealthScore = 100;
      sprintHealthScore -= criticalCount * 15;
      sprintHealthScore -= warningCount * 5;
      sprintHealthScore -= blockedCount * 10;
      sprintHealthScore = Math.max(0, Math.min(100, sprintHealthScore));

      // 5. Aggregate into risk factors
      const result = aggregateRiskFactors({
        projectId,
        projectName: project.name || projectId,
        indicators: sprintHealth.indicators.map((i) => ({
          id: i.id,
          severity: i.severity,
          message: i.message,
          details: i.details,
        })),
        stuckStories: sprintHealth.stuckStories,
        wipColumns: sprintHealth.wipColumns,
        capacityResults,
        agentUtilizations: projectAgentUtils,
        sprintHealthScore,
      });

      allFactors.push(result);
    }

    // Merge multi-project results into single response
    if (allFactors.length === 0) {
      return NextResponse.json({
        riskFactors: [],
        summary: { critical: 0, high: 0, medium: 0, low: 0, total: 0 },
        lastUpdated: new Date().toISOString(),
      } satisfies RiskDashboardResponse);
    }

    if (allFactors.length === 1) {
      return NextResponse.json(allFactors[0]);
    }

    // Merge multiple project responses
    const mergedFactors = allFactors.flatMap((r) => r.riskFactors);
    mergedFactors.sort((a, b) => b.severity - a.severity);

    const summary = { critical: 0, high: 0, medium: 0, low: 0, total: mergedFactors.length };
    for (const f of mergedFactors) {
      summary[f.severityLabel]++;
    }

    return NextResponse.json({
      riskFactors: mergedFactors,
      summary,
      lastUpdated: new Date().toISOString(),
    } satisfies RiskDashboardResponse);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 },
    );
  }
}
