/**
 * Underutilized agent analyzer for Story 56.9.
 *
 * Pure computation module that detects agents with low utilization
 * and generates reallocation suggestions targeting projects with
 * available capacity.
 *
 * All functions are synchronous, no I/O, no side effects.
 *
 * Note: The same underutilized agent may also appear in agent-rebalancing
 * suggestions (from optimization-engine.ts). This is by design — the ranking
 * system sorts all suggestions by priority, so the most actionable one
 * surfaces first. Deduplication is not performed because the two categories
 * serve different purposes: rebalancing proposes a specific project move,
 * while underutilized-detection highlights the wasted capacity.
 */

import {
  OPT_UNDERUTILIZED,
  type OptimizationEngineInput,
  type OptimizationSuggestion,
  type UnderutilizedAgentData,
} from "./optimization-types";
import { computeImpact } from "./optimization-engine";

// ---------------------------------------------------------------------------
// Confidence scoring constants
// ---------------------------------------------------------------------------

const CONFIDENCE_BASE = 50;
const CONFIDENCE_POOL_AGENT_BONUS = 20;
const CONFIDENCE_TARGET_AVAILABLE_BONUS = 15;
const CONFIDENCE_NO_STORIES_PENALTY = 10;
const CONFIDENCE_MAX = 95;
const CONFIDENCE_MIN = 20;

// ---------------------------------------------------------------------------
// Main analyzer
// ---------------------------------------------------------------------------

export function analyzeUnderutilizedAgents(
  input: OptimizationEngineInput,
): OptimizationSuggestion[] {
  const { agentUtilizations, capacityResults } = input;
  const suggestions: OptimizationSuggestion[] = [];
  const now = Date.now();

  // Build agent → project map from capacity results
  const agentProject = new Map<string, string>();
  for (const agent of agentUtilizations) {
    agentProject.set(agent.agentId, agent.projectId);
  }

  // Build project → agents with available capacity
  const projectCapacity = new Map<string, { agentId: string; availableSlots: number }[]>();
  for (const cap of capacityResults) {
    if (cap.availableSlots <= 0) continue;
    const projectId = agentProject.get(cap.agentId) ?? "unknown";
    const list = projectCapacity.get(projectId) ?? [];
    list.push({ agentId: cap.agentId, availableSlots: cap.availableSlots });
    projectCapacity.set(projectId, list);
  }

  // Find underutilized agents
  const underutilized = agentUtilizations.filter(
    (a) => a.utilizationPercent < OPT_UNDERUTILIZED && a.isActive,
  );

  for (const agent of underutilized) {
    const currentProject = agent.projectId;

    // Find projects with available capacity (exclude current project)
    const targetProjects: string[] = [];
    for (const [projectId, agents] of projectCapacity) {
      if (projectId === currentProject) continue;
      if (agents.length > 0) {
        targetProjects.push(projectId);
      }
    }

    // Compute impact
    const utilizationGap = OPT_UNDERUTILIZED - agent.utilizationPercent;
    const daysSaved = utilizationGap * 0.03;
    const riskReduction = Math.min(20, utilizationGap * 0.15);
    const utilizationDelta = utilizationGap;

    const impact = computeImpact({
      daysSavedEstimate: daysSaved,
      riskReductionEstimate: riskReduction,
      utilizationDelta,
      affectedAgents: [agent.agentId],
      affectedProjects: [currentProject, ...targetProjects.slice(0, 3)],
      affectedStories: [],
    });

    // Compute confidence based on factors
    let confidence = CONFIDENCE_BASE;
    if (agent.isPoolAgent) confidence += CONFIDENCE_POOL_AGENT_BONUS;
    if (targetProjects.length > 0) confidence += CONFIDENCE_TARGET_AVAILABLE_BONUS;
    if (agent.storiesWorked === 0) confidence -= CONFIDENCE_NO_STORIES_PENALTY;
    confidence = Math.min(CONFIDENCE_MAX, Math.max(CONFIDENCE_MIN, confidence));

    const data: UnderutilizedAgentData = {
      agentId: agent.agentId,
      projectId: currentProject,
      utilizationPercent: agent.utilizationPercent,
      isActive: agent.isActive,
      isPoolAgent: agent.isPoolAgent,
      storiesWorked: agent.storiesWorked,
      idleDays: 0,
      suggestedProjectIds: targetProjects.slice(0, 5),
      suggestedStoryIds: [],
    };

    const targetLabel =
      targetProjects.length > 0
        ? `Consider reallocating to: ${targetProjects.slice(0, 3).join(", ")}`
        : "No projects currently have available capacity for reallocation";

    suggestions.push({
      id: `opt-underutilized-${agent.agentId}`,
      category: "underutilized-detection",
      title: `Underutilized agent: ${agent.agentId} at ${agent.utilizationPercent}% in ${currentProject}`,
      description: `${agent.agentId} is active but only at ${agent.utilizationPercent}% utilization in ${currentProject}. ${agent.isPoolAgent ? "As a pool agent, " : ""}${targetLabel}. Increasing utilization by ${utilizationGap.toFixed(0)}pp would save an estimated ${daysSaved.toFixed(1)} days.`,
      impact,
      confidence,
      priority: 0,
      createdAt: now,
      data: data as unknown as Record<string, unknown>,
    });
  }

  return suggestions;
}
