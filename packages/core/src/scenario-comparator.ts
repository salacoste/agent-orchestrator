/**
 * Scenario comparator — side-by-side simulation comparison (Story 48.3).
 *
 * Pure function. Ranks simulation scenarios by on-time probability
 * and recommends the best option.
 */

import {
  getSimulationColor,
  type SimulationResult,
  type SimulationColor,
} from "./sprint-simulator.js";

/** A simulation scenario to compare. */
export interface Scenario {
  name: string;
  storyCount: number;
  result: SimulationResult;
}

/** Ranked scenario with color and rank. */
export interface RankedScenario extends Scenario {
  rank: number;
  color: SimulationColor;
  isRecommended: boolean;
}

/** Comparison result. */
export interface ScenarioComparison {
  scenarios: RankedScenario[];
  recommendedIndex: number;
}

/**
 * Compare 2+ simulation scenarios and recommend the best.
 *
 * Ranks by on-time probability (highest first).
 * Ties broken by fewer stories (simpler scope preferred).
 *
 * Pure function — no I/O.
 */
export function compareScenarios(scenarios: Scenario[]): ScenarioComparison {
  if (scenarios.length === 0) {
    return { scenarios: [], recommendedIndex: -1 };
  }

  // Sort by on-time probability desc, then story count asc (simpler preferred)
  const sorted = [...scenarios]
    .map((s, originalIndex) => ({ ...s, originalIndex }))
    .sort((a, b) => {
      const probDiff = b.result.onTimeProbability - a.result.onTimeProbability;
      if (Math.abs(probDiff) > 0.01) return probDiff;
      return a.storyCount - b.storyCount;
    });

  const ranked: RankedScenario[] = sorted.map((s, i) => ({
    name: s.name,
    storyCount: s.storyCount,
    result: s.result,
    rank: i + 1,
    color: getSimulationColor(s.result.onTimeProbability),
    isRecommended: i === 0,
  }));

  // Find the recommended scenario's index in the original array
  const recommendedIndex = sorted[0].originalIndex;

  return { scenarios: ranked, recommendedIndex };
}
