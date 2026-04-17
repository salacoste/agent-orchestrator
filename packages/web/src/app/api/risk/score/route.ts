import { NextResponse } from "next/server";
import { getServices } from "@/lib/services";
import {
  computeSprintHealth as computeTrackerHealth,
  computeCycleTime as computeTrackerCycleTime,
  computeThroughput as computeTrackerThroughput,
  computeTeamWorkload as computeTrackerTeamWorkload,
  computeStoryAging as computeTrackerStoryAging,
  type SprintHealthResult,
} from "@composio/ao-plugin-tracker-bmad";
import { computeAgentUtilization, getCapacityStatus } from "@composio/ao-core";
import { aggregateRiskFactors } from "@/lib/risk-aggregation";
import { aggregateBottlenecks } from "@/lib/bottleneck-aggregation";
import {
  calculateRiskScore,
  calculatePortfolioScore,
  type RiskScoreResult,
} from "@/lib/risk-score";
import { detectEmergingRisks, type EmergingRisk } from "@/lib/emerging-risk-detection";
import { updateScoreCache } from "@/lib/risk-alert-broadcaster";

export const dynamic = "force-dynamic";

const EMPTY_HEALTH: SprintHealthResult = {
  overall: "ok",
  indicators: [],
  stuckStories: [],
  wipColumns: [],
};

const EMPTY_CYCLE_TIME = {
  bottleneckColumn: null as string | null,
  averageColumnDwells: [] as Array<{ column: string; dwellMs: number }>,
  completedCount: 0,
};

const EMPTY_THROUGHPUT = {
  bottleneckTrend: null as string | null,
  columnTrends: [] as Array<{
    column: string;
    weeklyAvgMs: number[];
    trend: string;
    slope: number;
  }>,
  weeklyThroughput: [] as Array<{ weekStart: string; count: number; points?: number }>,
  dailyThroughput: [] as Array<{ date: string; count: number; points?: number }>,
};

const EMPTY_TEAM_WORKLOAD = {
  overloaded: [] as string[],
  unassigned: [] as Array<{ storyId: string; column: string; points?: number }>,
  members: [] as Array<{
    sessionId: string;
    storiesByColumn: Record<string, string[]>;
    totalInFlight: number;
    isOverloaded: boolean;
  }>,
  overloadThreshold: 0,
};

const EMPTY_STORY_AGING = {
  agingStories: [] as Array<{ storyId: string; column: string; ageMs: number; isAging: boolean }>,
};

function computeSprintHealthScore(health: SprintHealthResult): number {
  const criticalCount = health.indicators.filter((i) => i.severity === "critical").length;
  const warningCount = health.indicators.filter((i) => i.severity === "warning").length;
  const blockedCount = health.stuckStories.length;
  let score = 100;
  score -= criticalCount * 15;
  score -= warningCount * 5;
  score -= blockedCount * 10;
  return Math.max(0, Math.min(100, score));
}

function buildCapacityResults(
  allSessions: Array<{ id: string; projectId: string }>,
  projectId: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  config: any,
) {
  const projectSessions = allSessions.filter((s) => s.projectId === projectId);
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
    availableSlots: c.availableSlots,
  }));
}

interface ProjectScoreResult {
  score: RiskScoreResult;
  emergingRisks: EmergingRisk[];
}

function computeProjectScore(
  projectId: string,
  project: { name?: string; tracker?: { plugin?: string } },
  sprintHealth: SprintHealthResult,
  sprintHealthScore: number,
  capacityResults: ReturnType<typeof buildCapacityResults>,
  agentUtilizations: Array<{ agentId: string; utilizationPercent: number; isActive: boolean }>,
  cycleTime: typeof EMPTY_CYCLE_TIME,
  throughput: typeof EMPTY_THROUGHPUT,
  teamWorkload: typeof EMPTY_TEAM_WORKLOAD,
  storyAging: typeof EMPTY_STORY_AGING,
): ProjectScoreResult {
  const indicatorsMapped = sprintHealth.indicators.map((i) => ({
    id: i.id,
    severity: i.severity,
    message: i.message,
    details: i.details,
  }));

  const riskResult = aggregateRiskFactors({
    projectId,
    projectName: project.name || projectId,
    indicators: indicatorsMapped,
    stuckStories: sprintHealth.stuckStories,
    wipColumns: sprintHealth.wipColumns,
    capacityResults,
    agentUtilizations,
    // sprintHealthScore intentionally omitted here — handled by calculateRiskScore
    // to avoid double-counting (aggregateRiskFactors would also create a factor)
    throughputData: {
      columnTrends: throughput.columnTrends,
      bottleneckTrend: throughput.bottleneckTrend,
    },
  });

  const bottleneckResult = aggregateBottlenecks({
    projectId,
    projectName: project.name || projectId,
    sprintHealth: {
      indicators: indicatorsMapped,
      stuckStories: sprintHealth.stuckStories,
      wipColumns: sprintHealth.wipColumns,
    },
    cycleTime,
    throughput,
    teamWorkload,
    storyAging,
    capacityResults,
    conflicts: [],
  });

  const score = calculateRiskScore({
    projectId,
    riskFactors: riskResult.riskFactors,
    bottlenecks: bottleneckResult.bottlenecks,
    sprintHealthScore,
  });

  const emergingRisks = detectEmergingRisks({
    projectId,
    throughput: {
      dailyThroughput: throughput.dailyThroughput ?? [],
      weeklyThroughput: throughput.weeklyThroughput ?? [],
      columnTrends: throughput.columnTrends,
      bottleneckTrend: throughput.bottleneckTrend,
      leadTimes: [],
      averageLeadTimeMs: 0,
      medianLeadTimeMs: 0,
      averageCycleTimeMs: 0,
      medianCycleTimeMs: 0,
      flowEfficiency: 0,
    },
    sprintHealth: {
      overall: sprintHealth.overall,
      indicators: indicatorsMapped,
      stuckStories: sprintHealth.stuckStories,
      wipColumns: sprintHealth.wipColumns,
    },
    agentUtilizations,
    riskFactors: riskResult.riskFactors,
  });

  return { score, emergingRisks };
}

export async function GET(request: Request) {
  try {
    const { config, registry, sessionManager } = await getServices();

    const url = new URL(request.url);
    const projectParam = url.searchParams.get("project") || undefined;
    const includeBreakdown = url.searchParams.get("breakdown") === "true";

    const projects = config.projects || {};
    const projectIds = projectParam ? [projectParam] : Object.keys(projects);

    if (projectParam && !projects[projectParam]) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const allSessions = await sessionManager.list();

    // Compute agent utilization once for all projects (H3 fix)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const agentUtils = computeAgentUtilization(allSessions, registry as any, config);

    // Single project mode
    if (projectParam) {
      const project = projects[projectParam];
      if (!project) {
        return NextResponse.json({ error: "Project not found" }, { status: 404 });
      }

      const isBmad = project.tracker?.plugin === "bmad";
      const sprintHealth = isBmad ? computeTrackerHealth(project) : EMPTY_HEALTH;
      const sprintHealthScore = computeSprintHealthScore(sprintHealth);
      const capacityResults = buildCapacityResults(allSessions, projectParam, config);
      const agentUtilizations = agentUtils
        .filter((u) => u.projectId === projectParam)
        .map((u) => ({
          agentId: u.agentId,
          utilizationPercent: u.utilizationPercent,
          isActive: u.isActive,
        }));

      const cycleTime = isBmad ? computeTrackerCycleTime(project) : EMPTY_CYCLE_TIME;
      const throughput = isBmad ? computeTrackerThroughput(project) : EMPTY_THROUGHPUT;
      const teamWorkload = isBmad ? computeTrackerTeamWorkload(project) : EMPTY_TEAM_WORKLOAD;
      const storyAging = isBmad ? computeTrackerStoryAging(project) : EMPTY_STORY_AGING;

      const { score: scoreResult, emergingRisks } = computeProjectScore(
        projectParam,
        project,
        sprintHealth,
        sprintHealthScore,
        capacityResults,
        agentUtilizations,
        cycleTime,
        throughput,
        teamWorkload,
        storyAging,
      );

      const response: Record<string, unknown> = {
        projectId: projectParam,
        projectName: project.name || projectParam,
        score: scoreResult.score,
        severityLabel: scoreResult.severityLabel,
        factorCount: scoreResult.factorCount,
        bottleneckCount: scoreResult.bottleneckCount,
        emergingRisks,
        lastUpdated: scoreResult.lastUpdated,
      };
      if (includeBreakdown) {
        response.contributors = scoreResult.contributors;
      }
      return NextResponse.json(response);
    }

    // Multi-project / portfolio mode
    const allScores: RiskScoreResult[] = [];
    const emergingRisksMap = new Map<string, EmergingRisk[]>();

    for (const projectId of projectIds) {
      const project = projects[projectId];
      if (!project) continue;

      const isBmad = project.tracker?.plugin === "bmad";
      const sprintHealth = isBmad ? computeTrackerHealth(project) : EMPTY_HEALTH;
      const sprintHealthScore = computeSprintHealthScore(sprintHealth);
      const capacityResults = buildCapacityResults(allSessions, projectId, config);
      const agentUtilizations = agentUtils
        .filter((u) => u.projectId === projectId)
        .map((u) => ({
          agentId: u.agentId,
          utilizationPercent: u.utilizationPercent,
          isActive: u.isActive,
        }));

      const cycleTime = isBmad ? computeTrackerCycleTime(project) : EMPTY_CYCLE_TIME;
      const throughput = isBmad ? computeTrackerThroughput(project) : EMPTY_THROUGHPUT;
      const teamWorkload = isBmad ? computeTrackerTeamWorkload(project) : EMPTY_TEAM_WORKLOAD;
      const storyAging = isBmad ? computeTrackerStoryAging(project) : EMPTY_STORY_AGING;

      const { score: scoreResult, emergingRisks } = computeProjectScore(
        projectId,
        project,
        sprintHealth,
        sprintHealthScore,
        capacityResults,
        agentUtilizations,
        cycleTime,
        throughput,
        teamWorkload,
        storyAging,
      );

      allScores.push(scoreResult);
      emergingRisksMap.set(projectId, emergingRisks);
    }

    const portfolio = calculatePortfolioScore(allScores);

    // Cache score data for the alert broadcaster (Story 56.5)
    updateScoreCache(allScores, emergingRisksMap);

    const scoresWithRisks = portfolio.scores.map((s) => ({
      ...s,
      emergingRisks: emergingRisksMap.get(s.projectId) ?? [],
    }));
    return NextResponse.json({ ...portfolio, scores: scoresWithRisks });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 },
    );
  }
}
