/**
 * Optimization recommendation engine for Story 56.7.
 *
 * Pure computation module that takes utilization summaries, risk factors,
 * bottlenecks, and capacity data, then generates OptimizationSuggestion[]
 * sorted by estimated impact.
 *
 * Five analyzers:
 * - Agent rebalancing: overutilized/underutilized pair detection
 * - WIP adjustment: bottleneck-driven WIP limit changes
 * - Priority reorder: stuck/aging story priority changes
 * - Capacity scaling: near/at-capacity agent adjustments
 * - Underutilized detection: standalone low-utilization agent identification
 *
 * NFR-E4-1: Optimization analysis completes within 15 seconds.
 * NFR-R2: Results are deterministic for identical inputs.
 */

import {
  OPT_OVERUTILIZED,
  OPT_UNDERUTILIZED,
  OPT_NEAR_CAPACITY,
  OPT_BOTTLENECK_SEVERITY_THRESHOLD,
  RANK_WEIGHT_DAYS_SAVED,
  RANK_WEIGHT_RISK_REDUCTION,
  RANK_WEIGHT_UTILIZATION_DELTA,
  type OptimizationEngineInput,
  type OptimizationEngineResult,
  type OptimizationSuggestion,
  type EstimatedImpact,
  type AgentUtilRaw,
  type LearningWeights,
} from "./optimization-types";
import { analyzeUnderutilizedAgents } from "./underutilized-analyzer";

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

export function generateOptimizations(
  input: OptimizationEngineInput,
  learningWeights?: LearningWeights,
): OptimizationEngineResult {
  const start = Date.now();

  const allSuggestions: OptimizationSuggestion[] = [
    ...analyzeAgentRebalancing(input),
    ...analyzeWipAdjustments(input),
    ...analyzePriorityReorder(input),
    ...analyzeCapacityScaling(input),
    ...analyzeUnderutilizedAgents(input),
  ];

  const suggestions = rankSuggestions(allSuggestions, learningWeights);

  const agentIds = new Set(input.agentUtilizations.map((a) => a.agentId));
  const overutilized = input.agentUtilizations.filter(
    (a) => a.utilizationPercent > OPT_OVERUTILIZED,
  ).length;
  const underutilized = input.agentUtilizations.filter(
    (a) => a.utilizationPercent < OPT_UNDERUTILIZED && a.isActive,
  ).length;

  return {
    suggestions,
    analysisTimeMs: Date.now() - start,
    inputSummary: {
      projectCount: input.projectSummaries.length,
      agentCount: agentIds.size,
      overutilizedCount: overutilized,
      underutilizedCount: underutilized,
      bottleneckCount: input.bottlenecks.length,
    },
  };
}

// ---------------------------------------------------------------------------
// Analyzer: Agent Rebalancing
// ---------------------------------------------------------------------------

export function analyzeAgentRebalancing(input: OptimizationEngineInput): OptimizationSuggestion[] {
  const { agentUtilizations, projectSummaries } = input;
  if (projectSummaries.length < 2) return [];

  // Group agents by project
  const byProject = new Map<string, AgentUtilRaw[]>();
  for (const agent of agentUtilizations) {
    const list = byProject.get(agent.projectId) ?? [];
    list.push(agent);
    byProject.set(agent.projectId, list);
  }

  const suggestions: OptimizationSuggestion[] = [];
  const now = Date.now();

  // Find projects with overutilized agents
  const overProjects = projectSummaries.filter(
    (p) => p.overutilizedCount > 0 && p.avgUtilization > OPT_OVERUTILIZED,
  );
  // Find projects with underutilized agents
  const underProjects = projectSummaries.filter((p) => p.underutilizedCount > 0);

  for (const overP of overProjects) {
    for (const underP of underProjects) {
      if (overP.projectId === underP.projectId) continue;

      // Find pool agents in the underutilized project (preferred) or any underutilized agent
      const underAgents = (byProject.get(underP.projectId) ?? []).filter(
        (a) => a.utilizationPercent < OPT_UNDERUTILIZED && a.isActive && a.isPoolAgent,
      );
      // Fallback to non-pool underutilized agents
      const fallbackAgents = (byProject.get(underP.projectId) ?? []).filter(
        (a) => a.utilizationPercent < OPT_UNDERUTILIZED && a.isActive && !a.isPoolAgent,
      );
      const candidates = [...underAgents, ...fallbackAgents];
      if (candidates.length === 0) continue;

      const candidate = candidates[0];
      const sourceUtil = overP.avgUtilization;
      const targetUtil = underP.avgUtilization;
      const delta = Math.round((sourceUtil - targetUtil) / 2);

      const impact = computeImpact({
        daysSavedEstimate: delta * 0.05,
        riskReductionEstimate: delta * 0.2,
        utilizationDelta: delta,
        affectedAgents: [candidate.agentId],
        affectedProjects: [overP.projectId, underP.projectId],
        affectedStories: [],
      });

      suggestions.push({
        id: `opt-agent-rebalance-${candidate.agentId}-${overP.projectId}-${underP.projectId}`,
        category: "agent-rebalancing",
        title: `Rebalance ${candidate.agentId} from ${underP.projectId} to ${overP.projectId}`,
        description: `${overP.projectId} has ${overP.overutilizedCount} overutilized agent(s) at ${sourceUtil}% avg utilization, while ${underP.projectId} has ${underP.underutilizedCount} underutilized agent(s) at ${targetUtil}%. Moving ${candidate.agentId}${candidate.isPoolAgent ? " (pool agent)" : ""} would balance both projects.`,
        impact,
        confidence: candidate.isPoolAgent ? 85 : 65,
        priority: 0,
        createdAt: now,
        data: {
          sourceProject: underP.projectId,
          targetProject: overP.projectId,
          agentId: candidate.agentId,
          isPoolAgent: candidate.isPoolAgent,
          sourceUtilization: sourceUtil,
          targetUtilization: targetUtil,
        },
      });
    }
  }

  return suggestions;
}

// ---------------------------------------------------------------------------
// Analyzer: WIP Adjustments
// ---------------------------------------------------------------------------

export function analyzeWipAdjustments(input: OptimizationEngineInput): OptimizationSuggestion[] {
  const { bottlenecks } = input;
  const suggestions: OptimizationSuggestion[] = [];
  const now = Date.now();

  // Find WIP violation bottlenecks and column bottlenecks
  const relevantBottlenecks = bottlenecks.filter(
    (b) =>
      (b.type === "wip-violation" || b.type === "column-bottleneck") &&
      b.severity >= OPT_BOTTLENECK_SEVERITY_THRESHOLD,
  );

  const seenColumns = new Set<string>();
  for (const bn of relevantBottlenecks) {
    const col = bn.contributingFactors[0] ?? bn.title;
    if (seenColumns.has(col)) continue;
    seenColumns.add(col);

    const storiesAffected = bn.impact.storiesAffected;
    const delayDays = bn.impact.estimatedDelayDays;
    const riskReduction = Math.min(40, bn.severity * 0.4);
    const daysSaved = delayDays * 0.6;

    const impact = computeImpact({
      daysSavedEstimate: daysSaved,
      riskReductionEstimate: riskReduction,
      utilizationDelta: 0,
      affectedAgents: [],
      affectedProjects: bn.affectedProjects,
      affectedStories: bn.affectedStories.slice(0, 10),
    });

    const suggestedAction =
      bn.type === "wip-violation" ? "Increase WIP limit" : "Review column capacity";

    suggestions.push({
      id: `opt-wip-${bn.id}`,
      category: "wip-adjustment",
      title: `${suggestedAction}: ${bn.title}`,
      description: `Bottleneck detected (${bn.severityLabel} severity): ${bn.title}. ${storiesAffected} stories affected with ${delayDays.toFixed(1)} days estimated delay. ${suggestedAction.toLowerCase()} could reduce throughput bottleneck.`,
      impact,
      confidence: 70,
      priority: 0,
      createdAt: now,
      data: {
        bottleneckId: bn.id,
        bottleneckType: bn.type,
        severity: bn.severity,
        suggestedAction,
      },
    });
  }

  return suggestions;
}

// ---------------------------------------------------------------------------
// Analyzer: Priority Reorder
// ---------------------------------------------------------------------------

export function analyzePriorityReorder(input: OptimizationEngineInput): OptimizationSuggestion[] {
  const { bottlenecks, riskFactors } = input;
  const suggestions: OptimizationSuggestion[] = [];
  const now = Date.now();

  // Find stuck stories and aging stories bottlenecks
  const stuckBottlenecks = bottlenecks.filter(
    (b) =>
      (b.type === "stuck-stories" || b.type === "aging-stories") &&
      b.severity >= OPT_BOTTLENECK_SEVERITY_THRESHOLD,
  );

  for (const bn of stuckBottlenecks) {
    const stories = bn.affectedStories;
    if (stories.length === 0) continue;

    const daysSaved = bn.impact.estimatedDelayDays * 0.4;
    const riskReduction = Math.min(30, bn.severity * 0.3);

    const impact = computeImpact({
      daysSavedEstimate: daysSaved,
      riskReductionEstimate: riskReduction,
      utilizationDelta: 0,
      affectedAgents: [],
      affectedProjects: bn.affectedProjects,
      affectedStories: stories.slice(0, 10),
    });

    const isStuck = bn.type === "stuck-stories";
    const actionVerb = isStuck ? "Unblock" : "Escalate";

    suggestions.push({
      id: `opt-priority-${bn.id}`,
      category: "priority-reorder",
      title: `${actionVerb} ${stories.length} ${isStuck ? "stuck" : "aging"} stories`,
      description: `${bn.title} (${bn.severityLabel} severity). ${actionVerb.toLowerCase()}ing these stories by raising priority could reduce delay by ${daysSaved.toFixed(1)} days and risk by ${riskReduction.toFixed(0)}%.`,
      impact,
      confidence: 60,
      priority: 0,
      createdAt: now,
      data: {
        bottleneckId: bn.id,
        storyIds: stories,
        actionType: isStuck ? "unblock" : "escalate",
      },
    });
  }

  // Also check for high-severity risk factors suggesting priority changes
  const blockingRisks = riskFactors.filter(
    (r) =>
      r.type === "blocking-pattern" &&
      r.severity >= OPT_BOTTLENECK_SEVERITY_THRESHOLD &&
      r.affectedStories.length > 0,
  );

  for (const rf of blockingRisks) {
    const stories = rf.affectedStories;
    const daysSaved = rf.severity * 0.03;
    const riskReduction = rf.severity * 0.25;

    const impact = computeImpact({
      daysSavedEstimate: daysSaved,
      riskReductionEstimate: riskReduction,
      utilizationDelta: 0,
      affectedAgents: [],
      affectedProjects: rf.affectedProjects,
      affectedStories: stories.slice(0, 10),
    });

    suggestions.push({
      id: `opt-priority-risk-${rf.id}`,
      category: "priority-reorder",
      title: `Reorder priority for blocking pattern: ${rf.title}`,
      description: `${rf.title} (${rf.severityLabel}). ${stories.length} stories affected. Reordering priorities could reduce the blocking impact.`,
      impact,
      confidence: 55,
      priority: 0,
      createdAt: now,
      data: {
        riskFactorId: rf.id,
        storyIds: stories,
        actionType: "reorder",
      },
    });
  }

  return suggestions;
}

// ---------------------------------------------------------------------------
// Analyzer: Capacity Scaling
// ---------------------------------------------------------------------------

export function analyzeCapacityScaling(input: OptimizationEngineInput): OptimizationSuggestion[] {
  const { capacityResults, bottlenecks } = input;
  const suggestions: OptimizationSuggestion[] = [];
  const now = Date.now();

  // Find agents at or near capacity
  const atCapacity = capacityResults.filter((c) => c.isAtCapacity);
  const nearCapacity = capacityResults.filter((c) => c.isNearCapacity && !c.isAtCapacity);

  // Group by project via agent utilizations
  const agentProject = new Map<string, string>();
  for (const agent of input.agentUtilizations) {
    agentProject.set(agent.agentId, agent.projectId);
  }

  // Find capacity bottlenecks for context
  const capacityBottlenecks = bottlenecks.filter(
    (b) =>
      (b.type === "capacity-bottleneck" || b.type === "agent-overload") &&
      b.severity >= OPT_BOTTLENECK_SEVERITY_THRESHOLD,
  );

  // Suggest for agents at capacity
  for (const cap of atCapacity) {
    const projectId = agentProject.get(cap.agentId) ?? "unknown";
    const relatedBn = capacityBottlenecks.find((b) =>
      b.contributingFactors.some((f) => f.includes(cap.agentId) || f.includes(projectId)),
    );

    const daysSaved = relatedBn
      ? relatedBn.impact.estimatedDelayDays * 0.3
      : cap.utilizationPercent * 0.02;
    const riskReduction = Math.min(25, cap.utilizationPercent * 0.15);
    const utilDelta = cap.utilizationPercent - OPT_NEAR_CAPACITY;

    const impact = computeImpact({
      daysSavedEstimate: daysSaved,
      riskReductionEstimate: riskReduction,
      utilizationDelta: Math.max(0, utilDelta),
      affectedAgents: [cap.agentId],
      affectedProjects: [projectId],
      affectedStories: relatedBn?.affectedStories.slice(0, 10) ?? [],
    });

    suggestions.push({
      id: `opt-capacity-${cap.agentId}`,
      category: "capacity-scaling",
      title: `Reduce load on ${cap.agentId} (${cap.utilizationPercent}% capacity)`,
      description: `${cap.agentId} is at full capacity (${cap.utilizationPercent}%, ${cap.availableSlots} available slots). ${relatedBn ? `Related bottleneck: ${relatedBn.title}.` : ""} Consider redistributing workload to bring utilization below the near-capacity threshold (${OPT_NEAR_CAPACITY}%).`,
      impact,
      confidence: 75,
      priority: 0,
      createdAt: now,
      data: {
        agentId: cap.agentId,
        projectId,
        currentWorkload: cap.currentWorkload,
        maxCapacity: cap.maxCapacity,
        utilizationPercent: cap.utilizationPercent,
        availableSlots: cap.availableSlots,
      },
    });
  }

  // Suggest for near-capacity agents if there are capacity bottlenecks
  if (capacityBottlenecks.length > 0) {
    for (const cap of nearCapacity) {
      const projectId = agentProject.get(cap.agentId) ?? "unknown";

      const daysSaved = cap.utilizationPercent * 0.01;
      const riskReduction = Math.min(15, cap.utilizationPercent * 0.1);

      const impact = computeImpact({
        daysSavedEstimate: daysSaved,
        riskReductionEstimate: riskReduction,
        utilizationDelta: cap.utilizationPercent - OPT_NEAR_CAPACITY,
        affectedAgents: [cap.agentId],
        affectedProjects: [projectId],
        affectedStories: [],
      });

      suggestions.push({
        id: `opt-capacity-near-${cap.agentId}`,
        category: "capacity-scaling",
        title: `Monitor ${cap.agentId} approaching capacity (${cap.utilizationPercent}%)`,
        description: `${cap.agentId} is near capacity (${cap.utilizationPercent}%, ${cap.availableSlots} remaining slots in ${projectId}). Proactive redistribution could prevent a bottleneck.`,
        impact,
        confidence: 50,
        priority: 0,
        createdAt: now,
        data: {
          agentId: cap.agentId,
          projectId,
          utilizationPercent: cap.utilizationPercent,
          availableSlots: cap.availableSlots,
        },
      });
    }
  }

  return suggestions;
}

// ---------------------------------------------------------------------------
// Impact computation
// ---------------------------------------------------------------------------

export function computeImpact(params: {
  daysSavedEstimate: number;
  riskReductionEstimate: number;
  utilizationDelta: number;
  affectedAgents: string[];
  affectedProjects: string[];
  affectedStories: string[];
}): EstimatedImpact {
  return {
    daysSaved: Math.round(params.daysSavedEstimate * 10) / 10,
    riskReductionPercent:
      Math.round(Math.max(0, Math.min(100, params.riskReductionEstimate)) * 10) / 10,
    utilizationDeltaPercent: Math.round(Math.max(0, params.utilizationDelta)),
    affectedAgents: params.affectedAgents,
    affectedProjects: params.affectedProjects,
    affectedStories: params.affectedStories,
  };
}

// ---------------------------------------------------------------------------
// Ranking
// ---------------------------------------------------------------------------

export function rankSuggestions(
  suggestions: OptimizationSuggestion[],
  learningWeights?: LearningWeights,
): OptimizationSuggestion[] {
  const ranked = suggestions.map((s) => ({
    ...s,
    priority:
      s.impact.daysSaved * RANK_WEIGHT_DAYS_SAVED +
      s.impact.riskReductionPercent * RANK_WEIGHT_RISK_REDUCTION +
      Math.abs(s.impact.utilizationDeltaPercent) * RANK_WEIGHT_UTILIZATION_DELTA +
      s.confidence * 0.1,
  }));

  if (learningWeights && learningWeights.categoryBoosts.size > 0) {
    for (const s of ranked) {
      const multiplier = learningWeights.categoryBoosts.get(s.category) ?? 1.0;
      s.priority = Math.round(s.priority * multiplier * 100) / 100;
    }
  }

  return ranked.sort((a, b) => b.priority - a.priority);
}
