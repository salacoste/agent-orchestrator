/**
 * File Locking Utility for Agent Orchestrator
 *
 * Cross-platform file locking using proper-lockfile.
 * Prevents concurrent writes to YAML files from multiple processes.
 *
 * Story: 2-1-7 - File Locking Mechanism
 */

import lockfile from "proper-lockfile";

/**
 * Options for file lock acquisition
 */
export interface FileLockOptions {
  /** Number of retry attempts (default: 10) */
  retries?: number;
  /** Stale lock age in ms - locks older than this are considered stale (default: 10000) */
  stale?: number;
  /** Lock update interval in ms (default: 1000) */
  update?: number;
}

/**
 * File Lock wrapper for proper-lockfile
 *
 * Provides advisory file locking to prevent concurrent writes.
 * Uses lock files alongside the target file for cross-platform compatibility.
 */
export class FileLock {
  private activeLocks: Map<string, () => Promise<void>> = new Map();

  /**
   * Acquire a file lock
   *
   * @param filePath - Path to the file to lock
   * @param options - Lock options
   * @returns Release function to unlock the file
   */
  async acquire(filePath: string, options: FileLockOptions = {}): Promise<() => Promise<void>> {
    const { retries = 10, stale = 10000, update = 1000 } = options;

    // Check if already locked by this instance
    if (this.activeLocks.has(filePath)) {
      throw new Error(`File already locked by this process: ${filePath}`);
    }

    // Acquire lock using proper-lockfile
    const release = await lockfile.lock(filePath, {
      retries: {
        retries,
        minTimeout: 100,
        maxTimeout: 1000,
      },
      stale,
      update,
    });

    // Track the lock
    this.activeLocks.set(filePath, release);

    // Return wrapped release function
    return async () => {
      await this.release(filePath);
    };
  }

  /**
   * Release a file lock
   *
   * @param filePath - Path to the file to unlock
   */
  async release(filePath: string): Promise<void> {
    const release = this.activeLocks.get(filePath);
    if (!release) {
      return; // No lock held
    }

    try {
      await release();
    } finally {
      this.activeLocks.delete(filePath);
    }
  }

  /**
   * Execute a function with a file lock held
   *
   * Automatically acquires lock, executes function, and releases lock.
   * Ensures lock is always released even if function throws.
   *
   * @param filePath - Path to the file to lock
   * @param fn - Function to execute while holding lock
   * @param options - Lock options
   * @returns Result of the function
   */
  async withLock<T>(
    filePath: string,
    fn: () => Promise<T>,
    options: FileLockOptions = {},
  ): Promise<T> {
    const release = await this.acquire(filePath, options);
    try {
      return await fn();
    } finally {
      await release();
    }
  }

  /**
   * Check if a file is currently locked
   *
   * @param filePath - Path to check
   * @returns True if locked (by any process)
   */
  async isLocked(filePath: string): Promise<boolean> {
    try {
      return await lockfile.check(filePath);
    } catch (error) {
      // Log warning for unexpected errors (permissions, etc.)
      // but don't throw - isLocked is typically used for checking state
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        // eslint-disable-next-line no-console
        console.warn(
          `Warning: Could not check lock status for ${filePath}: ${(error as Error).message}`,
        );
      }
      return false;
    }
  }

  /**
   * Release all locks held by this instance
   */
  async releaseAll(): Promise<void> {
    const releases = Array.from(this.activeLocks.values());
    this.activeLocks.clear();

    await Promise.all(
      releases.map(async (release) => {
        try {
          await release();
        } catch {
          // Ignore release errors
        }
      }),
    );
  }
}

/**
 * Global file lock instance for State Manager
 */
let globalFileLock: FileLock | null = null;

/**
 * Get the global file lock instance
 */
export function getFileLock(): FileLock {
  if (!globalFileLock) {
    globalFileLock = new FileLock();
  }
  return globalFileLock;
}

/**
 * Reset the global file lock instance (for testing)
 */
export function resetFileLock(): void {
  globalFileLock = null;
}
