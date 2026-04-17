/**
 * Scenario comparison mapping utilities (Story 54.4, Task 1).
 *
 * Maps web-layer WhatIfScenario[] to core Scenario[] for use with
 * compareScenarios() from @composio/ao-core.
 */

import type { Scenario } from "@composio/ao-core";
import type { WhatIfScenario } from "./types";

/** Result of mapping WhatIfScenario[] to comparable Scenario[]. */
export interface MappingResult {
  scenarios: Scenario[];
  warnings: string[];
}

/**
 * Map WhatIfScenario[] to core Scenario[], filtering out invalid ones.
 *
 * Filters out:
 * - Scenarios without simulation results
 * - Scenarios in "draft" status (not yet simulated)
 *
 * Returns warnings for each filtered scenario.
 * Caller should check `result.scenarios.length < 2` before proceeding with comparison.
 */
export function mapToComparableScenarios(scenarios: WhatIfScenario[]): MappingResult {
  const valid: Scenario[] = [];
  const warnings: string[] = [];

  for (const s of scenarios) {
    if (s.status === "draft") {
      warnings.push(`Scenario '${s.name}' is still in draft status (not yet simulated)`);
      continue;
    }
    if (!s.result) {
      warnings.push(`Scenario '${s.name}' has no simulation results`);
      continue;
    }
    valid.push({
      name: s.name,
      storyCount: s.stories.length,
      result: s.result,
    });
  }

  return { scenarios: valid, warnings };
}

/**
 * Find the index of the best scenario for a given metric.
 *
 * - For day-based metrics (p50, p80, p95): lowest value wins
 * - For probability: highest value wins
 * - For confidence: highest value wins
 *
 * Returns the index of the best scenario, or -1 for empty arrays.
 * Ties are broken by returning the first occurrence.
 */
export function getBestMetricIndex(
  scenarios: Scenario[],
  metric: "p50Days" | "p80Days" | "p95Days" | "onTimeProbability" | "confidence",
): number {
  if (scenarios.length === 0) return -1;

  const isDaysMetric = metric === "p50Days" || metric === "p80Days" || metric === "p95Days";

  let bestIdx = 0;
  let bestVal = scenarios[0].result[metric];

  for (let i = 1; i < scenarios.length; i++) {
    const val = scenarios[i].result[metric];
    if (isDaysMetric) {
      if (val < bestVal) {
        bestIdx = i;
        bestVal = val;
      }
    } else {
      if (val > bestVal) {
        bestIdx = i;
        bestVal = val;
      }
    }
  }

  return bestIdx;
}
