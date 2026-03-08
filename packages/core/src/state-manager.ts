/**
 * State Manager Service
 *
 * Write-through caching with sprint-status.yaml as authoritative storage.
 * Sub-millisecond cache reads, version stamping for conflict detection.
 * Corruption detection and recovery from backup or rebuild.
 */

import type {
  StateManager,
  StateManagerConfig,
  StoryState,
  SetResult,
  BatchResult,
  VerifyResult,
} from "./types.js";
import { readFile, writeFile, rename, unlink, copyFile, mkdir } from "node:fs/promises";
import { parse, stringify } from "yaml";
import { randomBytes } from "node:crypto";
import { dirname } from "node:path";

/** Default maximum time for cache reload (ms) */
const DEFAULT_CACHE_RELOAD_THRESHOLD_MS = 100;

/** Default YAML template for rebuild */
const DEFAULT_YAML_TEMPLATE = `generated: {timestamp}
project: agent-orchestrator
project_key: NOKEY
tracking_system: file-system
story_location: _bmad-output/implementation-artifacts

development_status:
`;

/**
 * State Manager Implementation
 */
export class StateManagerImpl implements StateManager {
  private config: StateManagerConfig;
  private cache: Map<string, StoryState> = new Map();
  private initialized = false;
  private initializing = false; // Prevent concurrent initialize calls
  private closed = false; // Track if close() was called
  private backupPath: string; // Computed backup path
  private createBackup: boolean; // Whether to create backups

  constructor(config: StateManagerConfig) {
    this.config = config;
    this.backupPath = config.backupPath || `${config.yamlPath}.backup`;
    this.createBackup = config.createBackup ?? false;
  }

  /**
   * Initialize state manager by loading YAML into cache
   * Implements corruption detection and recovery from backup
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
      let content: string;

      try {
        content = await readFile(this.config.yamlPath, "utf-8");
      } catch (error) {
        // File doesn't exist - create default
        if ((error as NodeJS.ErrnoException).code === "ENOENT") {
          content = DEFAULT_YAML_TEMPLATE.replace(
            "{timestamp}",
            new Date().toISOString().split("T")[0],
          );
          await this.ensureDirectoryExists();
          await writeFile(this.config.yamlPath, content, "utf-8");
        } else {
          throw error;
        }
      }

      // Try to parse YAML
      let yaml: Record<string, unknown>;
      try {
        const parsed = parse(content);
        // Empty file or file with only comments returns null
        if (!parsed || typeof parsed !== "object") {
          throw new Error("YAML content is empty or invalid");
        }
        yaml = parsed as Record<string, unknown>;
      } catch (parseError) {
        // YAML is corrupted - try to recover from backup
        // eslint-disable-next-line no-console
        console.error(
          `Corrupted YAML detected in ${this.config.yamlPath}: ${(parseError as Error).message}`,
        );

        // Try backup recovery
        try {
          const backupContent = await readFile(this.backupPath, "utf-8");
          yaml = parse(backupContent) as Record<string, unknown>;

          // Restore the corrupted file from backup
          await writeFile(this.config.yamlPath, backupContent, "utf-8");
          // eslint-disable-next-line no-console
          console.log(`Recovered from backup: ${this.backupPath}`);
        } catch {
          // Backup also failed or doesn't exist - rebuild with default
          // eslint-disable-next-line no-console
          console.error(`⚠️  DATA LOSS: No valid backup found for ${this.config.yamlPath}`);
          // eslint-disable-next-line no-console
          console.warn(`Rebuilding with default template - all previous story data will be LOST`);
          yaml = parse(
            DEFAULT_YAML_TEMPLATE.replace("{timestamp}", new Date().toISOString().split("T")[0]),
          ) as Record<string, unknown>;

          // Write the rebuilt file
          await this.ensureDirectoryExists();
          await writeFile(
            this.config.yamlPath,
            DEFAULT_YAML_TEMPLATE.replace("{timestamp}", new Date().toISOString().split("T")[0]),
            "utf-8",
          );
        }
      }

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
   * Verify metadata integrity
   * @returns Verification result with valid flag and optional error message
   */
  async verify(): Promise<VerifyResult> {
    try {
      // Check if file exists and is readable
      const content = await readFile(this.config.yamlPath, "utf-8");

      // Try to parse YAML
      let yaml: Record<string, unknown> | null;
      try {
        yaml = parse(content) as Record<string, unknown>;
      } catch (parseError) {
        return {
          valid: false,
          error: `Corrupted YAML: ${(parseError as Error).message}`,
        };
      }

      // Validate YAML structure - check for required fields
      if (!yaml || typeof yaml !== "object") {
        return {
          valid: false,
          error: "YAML content is empty or invalid",
        };
      }

      // Check for expected structure - sprint-status.yaml should have development_status
      if (!yaml.development_status) {
        return {
          valid: false,
          error: "YAML missing required field: development_status",
        };
      }

      const developmentStatus = yaml.development_status;
      if (typeof developmentStatus !== "object" || developmentStatus === null) {
        return {
          valid: false,
          error: "YAML development_status is not an object",
        };
      }

      return {
        valid: true,
        recovered: false,
      };
    } catch (error) {
      return {
        valid: false,
        error: `Cannot read file: ${(error as Error).message}`,
      };
    }
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

    // Create backup before writing if enabled
    if (this.createBackup) {
      try {
        await copyFile(this.config.yamlPath, this.backupPath);
      } catch {
        // Ignore backup errors - file might not exist yet
      }
    }

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

  /**
   * Ensure directory exists for file path
   */
  private async ensureDirectoryExists(): Promise<void> {
    const dir = dirname(this.config.yamlPath);
    try {
      await mkdir(dir, { recursive: true });
    } catch {
      // Ignore errors - directory might already exist
    }
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
