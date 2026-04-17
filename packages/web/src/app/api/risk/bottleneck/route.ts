import { NextResponse } from "next/server";
import { getServices } from "@/lib/services";
import {
  computeSprintHealth as computeTrackerHealth,
  computeCycleTime,
  computeThroughput,
  computeTeamWorkload,
  computeStoryAging,
  type SprintHealthResult,
  type CycleTimeStats,
  type ThroughputResult,
  type TeamWorkloadResult,
  type StoryAgingResult,
} from "@composio/ao-plugin-tracker-bmad";
import { getCapacityStatus, runConflictDetection } from "@composio/ao-core";
import {
  aggregateBottlenecks,
  type BottleneckDashboardResponse,
  type CapacityRaw,
  type ConflictRaw,
} from "@/lib/bottleneck-aggregation";

export const dynamic = "force-dynamic";

const EMPTY_HEALTH: SprintHealthResult = {
  overall: "ok",
  indicators: [],
  stuckStories: [],
  wipColumns: [],
};

const EMPTY_CYCLE: CycleTimeStats = {
  stories: [],
  averageCycleTimeMs: 0,
  medianCycleTimeMs: 0,
  averageColumnDwells: [],
  bottleneckColumn: null,
  throughputPerDay: 0,
  throughputPerWeek: 0,
  completedCount: 0,
};

const EMPTY_THROUGHPUT: ThroughputResult = {
  dailyThroughput: [],
  weeklyThroughput: [],
  leadTimes: [],
  averageLeadTimeMs: 0,
  medianLeadTimeMs: 0,
  averageCycleTimeMs: 0,
  medianCycleTimeMs: 0,
  flowEfficiency: 0,
  columnTrends: [],
  bottleneckTrend: null,
};

const EMPTY_WORKLOAD: TeamWorkloadResult = {
  members: [],
  overloaded: [],
  unassigned: [],
  overloadThreshold: 0,
};

const EMPTY_AGING: StoryAgingResult = {
  columns: {},
  agingStories: [],
  totalActive: 0,
};

export async function GET(request: Request) {
  try {
    const { config, sessionManager } = await getServices();

    const url = new URL(request.url);
    const projectParam = url.searchParams.get("project") || undefined;

    const projects = config.projects || {};
    const projectIds = projectParam ? [projectParam] : Object.keys(projects);

    if (projectParam && !projects[projectParam]) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const allSessions = await sessionManager.list();

    // Resource conflicts (cross-project) — run ONCE outside the loop
    let sharedConflicts: ConflictRaw[] = [];
    try {
      const conflictResult = runConflictDetection(config);
      sharedConflicts = (conflictResult.conflicts ?? []).map((c) => ({
        id: c.id,
        resourceType: c.resourceType,
        resourceIdentifier: c.resourceIdentifier,
        competingProjects: c.competingProjects,
        severity: c.severity,
      }));
    } catch {
      // Conflict detection may fail gracefully
    }

    const allFactors: BottleneckDashboardResponse[] = [];

    for (const projectId of projectIds) {
      const project = projects[projectId];
      if (!project) continue;

      const isBmad = project.tracker?.plugin === "bmad";

      // 1. Sprint health indicators
      const sprintHealth = isBmad ? computeTrackerHealth(project) : EMPTY_HEALTH;

      // 2. Cycle time
      const cycleTime = isBmad ? computeCycleTime(project) : EMPTY_CYCLE;

      // 3. Throughput
      const throughput = isBmad ? computeThroughput(project) : EMPTY_THROUGHPUT;

      // 4. Team workload
      const workload = isBmad ? computeTeamWorkload(project) : EMPTY_WORKLOAD;

      // 5. Story aging
      const aging = isBmad ? computeStoryAging(project) : EMPTY_AGING;

      // 6. Capacity from session data — count stories per agent (sessionId)
      const projectSessions = allSessions.filter((s) => s.projectId === projectId);
      const workloadMap = new Map<string, number>();
      const agentProjectMap = new Map<string, string>();
      for (const session of projectSessions) {
        // Group by agent identifier — each session IS an agent instance
        // Count sessions (proxy for concurrent work) per agent
        const key = session.id;
        const current = workloadMap.get(key) ?? 0;
        workloadMap.set(key, current + 1);
        agentProjectMap.set(key, projectId);
      }
      const capacityStatus = getCapacityStatus(workloadMap, config, agentProjectMap);
      const capacityResults: CapacityRaw[] = [...capacityStatus.values()].map((c) => ({
        agentId: c.agentId,
        utilizationPercent: c.utilizationPercent,
        isAtCapacity: c.isAtCapacity,
        isNearCapacity: c.isNearCapacity,
        availableSlots: c.availableSlots,
      }));

      // 7. Filter conflicts relevant to this project
      const conflicts = sharedConflicts.filter((c) => c.competingProjects.includes(projectId));

      // 8. Aggregate into bottleneck items
      const result = aggregateBottlenecks({
        projectId,
        projectName: project.name || projectId,
        sprintHealth: {
          indicators: sprintHealth.indicators.map((i) => ({
            id: i.id,
            severity: i.severity,
            message: i.message,
            details: i.details,
          })),
          stuckStories: sprintHealth.stuckStories,
          wipColumns: sprintHealth.wipColumns,
        },
        cycleTime: {
          bottleneckColumn: cycleTime.bottleneckColumn,
          averageColumnDwells: cycleTime.averageColumnDwells,
          completedCount: cycleTime.completedCount,
        },
        throughput: {
          bottleneckTrend: throughput.bottleneckTrend,
          columnTrends: throughput.columnTrends,
        },
        teamWorkload: {
          overloaded: workload.overloaded,
          unassigned: workload.unassigned,
          members: workload.members,
          overloadThreshold: workload.overloadThreshold,
        },
        storyAging: {
          agingStories: aging.agingStories,
        },
        capacityResults,
        conflicts,
      });

      allFactors.push(result);
    }

    // Merge multi-project results
    if (allFactors.length === 0) {
      return NextResponse.json({
        bottlenecks: [],
        summary: {
          stuckStories: 0,
          wipViolations: 0,
          agingStories: 0,
          overloadedAgents: 0,
          resourceConflicts: 0,
          totalBottlenecks: 0,
        },
        lastUpdated: new Date().toISOString(),
      } satisfies BottleneckDashboardResponse);
    }

    if (allFactors.length === 1) {
      return NextResponse.json(allFactors[0]);
    }

    // Merge multiple projects
    const merged = allFactors.flatMap((r) => r.bottlenecks);
    merged.sort((a, b) => b.impact.impactScore - a.impact.impactScore);

    const summary = {
      stuckStories: 0,
      wipViolations: 0,
      agingStories: 0,
      overloadedAgents: 0,
      resourceConflicts: 0,
      totalBottlenecks: merged.length,
    };
    for (const f of merged) {
      switch (f.type) {
        case "stuck-stories":
          summary.stuckStories++;
          break;
        case "wip-violation":
          summary.wipViolations++;
          break;
        case "aging-stories":
          summary.agingStories++;
          break;
        case "agent-overload":
        case "capacity-bottleneck":
          summary.overloadedAgents++;
          break;
        case "resource-conflict":
          summary.resourceConflicts++;
          break;
      }
    }
    summary.totalBottlenecks = merged.length;

    return NextResponse.json({
      bottlenecks: merged,
      summary,
      lastUpdated: new Date().toISOString(),
    } satisfies BottleneckDashboardResponse);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 },
    );
  }
}
