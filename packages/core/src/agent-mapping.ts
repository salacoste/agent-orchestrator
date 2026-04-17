/**
 * Story-agent mapping — resolves which OMC agents to activate per story type.
 *
 * Provides default agent combinations for each story type and a cascade
 * resolution function that merges per-project config overrides.
 *
 * Epic 59, Story 59-6 (FR-S3-1, FR-S3-2, FR-S3-3).
 */

import type { AgentMapping, StoryType } from "./types.js";

// ---------------------------------------------------------------------------
// Default agent mappings
// ---------------------------------------------------------------------------

/**
 * Per-story-type default agent combinations.
 * Agent names correspond to OMC's built-in agent catalog.
 */
export const DEFAULT_AGENT_MAPPINGS: Record<StoryType, AgentMapping> = {
  exploration: {
    agents: ["searcher", "analyzer"],
    executionMode: "lightweight",
  },
  implementation: {
    agents: ["planner", "architect", "executor", "verifier"],
    executionMode: "standard",
  },
  bugfix: {
    agents: ["tracer", "debugger", "verifier"],
    executionMode: "standard",
  },
  review: {
    agents: ["reviewer"],
    executionMode: "lightweight",
  },
  default: {
    agents: ["planner", "executor", "verifier"],
    executionMode: "standard",
  },
};

// ---------------------------------------------------------------------------
// Resolve agent mapping
// ---------------------------------------------------------------------------

/**
 * Resolve the agent mapping for a story type, applying config overrides.
 *
 * Cascade: config override > defaults. Falls back to "default" mapping
 * when storyType is undefined or not in the mapping.
 */
export function resolveAgentMapping(
  storyType: StoryType | undefined,
  configOverride?: Record<string, AgentMapping>,
): AgentMapping {
  const typeKey = storyType ?? "default";
  const base = DEFAULT_AGENT_MAPPINGS[typeKey] ?? DEFAULT_AGENT_MAPPINGS["default"];

  if (!configOverride) {
    return { ...base, agents: [...base.agents] };
  }

  const override = configOverride[typeKey];
  if (!override) {
    return { ...base, agents: [...base.agents] };
  }

  return {
    agents: override.agents ? [...override.agents] : [...base.agents],
    ...(override.executionMode !== undefined && { executionMode: override.executionMode }),
    ...(base.executionMode !== undefined &&
      override.executionMode === undefined && { executionMode: base.executionMode }),
  };
}
