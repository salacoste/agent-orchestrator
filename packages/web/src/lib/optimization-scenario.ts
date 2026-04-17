/**
 * Optimization scenario engine for Story 56.8.
 *
 * Pure computation module that takes optimization suggestions and an
 * objective, then re-ranks suggestions based on objective-specific weights
 * and category priorities.
 *
 * All functions are synchronous, no I/O, no side effects.
 */

import { generateOptimizations } from "./optimization-engine";
import { applyLearningWeights } from "./optimization-learning";
import {
  OBJECTIVE_RANK_WEIGHTS,
  OBJECTIVE_ANALYZER_PRIORITY,
  type EstimatedImpact,
  type OptimizationSuggestion,
  type OptimizationEngineInput,
  type OptimizationObjective,
  type ObjectiveScenarioResult,
  type BaselineComparison,
  type ObjectiveResult,
  type ObjectiveComparisonSummary,
  type RankChange,
  type LearningWeights,
} from "./optimization-types";

// ---------------------------------------------------------------------------
// Main entry points
// ---------------------------------------------------------------------------

export function runObjectiveScenario(
  input: OptimizationEngineInput,
  objective: OptimizationObjective,
  learningWeights?: LearningWeights,
): ObjectiveScenarioResult {
  const start = Date.now();

  // Run base engine (objective field ignored by 56-7 engine)
  const baseline = generateOptimizations(input, learningWeights);

  // Re-rank with objective weights, then apply learning on top
  const reRanked = applyLearningWeights(
    applyObjectiveRanking(baseline.suggestions, objective),
    learningWeights,
  );

  // Compute comparison with baseline
  const baselineComparison = compareWithBaseline(reRanked, baseline.suggestions);

  return {
    objective,
    suggestions: reRanked,
    analysisTimeMs: Date.now() - start,
    inputSummary: baseline.inputSummary,
    baselineComparison,
  };
}

export function runAllObjectives(
  input: OptimizationEngineInput,
  learningWeights?: LearningWeights,
): {
  results: Map<OptimizationObjective, ObjectiveScenarioResult>;
  baselineSuggestions: OptimizationSuggestion[];
} {
  // Run base engine once
  const baseline = generateOptimizations(input, learningWeights);

  const results = new Map<OptimizationObjective, ObjectiveScenarioResult>();
  const objectives: OptimizationObjective[] = [
    "minimize-time",
    "maximize-throughput",
    "balance-workload",
    "reduce-blocking",
  ];

  for (const objective of objectives) {
    const start = Date.now();
    const reRanked = applyLearningWeights(
      applyObjectiveRanking(baseline.suggestions, objective),
      learningWeights,
    );
    const baselineComparison = compareWithBaseline(reRanked, baseline.suggestions);

    results.set(objective, {
      objective,
      suggestions: reRanked,
      analysisTimeMs: Date.now() - start,
      inputSummary: baseline.inputSummary,
      baselineComparison,
    });
  }

  return { results, baselineSuggestions: baseline.suggestions };
}

export function compareObjectives(
  results: Map<OptimizationObjective, ObjectiveScenarioResult>,
  baselineSuggestions: OptimizationSuggestion[],
): ObjectiveComparisonSummary {
  const start = Date.now();
  const objectives: ObjectiveResult[] = [];

  for (const [, result] of results) {
    const top3 = result.suggestions.slice(0, 3);
    const projectedImpact = aggregateImpact(top3);
    objectives.push({
      objective: result.objective,
      topSuggestions: top3,
      projectedImpact,
    });
  }

  return {
    objectives,
    baselineTopSuggestions: baselineSuggestions.slice(0, 3),
    analysisTimeMs: Date.now() - start,
  };
}

// ---------------------------------------------------------------------------
// Objective ranking
// ---------------------------------------------------------------------------

export function applyObjectiveRanking(
  suggestions: OptimizationSuggestion[],
  objective: OptimizationObjective,
): OptimizationSuggestion[] {
  if (suggestions.length === 0) return [];

  const weights = OBJECTIVE_RANK_WEIGHTS[objective];
  const categoryConfig = OBJECTIVE_ANALYZER_PRIORITY[objective];

  // Apply category boost/suppress and recompute priority
  const adjusted = suggestions.map((s) => {
    let priority =
      s.impact.daysSaved * weights.daysSaved +
      s.impact.riskReductionPercent * weights.riskReduction +
      Math.abs(s.impact.utilizationDeltaPercent) * weights.utilizationDelta +
      s.confidence * 0.1;

    if (categoryConfig.boost.includes(s.category)) {
      priority *= weights.boostFactor;
    } else if (categoryConfig.suppress.includes(s.category)) {
      priority *= weights.suppressFactor;
    }

    return { ...s, priority };
  });

  // Sort by new priority descending
  return adjusted.sort((a, b) => b.priority - a.priority);
}

// ---------------------------------------------------------------------------
// Baseline comparison
// ---------------------------------------------------------------------------

export function compareWithBaseline(
  objectiveRanked: OptimizationSuggestion[],
  baselineRanked: OptimizationSuggestion[],
): BaselineComparison {
  if (baselineRanked.length === 0 || objectiveRanked.length === 0) {
    return { topSuggestionMoved: false, rankChanges: [] };
  }

  const baselineIndex = new Map<string, number>();
  baselineRanked.forEach((s, i) => baselineIndex.set(s.id, i));

  const rankChanges: RankChange[] = [];
  for (let objIdx = 0; objIdx < objectiveRanked.length; objIdx++) {
    const id = objectiveRanked[objIdx].id;
    const baseIdx = baselineIndex.get(id);
    if (baseIdx !== undefined && baseIdx !== objIdx) {
      rankChanges.push({
        suggestionId: id,
        baselineRank: baseIdx,
        objectiveRank: objIdx,
        rankDelta: baseIdx - objIdx, // positive = moved up
      });
    }
  }

  const topSuggestionMoved =
    objectiveRanked.length > 0 &&
    baselineRanked.length > 0 &&
    objectiveRanked[0].id !== baselineRanked[0].id;

  return { topSuggestionMoved, rankChanges };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function aggregateImpact(suggestions: OptimizationSuggestion[]): EstimatedImpact {
  const result = {
    daysSaved: 0,
    riskReductionPercent: 0,
    utilizationDeltaPercent: 0,
    affectedAgents: [] as string[],
    affectedProjects: [] as string[],
    affectedStories: [] as string[],
  };

  for (const s of suggestions) {
    result.daysSaved += s.impact.daysSaved;
    result.riskReductionPercent += s.impact.riskReductionPercent;
    result.utilizationDeltaPercent += s.impact.utilizationDeltaPercent;
    result.affectedAgents.push(...s.impact.affectedAgents);
    result.affectedProjects.push(...s.impact.affectedProjects);
    result.affectedStories.push(...s.impact.affectedStories);
  }

  // Cap percentages at 100
  result.riskReductionPercent = Math.min(result.riskReductionPercent, 100);

  // Deduplicate
  result.affectedAgents = [...new Set(result.affectedAgents)];
  result.affectedProjects = [...new Set(result.affectedProjects)];
  result.affectedStories = [...new Set(result.affectedStories)];

  return result;
}
