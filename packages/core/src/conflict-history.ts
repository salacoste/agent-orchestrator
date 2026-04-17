/**
 * Conflict History Tracking — types, JSONL store, query, filter, export, pattern analysis (Epic 52, Story 52.5).
 *
 * Records resolution outcomes for detected resource conflicts, provides query/filter
 * capabilities, pattern analysis, and JSON export.
 *
 * Design: Pure sync functions for query/filter/export. JSONL I/O in separate functions.
 * Builds on the audit trail pattern from resource-conflict.ts.
 *
 * FR-F4-5: Conflict history is tracked and queryable for pattern analysis.
 * NFR-F4-2: Pattern analysis scales to 50 projects (O(n) scan of JSONL entries).
 */

import type { ResourceConflict, ResourceConflictType } from "./resource-conflict.js";
import type { ResourceConflictResolutionStrategy } from "./resource-conflict-suggestions.js";
import { appendFileSync, existsSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { randomBytes } from "node:crypto";

// =============================================================================
// TYPES
// =============================================================================

/** Outcome of a conflict resolution action. */
export type ConflictResolutionOutcome = "resolved" | "dismissed" | "escalated" | "auto-resolved";

/** A conflict history entry — a resolved conflict with resolution details. */
export interface ConflictHistoryEntry {
  /** Unique history entry ID. */
  id: string;
  /** The conflict snapshot at the time of resolution. */
  conflict: ResourceConflict;
  /** ISO timestamp when the conflict was resolved. */
  resolvedAt: string;
  /** Strategy applied to resolve the conflict. */
  resolutionStrategy: ResourceConflictResolutionStrategy | "manual" | "none";
  /** Outcome of the resolution. */
  resolutionOutcome: ConflictResolutionOutcome;
  /** Who or what resolved the conflict (user email, "system", "policy:<name>"). */
  resolvedBy: string;
  /** Free-text notes about the resolution. */
  notes: string;
}

/** Filter parameters for querying conflict history. */
export interface ConflictHistoryFilter {
  /** Start of date range (inclusive ISO string). */
  dateFrom?: string;
  /** End of date range (inclusive ISO string). */
  dateTo?: string;
  /** Filter by resource type. */
  resourceType?: ResourceConflictType;
  /** Filter by project ID (matches against competingProjects). */
  projectId?: string;
  /** Filter by resolution outcome. */
  resolutionOutcome?: ConflictResolutionOutcome;
}

/** Aggregated pattern statistics from conflict history. */
export interface ConflictPatternSummary {
  /** Total number of resolved conflicts. */
  totalResolved: number;
  /** Count of resolutions by resource type. */
  byResourceType: Partial<Record<ResourceConflictType, number>>;
  /** Count of resolutions by outcome. */
  byOutcome: Partial<Record<ConflictResolutionOutcome, number>>;
  /** Count of resolutions by strategy. */
  byStrategy: Partial<Record<ResourceConflictResolutionStrategy | "manual" | "none", number>>;
  /** The resource identifier with the most conflicts. Null if no entries. */
  mostConflictedResource: string | null;
  /** Average resolution time in ms (resolvedAt - conflict.detectedAt). 0 if no entries. */
  avgResolutionTimeMs: number;
  /** Resources with more than 1 conflict, sorted by count descending. */
  recurringConflicts: Array<{ resourceIdentifier: string; count: number }>;
}

// =============================================================================
// CONSTANTS
// =============================================================================

/** Default filename for the JSONL resolution history file. */
export const CONFLICT_HISTORY_FILENAME = "conflict-history.jsonl";

/** Valid resolution outcomes for JSONL validation. */
const VALID_OUTCOMES: ReadonlySet<string> = new Set<string>([
  "resolved",
  "dismissed",
  "escalated",
  "auto-resolved",
]);

// =============================================================================
// ID GENERATION
// =============================================================================

/**
 * Generate a unique history entry ID.
 * Format: `history-<timestamp-base36>-<random-hex>` (follows generateConflictId pattern).
 */
export function generateHistoryId(): string {
  const timestamp = Date.now().toString(36);
  const random = randomBytes(4).toString("hex").padStart(8, "0");
  return `history-${timestamp}-${random}`;
}

// =============================================================================
// JSONL PERSISTENCE
// =============================================================================

/**
 * Append a conflict resolution event to the JSONL history file.
 * Each line is a complete ConflictHistoryEntry JSON object.
 *
 * @param configPath - Path to the orchestrator config file (history file lives alongside)
 * @param entry - The history entry to persist
 */
export function appendConflictResolution(configPath: string, entry: ConflictHistoryEntry): void {
  const dir = dirname(configPath);
  const historyPath = join(dir, CONFLICT_HISTORY_FILENAME);
  appendFileSync(historyPath, JSON.stringify(entry) + "\n");
}

/**
 * Read and parse all entries from the JSONL conflict history file.
 * Malformed lines are silently skipped.
 *
 * @param configPath - Path to the orchestrator config file
 * @returns Array of valid history entries, oldest first
 */
export function readConflictHistory(configPath: string): ConflictHistoryEntry[] {
  const dir = dirname(configPath);
  const historyPath = join(dir, CONFLICT_HISTORY_FILENAME);

  if (!existsSync(historyPath)) return [];

  try {
    const content = readFileSync(historyPath, "utf-8");
    const lines = content.split("\n").filter((line) => line.trim().length > 0);

    const entries: ConflictHistoryEntry[] = [];
    for (const line of lines) {
      try {
        const parsed = JSON.parse(line);
        if (isValidHistoryEntry(parsed)) {
          entries.push(parsed);
        }
      } catch {
        // Skip malformed lines
      }
    }

    return entries;
  } catch {
    return [];
  }
}

/**
 * Type guard for validating a parsed JSONL entry.
 */
function isValidHistoryEntry(value: unknown): value is ConflictHistoryEntry {
  if (typeof value !== "object" || value === null) return false;
  const obj = value as Record<string, unknown>;

  return (
    typeof obj.id === "string" &&
    typeof obj.resolvedAt === "string" &&
    typeof obj.resolutionStrategy === "string" &&
    typeof obj.resolutionOutcome === "string" &&
    VALID_OUTCOMES.has(obj.resolutionOutcome as string) &&
    typeof obj.resolvedBy === "string" &&
    typeof obj.notes === "string" &&
    typeof obj.conflict === "object" &&
    obj.conflict !== null
  );
}

// =============================================================================
// PURE QUERY FUNCTIONS (no I/O — testable)
// =============================================================================

/**
 * Filter conflict history entries by the given criteria.
 * All filters combine with AND logic. Empty filter returns all entries.
 *
 * @param entries - History entries to filter
 * @param filter - Filter criteria
 * @returns Filtered entries
 */
export function filterConflictHistory(
  entries: ConflictHistoryEntry[],
  filter: ConflictHistoryFilter,
): ConflictHistoryEntry[] {
  return entries.filter((entry) => {
    // Date range filter
    if (filter.dateFrom && entry.resolvedAt < filter.dateFrom) return false;
    if (filter.dateTo && entry.resolvedAt > filter.dateTo) return false;

    // Resource type filter
    if (filter.resourceType && entry.conflict.resourceType !== filter.resourceType) return false;

    // Project filter — check if project is in competingProjects
    if (filter.projectId && !entry.conflict.competingProjects.includes(filter.projectId))
      return false;

    // Outcome filter
    if (filter.resolutionOutcome && entry.resolutionOutcome !== filter.resolutionOutcome)
      return false;

    return true;
  });
}

/**
 * Serialize filtered history entries to a JSON export string.
 *
 * @param entries - Filtered history entries
 * @returns JSON string suitable for file download
 */
export function exportConflictHistory(entries: ConflictHistoryEntry[]): string {
  return JSON.stringify(
    {
      exportedAt: new Date().toISOString(),
      entryCount: entries.length,
      entries,
    },
    null,
    2,
  );
}

/**
 * Compute aggregated pattern statistics from conflict history entries.
 *
 * @param entries - History entries to analyze
 * @returns Pattern summary with counts, averages, and recurring conflicts
 */
export function computeConflictPatterns(entries: ConflictHistoryEntry[]): ConflictPatternSummary {
  if (entries.length === 0) {
    return {
      totalResolved: 0,
      byResourceType: {},
      byOutcome: {},
      byStrategy: {},
      mostConflictedResource: null,
      avgResolutionTimeMs: 0,
      recurringConflicts: [],
    };
  }

  // Count by dimensions
  const byResourceType: Partial<Record<ResourceConflictType, number>> = {};
  const byOutcome: Partial<Record<ConflictResolutionOutcome, number>> = {};
  const byStrategy: Partial<
    Record<ResourceConflictResolutionStrategy | "manual" | "none", number>
  > = {};
  const resourceCounts = new Map<string, number>();
  let totalResolutionTimeMs = 0;
  let validDateCount = 0;

  for (const entry of entries) {
    // Resource type
    const rt = entry.conflict.resourceType;
    byResourceType[rt] = (byResourceType[rt] ?? 0) + 1;

    // Outcome
    const outcome = entry.resolutionOutcome;
    byOutcome[outcome] = (byOutcome[outcome] ?? 0) + 1;

    // Strategy
    const strategy = entry.resolutionStrategy;
    byStrategy[strategy] = (byStrategy[strategy] ?? 0) + 1;

    // Resource identifier counts
    const ri = entry.conflict.resourceIdentifier;
    resourceCounts.set(ri, (resourceCounts.get(ri) ?? 0) + 1);

    // Resolution time
    const detectedAt = new Date(entry.conflict.detectedAt).getTime();
    const resolvedAt = new Date(entry.resolvedAt).getTime();
    if (!isNaN(detectedAt) && !isNaN(resolvedAt)) {
      totalResolutionTimeMs += resolvedAt - detectedAt;
      validDateCount++;
    }
  }

  // Most conflicted resource
  let mostConflictedResource: string | null = null;
  let maxCount = 0;
  for (const [resource, count] of resourceCounts) {
    if (count > maxCount) {
      maxCount = count;
      mostConflictedResource = resource;
    }
  }

  // Recurring conflicts (>1 occurrence)
  const recurringConflicts: Array<{ resourceIdentifier: string; count: number }> = [];
  for (const [resource, count] of resourceCounts) {
    if (count > 1) {
      recurringConflicts.push({ resourceIdentifier: resource, count });
    }
  }
  recurringConflicts.sort((a, b) => b.count - a.count);

  return {
    totalResolved: entries.length,
    byResourceType,
    byOutcome,
    byStrategy,
    mostConflictedResource,
    avgResolutionTimeMs:
      validDateCount > 0 ? Math.round(totalResolutionTimeMs / validDateCount) : 0,
    recurringConflicts,
  };
}

/**
 * Create a history entry from a resolved conflict.
 * Convenience function that generates an ID and structures the entry.
 *
 * @param conflict - The resolved conflict
 * @param resolution - Resolution details
 * @returns A complete ConflictHistoryEntry
 */
export function createHistoryEntry(
  conflict: ResourceConflict,
  resolution: {
    strategy: ResourceConflictResolutionStrategy | "manual" | "none";
    outcome: ConflictResolutionOutcome;
    resolvedBy: string;
    notes?: string;
  },
): ConflictHistoryEntry {
  return {
    id: generateHistoryId(),
    conflict,
    resolvedAt: new Date().toISOString(),
    resolutionStrategy: resolution.strategy,
    resolutionOutcome: resolution.outcome,
    resolvedBy: resolution.resolvedBy,
    notes: resolution.notes ?? "",
  };
}
