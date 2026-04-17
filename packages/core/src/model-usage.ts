/**
 * Model Usage Aggregator — tracks tier and token consumption per session.
 *
 * Provides:
 * - In-memory event store with JSONL persistence
 * - Aggregation queries by session, story, project, sprint
 * - Summary with per-tier breakdown
 *
 * Architecture:
 * - Append-only JSONL at {sessionsDir}/audit/model-usage.jsonl
 * - On startup, loads events from JSONL to restore in-memory state (synchronous)
 * - recordUsage() appends to both in-memory store and JSONL file
 */

import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { appendFile, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { parse } from "yaml";
import type { ModelTier, ModelUsageEvent, UsageAggregate } from "./types.js";

// Re-export types for convenient single-import access (L2 fix)
export type { ModelTier, ModelUsageEvent, UsageAggregate } from "./types.js";

const MODEL_USAGE_FILENAME = "model-usage.jsonl";
const VALID_TIERS: readonly ModelTier[] = ["low", "medium", "high"];

export interface ModelUsageAggregator {
  recordUsage(event: ModelUsageEvent): void;
  getBySession(sessionId: string): UsageAggregate;
  getByStory(storyId: string): UsageAggregate;
  getByProject(projectId: string): UsageAggregate;
  /** Aggregates usage for all stories in the sprint defined at projectPath/sprint-status.yaml. */
  getBySprint(projectPath: string): Promise<UsageAggregate>;
  getSummary(): {
    totalTokens: number;
    totalCost: number;
    byTier: Record<ModelTier, { tokens: number; cost: number; sessions: number }>;
  };
}

function emptyAggregate(): UsageAggregate {
  return { totalInputTokens: 0, totalOutputTokens: 0, totalCostUsd: 0, sessionCount: 0 };
}

function aggregateEvents(events: ModelUsageEvent[]): UsageAggregate {
  const agg = emptyAggregate();
  for (const event of events) {
    agg.totalInputTokens += event.inputTokens;
    agg.totalOutputTokens += event.outputTokens;
    agg.totalCostUsd += event.estimatedCostUsd;
    agg.sessionCount += 1;
  }
  return agg;
}

/**
 * Validate and normalise a model tier value.
 * Returns the tier if valid, otherwise falls back to "medium".
 */
export function validateModelTier(raw: string | undefined): ModelTier {
  if (raw && (VALID_TIERS as readonly string[]).includes(raw)) {
    return raw as ModelTier;
  }
  return "medium";
}

/**
 * Filter sprint-status.yaml keys to story-only entries.
 * Excludes epic keys (starting with "epic-") and retrospective keys
 * (ending with "-retrospective").
 */
function isStoryKey(key: string): boolean {
  return !key.startsWith("epic-") && !key.endsWith("-retrospective");
}

/**
 * Read story IDs from sprint-status.yaml at the given project path (async).
 * Returns null if the file doesn't exist or is malformed.
 * Filters to story-only keys (excludes epics and retrospectives).
 */
async function readSprintStoryIds(projectPath: string): Promise<string[] | null> {
  const statusPath = join(projectPath, "sprint-status.yaml");
  try {
    const content = await readFile(statusPath, "utf-8");
    const parsed = parse(content) as Record<string, unknown>;
    const devStatus = parsed.development_status;
    if (devStatus && typeof devStatus === "object") {
      return Object.keys(devStatus as Record<string, unknown>).filter(isStoryKey);
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Create a new ModelUsageAggregator instance.
 * Optionally loads persisted events from a JSONL file (synchronous on construction).
 */
export function createModelUsageAggregator(sessionsDir?: string): ModelUsageAggregator {
  const events: ModelUsageEvent[] = [];
  const jsonlPath = sessionsDir ? join(sessionsDir, "audit", MODEL_USAGE_FILENAME) : null;
  const auditDir = jsonlPath ? dirname(jsonlPath) : null;

  // Track unique session IDs for sessionCount accuracy
  const sessionIndex = new Map<string, ModelUsageEvent[]>();
  // Secondary indexes for faster queries
  const storyIndex = new Map<string, ModelUsageEvent[]>();
  const projectIndex = new Map<string, ModelUsageEvent[]>();

  function indexEvent(event: ModelUsageEvent): void {
    events.push(event);
    // Index by session
    const sessionEvents = sessionIndex.get(event.sessionId);
    if (sessionEvents) {
      sessionEvents.push(event);
    } else {
      sessionIndex.set(event.sessionId, [event]);
    }
    // Index by story
    const storyEvents = storyIndex.get(event.storyId);
    if (storyEvents) {
      storyEvents.push(event);
    } else {
      storyIndex.set(event.storyId, [event]);
    }
    // Index by project
    const projectEvents = projectIndex.get(event.projectId);
    if (projectEvents) {
      projectEvents.push(event);
    } else {
      projectIndex.set(event.projectId, [event]);
    }
  }

  // Load persisted events synchronously on construction
  if (jsonlPath && existsSync(jsonlPath)) {
    try {
      const content = readFileSync(jsonlPath, "utf-8");
      for (const line of content.split("\n")) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        try {
          const parsed = JSON.parse(trimmed) as ModelUsageEvent;
          indexEvent(parsed);
        } catch {
          // Skip malformed lines
        }
      }
    } catch {
      // File unreadable — start fresh
    }
  }

  // Ensure audit directory exists lazily (once)
  let dirCreated = false;
  function ensureAuditDir(): void {
    if (dirCreated || !auditDir) return;
    if (!existsSync(auditDir)) {
      mkdirSync(auditDir, { recursive: true });
    }
    dirCreated = true;
  }

  return {
    recordUsage(event: ModelUsageEvent): void {
      indexEvent(event);
      // Append to JSONL
      if (jsonlPath) {
        ensureAuditDir();
        appendFile(jsonlPath, JSON.stringify(event) + "\n").catch(() => {
          // JSONL write failure must not block completion
        });
      }
    },

    getBySession(sessionId: string): UsageAggregate {
      const sessionEvents = sessionIndex.get(sessionId);
      return sessionEvents ? aggregateEvents(sessionEvents) : emptyAggregate();
    },

    getByStory(storyId: string): UsageAggregate {
      const matching = storyIndex.get(storyId);
      return matching ? aggregateEvents(matching) : emptyAggregate();
    },

    getByProject(projectId: string): UsageAggregate {
      const matching = projectIndex.get(projectId);
      return matching ? aggregateEvents(matching) : emptyAggregate();
    },

    async getBySprint(projectPath: string): Promise<UsageAggregate> {
      const storyIds = await readSprintStoryIds(projectPath);
      if (!storyIds) {
        // No sprint-status.yaml found — return empty
        return emptyAggregate();
      }
      // Collect events for all stories in the sprint
      const sprintEvents: ModelUsageEvent[] = [];
      for (const storyId of storyIds) {
        const storyEvents = storyIndex.get(storyId);
        if (storyEvents) {
          sprintEvents.push(...storyEvents);
        }
      }
      return aggregateEvents(sprintEvents);
    },

    getSummary(): {
      totalTokens: number;
      totalCost: number;
      byTier: Record<ModelTier, { tokens: number; cost: number; sessions: number }>;
    } {
      let totalTokens = 0;
      let totalCost = 0;
      const byTier: Record<ModelTier, { tokens: number; cost: number; sessions: number }> = {
        low: { tokens: 0, cost: 0, sessions: 0 },
        medium: { tokens: 0, cost: 0, sessions: 0 },
        high: { tokens: 0, cost: 0, sessions: 0 },
      };

      const tierSessions = new Map<string, Set<string>>();
      for (const tier of VALID_TIERS) {
        tierSessions.set(tier, new Set());
      }

      for (const event of events) {
        const tier = event.modelTier;
        // Guard against invalid tier values
        if (!(VALID_TIERS as readonly string[]).includes(tier)) continue;
        const tokens = event.inputTokens + event.outputTokens;
        totalTokens += tokens;
        totalCost += event.estimatedCostUsd;
        byTier[tier].tokens += tokens;
        byTier[tier].cost += event.estimatedCostUsd;
        const tierSet = tierSessions.get(tier);
        if (tierSet) tierSet.add(event.sessionId);
      }

      for (const tier of VALID_TIERS) {
        const tierSet = tierSessions.get(tier);
        byTier[tier].sessions = tierSet ? tierSet.size : 0;
      }

      return { totalTokens, totalCost, byTier };
    },
  };
}

/**
 * Bootstrap a persistent model usage aggregator with a sessions directory.
 * The returned aggregator reads/writes JSONL at {sessionsDir}/audit/model-usage.jsonl.
 * Register the result via `registerModelUsageAggregator()` so completion handlers
 * pick up the persistent instance instead of the default in-memory singleton.
 */
export function bootstrapModelUsageAggregator(sessionsDir: string): ModelUsageAggregator {
  return createModelUsageAggregator(sessionsDir);
}

/** Singleton instance for shared use (no persistence — tests and CLI use factory). */
export const modelUsageAggregator = createModelUsageAggregator();
