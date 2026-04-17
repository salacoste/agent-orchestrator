/**
 * Scenario Simulation Utilities — parameter mapping and parallelism scaling (Story 54.3).
 *
 * Pure functions: no I/O, deterministic output from input.
 */

import type { StoryPriority, WhatIfScenario } from "./types";
import type {
  SimStory,
  SimulationInput,
  SimulationResult,
  SessionLearning,
} from "@composio/ao-core";

/** Default iterations for scenario simulation (balanced for <10s completion). */
const DEFAULT_ITERATIONS = 1000;

/** Priority sort order: lower number = scheduled first. */
const PRIORITY_ORDER: Record<StoryPriority, number> = {
  high: 0,
  medium: 1,
  low: 2,
};

/**
 * Build a SimulationInput from a scenario's stories, parameters, and learnings.
 *
 * Maps ScenarioStorySnapshot[] → SimStory[], applies priority ordering,
 * and sets iterations to the scenario default (1000).
 * Pure function: no side effects.
 */
export function buildSimulationInput(
  scenario: WhatIfScenario,
  learnings: SessionLearning[],
): SimulationInput {
  const params = scenario.parameters;
  const storyPriorities = params?.storyPriorities ?? [];

  // Build priority lookup from overrides
  const priorityMap = new Map<string, StoryPriority>();
  for (const override of storyPriorities) {
    priorityMap.set(override.storyId, override.newPriority);
  }

  // Map stories and assign priority
  const tagged = scenario.stories.map((s): { sim: SimStory; priority: StoryPriority } => ({
    sim: { id: s.id, domainTags: s.domainTags },
    priority: priorityMap.get(s.id) ?? "medium",
  }));

  // Sort by priority: high first, then medium, then low
  tagged.sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]);

  return {
    stories: tagged.map((t) => t.sim),
    learnings,
    iterations: DEFAULT_ITERATIONS,
  };
}

/**
 * Apply parallelism scaling to a simulation result.
 *
 * Divides day-based predictions by effectiveConcurrency (agentCount × capacityLimit).
 * Clamps all day values to a minimum of 1 to avoid unrealistic predictions.
 * Preserves non-day fields (probability, confidence, iterationsRun).
 * Pure function: no side effects.
 */
export function applyParallelismScaling(
  result: SimulationResult,
  agentCount: number,
  capacityLimit: number,
): SimulationResult {
  const effectiveConcurrency = agentCount * capacityLimit;

  const clamp = (days: number): number => Math.max(1, days / effectiveConcurrency);

  return {
    p50Days: clamp(result.p50Days),
    p80Days: clamp(result.p80Days),
    p95Days: clamp(result.p95Days),
    onTimeProbability: result.onTimeProbability,
    confidence: result.confidence,
    iterationsRun: result.iterationsRun,
  };
}
