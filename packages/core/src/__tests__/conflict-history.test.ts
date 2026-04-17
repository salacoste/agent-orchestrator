/**
 * Conflict History Tests (Epic 52, Story 52.5)
 *
 * Tests for conflict history types, JSONL store, query, filter, export, pattern analysis.
 */

import { describe, expect, it, beforeEach, afterEach } from "vitest";
import {
  generateHistoryId,
  filterConflictHistory,
  exportConflictHistory,
  computeConflictPatterns,
  createHistoryEntry,
  readConflictHistory,
  appendConflictResolution,
  CONFLICT_HISTORY_FILENAME,
  type ConflictHistoryEntry,
} from "../conflict-history.js";
import type { ResourceConflict } from "../resource-conflict.js";
import { writeFileSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

// =============================================================================
// TEST FIXTURES
// =============================================================================

function makeConflict(overrides: Partial<ResourceConflict> = {}): ResourceConflict {
  return {
    id: "conflict-test-001",
    resourceType: "repository",
    resourceIdentifier: "org/shared-repo",
    competingProjects: ["project-a", "project-b"],
    severity: "high",
    detectedAt: "2026-04-01T12:00:00.000Z",
    metadata: {},
    ...overrides,
  };
}

function makeHistoryEntry(overrides: Partial<ConflictHistoryEntry> = {}): ConflictHistoryEntry {
  return {
    id: "history-test-001",
    conflict: makeConflict(),
    resolvedAt: "2026-04-01T14:00:00.000Z",
    resolutionStrategy: "sequential-scheduling",
    resolutionOutcome: "resolved",
    resolvedBy: "user@example.com",
    notes: "Queued project B after project A",
    ...overrides,
  };
}

const sampleEntries: ConflictHistoryEntry[] = [
  makeHistoryEntry({
    id: "history-001",
    conflict: makeConflict({
      resourceType: "repository",
      resourceIdentifier: "org/shared-repo",
      detectedAt: "2026-03-28T10:00:00.000Z",
    }),
    resolvedAt: "2026-03-28T12:00:00.000Z",
    resolutionStrategy: "sequential-scheduling",
    resolutionOutcome: "resolved",
  }),
  makeHistoryEntry({
    id: "history-002",
    conflict: makeConflict({
      resourceType: "agent",
      resourceIdentifier: "shared-pool",
      competingProjects: ["project-a", "project-c"],
      detectedAt: "2026-03-29T08:00:00.000Z",
    }),
    resolvedAt: "2026-03-29T10:30:00.000Z",
    resolutionStrategy: "agent-reassignment",
    resolutionOutcome: "auto-resolved",
  }),
  makeHistoryEntry({
    id: "history-003",
    conflict: makeConflict({
      resourceType: "file-path",
      resourceIdentifier: "/worktrees/repo-x",
      competingProjects: ["project-b", "project-d"],
      detectedAt: "2026-03-30T14:00:00.000Z",
    }),
    resolvedAt: "2026-03-30T14:30:00.000Z",
    resolutionStrategy: "resource-isolation",
    resolutionOutcome: "dismissed",
  }),
  makeHistoryEntry({
    id: "history-004",
    conflict: makeConflict({
      resourceType: "repository",
      resourceIdentifier: "org/shared-repo",
      competingProjects: ["project-a", "project-b"],
      detectedAt: "2026-04-01T09:00:00.000Z",
    }),
    resolvedAt: "2026-04-01T11:00:00.000Z",
    resolutionStrategy: "stagger-schedules",
    resolutionOutcome: "resolved",
  }),
  makeHistoryEntry({
    id: "history-005",
    conflict: makeConflict({
      resourceType: "agent",
      resourceIdentifier: "shared-pool",
      competingProjects: ["project-c", "project-d"],
      detectedAt: "2026-04-01T12:00:00.000Z",
    }),
    resolvedAt: "2026-04-01T15:00:00.000Z",
    resolutionStrategy: "increase-capacity",
    resolutionOutcome: "escalated",
  }),
];

// =============================================================================
// ID GENERATION
// =============================================================================

describe("generateHistoryId", () => {
  it("produces ID with correct prefix", () => {
    const id = generateHistoryId();
    expect(id).toMatch(/^history-/);
  });

  it("produces unique IDs on consecutive calls", () => {
    const ids = new Set(Array.from({ length: 10 }, () => generateHistoryId()));
    expect(ids.size).toBe(10);
  });
});

// =============================================================================
// FILTER CONFLICT HISTORY
// =============================================================================

describe("filterConflictHistory", () => {
  it("returns all entries with empty filter", () => {
    const result = filterConflictHistory(sampleEntries, {});
    expect(result).toHaveLength(sampleEntries.length);
  });

  it("filters by dateFrom", () => {
    const result = filterConflictHistory(sampleEntries, { dateFrom: "2026-03-30T00:00:00.000Z" });
    expect(result).toHaveLength(3); // entries 003, 004, 005
    expect(result.every((e) => e.resolvedAt >= "2026-03-30T00:00:00.000Z")).toBe(true);
  });

  it("filters by dateTo", () => {
    const result = filterConflictHistory(sampleEntries, { dateTo: "2026-03-29T23:59:59.999Z" });
    expect(result).toHaveLength(2); // entries 001, 002
  });

  it("filters by date range", () => {
    const result = filterConflictHistory(sampleEntries, {
      dateFrom: "2026-03-29T00:00:00.000Z",
      dateTo: "2026-03-30T23:59:59.999Z",
    });
    expect(result).toHaveLength(2); // entries 002, 003
  });

  it("filters by resource type", () => {
    const result = filterConflictHistory(sampleEntries, { resourceType: "agent" });
    expect(result).toHaveLength(2); // entries 002, 005
    expect(result.every((e) => e.conflict.resourceType === "agent")).toBe(true);
  });

  it("filters by project ID", () => {
    const result = filterConflictHistory(sampleEntries, { projectId: "project-c" });
    expect(result).toHaveLength(2); // entries 002, 005
  });

  it("filters by resolution outcome", () => {
    const result = filterConflictHistory(sampleEntries, { resolutionOutcome: "resolved" });
    expect(result).toHaveLength(2); // entries 001, 004
    expect(result.every((e) => e.resolutionOutcome === "resolved")).toBe(true);
  });

  it("combines multiple filters with AND logic", () => {
    const result = filterConflictHistory(sampleEntries, {
      resourceType: "repository",
      resolutionOutcome: "resolved",
    });
    expect(result).toHaveLength(2); // entries 001, 004
  });

  it("returns empty for non-matching filter", () => {
    const result = filterConflictHistory(sampleEntries, {
      resourceType: "external-service",
    });
    expect(result).toHaveLength(0);
  });

  it("handles empty entries array", () => {
    const result = filterConflictHistory([], { resourceType: "repository" });
    expect(result).toHaveLength(0);
  });
});

// =============================================================================
// EXPORT CONFLICT HISTORY
// =============================================================================

describe("exportConflictHistory", () => {
  it("produces valid JSON with metadata", () => {
    const json = exportConflictHistory(sampleEntries);
    const parsed = JSON.parse(json);

    expect(parsed.exportedAt).toBeTruthy();
    expect(parsed.entryCount).toBe(sampleEntries.length);
    expect(parsed.entries).toHaveLength(sampleEntries.length);
  });

  it("includes correct entries", () => {
    const json = exportConflictHistory(sampleEntries.slice(0, 2));
    const parsed = JSON.parse(json);

    expect(parsed.entryCount).toBe(2);
    expect(parsed.entries[0].id).toBe("history-001");
    expect(parsed.entries[1].id).toBe("history-002");
  });

  it("handles empty array", () => {
    const json = exportConflictHistory([]);
    const parsed = JSON.parse(json);

    expect(parsed.entryCount).toBe(0);
    expect(parsed.entries).toEqual([]);
  });
});

// =============================================================================
// COMPUTE CONFLICT PATTERNS
// =============================================================================

describe("computeConflictPatterns", () => {
  it("returns zero summary for empty entries", () => {
    const summary = computeConflictPatterns([]);
    expect(summary.totalResolved).toBe(0);
    expect(summary.byResourceType).toEqual({});
    expect(summary.byOutcome).toEqual({});
    expect(summary.mostConflictedResource).toBeNull();
    expect(summary.avgResolutionTimeMs).toBe(0);
    expect(summary.recurringConflicts).toEqual([]);
  });

  it("computes total resolved count", () => {
    const summary = computeConflictPatterns(sampleEntries);
    expect(summary.totalResolved).toBe(5);
  });

  it("computes counts by resource type", () => {
    const summary = computeConflictPatterns(sampleEntries);
    expect(summary.byResourceType.repository).toBe(2);
    expect(summary.byResourceType.agent).toBe(2);
    expect(summary.byResourceType["file-path"]).toBe(1);
  });

  it("computes counts by outcome", () => {
    const summary = computeConflictPatterns(sampleEntries);
    expect(summary.byOutcome.resolved).toBe(2);
    expect(summary.byOutcome["auto-resolved"]).toBe(1);
    expect(summary.byOutcome.dismissed).toBe(1);
    expect(summary.byOutcome.escalated).toBe(1);
  });

  it("computes counts by strategy", () => {
    const summary = computeConflictPatterns(sampleEntries);
    expect(summary.byStrategy["sequential-scheduling"]).toBe(1);
    expect(summary.byStrategy["agent-reassignment"]).toBe(1);
    expect(summary.byStrategy["resource-isolation"]).toBe(1);
    expect(summary.byStrategy["stagger-schedules"]).toBe(1);
    expect(summary.byStrategy["increase-capacity"]).toBe(1);
  });

  it("identifies most conflicted resource", () => {
    const summary = computeConflictPatterns(sampleEntries);
    // "org/shared-repo" and "shared-pool" both appear twice
    // First encountered wins on tie
    expect(summary.mostConflictedResource).toBeTruthy();
    expect(["org/shared-repo", "shared-pool"]).toContain(summary.mostConflictedResource);
  });

  it("computes average resolution time", () => {
    const summary = computeConflictPatterns(sampleEntries);
    // All entries have valid detectedAt → resolvedAt diffs
    expect(summary.avgResolutionTimeMs).toBeGreaterThan(0);
  });

  it("identifies recurring conflicts", () => {
    const summary = computeConflictPatterns(sampleEntries);
    expect(summary.recurringConflicts.length).toBeGreaterThan(0);
    // Both org/shared-repo and shared-pool appear 2 times each
    const resources = summary.recurringConflicts.map((r) => r.resourceIdentifier);
    expect(resources).toContain("org/shared-repo");
    expect(resources).toContain("shared-pool");
    // Sorted by count descending
    for (let i = 1; i < summary.recurringConflicts.length; i++) {
      expect(summary.recurringConflicts[i - 1].count).toBeGreaterThanOrEqual(
        summary.recurringConflicts[i].count,
      );
    }
  });
});

// =============================================================================
// CREATE HISTORY ENTRY
// =============================================================================

describe("createHistoryEntry", () => {
  it("creates entry with generated ID and current timestamp", () => {
    const conflict = makeConflict();
    const before = new Date().toISOString();
    const entry = createHistoryEntry(conflict, {
      strategy: "sequential-scheduling",
      outcome: "resolved",
      resolvedBy: "test-user",
    });
    const after = new Date().toISOString();

    expect(entry.id).toMatch(/^history-/);
    expect(entry.resolvedAt >= before).toBe(true);
    expect(entry.resolvedAt <= after).toBe(true);
    expect(entry.conflict).toBe(conflict);
    expect(entry.resolutionStrategy).toBe("sequential-scheduling");
    expect(entry.resolutionOutcome).toBe("resolved");
    expect(entry.resolvedBy).toBe("test-user");
    expect(entry.notes).toBe("");
  });

  it("includes notes when provided", () => {
    const entry = createHistoryEntry(makeConflict(), {
      strategy: "manual",
      outcome: "dismissed",
      resolvedBy: "admin",
      notes: "False positive",
    });
    expect(entry.notes).toBe("False positive");
  });
});

// =============================================================================
// JSONL PERSISTENCE
// =============================================================================

describe("JSONL persistence", () => {
  let tempDir: string;
  let configPath: string;

  beforeEach(() => {
    tempDir = join(tmpdir(), `conflict-history-test-${Date.now()}`);
    mkdirSync(tempDir, { recursive: true });
    configPath = join(tempDir, "test-config.yaml");
    writeFileSync(configPath, "test: true\n");
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("appends and reads history entries", () => {
    const entry = makeHistoryEntry();

    appendConflictResolution(configPath, entry);
    const loaded = readConflictHistory(configPath);

    expect(loaded).toHaveLength(1);
    expect(loaded[0].id).toBe(entry.id);
    expect(loaded[0].resolutionOutcome).toBe(entry.resolutionOutcome);
  });

  it("reads multiple entries in order", () => {
    const entry1 = makeHistoryEntry({ id: "history-a" });
    const entry2 = makeHistoryEntry({ id: "history-b" });

    appendConflictResolution(configPath, entry1);
    appendConflictResolution(configPath, entry2);

    const loaded = readConflictHistory(configPath);
    expect(loaded).toHaveLength(2);
    expect(loaded[0].id).toBe("history-a");
    expect(loaded[1].id).toBe("history-b");
  });

  it("returns empty array when history file does not exist", () => {
    const loaded = readConflictHistory(configPath);
    expect(loaded).toEqual([]);
  });

  it("skips malformed JSONL lines", () => {
    const historyPath = join(tempDir, CONFLICT_HISTORY_FILENAME);
    // Write a mix of valid and invalid lines
    const validEntry = makeHistoryEntry({ id: "history-valid" });
    const lines = ["not-json\n", JSON.stringify(validEntry) + "\n", "{broken json\n", ""];
    writeFileSync(historyPath, lines.join(""));

    const loaded = readConflictHistory(configPath);
    expect(loaded).toHaveLength(1);
    expect(loaded[0].id).toBe("history-valid");
  });

  it("validates required fields on load", () => {
    const historyPath = join(tempDir, CONFLICT_HISTORY_FILENAME);
    // Entry missing required fields
    const invalidEntry = { id: "bad", resolvedAt: "2026-01-01" };
    writeFileSync(historyPath, JSON.stringify(invalidEntry) + "\n");

    const loaded = readConflictHistory(configPath);
    expect(loaded).toHaveLength(0);
  });
});

// =============================================================================
// INTEGRATION: FILTER + PATTERNS PIPELINE
// =============================================================================

describe("integration: filter → patterns pipeline", () => {
  it("computes patterns on filtered subset", () => {
    const filtered = filterConflictHistory(sampleEntries, { resourceType: "agent" });
    const patterns = computeConflictPatterns(filtered);

    expect(patterns.totalResolved).toBe(2);
    expect(patterns.byResourceType.agent).toBe(2);
    expect(patterns.byResourceType.repository).toBeUndefined();
  });

  it("export respects filters", () => {
    const filtered = filterConflictHistory(sampleEntries, { resolutionOutcome: "resolved" });
    const json = exportConflictHistory(filtered);
    const parsed = JSON.parse(json);

    expect(parsed.entryCount).toBe(2);
    expect(
      parsed.entries.every((e: ConflictHistoryEntry) => e.resolutionOutcome === "resolved"),
    ).toBe(true);
  });
});
