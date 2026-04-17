/**
 * Model Routing Service — maps story complexity to model tiers with auto-escalation.
 *
 * Provides:
 * - Keyword-based story complexity classification (LOW/MEDIUM/HIGH)
 * - Tier-to-model resolution via existing resolveModelTiers() cascade
 * - Per-session failure tracking with auto-escalation after 2 consecutive failures
 * - In-memory state only (cleared on process restart)
 *
 * Epic 58, Story 58-4 (FR-P2-1 through FR-P2-4).
 */

import type { ModelTier, OrchestratorConfig, ProjectConfig } from "./types.js";
import { resolveModelTiers } from "./session-manager.js";

// ---------------------------------------------------------------------------
// Complexity heuristics
// ---------------------------------------------------------------------------

const LOW_TIER_KEYWORDS = [
  "explore",
  "search",
  "format",
  "lint",
  "find",
  "list",
  "scan",
  "audit",
  "check",
  "validate",
  "verify",
];

const HIGH_TIER_KEYWORDS = [
  "architect",
  "design",
  "debug",
  "debugger",
  "fix",
  "investigate",
  "troubleshoot",
  "refactor",
  "migrate",
];

/** Failure tracker per session. */
interface FailureRecord {
  tier: ModelTier;
  count: number;
}

/** Arguments for resolveTier(). */
export interface ResolveTierOptions {
  /** Story key from sprint-status (e.g., "58-4-model-routing-service"). */
  storyKey: string;
  /** Optional explicit tier override from caller. */
  explicitTier?: ModelTier;
  /** Optional default tier from provider config. */
  defaultTier?: ModelTier;
  /** Optional session ID for failure-based escalation. */
  sessionId?: string;
}

// ---------------------------------------------------------------------------
// ModelRoutingService interface
// ---------------------------------------------------------------------------

export interface ModelRoutingService {
  /** Classify a story into a model tier. */
  resolveTier(options: ResolveTierOptions): ModelTier;
  /** Map a tier to a concrete model string using config cascade. */
  tierToModel(tier: ModelTier, config: OrchestratorConfig, project: ProjectConfig): string;
  /** Record a failure for a session at the given tier. Returns new failure count. */
  recordFailure(sessionId: string, tier: ModelTier): number;
  /** Get current failure count for a session. */
  getFailureCount(sessionId: string): number;
  /** Reset failures for a session (called on success). */
  resetFailures(sessionId: string): void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Classify story complexity from its key using keyword heuristics. */
export function classifyStoryComplexity(storyKey: string): ModelTier | null {
  const parts = storyKey.toLowerCase().split(/[-_]/);
  for (const part of parts) {
    if (LOW_TIER_KEYWORDS.includes(part)) return "low";
  }
  for (const part of parts) {
    if (HIGH_TIER_KEYWORDS.includes(part)) return "high";
  }
  return null;
}

/** Get the next tier up from the current one. Returns null if already at HIGH. */
function escalateTier(tier: ModelTier): ModelTier | null {
  if (tier === "low") return "medium";
  if (tier === "medium") return "high";
  return null;
}

/** Return the higher of two tiers. */
function maxTier(a: ModelTier, b: ModelTier): ModelTier {
  const order: Record<ModelTier, number> = { low: 0, medium: 1, high: 2 };
  return order[a] >= order[b] ? a : b;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createModelRoutingService(): ModelRoutingService {
  /** In-memory failure counter: sessionId → { tier, count }. */
  const failures = new Map<string, FailureRecord>();

  return {
    resolveTier(options: ResolveTierOptions): ModelTier {
      const { storyKey, explicitTier, defaultTier, sessionId } = options;

      // 1. Explicit override takes absolute precedence
      if (explicitTier) return explicitTier;

      // 2. Keyword heuristics (computed first so escalation can compare)
      const heuristic = classifyStoryComplexity(storyKey);

      // 3. Check auto-escalation from failure tracking
      if (sessionId) {
        const record = failures.get(sessionId);
        if (record && record.count >= 2) {
          const escalated = escalateTier(record.tier);
          if (escalated) {
            // Return the higher of heuristic vs escalated
            return maxTier(escalated, heuristic ?? "medium");
          }
          // Already at HIGH, return HIGH
          return "high";
        }
      }

      // 4. Use heuristic if matched
      if (heuristic) return heuristic;

      // 5. Default tier from config
      if (defaultTier) return defaultTier;

      // 6. Fallback to MEDIUM
      return "medium";
    },

    tierToModel(tier: ModelTier, config: OrchestratorConfig, project: ProjectConfig): string {
      const tiers = resolveModelTiers(config, project);
      return tiers[tier];
    },

    recordFailure(sessionId: string, tier: ModelTier): number {
      const existing = failures.get(sessionId);
      if (existing && existing.tier === tier) {
        existing.count += 1;
        return existing.count;
      }
      // New tier or new session — reset counter for new tier
      const record: FailureRecord = { tier, count: 1 };
      failures.set(sessionId, record);
      return 1;
    },

    getFailureCount(sessionId: string): number {
      return failures.get(sessionId)?.count ?? 0;
    },

    resetFailures(sessionId: string): void {
      failures.delete(sessionId);
    },
  };
}

/** Shared singleton for use across the process. */
export const modelRoutingService = createModelRoutingService();
