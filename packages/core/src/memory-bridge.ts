/**
 * Memory Bridge — Cross-session knowledge persistence (Epic 61, Story 61-1).
 *
 * Extracts typed knowledge entries from completed session workspaces,
 * deduplicates by content hash, persists to project-level JSONL,
 * and injects accumulated knowledge into new session prompts.
 *
 * Design principles:
 * - JSONL append-only (rotation at 10MB, same pattern as learning-store.ts)
 * - Content-hash dedup at load time (not write time) — prevents TOCTOU races
 * - Project-scoped (not global)
 * - Non-fatal everywhere (never breaks completion or spawn)
 * - Config-gated (project.learning.crossSessionMemory)
 */

import { appendFile, readFile, writeFile, mkdir, stat, rename, unlink } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { randomUUID, createHash } from "node:crypto";
import { readProjectMemory } from "./project-memory.js";
import type { CrossSessionMemoryEntry, ProjectMemoryEntry } from "./types.js";

// =============================================================================
// Constants
// =============================================================================

const BRIDGE_FILENAME = "cross-session-memory.jsonl";
const DEFAULT_MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

// =============================================================================
// Content Hash
// =============================================================================

/** Compute a content-hash dedup key: MD5(type + ":" + content). */
export function computeContentHash(type: string, content: string): string {
  return createHash("md5").update(`${type}:${content}`).digest("hex");
}

// =============================================================================
// Extract
// =============================================================================

/**
 * Extract project memory entries from a completed session's workspace.
 *
 * Reads `.omc/project-memory.json` via the existing `readProjectMemory()`.
 * Returns an empty array on any error (best-effort).
 */
export async function extractMemoryFromWorkspace(
  workspacePath: string,
): Promise<ProjectMemoryEntry[]> {
  try {
    const memory = await readProjectMemory(workspacePath);
    return memory.entries;
  } catch {
    return [];
  }
}

// =============================================================================
// Deduplicate
// =============================================================================

/**
 * Merge incoming entries with existing entries, deduplicating by content hash.
 *
 * - Identical content from different sessions → merged source references
 * - Different content → kept as separate entries
 */
export function deduplicateEntries(
  existing: CrossSessionMemoryEntry[],
  incoming: ProjectMemoryEntry[],
  sourceSessionId: string,
  now: string = new Date().toISOString(),
): CrossSessionMemoryEntry[] {
  const map = new Map<string, CrossSessionMemoryEntry>();

  // Index existing entries by content hash
  for (const entry of existing) {
    map.set(entry.contentHash, { ...entry });
  }

  // Merge incoming entries
  for (const entry of incoming) {
    const hash = computeContentHash(entry.type, entry.content);
    const existingEntry = map.get(hash);

    if (existingEntry) {
      // Merge source references
      if (!existingEntry.sourceSessionIds.includes(sourceSessionId)) {
        existingEntry.sourceSessionIds = [...existingEntry.sourceSessionIds, sourceSessionId];
      }
      existingEntry.lastSeenAt = now;
      // Preserve richer fields from incoming if existing is sparse
      if (!existingEntry.source && entry.source) {
        existingEntry.source = entry.source;
      }
      if (!existingEntry.timestamp && entry.timestamp) {
        existingEntry.timestamp = entry.timestamp;
      }
    } else {
      // New unique entry
      map.set(hash, {
        id: entry.id || randomUUID(),
        type: entry.type,
        content: entry.content,
        source: entry.source,
        timestamp: entry.timestamp,
        contentHash: hash,
        sourceSessionIds: [sourceSessionId],
        firstSeenAt: now,
        lastSeenAt: now,
      });
    }
  }

  return Array.from(map.values());
}

// =============================================================================
// Persist (JSONL — true append-only)
// =============================================================================

/**
 * Append new entries to project-level JSONL file.
 *
 * True append-only — never reads or rewrites existing content.
 * Deduplication happens at load time in `loadAccumulatedMemory()`.
 * Rotates the file if it exceeds the max size before appending.
 */
export async function appendEntries(
  projectDir: string,
  entries: CrossSessionMemoryEntry[],
): Promise<void> {
  const omcDir = join(projectDir, ".omc");
  const jsonlPath = join(omcDir, BRIDGE_FILENAME);

  await mkdir(omcDir, { recursive: true });

  // Check for rotation before appending
  if (existsSync(jsonlPath)) {
    try {
      const fileStat = await stat(jsonlPath);
      if (fileStat.size >= DEFAULT_MAX_FILE_SIZE) {
        const dateStamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
        const rotatedPath = join(omcDir, `cross-session-memory-${dateStamp}.jsonl`);
        await rename(jsonlPath, rotatedPath);
      }
    } catch {
      // Stat/rename failure — continue with append
    }
  }

  // Append each entry as its own JSONL line
  const lines = entries.map((e) => JSON.stringify(e)).join("\n") + "\n";
  await appendFile(jsonlPath, lines, "utf-8");
}

// =============================================================================
// Load (with dedup-at-read-time merge)
// =============================================================================

/**
 * Load accumulated cross-session memory from project-level JSONL.
 *
 * Reads all lines and merges duplicates by contentHash, combining
 * sourceSessionIds from multiple entries with the same hash.
 *
 * Tolerates malformed lines (skips them). Returns empty array on any error.
 */
export async function loadAccumulatedMemory(
  projectDir: string,
): Promise<CrossSessionMemoryEntry[]> {
  const jsonlPath = join(projectDir, ".omc", BRIDGE_FILENAME);

  if (!existsSync(jsonlPath)) {
    return [];
  }

  try {
    const raw = await readFile(jsonlPath, "utf-8");
    const rawEntries: CrossSessionMemoryEntry[] = [];

    for (const line of raw.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        const parsed = JSON.parse(trimmed) as CrossSessionMemoryEntry;
        if (parsed.contentHash && parsed.type && parsed.content) {
          rawEntries.push(parsed);
        }
      } catch {
        // Skip malformed lines
      }
    }

    // Dedup-at-read: merge entries with same contentHash
    const map = new Map<string, CrossSessionMemoryEntry>();
    for (const entry of rawEntries) {
      const existing = map.get(entry.contentHash);
      if (existing) {
        // Merge source session IDs
        const merged = new Set([...existing.sourceSessionIds, ...entry.sourceSessionIds]);
        existing.sourceSessionIds = Array.from(merged);
        // Keep latest timestamps
        if (entry.lastSeenAt > existing.lastSeenAt) {
          existing.lastSeenAt = entry.lastSeenAt;
        }
        if (entry.firstSeenAt < existing.firstSeenAt) {
          existing.firstSeenAt = entry.firstSeenAt;
        }
        // Preserve richer fields
        if (!existing.source && entry.source) {
          existing.source = entry.source;
        }
        if (!existing.timestamp && entry.timestamp) {
          existing.timestamp = entry.timestamp;
        }
      } else {
        map.set(entry.contentHash, { ...entry });
      }
    }

    return Array.from(map.values());
  } catch {
    return [];
  }
}

// =============================================================================
// Write Lock (prevents read-modify-write races on rewrite operations)
// =============================================================================

/**
 * Simple per-project lock manager to serialize rewrite operations.
 * Prevents TOCTOU races where concurrent removeEntry/updateEntry calls
 * could lose entries written between load and rewrite.
 */
const writeLockManager = {
  _locks: new Map<string, Promise<void>>(),

  async withLock(projectDir: string, fn: () => Promise<void>): Promise<void> {
    // Wait for any in-flight operation on this project
    const existing = this._locks.get(projectDir);
    const chain = existing ? existing.then(() => fn()) : fn();
    this._locks.set(projectDir, chain);
    try {
      await chain;
    } finally {
      // Only clear if we're the last operation
      if (this._locks.get(projectDir) === chain) {
        this._locks.delete(projectDir);
      }
    }
  },
};

// =============================================================================
// Write Operations (atomic rewrite for delete/update)
// =============================================================================

/**
 * Remove an entry from cross-session memory by contentHash.
 *
 * Loads all entries, filters out the one matching contentHash,
 * then atomically rewrites the JSONL file.
 *
 * No-op if contentHash not found or file doesn't exist.
 */
export async function removeEntry(projectDir: string, contentHash: string): Promise<void> {
  await writeLockManager.withLock(projectDir, async () => {
    const entries = await loadAccumulatedMemory(projectDir);
    const filtered = entries.filter((e) => e.contentHash !== contentHash);

    // No change needed — entry not found or already gone
    if (filtered.length === entries.length) return;

    await rewriteEntries(projectDir, filtered);
  });
}

/**
 * Update an entry's content in cross-session memory by contentHash.
 *
 * Loads all entries, updates the matching entry's content and lastSeenAt,
 * recomputes contentHash, then atomically rewrites the JSONL file.
 *
 * No-op if contentHash not found or file doesn't exist.
 */
export async function updateEntry(
  projectDir: string,
  contentHash: string,
  newContent: string,
): Promise<void> {
  await writeLockManager.withLock(projectDir, async () => {
    const entries = await loadAccumulatedMemory(projectDir);
    const updated = entries.map((entry) => {
      if (entry.contentHash !== contentHash) return entry;
      return {
        ...entry,
        content: newContent,
        contentHash: computeContentHash(entry.type, newContent),
        lastSeenAt: new Date().toISOString(),
      };
    });

    // No change needed — contentHash not found
    if (updated.every((e, i) => e.contentHash === entries[i]!.contentHash)) return;

    await rewriteEntries(projectDir, updated);
  });
}

/**
 * Atomically rewrite all entries to the JSONL file.
 *
 * Uses temp-file-then-rename pattern (same as writeProjectMemory).
 * Cleans up temp file on rename failure.
 */
async function rewriteEntries(
  projectDir: string,
  entries: CrossSessionMemoryEntry[],
): Promise<void> {
  const omcDir = join(projectDir, ".omc");
  const jsonlPath = join(omcDir, BRIDGE_FILENAME);

  await mkdir(omcDir, { recursive: true });

  const tmpPath = `${jsonlPath}.${process.pid}.${randomUUID()}`;
  const lines = entries.map((e) => JSON.stringify(e)).join("\n") + "\n";
  try {
    await writeFile(tmpPath, lines, "utf-8");
    await rename(tmpPath, jsonlPath);
  } catch (error) {
    // Clean up orphaned temp file on rename failure
    try {
      await unlink(tmpPath);
    } catch {
      // Temp file may already be gone
    }
    throw error;
  }
}

// =============================================================================
// High-level Bridge Operations
// =============================================================================

/**
 * Extract memory from a completed session's workspace and append to
 * project-level JSONL store.
 *
 * Uses true append-only writes — no read-merge-write cycle.
 * Dedup is handled at load time in `loadAccumulatedMemory()`.
 *
 * Non-fatal: errors are logged but never thrown.
 */
export async function extractAndBridgeMemory(
  projectDir: string,
  workspacePath: string,
  sessionId: string,
): Promise<void> {
  try {
    const incoming = await extractMemoryFromWorkspace(workspacePath);
    if (incoming.length === 0) return;

    const now = new Date().toISOString();
    const bridgeEntries: CrossSessionMemoryEntry[] = incoming.map((entry) => ({
      id: entry.id || randomUUID(),
      type: entry.type,
      content: entry.content,
      source: entry.source,
      timestamp: entry.timestamp,
      contentHash: computeContentHash(entry.type, entry.content),
      sourceSessionIds: [sessionId],
      firstSeenAt: now,
      lastSeenAt: now,
    }));

    await appendEntries(projectDir, bridgeEntries);
  } catch (error) {
    process.stderr.write(`[memory-bridge] extractAndBridgeMemory failed: ${String(error)}\n`);
  }
}

/**
 * Build a formatted text block from accumulated cross-session memory
 * for injection into a new session prompt.
 *
 * Returns empty string if no entries or on any error (non-fatal).
 */
export async function buildCrossSessionMemoryLayer(projectDir: string): Promise<string> {
  try {
    const entries = await loadAccumulatedMemory(projectDir);
    if (entries.length === 0) return "";

    const sections = new Map<string, string[]>();
    for (const entry of entries) {
      const type = entry.type;
      if (!sections.has(type)) {
        sections.set(type, []);
      }
      const lines = sections.get(type);
      if (!lines) continue;
      const sources =
        entry.sourceSessionIds.length > 0
          ? ` (from ${entry.sourceSessionIds.length} session(s))`
          : "";
      lines.push(`- ${entry.content}${sources}`);
    }

    const parts: string[] = ["## Cross-Session Knowledge"];
    for (const [type, items] of sections) {
      parts.push(`\n### ${type.charAt(0).toUpperCase() + type.slice(1)}s`);
      parts.push(items.join("\n"));
    }

    return parts.join("\n") + "\n";
  } catch {
    return "";
  }
}
