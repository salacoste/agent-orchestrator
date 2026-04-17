import { NextResponse } from "next/server";
import { getServices } from "@/lib/services";
import {
  computeAgentUtilization,
  getCapacityStatus,
  type OrchestratorConfig,
} from "@composio/ao-core";
import {
  computeSprintHealth as computeTrackerHealth,
  computeCycleTime as computeTrackerCycleTime,
  computeThroughput as computeTrackerThroughput,
  computeTeamWorkload as computeTrackerTeamWorkload,
  computeStoryAging as computeTrackerStoryAging,
} from "@composio/ao-plugin-tracker-bmad";
import { aggregateRiskFactors } from "@/lib/risk-aggregation";
import { aggregateBottlenecks } from "@/lib/bottleneck-aggregation";
import { collectSnapshot, buildProjectSummary } from "@/lib/utilization-snapshot";
import { generateOptimizations } from "@/lib/optimization-engine";
import {
  recordOptimizationFeedback,
  getOptimizationFeedback,
  _resetOptimizationFeedback,
} from "@/lib/optimization-feedback";
import {
  runObjectiveScenario,
  runAllObjectives,
  compareObjectives,
} from "@/lib/optimization-scenario";
import {
  type OptimizationCategory,
  type OptimizationObjective,
  OBJECTIVE_RANK_WEIGHTS,
} from "@/lib/optimization-types";
import { analyzeSuggestionImpact, analyzeAllSuggestions } from "@/lib/optimization-impact";
import { computeLearningWeights } from "@/lib/optimization-learning";

export const dynamic = "force-dynamic";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildCapacityResults(
  allSessions: Array<{ id: string; projectId: string }>,
  projectId: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  config: any,
) {
  const workloadMap = new Map<string, number>();
  const agentProjectMap = new Map<string, string>();
  for (const session of allSessions) {
    if (session.projectId !== projectId) continue;
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
    maxCapacity: c.maxCapacity,
    currentWorkload: c.currentWorkload,
  }));
}

// ---------------------------------------------------------------------------
// GET /api/risk/optimization
// ---------------------------------------------------------------------------

export async function GET(request: Request): Promise<Response> {
  const { searchParams } = new URL(request.url);
  const projectParam = searchParams.get("project");
  const categoryParam = searchParams.get("category") as OptimizationCategory | null;
  const objectiveParam = searchParams.get("objective") as OptimizationObjective | null;
  const compareParam = searchParams.get("compare") === "true";
  const impactParam = searchParams.get("impact") === "true";
  const suggestionIdParam = searchParams.get("suggestionId");

  const validObjectives = Object.keys(OBJECTIVE_RANK_WEIGHTS) as OptimizationObjective[];
  if (objectiveParam && !validObjectives.includes(objectiveParam)) {
    return NextResponse.json(
      { error: `Invalid objective. Must be one of: ${validObjectives.join(", ")}` },
      { status: 400 },
    );
  }

  if (compareParam && objectiveParam) {
    return NextResponse.json(
      { error: "Cannot specify both 'compare' and 'objective' parameters" },
      { status: 400 },
    );
  }

  let config: OrchestratorConfig;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let registry: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let sessions: any;

  try {
    const services = await getServices();
    config = services.config;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    registry = services.registry as any;
    sessions = await services.sessionManager.list();
  } catch {
    return NextResponse.json({ error: "Failed to load services" }, { status: 500 });
  }

  const allSessions = sessions as Parameters<typeof computeAgentUtilization>[0];
  const agentUtils = computeAgentUtilization(allSessions, registry, config);
  const projectIds = projectParam ? [projectParam] : Object.keys(config.projects ?? {});

  // Build project summaries
  const projectSummaries = [];
  const allCapacityResults = [];
  for (const pid of projectIds) {
    const projectSessions = allSessions.filter((s) => s.projectId === pid);
    const capacityArr = buildCapacityResults(projectSessions, pid, config);
    allCapacityResults.push(...capacityArr);

    const snapshotInput = {
      agentUtilizations: agentUtils
        .filter((u) => u.projectId === pid)
        .map((u) => ({
          agentId: u.agentId,
          utilizationPercent: u.utilizationPercent,
          isActive: u.isActive,
          storiesWorked: u.storiesWorked,
          isPoolAgent: u.isPoolAgent,
          projectId: u.projectId,
        })),
      capacityResults: capacityArr,
      projectId: pid,
    };
    const snapshots = collectSnapshot(snapshotInput);
    projectSummaries.push(buildProjectSummary(pid, snapshots));
  }

  // Build risk factors and bottlenecks per project
  const allRiskFactors = [];
  const allBottlenecks = [];
  for (const pid of projectIds) {
    try {
      const projectSessions = allSessions.filter((s) => s.projectId === pid);
      const projectConfig = config.projects[pid];
      const health = await computeTrackerHealth(projectConfig);
      const cycleTime = await computeTrackerCycleTime(projectConfig);
      const throughput = await computeTrackerThroughput(projectConfig);
      const teamWorkload = await computeTrackerTeamWorkload(projectConfig);
      const storyAging = await computeTrackerStoryAging(projectConfig);
      const capacityArr = buildCapacityResults(projectSessions, pid, config);
      const projectAgentUtils = agentUtils.filter((u) => u.projectId === pid);

      const riskResp = aggregateRiskFactors({
        projectId: pid,
        projectName: pid,
        indicators: health.indicators,
        stuckStories: health.stuckStories,
        wipColumns: health.wipColumns,
        capacityResults: capacityArr.map((c) => ({
          agentId: c.agentId,
          utilizationPercent: c.utilizationPercent,
          isAtCapacity: c.isAtCapacity,
          isNearCapacity: c.isNearCapacity,
          availableSlots: c.availableSlots,
        })),
        agentUtilizations: projectAgentUtils.map((u) => ({
          agentId: u.agentId,
          utilizationPercent: u.utilizationPercent,
          isActive: u.isActive,
          storiesWorked: u.storiesWorked,
          isPoolAgent: u.isPoolAgent,
        })),
        throughputData: {
          bottleneckTrend: throughput.bottleneckTrend,
          columnTrends: throughput.columnTrends,
        },
      });
      allRiskFactors.push(...riskResp.riskFactors);

      const bnResp = aggregateBottlenecks({
        projectId: pid,
        projectName: pid,
        sprintHealth: {
          indicators: health.indicators,
          stuckStories: health.stuckStories,
          wipColumns: health.wipColumns,
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
          overloaded: teamWorkload.overloaded,
          unassigned: teamWorkload.unassigned,
          members: teamWorkload.members,
          overloadThreshold: teamWorkload.overloadThreshold,
        },
        storyAging: { agingStories: storyAging.agingStories },
        capacityResults: capacityArr.map((c) => ({
          agentId: c.agentId,
          utilizationPercent: c.utilizationPercent,
          isAtCapacity: c.isAtCapacity,
          isNearCapacity: c.isNearCapacity,
          availableSlots: c.availableSlots,
        })),
        conflicts: [],
      });
      allBottlenecks.push(...bnResp.bottlenecks);
    } catch {
      // Tracker may not be available — continue with empty data for this project
    }
  }

  const engineInput = {
    projectSummaries,
    riskFactors: allRiskFactors,
    bottlenecks: allBottlenecks,
    agentUtilizations: agentUtils.map((u) => ({
      agentId: u.agentId,
      projectId: u.projectId,
      utilizationPercent: u.utilizationPercent,
      isActive: u.isActive,
      isPoolAgent: u.isPoolAgent,
      storiesWorked: u.storiesWorked,
    })),
    capacityResults: allCapacityResults,
  };

  // Compare all objectives mode
  if (compareParam) {
    const feedback = getOptimizationFeedback();
    const learningWeights = computeLearningWeights(feedback);
    const { results, baselineSuggestions } = runAllObjectives(engineInput, learningWeights);
    const comparison = compareObjectives(results, baselineSuggestions);
    return NextResponse.json(comparison);
  }

  // Single objective mode
  if (objectiveParam) {
    const feedback = getOptimizationFeedback();
    const learningWeights = computeLearningWeights(feedback);
    const scenarioResult = runObjectiveScenario(engineInput, objectiveParam, learningWeights);
    // Apply category filter if specified
    if (categoryParam) {
      scenarioResult.suggestions = scenarioResult.suggestions.filter(
        (s) => s.category === categoryParam,
      );
    }
    return NextResponse.json(scenarioResult);
  }

  // Default mode — existing 56-7 behaviour with learning weights
  const feedback = getOptimizationFeedback();
  const learningWeights = computeLearningWeights(feedback);
  const result = generateOptimizations(engineInput, learningWeights);

  // Apply category filter if specified
  if (categoryParam) {
    result.suggestions = result.suggestions.filter((s) => s.category === categoryParam);
  }

  // Impact analysis mode — augment suggestions with before/after impact
  if (impactParam) {
    if (suggestionIdParam) {
      // Single suggestion impact
      const suggestion = result.suggestions.find((s) => s.id === suggestionIdParam);
      if (!suggestion) {
        return NextResponse.json(
          { error: `Suggestion not found: ${suggestionIdParam}` },
          { status: 404 },
        );
      }
      const impactAnalysis = analyzeSuggestionImpact(suggestion, engineInput);
      return NextResponse.json({ suggestion, impactAnalysis });
    }
    // All suggestions impact
    const impactDetails = analyzeAllSuggestions(result.suggestions, engineInput);
    return NextResponse.json({ ...result, suggestions: impactDetails });
  }

  return NextResponse.json(result);
}

// ---------------------------------------------------------------------------
// PATCH /api/risk/optimization — accept/dismiss
// ---------------------------------------------------------------------------

export async function PATCH(request: Request): Promise<Response> {
  let body: {
    suggestionId?: string;
    action?: "accepted" | "dismissed";
    reason?: string;
    category?: OptimizationCategory;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { suggestionId, action, reason, category } = body;

  if (!suggestionId || !action || !category) {
    return NextResponse.json(
      { error: "Missing required fields: suggestionId, action, category" },
      { status: 400 },
    );
  }

  if (action !== "accepted" && action !== "dismissed") {
    return NextResponse.json(
      { error: "Action must be 'accepted' or 'dismissed'" },
      { status: 400 },
    );
  }

  const validCategories: OptimizationCategory[] = [
    "agent-rebalancing",
    "wip-adjustment",
    "priority-reorder",
    "capacity-scaling",
    "underutilized-detection",
  ];
  if (!validCategories.includes(category)) {
    return NextResponse.json(
      { error: `Invalid category. Must be one of: ${validCategories.join(", ")}` },
      { status: 400 },
    );
  }

  recordOptimizationFeedback({
    suggestionId,
    category,
    action,
    timestamp: Date.now(),
    reason,
  });

  return NextResponse.json({
    success: true,
    suggestionId,
    action,
  });
}

// ---------------------------------------------------------------------------
// DELETE /api/risk/optimization — reset learning feedback (Story 56.11)
// ---------------------------------------------------------------------------

export async function DELETE(): Promise<Response> {
  _resetOptimizationFeedback();
  return NextResponse.json({ success: true, message: "Learning feedback cleared" });
}
