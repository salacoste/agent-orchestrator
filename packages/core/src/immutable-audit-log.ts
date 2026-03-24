/**
 * Immutable Audit Log — tamper-proof append-only trail (Story 46a.1).
 *
 * Separate from events.jsonl (which rotates). This file NEVER rotates,
 * NEVER deletes entries, and uses cryptographic hash chaining for
 * tamper detection.
 */

import { createHash, randomUUID } from "node:crypto";
import { appendFile, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";

/** A single immutable audit log entry. */
export interface AuditLogEntry {
  id: string;
  timestamp: string;
  actor: string;
  action: string;
  target: string;
  beforeState?: string;
  afterState?: string;
  metadata?: Record<string, unknown>;
  hash: string;
  previousHash: string;
}

/** Chain verification result. */
export interface ChainVerification {
  valid: boolean;
  entriesChecked: number;
  brokenAt?: number;
  error?: string;
}

/** Genesis hash for the first entry in the chain. */
const GENESIS_HASH = "0";

/**
 * Compute SHA-256 hash of an entry's content (excluding the hash field itself).
 */
export function computeEntryHash(entry: Omit<AuditLogEntry, "hash">): string {
  const data = JSON.stringify({
    id: entry.id,
    timestamp: entry.timestamp,
    actor: entry.actor,
    action: entry.action,
    target: entry.target,
    beforeState: entry.beforeState,
    afterState: entry.afterState,
    metadata: entry.metadata,
    previousHash: entry.previousHash,
  });
  return createHash("sha256").update(data).digest("hex");
}

/**
 * Verify the integrity of a chain of audit log entries.
 */
export function verifyChain(entries: AuditLogEntry[]): ChainVerification {
  if (entries.length === 0) {
    return { valid: true, entriesChecked: 0 };
  }

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];

    // Verify hash matches content
    const { hash: _h, ...rest } = entry;
    const expected = computeEntryHash(rest);
    if (entry.hash !== expected) {
      return { valid: false, entriesChecked: i + 1, brokenAt: i, error: "Hash mismatch" };
    }

    // Verify chain link
    if (i === 0) {
      if (entry.previousHash !== GENESIS_HASH) {
        return { valid: false, entriesChecked: 1, brokenAt: 0, error: "Invalid genesis hash" };
      }
    } else if (entry.previousHash !== entries[i - 1].hash) {
      return { valid: false, entriesChecked: i + 1, brokenAt: i, error: "Chain link broken" };
    }
  }

  return { valid: true, entriesChecked: entries.length };
}

/** Immutable audit log service. */
export interface ImmutableAuditLog {
  append(entry: {
    actor: string;
    action: string;
    target: string;
    beforeState?: string;
    afterState?: string;
    metadata?: Record<string, unknown>;
  }): Promise<AuditLogEntry>;
  readEntries(options?: { since?: string; limit?: number }): Promise<AuditLogEntry[]>;
  verify(): Promise<ChainVerification>;
}

/**
 * Create an immutable audit log service.
 */
export function createImmutableAuditLog(filePath: string): ImmutableAuditLog {
  let lastHash = GENESIS_HASH;
  let initialized = false;
  /** Write chain serializes concurrent appends to prevent chain forks. */
  let writeChain = Promise.resolve<AuditLogEntry | null>(null);

  /** Load last hash from existing file on first use. */
  async function ensureInitialized(): Promise<void> {
    if (initialized) return;
    initialized = true;

    if (!existsSync(filePath)) return;

    try {
      const content = await readFile(filePath, "utf-8");
      const lines = content.trim().split("\n").filter(Boolean);
      if (lines.length > 0) {
        const lastLine = lines[lines.length - 1];
        const parsed = JSON.parse(lastLine) as AuditLogEntry;
        if (parsed.hash) {
          lastHash = parsed.hash;
        }
      }
    } catch {
      // Corrupted file — start fresh chain from last known hash
    }
  }

  /** Internal append — must be called sequentially via writeChain. */
  async function doAppend(input: {
    actor: string;
    action: string;
    target: string;
    beforeState?: string;
    afterState?: string;
    metadata?: Record<string, unknown>;
  }): Promise<AuditLogEntry> {
    await ensureInitialized();

    const entry: Omit<AuditLogEntry, "hash"> = {
      id: randomUUID(),
      timestamp: new Date().toISOString(),
      actor: input.actor,
      action: input.action,
      target: input.target,
      beforeState: input.beforeState,
      afterState: input.afterState,
      metadata: input.metadata,
      previousHash: lastHash,
    };

    const hash = computeEntryHash(entry);
    const fullEntry: AuditLogEntry = { ...entry, hash };

    await appendFile(filePath, JSON.stringify(fullEntry) + "\n", "utf-8");
    lastHash = hash;

    return fullEntry;
  }

  return {
    append(input) {
      // Chain writes to serialize concurrent calls
      const next = writeChain.then(() => doAppend(input));
      writeChain = next.catch(() => null);
      return next;
    },

    async readEntries(options) {
      await ensureInitialized();

      if (!existsSync(filePath)) return [];

      const content = await readFile(filePath, "utf-8");
      const lines = content.trim().split("\n").filter(Boolean);

      let entries: AuditLogEntry[] = [];
      for (const line of lines) {
        try {
          entries.push(JSON.parse(line) as AuditLogEntry);
        } catch {
          // Skip malformed lines
        }
      }

      // Filter by since
      if (options?.since) {
        const sinceMs = new Date(options.since).getTime();
        entries = entries.filter((e) => new Date(e.timestamp).getTime() >= sinceMs);
      }

      // Limit
      if (options?.limit && options.limit > 0) {
        entries = entries.slice(0, options.limit);
      }

      return entries;
    },

    async verify() {
      const entries = await this.readEntries();
      return verifyChain(entries);
    },
  };
}
