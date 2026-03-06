/**
 * State Manager Service
 *
 * Write-through caching with sprint-status.yaml as authoritative storage.
 * Sub-millisecond cache reads, version stamping for conflict detection.
 */

import type {
  StateManager,
  StateManagerConfig,
  StoryState,
  SetResult,
  BatchResult,
} from "./types.js";
import { readFile, writeFile, rename, unlink } from "node:fs/promises";
import { parse, stringify } from "yaml";
import { randomBytes } from "node:crypto";

/** Default maximum time for cache reload (ms) */
const DEFAULT_CACHE_RELOAD_THRESHOLD_MS = 100;

/**
 * State Manager Implementation
 */
export class StateManagerImpl implements StateManager {
  private config: StateManagerConfig;
  private cache: Map<string, StoryState> = new Map();
  private initialized = false;
  private initializing = false; // Prevent concurrent initialize calls
  private closed = false; // Track if close() was called

  constructor(config: StateManagerConfig) {
    this.config = config;
  }

  /**
   * Initialize state manager by loading YAML into cache
   */
  async initialize(): Promise<void> {
    // Prevent concurrent initialization
    if (this.initializing) {
      // Wait for existing initialization to complete
      while (this.initializing) {
        await new Promise((resolve) => setTimeout(resolve, 10));
      }
      return;
    }

    // Prevent re-initialization after close
    if (this.closed) {
      throw new Error("StateManager is closed and cannot be reinitialized");
    }

    // Note: We allow re-initialization (when this.initialized is true) for cache invalidation
    // The invalidate() method clears the cache and resets this flag

    this.initializing = true;

    try {
      const content = await readFile(this.config.yamlPath, "utf-8");
      const yaml = parse(content) as Record<string, unknown>;

      const developmentStatus = (yaml.development_status || {}) as Record<string, unknown>;

      for (const [storyId, story] of Object.entries(developmentStatus)) {
        if (storyId.startsWith("epic-")) continue; // Skip epic entries

        // Handle both formats:
        // 1. Simple format: story-id: status
        // 2. Full format: story-id: {status: value, title: value, ...}
        const storyData = story as Record<string, unknown> | string;

        if (typeof storyData === "string") {
          // Simple format: story-id: status
          // Don't generate new version on load - use placeholder that gets replaced on write
          this.cache.set(storyId, {
            id: storyId,
            status: storyData as StoryState["status"],
            title: storyId,
            version: "", // Empty version indicates not yet written with version
            updatedAt: new Date().toISOString(),
          });
        } else {
          // Full format with metadata
          this.cache.set(storyId, {
            id: storyId,
            status: (storyData.status as StoryState["status"]) || "backlog",
            title: (storyData.title as string) || storyId,
            description: storyData.description as string | undefined,
            acceptanceCriteria: storyData.acceptanceCriteria as string[] | undefined,
            dependencies: storyData.dependencies as string[] | undefined,
            assignedAgent: storyData.assignedAgent as string | undefined,
            version: (storyData.version as string) || "",
            updatedAt: (storyData.updatedAt as string) || new Date().toISOString(),
          });
        }
      }

      this.initialized = true;
    } finally {
      this.initializing = false;
    }
  }

  /**
   * Get story state from cache (≤1ms)
   */
  get(storyId: string): StoryState | null {
    if (this.closed) {
      return null; // Return null when closed
    }

    const state = this.cache.get(storyId);
    return state ? { ...state } : null; // Return copy
  }

  /**
   * Get all stories from cache
   */
  getAll(): Map<string, StoryState> {
    if (this.closed) {
      return new Map(); // Return empty map when closed
    }

    return new Map(this.cache); // Return copy
  }

  /**
   * Set story state with write-through pattern
   */
  async set(storyId: string, state: StoryState, expectedVersion?: string): Promise<SetResult> {
    if (this.closed) {
      return {
        success: false,
        version: "unknown",
        error: "StateManager is closed",
      };
    }

    // Validate storyId matches state.id
    if (state.id && state.id !== storyId) {
      return {
        success: false,
        version: "unknown",
        error: `storyId "${storyId}" does not match state.id "${state.id}"`,
      };
    }

    const current = this.cache.get(storyId);

    // Version check
    if (expectedVersion && current && current.version !== expectedVersion) {
      return {
        success: false,
        version: current.version,
        conflict: true,
        error: `Version mismatch: expected ${expectedVersion}, found ${current.version}`,
      };
    }

    // Generate new version
    const newVersion = this.generateVersion();
    const newState = {
      ...state,
      id: storyId, // Ensure ID consistency
      version: newVersion,
      updatedAt: new Date().toISOString(),
    };

    // Write-through: write to YAML first
    try {
      await this.writeToYaml(storyId, newState);
    } catch (error) {
      return {
        success: false,
        version: current?.version || "unknown",
        error: `Failed to write to YAML: ${(error as Error).message}`,
      };
    }

    // Update cache only after successful write
    this.cache.set(storyId, newState);

    return {
      success: true,
      version: newVersion,
    };
  }

  /**
   * Update story state (partial update)
   */
  async update(
    storyId: string,
    updates: Partial<StoryState>,
    expectedVersion?: string,
  ): Promise<SetResult> {
    if (this.closed) {
      return {
        success: false,
        version: "unknown",
        error: "StateManager is closed",
      };
    }

    const current = this.cache.get(storyId);
    if (!current) {
      return {
        success: false,
        version: "unknown",
        error: `Story ${storyId} not found`,
      };
    }

    return this.set(storyId, { ...current, ...updates }, expectedVersion);
  }

  /**
   * Batch update multiple stories
   * Note: NOT atomic - writes one at a time for reliability
   * Returns partial results if some writes fail
   */
  async batchSet(updates: Map<string, StoryState>): Promise<BatchResult> {
    const succeeded: string[] = [];
    const failed: Array<{ storyId: string; error: string }> = [];

    for (const [storyId, state] of updates.entries()) {
      const result = await this.set(storyId, state);
      if (result.success) {
        succeeded.push(storyId);
      } else {
        failed.push({ storyId, error: result.error || "Unknown error" });
      }
    }

    return { succeeded, failed };
  }

  /**
   * Invalidate and reload cache
   */
  async invalidate(): Promise<void> {
    if (this.closed) {
      throw new Error("StateManager is closed");
    }

    const start = Date.now();

    // Force reload from YAML by clearing cache and reinitializing
    this.cache.clear();
    this.initialized = false;
    await this.initialize();

    const elapsed = Date.now() - start;
    if (elapsed > DEFAULT_CACHE_RELOAD_THRESHOLD_MS) {
      // eslint-disable-next-line no-console
      console.warn(
        `Cache reload took ${elapsed}ms (target: ≤${DEFAULT_CACHE_RELOAD_THRESHOLD_MS}ms)`,
      );
    }

    // Publish event
    if (this.config.eventBus) {
      await this.config.eventBus.publish({
        eventType: "state.external_update",
        metadata: {
          storiesReloaded: this.cache.size,
        },
      });
    }
  }

  /**
   * Get current version for a story
   */
  getVersion(storyId: string): string | null {
    if (this.closed) {
      return null; // Return null when closed
    }

    const entry = this.cache.get(storyId);
    return entry?.version ?? null; // Use ?? to preserve empty string
  }

  /**
   * Close state manager and clear cache
   */
  async close(): Promise<void> {
    this.closed = true;
    this.cache.clear();
    this.initialized = false;
  }

  /**
   * Write story state to YAML file
   * Note: This implementation has known limitations:
   * - No file locking for concurrent writes from multiple processes
   * - Last writer wins - earlier concurrent writes may be lost
   * - For multi-process scenarios, consider using file locks or a mutex service
   */
  private async writeToYaml(storyId: string, state: StoryState): Promise<void> {
    const tmpPath = this.config.yamlPath + ".tmp";

    // Clean up any existing temp file from previous failed write
    try {
      await unlink(tmpPath);
    } catch {
      // Temp file doesn't exist, which is fine
    }

    // Read current YAML
    const content = await readFile(this.config.yamlPath, "utf-8");
    const yaml = parse(content) as Record<string, unknown>;

    // Update story
    if (!yaml.development_status) {
      (yaml.development_status as Record<string, unknown>) = {};
    }
    const developmentStatus = yaml.development_status as Record<string, unknown>;
    developmentStatus[storyId] = {
      status: state.status,
      title: state.title,
      description: state.description,
      acceptanceCriteria: state.acceptanceCriteria,
      dependencies: state.dependencies,
      assignedAgent: state.assignedAgent,
      version: state.version,
      updatedAt: state.updatedAt,
    };

    // Write to temporary file
    const newYaml = stringify(yaml);
    await writeFile(tmpPath, newYaml, "utf-8");

    try {
      // Atomic rename
      await rename(tmpPath, this.config.yamlPath);
    } catch (error) {
      // Clean up temp file on failure
      try {
        await unlink(tmpPath);
      } catch {
        // Ignore cleanup errors
      }
      throw error; // Re-throw original error
    }
  }

  /**
   * Generate version stamp: v{timestamp}-{random}
   */
  private generateVersion(): string {
    const timestamp = Date.now();
    const random = randomBytes(4).toString("hex");
    return `v${timestamp}-${random}`;
  }
}

/**
 * Factory function to create a StateManager instance
 * @param config - Configuration for the state manager
 * @returns Configured StateManager instance
 */
export function createStateManager(config: StateManagerConfig): StateManager {
  return new StateManagerImpl(config);
}
