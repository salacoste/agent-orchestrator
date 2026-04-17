/**
 * Scenario Parameter Utilities — validation, diff computation, defaults (Story 54.2).
 *
 * Pure functions: no I/O, deterministic output from input.
 */

import type {
  ScenarioParameters,
  StoryPriority,
  StoryPriorityOverride,
  ParameterDiff,
} from "./types";

/** Valid priority values for runtime validation. */
const VALID_PRIORITIES: ReadonlySet<string> = new Set<StoryPriority>(["high", "medium", "low"]);

/** Minimum allowed agent count. */
export const MIN_AGENT_COUNT = 1;
/** Maximum allowed agent count. */
export const MAX_AGENT_COUNT = 50;
/** Minimum allowed capacity limit. */
export const MIN_CAPACITY = 1;
/** Maximum allowed capacity limit. */
export const MAX_CAPACITY = 20;

/**
 * Validate scenario parameters.
 *
 * Returns an array of error messages. Empty array = valid.
 * Pure function: no side effects.
 */
export function validateParameters(params: ScenarioParameters, storyIds?: string[]): string[] {
  const errors: string[] = [];

  if (!Number.isInteger(params.agentCount) || params.agentCount < MIN_AGENT_COUNT) {
    errors.push(`Agent count must be at least ${MIN_AGENT_COUNT}`);
  }
  if (params.agentCount > MAX_AGENT_COUNT) {
    errors.push(`Agent count must be at most ${MAX_AGENT_COUNT}`);
  }

  if (!Number.isInteger(params.capacityLimit) || params.capacityLimit < MIN_CAPACITY) {
    errors.push(`Capacity limit must be at least ${MIN_CAPACITY}`);
  }
  if (params.capacityLimit > MAX_CAPACITY) {
    errors.push(`Capacity limit must be at most ${MAX_CAPACITY}`);
  }

  // Validate story priority overrides
  const seenIds = new Set<string>();
  for (const override of params.storyPriorities) {
    if (seenIds.has(override.storyId)) {
      errors.push(`Duplicate story ID in priority overrides: ${override.storyId}`);
    }
    seenIds.add(override.storyId);

    if (!VALID_PRIORITIES.has(override.newPriority)) {
      errors.push(`Invalid priority value for story ${override.storyId}: ${override.newPriority}`);
    }

    if (!VALID_PRIORITIES.has(override.originalPriority)) {
      errors.push(
        `Invalid original priority for story ${override.storyId}: ${override.originalPriority}`,
      );
    }

    if (storyIds && !storyIds.includes(override.storyId)) {
      errors.push(`Story ID not found in scenario: ${override.storyId}`);
    }
  }

  return errors;
}

/**
 * Compute the diff between original and modified scenario parameters.
 *
 * Returns a ParameterDiff showing what changed.
 * If original is undefined, uses defaults (agentCount=1, capacityLimit=1, no overrides).
 * Pure function: no side effects.
 */
export function computeParameterDiff(
  original: ScenarioParameters | undefined,
  modified: ScenarioParameters,
): ParameterDiff {
  const origAgent = original?.agentCount ?? MIN_AGENT_COUNT;
  const origCapacity = original?.capacityLimit ?? MIN_CAPACITY;
  const origPriorities = original?.storyPriorities ?? [];

  const agentCount =
    origAgent !== modified.agentCount
      ? { original: origAgent, modified: modified.agentCount }
      : null;

  const capacityLimit =
    origCapacity !== modified.capacityLimit
      ? { original: origCapacity, modified: modified.capacityLimit }
      : null;

  // Find priority changes — compare against original overrides
  const origMap = new Map(origPriorities.map((o) => [o.storyId, o.newPriority]));
  const priorityChanges: StoryPriorityOverride[] = modified.storyPriorities.filter((override) => {
    const origPriority = origMap.get(override.storyId) ?? "medium";
    return override.newPriority !== origPriority;
  });

  const hasChanges = agentCount !== null || capacityLimit !== null || priorityChanges.length > 0;

  return { agentCount, capacityLimit, priorityChanges, hasChanges };
}

/**
 * Apply default parameter values based on config-derived defaults.
 *
 * If the scenario already has parameters, returns them unchanged.
 * Otherwise returns defaults.
 * Pure function: no side effects.
 */
export function applyParameterDefaults(
  existing: ScenarioParameters | undefined,
  defaultAgentCount: number,
): ScenarioParameters {
  if (existing) return existing;
  return {
    agentCount: defaultAgentCount,
    capacityLimit: MIN_CAPACITY,
    storyPriorities: [],
  };
}
