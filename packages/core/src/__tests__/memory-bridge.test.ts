/**
 * Memory Bridge — Cross-session knowledge persistence tests (Epic 61, Story 61-1).
 *
 * Covers: extraction, deduplication, JSONL persistence, loading with dedup-at-read,
 * config gating, and non-fatal error handling.
 */

import { describe, expect, it } from "vitest";
import { mkdir, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";
import type { CrossSessionMemoryEntry, ProjectMemoryEntry } from "../types.js";
import {
  computeContentHash,
  extractMemoryFromWorkspace,
  deduplicateEntries,
  appendEntries,
  loadAccumulatedMemory,
  extractAndBridgeMemory,
  buildCrossSessionMemoryLayer,
} from "../memory-bridge.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function makeTempDir(): Promise<string> {
  const dir = join(tmpdir(), `memory-bridge-test-${randomUUID()}`);
  await mkdir(dir, { recursive: true });
  return dir;
}

function makeEntry(overrides: Partial<ProjectMemoryEntry> = {}): ProjectMemoryEntry {
  return {
    id: randomUUID(),
    type: "convention",
    content: "Use kebab-case for files",
    ...overrides,
  };
}

function makeBridgeEntry(
  overrides: Partial<CrossSessionMemoryEntry> = {},
): CrossSessionMemoryEntry {
  return {
    id: randomUUID(),
    type: "convention",
    content: "Use kebab-case for files",
    contentHash: computeContentHash("convention", "Use kebab-case for files"),
    sourceSessionIds: ["session-1"],
    firstSeenAt: "2026-04-17T00:00:00Z",
    lastSeenAt: "2026-04-17T00:00:00Z",
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// computeContentHash
// ---------------------------------------------------------------------------

describe("computeContentHash", () => {
  it("produces deterministic MD5 hex hash", () => {
    const a = computeContentHash("convention", "Use kebab-case");
    const b = computeContentHash("convention", "Use kebab-case");
    expect(a).toBe(b);
    expect(a).toHaveLength(32); // MD5 hex length
  });

  it("differs when type or content differs", () => {
    const a = computeContentHash("convention", "Use kebab-case");
    const b = computeContentHash("decision", "Use kebab-case");
    const c = computeContentHash("convention", "Use camelCase");
    expect(a).not.toBe(b);
    expect(a).not.toBe(c);
  });
});

// ---------------------------------------------------------------------------
// extractMemoryFromWorkspace
// ---------------------------------------------------------------------------

describe("extractMemoryFromWorkspace", () => {
  it("extracts entries from valid workspace memory", async () => {
    const dir = await makeTempDir();
    const omcDir = join(dir, ".omc");
    await mkdir(omcDir, { recursive: true });
    await writeFile(
      join(omcDir, "project-memory.json"),
      JSON.stringify({
        entries: [makeEntry(), makeEntry({ type: "decision", content: "Use vitest" })],
      }),
    );

    const entries = await extractMemoryFromWorkspace(dir);
    expect(entries).toHaveLength(2);
    expect(entries[0].type).toBe("convention");
    expect(entries[1].type).toBe("decision");

    await rm(dir, { recursive: true, force: true });
  });

  it("returns empty for missing workspace", async () => {
    const entries = await extractMemoryFromWorkspace("/nonexistent/path");
    expect(entries).toEqual([]);
  });

  it("returns empty for workspace without .omc dir", async () => {
    const dir = await makeTempDir();
    const entries = await extractMemoryFromWorkspace(dir);
    expect(entries).toEqual([]);
    await rm(dir, { recursive: true, force: true });
  });

  it("handles legacy format memory", async () => {
    const dir = await makeTempDir();
    const omcDir = join(dir, ".omc");
    await mkdir(omcDir, { recursive: true });
    // Legacy format: flat key-value JSON
    await writeFile(
      join(omcDir, "project-memory.json"),
      JSON.stringify({ "naming convention": "kebab-case", "test framework": "vitest" }),
    );

    const entries = await extractMemoryFromWorkspace(dir);
    expect(entries.length).toBeGreaterThanOrEqual(2);
    // Legacy entries should be wrapped with type "learning"
    for (const entry of entries) {
      expect(entry.type).toBe("learning");
      expect(entry.content).toBeTruthy();
    }

    await rm(dir, { recursive: true, force: true });
  });
});

// ---------------------------------------------------------------------------
// deduplicateEntries
// ---------------------------------------------------------------------------

describe("deduplicateEntries", () => {
  it("merges identical content from different sessions", () => {
    const existing: CrossSessionMemoryEntry[] = [];
    const incoming = [makeEntry()];
    const result = deduplicateEntries(existing, incoming, "session-A");
    expect(result).toHaveLength(1);
    expect(result[0].sourceSessionIds).toContain("session-A");
  });

  it("merges same content from different sessions into one entry", () => {
    const existing = [makeBridgeEntry({ sourceSessionIds: ["session-A"] })];
    const incoming = [makeEntry()]; // same type+content
    const result = deduplicateEntries(existing, incoming, "session-B");
    expect(result).toHaveLength(1);
    expect(result[0].sourceSessionIds).toContain("session-A");
    expect(result[0].sourceSessionIds).toContain("session-B");
  });

  it("keeps different content as separate entries", () => {
    const existing = [makeBridgeEntry()];
    const incoming = [makeEntry({ type: "decision", content: "Use vitest" })];
    const result = deduplicateEntries(existing, incoming, "session-B");
    expect(result).toHaveLength(2);
  });

  it("does not duplicate source session ID", () => {
    const existing = [makeBridgeEntry({ sourceSessionIds: ["session-A"] })];
    const incoming = [makeEntry()]; // same content
    const result = deduplicateEntries(existing, incoming, "session-A");
    expect(result).toHaveLength(1);
    expect(result[0].sourceSessionIds).toEqual(["session-A"]);
  });

  it("sets firstSeenAt and lastSeenAt on new entries", () => {
    const now = "2026-04-17T12:00:00Z";
    const result = deduplicateEntries([], [makeEntry()], "session-A", now);
    expect(result[0].firstSeenAt).toBe(now);
    expect(result[0].lastSeenAt).toBe(now);
  });

  it("updates lastSeenAt on merge", () => {
    const existing = [makeBridgeEntry({ firstSeenAt: "2026-01-01T00:00:00Z" })];
    const incoming = [makeEntry()];
    const now = "2026-04-17T12:00:00Z";
    const result = deduplicateEntries(existing, incoming, "session-B", now);
    expect(result[0].firstSeenAt).toBe("2026-01-01T00:00:00Z");
    expect(result[0].lastSeenAt).toBe(now);
  });

  it("preserves richer fields from incoming", () => {
    const existing = [makeBridgeEntry({ source: undefined, timestamp: undefined })];
    const incoming = [makeEntry({ source: "compact-hook", timestamp: "2026-04-17T00:00:00Z" })];
    const result = deduplicateEntries(existing, incoming, "session-B");
    expect(result[0].source).toBe("compact-hook");
    expect(result[0].timestamp).toBe("2026-04-17T00:00:00Z");
  });
});

// ---------------------------------------------------------------------------
// JSONL persistence and loading (append-only)
// ---------------------------------------------------------------------------

describe("appendEntries + loadAccumulatedMemory", () => {
  it("appends and loads entries round-trip", async () => {
    const dir = await makeTempDir();
    const entries = [
      makeBridgeEntry(),
      makeBridgeEntry({ type: "decision", content: "Use vitest" }),
    ];
    entries[1].contentHash = computeContentHash(entries[1].type, entries[1].content);

    await appendEntries(dir, entries);
    const loaded = await loadAccumulatedMemory(dir);

    expect(loaded).toHaveLength(2);
    expect(loaded[0].contentHash).toBe(entries[0].contentHash);
    expect(loaded[1].type).toBe("decision");

    await rm(dir, { recursive: true, force: true });
  });

  it("returns empty when no JSONL file exists", async () => {
    const dir = await makeTempDir();
    const loaded = await loadAccumulatedMemory(dir);
    expect(loaded).toEqual([]);
    await rm(dir, { recursive: true, force: true });
  });

  it("tolerates malformed JSONL lines", async () => {
    const dir = await makeTempDir();
    const omcDir = join(dir, ".omc");
    await mkdir(omcDir, { recursive: true });
    const jsonlPath = join(omcDir, "cross-session-memory.jsonl");

    // Mix valid and invalid lines
    const validEntry = makeBridgeEntry();
    const lines = [
      JSON.stringify(validEntry),
      "not valid json{{{",
      "",
      JSON.stringify({ missing: "required fields" }),
    ].join("\n");
    await writeFile(jsonlPath, lines);

    const loaded = await loadAccumulatedMemory(dir);
    expect(loaded).toHaveLength(1);
    expect(loaded[0].contentHash).toBe(validEntry.contentHash);

    await rm(dir, { recursive: true, force: true });
  });

  it("merges duplicate content hashes at load time", async () => {
    const dir = await makeTempDir();

    // Append same knowledge from two different sessions
    const hash = computeContentHash("convention", "Use kebab-case");
    await appendEntries(dir, [
      makeBridgeEntry({
        contentHash: hash,
        content: "Use kebab-case",
        sourceSessionIds: ["session-A"],
      }),
    ]);
    await appendEntries(dir, [
      makeBridgeEntry({
        contentHash: hash,
        content: "Use kebab-case",
        sourceSessionIds: ["session-B"],
      }),
    ]);

    const loaded = await loadAccumulatedMemory(dir);
    // Should merge into one entry with both source session IDs
    expect(loaded).toHaveLength(1);
    expect(loaded[0].sourceSessionIds).toContain("session-A");
    expect(loaded[0].sourceSessionIds).toContain("session-B");

    await rm(dir, { recursive: true, force: true });
  });

  it("rotates file when exceeding max size", async () => {
    const dir = await makeTempDir();
    const omcDir = join(dir, ".omc");
    await mkdir(omcDir, { recursive: true });
    const jsonlPath = join(omcDir, "cross-session-memory.jsonl");

    // Write a file that exceeds the 10MB rotation threshold
    const bigEntry = makeBridgeEntry({ content: "x".repeat(1024) });
    const bigLine = JSON.stringify(bigEntry) + "\n";
    const lineCount = Math.ceil((10 * 1024 * 1024) / bigLine.length) + 100;
    const bigContent = bigLine.repeat(lineCount);
    await writeFile(jsonlPath, bigContent);

    // Append new entries — should trigger rotation
    await appendEntries(dir, [makeBridgeEntry({ content: "after-rotation" })]);

    // Should have loaded successfully from the new (post-rotation) file
    const loaded = await loadAccumulatedMemory(dir);
    expect(loaded.length).toBeGreaterThanOrEqual(1);
    expect(loaded.some((e) => e.content === "after-rotation")).toBe(true);

    await rm(dir, { recursive: true, force: true });
  });

  it("appends to existing file without rewriting", async () => {
    const dir = await makeTempDir();

    // First append — different content to avoid dedup at load time
    const first = makeBridgeEntry({
      content: "first entry",
      contentHash: computeContentHash("convention", "first entry"),
    });
    await appendEntries(dir, [first]);
    // Second append
    const second = makeBridgeEntry({
      content: "second entry",
      contentHash: computeContentHash("convention", "second entry"),
    });
    await appendEntries(dir, [second]);

    const loaded = await loadAccumulatedMemory(dir);
    expect(loaded).toHaveLength(2);
    expect(loaded.some((e) => e.content === "first entry")).toBe(true);
    expect(loaded.some((e) => e.content === "second entry")).toBe(true);

    await rm(dir, { recursive: true, force: true });
  });
});

// ---------------------------------------------------------------------------
// extractAndBridgeMemory (high-level)
// ---------------------------------------------------------------------------

describe("extractAndBridgeMemory", () => {
  it("extracts and persists memory from workspace", async () => {
    const projectDir = await makeTempDir();
    const workspaceDir = await makeTempDir();

    // Write workspace memory
    const omcDir = join(workspaceDir, ".omc");
    await mkdir(omcDir, { recursive: true });
    await writeFile(
      join(omcDir, "project-memory.json"),
      JSON.stringify({ entries: [makeEntry()] }),
    );

    await extractAndBridgeMemory(projectDir, workspaceDir, "session-1");

    const loaded = await loadAccumulatedMemory(projectDir);
    expect(loaded).toHaveLength(1);
    expect(loaded[0].sourceSessionIds).toContain("session-1");

    await rm(projectDir, { recursive: true, force: true });
    await rm(workspaceDir, { recursive: true, force: true });
  });

  it("does nothing for workspace without memory", async () => {
    const projectDir = await makeTempDir();
    const workspaceDir = await makeTempDir(); // empty, no .omc

    await extractAndBridgeMemory(projectDir, workspaceDir, "session-1");

    const loaded = await loadAccumulatedMemory(projectDir);
    expect(loaded).toEqual([]);

    await rm(projectDir, { recursive: true, force: true });
    await rm(workspaceDir, { recursive: true, force: true });
  });

  it("never throws even on invalid paths", async () => {
    await expect(
      extractAndBridgeMemory("/nonexistent/project", "/nonexistent/workspace", "s1"),
    ).resolves.toBeUndefined();
  });

  it("merges duplicate knowledge across sessions at load time", async () => {
    const projectDir = await makeTempDir();
    const workspaceDir = await makeTempDir();

    // Write same convention to workspace
    const omcDir = join(workspaceDir, ".omc");
    await mkdir(omcDir, { recursive: true });
    await writeFile(
      join(omcDir, "project-memory.json"),
      JSON.stringify({ entries: [makeEntry()] }),
    );

    // Bridge twice with different session IDs
    await extractAndBridgeMemory(projectDir, workspaceDir, "session-A");
    await extractAndBridgeMemory(projectDir, workspaceDir, "session-B");

    const loaded = await loadAccumulatedMemory(projectDir);
    // Same content should be deduplicated at load time
    expect(loaded).toHaveLength(1);
    expect(loaded[0].sourceSessionIds).toContain("session-A");
    expect(loaded[0].sourceSessionIds).toContain("session-B");

    await rm(projectDir, { recursive: true, force: true });
    await rm(workspaceDir, { recursive: true, force: true });
  });
});

// ---------------------------------------------------------------------------
// buildCrossSessionMemoryLayer
// ---------------------------------------------------------------------------

describe("buildCrossSessionMemoryLayer", () => {
  it("returns formatted markdown with sections by type", async () => {
    const dir = await makeTempDir();
    const entries = [
      makeBridgeEntry({ type: "convention", content: "Use kebab-case" }),
      makeBridgeEntry({ type: "decision", content: "Use vitest" }),
    ];
    entries[1].contentHash = computeContentHash(entries[1].type, entries[1].content);

    await appendEntries(dir, entries);
    const layer = await buildCrossSessionMemoryLayer(dir);

    expect(layer).toContain("## Cross-Session Knowledge");
    expect(layer).toContain("### Conventions");
    expect(layer).toContain("Use kebab-case");
    expect(layer).toContain("### Decisions");
    expect(layer).toContain("Use vitest");

    await rm(dir, { recursive: true, force: true });
  });

  it("returns empty string when no entries", async () => {
    const dir = await makeTempDir();
    const layer = await buildCrossSessionMemoryLayer(dir);
    expect(layer).toBe("");
    await rm(dir, { recursive: true, force: true });
  });

  it("includes session count per entry", async () => {
    const dir = await makeTempDir();
    const entry = makeBridgeEntry({
      sourceSessionIds: ["session-A", "session-B", "session-C"],
    });
    await appendEntries(dir, [entry]);
    const layer = await buildCrossSessionMemoryLayer(dir);
    expect(layer).toContain("from 3 session(s)");

    await rm(dir, { recursive: true, force: true });
  });

  it("never throws on errors", async () => {
    const layer = await buildCrossSessionMemoryLayer("/nonexistent/path");
    expect(layer).toBe("");
  });
});
