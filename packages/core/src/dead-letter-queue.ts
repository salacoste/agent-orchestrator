/**
 * Dead Letter Queue Service
 *
 * Provides:
 * - Storage for failed operations after max retries
 * - Persistence to disk (dlq.jsonl)
 * - CLI operations: list, replay, purge
 * - Alert on large queue size
 * - Circuit breaker bypass for manual replays
 *
 * Integrates with RetryService's onNonRetryable callback to automatically
 * capture operations that have exhausted all retry attempts.
 */

import { appendFile, readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";

// =============================================================================
// Types
// =============================================================================

/**
 * Dead Letter Queue entry - represents a failed operation
 */
export interface DLQEntry {
  /** Unique error identifier (UUID) */
  errorId: string;
  /** Operation type (e.g., "bmad_sync", "event_publish") */
  operation: string;
  /** Original operation payload */
  payload: unknown;
  /** Human-readable failure reason */
  failureReason: string;
  /** Number of retry attempts before giving up */
  retryCount: number;
  /** ISO timestamp of when the operation failed */
  failedAt: string;
  /** Original error details */
  originalError: Error | { message: string; name: string };
}

/**
 * Dead Letter Queue statistics
 */
export interface DLQStats {
  /** Total number of entries in the DLQ */
  totalEntries: number;
  /** Breakdown by operation type */
  byOperation: Record<string, number>;
  /** Timestamp of oldest entry (null if empty) */
  oldestEntry: string | null;
  /** Timestamp of newest entry (null if empty) */
  newestEntry: string | null;
}

/**
 * Configuration for Dead Letter Queue
 */
export interface DLQConfig {
  /** Path to DLQ JSONL file */
  dlqPath: string;
  /** Alert threshold - fire alert when entries exceed this count */
  alertThreshold?: number;
}

/**
 * Result of a replay operation
 */
export type ReplayResult<T> = T | null;

/**
 * Alert callback function type
 */
export type AlertCallback = (size: number) => void;

// =============================================================================
// Implementation
// =============================================================================

const DEFAULT_ALERT_THRESHOLD = 1000;

export class DeadLetterQueueServiceImpl {
  private config: Required<DLQConfig>;
  private entries: DLQEntry[] = [];
  private alertCallback: AlertCallback = () => {};

  constructor(config: DLQConfig) {
    this.config = {
      dlqPath: config.dlqPath,
      alertThreshold: config.alertThreshold ?? DEFAULT_ALERT_THRESHOLD,
    };
  }

  /**
   * Start the DLQ service - load existing entries from disk
   */
  async start(): Promise<void> {
    await this.loadFromDisk();
  }

  /**
   * Stop the DLQ service - persist entries to disk
   */
  async stop(): Promise<void> {
    await this.persistToDisk();
  }

  /**
   * Register a callback for DLQ size alerts
   */
  onAlert(callback: AlertCallback): void {
    this.alertCallback = callback;
  }

  /**
   * Add a failed operation to the DLQ
   * @returns The error ID for the new entry
   */
  async enqueue(
    entry: Omit<DLQEntry, "errorId" | "failedAt" | "originalError"> & {
      originalError: Error | { message: string; name: string };
    },
  ): Promise<string> {
    const errorId = randomUUID();
    const failedAt = new Date().toISOString();

    const dlqEntry: DLQEntry = {
      errorId,
      failedAt,
      ...entry,
      // Ensure originalError is serializable
      originalError:
        entry.originalError instanceof Error
          ? { message: entry.originalError.message, name: entry.originalError.name }
          : entry.originalError,
    };

    this.entries.push(dlqEntry);

    // Persist to disk immediately
    await this.appendToFile(dlqEntry);

    // Check alert threshold
    if (this.entries.length >= this.config.alertThreshold) {
      this.alertCallback(this.entries.length);
    }

    return errorId;
  }

  /**
   * List all entries in the DLQ
   */
  async list(): Promise<DLQEntry[]> {
    return [...this.entries];
  }

  /**
   * Get a specific entry by error ID
   * @returns The entry or null if not found
   */
  async get(errorId: string): Promise<DLQEntry | null> {
    return this.entries.find((e) => e.errorId === errorId) ?? null;
  }

  /**
   * Replay a failed operation
   * @param errorId - The error ID to replay
   * @param replayFn - Function to execute the operation (bypasses circuit breaker)
   * @returns The result of the replay function, or null if entry not found
   */
  async replay<T>(
    errorId: string,
    replayFn: (payload: unknown) => Promise<T>,
  ): Promise<ReplayResult<T>> {
    const entryIndex = this.entries.findIndex((e) => e.errorId === errorId);

    if (entryIndex === -1) {
      return null;
    }

    const entry = this.entries[entryIndex];

    try {
      // Execute the replay function (bypasses circuit breaker by design)
      const result = await replayFn(entry.payload);

      // Success - remove from DLQ
      this.entries.splice(entryIndex, 1);
      await this.persistToDisk();

      return result;
    } catch {
      // Replay failed - keep entry in DLQ
      return null;
    }
  }

  /**
   * Remove entries older than the specified threshold
   * @param olderThanMs - Age threshold in milliseconds
   * @returns Number of entries purged
   */
  async purge(olderThanMs: number): Promise<number> {
    const now = Date.now();
    const initialCount = this.entries.length;

    this.entries = this.entries.filter((entry) => {
      const entryTime = new Date(entry.failedAt).getTime();
      const age = now - entryTime;
      return age <= olderThanMs;
    });

    const purged = initialCount - this.entries.length;

    if (purged > 0) {
      await this.persistToDisk();
    }

    return purged;
  }

  /**
   * Get statistics about the DLQ
   */
  async getStats(): Promise<DLQStats> {
    const byOperation: Record<string, number> = {};

    for (const entry of this.entries) {
      byOperation[entry.operation] = (byOperation[entry.operation] ?? 0) + 1;
    }

    let oldestEntry: string | null = null;
    let newestEntry: string | null = null;

    if (this.entries.length > 0) {
      oldestEntry = this.entries[0].failedAt;
      newestEntry = this.entries[this.entries.length - 1].failedAt;
    }

    return {
      totalEntries: this.entries.length,
      byOperation,
      oldestEntry,
      newestEntry,
    };
  }

  // ===========================================================================
  // Private methods
  // ===========================================================================

  /**
   * Load entries from disk on startup
   */
  private async loadFromDisk(): Promise<void> {
    if (!existsSync(this.config.dlqPath)) {
      return;
    }

    try {
      const content = await readFile(this.config.dlqPath, "utf-8");
      const lines = content.trim().split("\n");

      for (const line of lines) {
        if (!line) continue;
        try {
          const entry = JSON.parse(line) as DLQEntry;
          this.entries.push(entry);
        } catch {
          // Skip malformed lines
        }
      }
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("[DLQ] Failed to load from disk:", error);
    }
  }

  /**
   * Persist all entries to disk
   */
  private async persistToDisk(): Promise<void> {
    if (this.entries.length === 0) {
      // Clear file if empty
      try {
        await writeFile(this.config.dlqPath, "", "utf-8");
      } catch {
        // Ignore errors
      }
      return;
    }

    const content = this.entries.map((e) => JSON.stringify(e)).join("\n") + "\n";

    try {
      // Ensure directory exists
      const dir = join(this.config.dlqPath, "..");
      await mkdir(dir, { recursive: true });

      await writeFile(this.config.dlqPath, content, "utf-8");
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("[DLQ] Failed to persist to disk:", error);
    }
  }

  /**
   * Append a single entry to disk
   */
  private async appendToFile(entry: DLQEntry): Promise<void> {
    try {
      // Ensure directory exists
      const dir = join(this.config.dlqPath, "..");
      await mkdir(dir, { recursive: true });

      const line = JSON.stringify(entry) + "\n";
      await appendFile(this.config.dlqPath, line, "utf-8");
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("[DLQ] Failed to append to disk:", error);
    }
  }
}

/**
 * Factory function to create a DeadLetterQueue service
 */
export function createDeadLetterQueue(config: DLQConfig): DeadLetterQueueServiceImpl {
  return new DeadLetterQueueServiceImpl(config);
}

// Type export for consumers
export type DeadLetterQueueService = DeadLetterQueueServiceImpl;
