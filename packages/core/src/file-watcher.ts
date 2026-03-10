/**
 * File Watcher Service
 *
 * Watches files for external changes and triggers cache invalidation.
 * Uses chokidar for efficient file watching with debouncing.
 */

/* eslint-disable no-console -- Console output is required by AC 2 and AC 5 for user-facing messages */

import type { FileWatcher, FileWatcherConfig } from "./types.js";
import { watch, type FSWatcher } from "chokidar";
import { readFile, readdir, copyFile, mkdir, unlink } from "node:fs/promises";
import { parse } from "yaml";
import { createInterface } from "node:readline";
import { randomBytes } from "node:crypto";
import { join } from "node:path";

export class FileWatcherImpl implements FileWatcher {
  private config: FileWatcherConfig;
  private watchers: Map<string, FSWatcher> = new Map();
  private debounceTimers: Map<string, NodeJS.Timeout> = new Map();
  private debounceEventCounts: Map<string, number> = new Map();
  private previousVersions: Map<string, Record<string, unknown>> = new Map();
  private retryAttempts: Map<string, number> = new Map();
  private cleanupTimer: NodeJS.Timeout | null = null;
  private readonly maxRetryAttempts = 5;
  // Default retention settings
  private readonly defaultMaxBackupAgeMs = 7 * 24 * 60 * 60 * 1000; // 7 days
  private readonly defaultCleanupIntervalMs = 60 * 60 * 1000; // 1 hour

  constructor(config: FileWatcherConfig) {
    this.config = config;
  }

  async watch(path: string): Promise<void> {
    // AC 7: Allow disabling file watcher via enabled: false config
    if (this.config.enabled === false) {
      console.info("File watcher is disabled (enabled: false in config)");
      return;
    }

    // Validate file exists before watching (throws as per interface contract)
    const fileExists = await readFile(path)
      .then(() => true)
      .catch(() => false);
    if (!fileExists) {
      throw new Error(`File not found: ${path}`);
    }

    const watcher = watch(path, {
      persistent: true,
      ignoreInitial: true,
      awaitWriteFinish: {
        stabilityThreshold: 200,
        pollInterval: 100,
      },
    });

    watcher.on("change", () => this.handleChange(path));
    watcher.on("unlink", () => this.handleDelete(path));
    watcher.on("error", (_error) => {
      // Watcher errors are logged but don't stop watching
      // Error details are available via chokidar if needed
    });

    this.watchers.set(path, watcher);

    // Store initial state for comparison
    await this.storeInitialState(path);

    // Start periodic cleanup if this is the first watcher and cleanup is enabled
    if (this.watchers.size === 1 && this.config.cleanupIntervalMs !== 0) {
      this.startPeriodicCleanup();
    }
  }

  async unwatch(path: string): Promise<void> {
    const watcher = this.watchers.get(path);
    if (watcher) {
      await watcher.close();
      this.watchers.delete(path);
    }

    const timer = this.debounceTimers.get(path);
    if (timer) {
      clearTimeout(timer);
      this.debounceTimers.delete(path);
    }

    const eventCount = this.debounceEventCounts.get(path);
    if (eventCount) {
      this.debounceEventCounts.delete(path);
    }
  }

  async close(): Promise<void> {
    // Stop periodic cleanup timer
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }

    for (const [_path, watcher] of this.watchers.entries()) {
      await watcher.close();
    }
    this.watchers.clear();
  }

  isWatching(path: string): boolean {
    return this.watchers.has(path);
  }

  private async handleChange(path: string): Promise<void> {
    // Track event count for overflow detection
    const currentCount = (this.debounceEventCounts.get(path) || 0) + 1;
    this.debounceEventCounts.set(path, currentCount);

    // Check for debounce overflow (too many rapid events)
    const overflowThreshold = this.config.debounceOverflowThreshold || 10;
    if (currentCount >= overflowThreshold) {
      // Clear existing timer before immediate processing
      const existingTimer = this.debounceTimers.get(path);
      if (existingTimer) {
        clearTimeout(existingTimer);
        this.debounceTimers.delete(path);
      }

      // Process immediately instead of waiting
      console.warn(`Debounce overflow detected (${currentCount} events), processing immediately`);
      this.debounceEventCounts.delete(path);
      await this.processChange(path, 0); // 0 delay for immediate processing
      return;
    }

    // Debounce rapid changes
    const existingTimer = this.debounceTimers.get(path);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    const timer = setTimeout(async () => {
      await this.processChange(path);
      this.debounceTimers.delete(path);
      this.debounceEventCounts.delete(path); // Reset count on processing
    }, this.config.debounceMs || 500);

    this.debounceTimers.set(path, timer);
  }

  private async processChange(path: string, _overrideDelay?: number): Promise<void> {
    try {
      // Read new state
      const content = await readFile(path, "utf-8");
      const newState = parse(content);

      // Compare with previous state
      const previousState = this.previousVersions.get(path);
      const changedStories = this.detectChanges(previousState, newState);

      // Check for version conflicts
      const conflict = this.detectConflict(previousState, newState);

      if (conflict) {
        await this.handleConflict(path, previousState, newState, conflict);
      } else {
        // Invalidate cache and reload
        await this.config.stateManager.invalidate();

        // Publish event
        if (this.config.eventBus) {
          await this.config.eventBus.publish({
            eventType: "state.external_update",
            metadata: {
              path,
              previousVersion: this.extractVersion(previousState),
              newVersion: this.extractVersion(newState),
              changedStories,
            },
          });
        }

        // Update stored state
        this.previousVersions.set(path, newState);

        // Create backup after successful processing
        await this.createBackup(path);
      }

      // Reset retry attempts on success
      this.retryAttempts.delete(path);
    } catch (error) {
      const errorCode = (error as NodeJS.ErrnoException).code;

      if (errorCode === "EACCES" || errorCode === "EPERM") {
        console.error(
          `Cannot read sprint-status.yaml: ${errorCode === "EACCES" ? "Permission denied" : "Access error"}`,
        );
        console.info("Continuing with cached state");

        // Exponential backoff retry
        const attempts = (this.retryAttempts.get(path) || 0) + 1;
        this.retryAttempts.set(path, attempts);

        if (attempts <= this.maxRetryAttempts) {
          const delay = Math.min(5000 * Math.pow(2, attempts - 1), 60000); // 5s, 10s, 20s, 40s, 60s max
          const jitter = randomBytes(2).readUInt16BE(0) / 65535; // 0-1 range
          const jitterMs = Math.floor(jitter * 1000); // 0-1000ms jitter
          const totalDelay = delay + jitterMs;

          console.info(
            `Retrying in ${(totalDelay / 1000).toFixed(1)} seconds... (attempt ${attempts}/${this.maxRetryAttempts})`,
          );
          setTimeout(() => this.processChange(path), totalDelay);
        } else {
          console.error(
            `Max retry attempts (${this.maxRetryAttempts}) reached. Manual intervention required.`,
          );
        }
      } else {
        console.error("Failed to process file change:", error);
      }
    }
  }

  private detectChanges(
    previous: Record<string, unknown> | undefined,
    current: Record<string, unknown>,
  ): string[] {
    if (!previous) return [];

    const prevStories = (previous.development_status as Record<string, unknown>) || {};
    const currStories = (current.development_status as Record<string, unknown>) || {};
    const changed: string[] = [];

    // Find added and modified stories in current state
    for (const [storyId, story] of Object.entries(currStories)) {
      if (storyId.startsWith("epic-")) continue;

      const prevStory = prevStories[storyId];
      if (!prevStory || JSON.stringify(prevStory) !== JSON.stringify(story)) {
        changed.push(storyId);
      }
    }

    // Find deleted stories (in previous but not in current)
    for (const storyId of Object.keys(prevStories)) {
      if (storyId.startsWith("epic-")) continue;
      if (!(storyId in currStories)) {
        changed.push(storyId);
      }
    }

    return changed;
  }

  private detectConflict(
    previous: Record<string, unknown> | undefined,
    current: Record<string, unknown>,
  ): { type: string; localVersion: string; externalVersion: string } | null {
    if (!previous) return null;

    const prevVersion = this.extractVersion(previous);
    const currVersion = this.extractVersion(current);

    // Get local version from cached state (using metadata.version)
    const localVersion = prevVersion; // Our last known version

    // Check if external version differs from what we have cached
    if (currVersion !== localVersion && currVersion !== "unknown") {
      return {
        type: "version_mismatch",
        localVersion,
        externalVersion: currVersion,
      };
    }

    return null;
  }

  private async handleConflict(
    path: string,
    previous: Record<string, unknown> | undefined,
    current: Record<string, unknown>,
    conflict: { type: string; localVersion: string; externalVersion: string },
  ): Promise<void> {
    console.warn("\n⚠️  Conflict detected: sprint-status.yaml was modified externally");
    console.warn(`   Local version:  ${conflict.localVersion}`);
    console.warn(`   External version: ${conflict.externalVersion}`);

    // Show detailed diff
    const diff = this.generateDiff(previous, current);
    console.log("\n" + diff);

    // Prompt for resolution
    console.log("\nResolution options:");
    console.log("  [M]erge - Interactive merge view (select changes to keep)");
    console.log("  [K]eep local - Discard external changes");
    console.log("  [A]ccept external - Overwrite local state with external changes");

    if (this.config.interactive) {
      const choice = await this.promptUser("Choose resolution [M/K/A]: ");
      switch (choice.toLowerCase().trim()) {
        case "m":
          await this.mergeChanges(path, previous, current);
          break;
        case "k":
          await this.keepLocal();
          break;
        case "a":
        default:
          await this.acceptExternal(path, current);
          break;
      }
    } else {
      // Non-interactive mode: default to accepting external
      console.info("Non-interactive mode: accepting external changes");
      await this.acceptExternal(path, current);
    }
  }

  private async promptUser(query: string): Promise<string> {
    const rl = createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    return new Promise((resolve) => {
      rl.question(query, (answer) => {
        rl.close();
        resolve(answer);
      });
    });
  }

  private async mergeChanges(
    path: string,
    previous: Record<string, unknown> | undefined,
    current: Record<string, unknown>,
  ): Promise<void> {
    const prevStories = (previous?.development_status as Record<string, unknown>) || {};
    const currStories = (current.development_status as Record<string, unknown>) || {};
    const allStoryIds = new Set([...Object.keys(prevStories), ...Object.keys(currStories)]);

    console.log("\n📋 Interactive Merge - Choose version for each story:");
    const mergedState: Record<string, unknown> = { ...current };

    for (const storyId of allStoryIds) {
      if (storyId.startsWith("epic-")) continue;

      const prevStory = prevStories[storyId];
      const currStory = currStories[storyId];

      if (!prevStory) {
        console.log(`  ${storyId}: NEW in external (will be added)`);
      } else if (!currStory) {
        console.log(`  ${storyId}: DELETED in external (will be removed)`);
      } else if (JSON.stringify(prevStory) !== JSON.stringify(currStory)) {
        const prevStatus =
          typeof prevStory === "string" ? prevStory : (prevStory as Record<string, unknown>).status;
        const currStatus =
          typeof currStory === "string" ? currStory : (currStory as Record<string, unknown>).status;
        console.log(`  ${storyId}: Local=${prevStatus} vs External=${currStatus}`);

        const choice = await this.promptUser(
          `    Keep [L]ocal, [E]xternal, or [S]kip for this story? `,
        );
        if (choice.toLowerCase().trim() === "l") {
          (mergedState.development_status as Record<string, unknown>)[storyId] = prevStory;
        } else if (choice.toLowerCase().trim() !== "s") {
          // Keep external (already in mergedState)
        }
      }
    }

    await this.config.stateManager.invalidate();
    // Update previousVersions with merged state for proper conflict detection
    this.previousVersions.set(path, mergedState);
    console.log("✅ Merge completed");

    // Log resolution to audit trail
    if (this.config.eventBus) {
      await this.config.eventBus.publish({
        eventType: "state.conflict_resolved",
        metadata: {
          resolution: "merged",
          timestamp: new Date().toISOString(),
        },
      });
    }
  }

  private async keepLocal(): Promise<void> {
    console.log("✅ Keeping local state (discarding external changes)");
    // No action needed - we just don't update our cache

    if (this.config.eventBus) {
      await this.config.eventBus.publish({
        eventType: "state.conflict_resolved",
        metadata: {
          resolution: "keep_local",
          timestamp: new Date().toISOString(),
        },
      });
    }
  }

  private async acceptExternal(
    path: string,
    externalState: Record<string, unknown>,
  ): Promise<void> {
    await this.config.stateManager.invalidate();
    // Update previousVersions with external state for proper conflict detection
    this.previousVersions.set(path, externalState);

    console.log("✅ Accepted external changes");

    // Log resolution to audit trail
    if (this.config.eventBus) {
      await this.config.eventBus.publish({
        eventType: "state.conflict_resolved",
        metadata: {
          resolution: "accept_external",
          timestamp: new Date().toISOString(),
        },
      });
    }
  }

  private async handleDelete(path: string): Promise<void> {
    console.error("\n❌ sprint-status.yaml was deleted");

    if (this.config.interactive) {
      const choice = await this.promptUser("Restore from backup? [y/N]: ");
      if (choice.toLowerCase().trim() === "y") {
        await this.restoreFromBackup(path);
      } else {
        console.warn("⚠️  No backup restored. File remains deleted.");
      }
    } else {
      // Non-interactive mode: attempt restore
      console.info("Non-interactive mode: attempting restore from backup");
      await this.restoreFromBackup(path);
    }
  }

  private async restoreFromBackup(path: string): Promise<void> {
    const backupDir = this.config.backupDir || ".backups/";

    try {
      // List all backup files
      const files = await readdir(backupDir);
      const backupFiles = files
        .filter((f) => f.startsWith("sprint-status.yaml.backup."))
        .sort()
        .reverse(); // Most recent first

      if (backupFiles.length === 0) {
        console.error("❌ No backups found!");
        return;
      }

      const mostRecentBackup = backupFiles[0];
      const backupPath = join(backupDir, mostRecentBackup);

      console.info(`📂 Restoring from: ${mostRecentBackup}`);

      // Ensure backup directory exists
      await mkdir(backupDir, { recursive: true });

      // Copy backup to original location
      await copyFile(backupPath, path);

      console.log("✅ File restored from backup");

      // Trigger reload of restored file
      await this.storeInitialState(path);
    } catch (error) {
      console.error("❌ Failed to restore from backup:", (error as Error).message);
    }
  }

  private async createBackup(path: string): Promise<void> {
    const backupDir = this.config.backupDir || ".backups/";
    const maxBackups = this.config.maxBackups || 10;

    try {
      // Generate backup filename with timestamp
      const timestamp = new Date().toISOString().replace(/[:.]/g, "").slice(0, 15); // YYYYMMDDTHHMMSS
      const backupFilename = `sprint-status.yaml.backup.${timestamp}`;
      const backupPath = join(backupDir, backupFilename);

      // Ensure backup directory exists
      await mkdir(backupDir, { recursive: true });

      // Copy current file to backup
      await copyFile(path, backupPath);

      // Clean up old backups (keep only maxBackups most recent)
      await this.cleanupOldBackups(backupDir, maxBackups);
    } catch (error) {
      console.error("Failed to create backup:", (error as Error).message);
    }
  }

  private async cleanupOldBackups(backupDir: string, maxBackups: number): Promise<void> {
    try {
      const files = await readdir(backupDir);
      const maxAgeMs = this.config.maxBackupAgeMs ?? this.defaultMaxBackupAgeMs;
      const now = Date.now();

      // Get backup files with their stats
      const backupFilesWithStats = await Promise.all(
        files
          .filter((f) => f.startsWith("sprint-status.yaml.backup."))
          .map(async (f) => {
            const filePath = join(backupDir, f);
            const stat = await import("node:fs/promises").then((fs) => fs.stat(filePath));
            return {
              name: f,
              path: filePath,
              mtime: stat.mtimeMs,
              age: now - stat.mtimeMs,
            };
          }),
      );

      // Sort by modification time (oldest first)
      backupFilesWithStats.sort((a, b) => a.mtime - b.mtime);

      // Remove files that are too old
      const expiredFiles = backupFilesWithStats.filter((f) => f.age > maxAgeMs);
      for (const file of expiredFiles) {
        await unlink(file.path);
        console.log(
          `🗑️  Removed expired backup: ${file.name} (age: ${Math.round(file.age / (1000 * 60 * 60 * 24))} days)`,
        );
      }

      // Get remaining files after age-based cleanup
      const remainingFiles = backupFilesWithStats.filter((f) => f.age <= maxAgeMs);

      // Remove oldest backups if we still have too many
      while (remainingFiles.length > maxBackups) {
        const oldestBackup = remainingFiles.shift();
        if (oldestBackup) {
          await unlink(oldestBackup.path);
          console.log(`🗑️  Removed old backup: ${oldestBackup.name} (exceeds maxBackups limit)`);
        }
      }
    } catch (error) {
      console.error("Failed to cleanup old backups:", (error as Error).message);
    }
  }

  /**
   * Start periodic backup cleanup
   */
  private startPeriodicCleanup(): void {
    const cleanupIntervalMs = this.config.cleanupIntervalMs ?? this.defaultCleanupIntervalMs;
    const backupDir = this.config.backupDir || ".backups/";
    const maxBackups = this.config.maxBackups ?? 10;

    // Run initial cleanup
    this.cleanupOldBackups(backupDir, maxBackups).catch((error) => {
      console.error("Failed to run initial backup cleanup:", (error as Error).message);
    });

    // Schedule periodic cleanup
    this.cleanupTimer = setInterval(() => {
      this.cleanupOldBackups(backupDir, maxBackups).catch((error) => {
        console.error("Failed to run periodic backup cleanup:", (error as Error).message);
      });
    }, cleanupIntervalMs);

    console.log(
      `🗑️  Started periodic backup cleanup (every ${cleanupIntervalMs / 1000 / 60} minutes)`,
    );
  }

  /**
   * Stop periodic backup cleanup
   */
  private stopPeriodicCleanup(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
  }

  private async storeInitialState(path: string): Promise<void> {
    try {
      const content = await readFile(path, "utf-8");
      const state = parse(content);
      this.previousVersions.set(path, state);
    } catch (error) {
      console.error("Failed to read initial state:", error);
    }
  }

  private extractVersion(state: Record<string, unknown> | undefined): string {
    if (!state) return "unknown";
    const metadata = state.metadata as Record<string, unknown> | undefined;
    return (metadata?.version as string) || "unknown";
  }

  private generateDiff(
    previous: Record<string, unknown> | undefined,
    current: Record<string, unknown>,
  ): string {
    if (!previous) {
      return "Diff: New file created";
    }

    const prevStories = (previous.development_status as Record<string, unknown>) || {};
    const currStories = (current.development_status as Record<string, unknown>) || {};

    const lines: string[] = [];
    lines.push("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    lines.push("Story State Changes:");
    lines.push("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

    const allStoryIds = new Set([...Object.keys(prevStories), ...Object.keys(currStories)]);

    for (const storyId of allStoryIds) {
      if (storyId.startsWith("epic-")) continue;

      const prevStory = prevStories[storyId];
      const currStory = currStories[storyId];

      if (!prevStory) {
        const status =
          typeof currStory === "string" ? currStory : (currStory as Record<string, unknown>).status;
        lines.push(`  + ${storyId}: ${status} (ADDED)`);
      } else if (!currStory) {
        lines.push(`  - ${storyId} (REMOVED)`);
      } else {
        const prevStatus =
          typeof prevStory === "string" ? prevStory : (prevStory as Record<string, unknown>).status;
        const currStatus =
          typeof currStory === "string" ? currStory : (currStory as Record<string, unknown>).status;

        if (prevStatus !== currStatus) {
          lines.push(`  ~ ${storyId}: ${prevStatus} → ${currStatus}`);
        }
      }
    }

    // Check metadata version changes
    const prevMetadata = previous.metadata as Record<string, unknown> | undefined;
    const currMetadata = current.metadata as Record<string, unknown> | undefined;
    const prevVersion = prevMetadata?.version as string | undefined;
    const currVersion = currMetadata?.version as string | undefined;

    if (prevVersion !== currVersion) {
      lines.push("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      lines.push(`Version: ${prevVersion || "none"} → ${currVersion || "none"}`);
    }

    lines.push("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

    return lines.join("\n");
  }
}

/**
 * Factory function to create a FileWatcher instance
 * @param config - Configuration for the file watcher
 * @returns Configured FileWatcher instance
 */
export function createFileWatcher(config: FileWatcherConfig): FileWatcher {
  return new FileWatcherImpl(config);
}
