/**
 * Persistence-aware session timeout — adjusts blocked-agent detection timeout
 * based on execution mode from agent mapping.
 *
 * Persistent sessions get 3x timeout, lightweight get 0.5x, standard gets 1x.
 * Effective timeout is clamped to [1m, 60m] regardless of multiplier.
 *
 * Epic 59, Story 59-7 (FR-S2-4).
 */

import type { AgentMapping, BlockedAgentDetectorConfig } from "./types.js";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * Per-execution-mode timeout multipliers.
 * Applied on top of the agent-type base timeout.
 */
export const EXECUTION_MODE_TIMEOUT_MULTIPLIERS: Record<
  NonNullable<AgentMapping["executionMode"]>,
  number
> = {
  standard: 1.0,
  persistent: 3.0,
  lightweight: 0.5,
};

/** Minimum timeout (1 minute) */
export const MIN_TIMEOUT = 1 * 60 * 1000;

/** Maximum timeout (60 minutes) */
export const MAX_TIMEOUT = 60 * 60 * 1000;

// ---------------------------------------------------------------------------
// Resolve session timeout
// ---------------------------------------------------------------------------

/**
 * Compute the effective timeout for an agent session based on execution mode.
 *
 * @param baseTimeout - The agent-type base timeout in milliseconds
 * @param executionMode - The session's execution mode (from session metadata)
 * @param config - Optional detector config with custom multipliers
 * @returns Effective timeout in milliseconds, clamped to [MIN_TIMEOUT, MAX_TIMEOUT]
 */
export function resolveSessionTimeout(
  baseTimeout: number,
  executionMode: AgentMapping["executionMode"],
  config?: Pick<BlockedAgentDetectorConfig, "executionModeTimeouts">,
): number {
  if (!executionMode) {
    return clamp(baseTimeout);
  }

  // Use custom multiplier if configured, otherwise default
  const customMultipliers = config?.executionModeTimeouts;
  const multiplier =
    customMultipliers?.[executionMode] ?? EXECUTION_MODE_TIMEOUT_MULTIPLIERS[executionMode] ?? 1.0;

  return clamp(Math.round(baseTimeout * multiplier));
}

function clamp(value: number): number {
  return Math.max(MIN_TIMEOUT, Math.min(MAX_TIMEOUT, value));
}
