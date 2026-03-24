/**
 * Learning Store — Persistent JSONL storage for SessionLearning records
 *
 * Provides:
 * - Append-only JSONL storage ({sessionsDir}/learnings.jsonl)
 * - File rotation at configurable size (default 10MB)
 * - Retention-based cleanup (default 90 days)
 * - Load from disk on startup
 * - Malformed line tolerance
 *
 * Follows the same pattern as dead-letter-queue.ts.
 */

import { appendFile, readFile, writeFile, mkdir, stat, rename } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname } from "node:path";
import type { SessionLearning } from "./types.js";

// =============================================================================
// Types
// =============================================================================

/** Configuration for the learning store */
export interface LearningStoreConfig {
  /** Path to learnings JSONL file */
  learningsPath: string;
  /** Maximum file size before rotation in bytes (default: 10MB) */
  maxFileSize?: number;
  /** Retention period in days (default: 90) */
  retentionDays?: number;
}

/** Query parameters for filtering learning records */
export interface LearningQuery {
  /** Filter by agent ID */
  agentId?: string;
  /** Filter by domain tag (matches any record containing this tag) */
  domain?: string;
  /** Filter by outcome */
  outcome?: SessionLearning["outcome"];
  /** Filter by time window (ms from now, e.g., 30 * 24 * 60 * 60 * 1000 for 30 days) */
  sinceMs?: number;
  /** Maximum number of records to return (newest first) */
  limit?: number;
}

/** Learning store service interface */
export interface LearningStore {
  /** Store a new learning record */
  store(learning: SessionLearning): Promise<void>;
  /** List all in-memory learning records */
  list(): SessionLearning[];
  /** Query records with filtering, sorted newest first */
  query(params: LearningQuery): SessionLearning[];
  /** Start the store — load existing records from disk */
  start(): Promise<void>;
  /** Stop the store */
  stop(): Promise<void>;
}

// =============================================================================
// Constants
// =============================================================================

const DEFAULT_MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const DEFAULT_RETENTION_DAYS = 90;

// =============================================================================
// Implementation
// =============================================================================

class LearningStoreImpl implements LearningStore {
  private config: Required<LearningStoreConfig>;
  private entries: SessionLearning[] = [];

  constructor(config: LearningStoreConfig) {
    this.config = {
      learningsPath: config.learningsPath,
      maxFileSize: config.maxFileSize ?? DEFAULT_MAX_FILE_SIZE,
      retentionDays: config.retentionDays ?? DEFAULT_RETENTION_DAYS,
    };
  }

  async start(): Promise<void> {
    await this.loadFromDisk();
    this.purgeExpired();
  }

  async stop(): Promise<void> {
    // No cleanup needed — records are persisted on each store()
  }

  async store(learning: SessionLearning): Promise<void> {
    this.entries.push(learning);

    // Ensure directory exists
    const dir = dirname(this.config.learningsPath);
    await mkdir(dir, { recursive: true });

    // Check rotation before appending
    await this.maybeRotate();

    // Append to JSONL
    const line = JSON.stringify(learning) + "\n";
    await appendFile(this.config.learningsPath, line, "utf-8");
  }

  list(): SessionLearning[] {
    return [...this.entries];
  }

  query(params: LearningQuery): SessionLearning[] {
    let results = [...this.entries];

    if (params.agentId) {
      results = results.filter((r) => r.agentId === params.agentId);
    }
    if (params.domain) {
      const domain = params.domain;
      results = results.filter((r) => r.domainTags.includes(domain));
    }
    if (params.outcome) {
      results = results.filter((r) => r.outcome === params.outcome);
    }
    if (params.sinceMs) {
      const cutoff = new Date(Date.now() - params.sinceMs).toISOString();
      results = results.filter((r) => r.capturedAt >= cutoff);
    }

    // Sort newest first
    results.sort((a, b) => b.capturedAt.localeCompare(a.capturedAt));

    if (params.limit) {
      results = results.slice(0, params.limit);
    }

    return results;
  }

  // ===========================================================================
  // Private methods
  // ===========================================================================

  private async loadFromDisk(): Promise<void> {
    if (!existsSync(this.config.learningsPath)) {
      return;
    }

    try {
      const content = await readFile(this.config.learningsPath, "utf-8");
      const lines = content.trim().split("\n");

      for (const line of lines) {
        if (!line) continue;
        try {
          const entry = JSON.parse(line) as SessionLearning;
          this.entries.push(entry);
        } catch {
          // Skip malformed lines
        }
      }
    } catch {
      // File read failure — start with empty store
    }
  }

  private purgeExpired(): void {
    const cutoff = Date.now() - this.config.retentionDays * 24 * 60 * 60 * 1000;
    this.entries = this.entries.filter((e) => {
      const ts = new Date(e.capturedAt).getTime();
      return !isNaN(ts) && ts >= cutoff;
    });
  }

  private async maybeRotate(): Promise<void> {
    if (!existsSync(this.config.learningsPath)) {
      return;
    }

    try {
      const stats = await stat(this.config.learningsPath);
      if (stats.size <= this.config.maxFileSize) {
        return;
      }

      // Rotate: rename current file with timestamp
      const timestamp = new Date().toISOString().split("T")[0];
      const rotatedPath = `${this.config.learningsPath}.${timestamp}`;
      await rename(this.config.learningsPath, rotatedPath);

      // Start fresh file
      await writeFile(this.config.learningsPath, "", "utf-8");
    } catch {
      // Rotation failure is non-fatal — continue appending
    }
  }
}

/**
 * Factory function to create a LearningStore
 */
export function createLearningStore(config: LearningStoreConfig): LearningStore {
  return new LearningStoreImpl(config);
}
