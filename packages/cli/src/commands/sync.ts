/**
 * Sync Command
 *
 * Bidirectional state synchronization with BMAD tracker.
 * Supports syncing specific stories or all stories, with status reporting.
 */

import chalk from "chalk";
import ora from "ora";
import type { Command } from "commander";
import { loadConfig, createStateManager, createSyncService } from "@composio/ao-core";

/**
 * Display sync status
 */
function displaySyncStatus(status: {
  lastSyncTime: string | null;
  queueSize: number;
  failedCount: number;
  bmadConnected: boolean;
  degradedMode: boolean;
}): void {
  console.log(chalk.bold("\n  Sync Status:"));
  console.log(
    `  Last Sync: ${status.lastSyncTime ? chalk.gray(status.lastSyncTime) : chalk.yellow("Never")}`,
  );
  console.log(`  Queue Size: ${status.queueSize}`);
  console.log(`  Failed: ${status.failedCount}`);
  console.log(`  BMAD Connected: ${status.bmadConnected ? chalk.green("Yes") : chalk.red("No")}`);
  if (status.degradedMode) {
    console.log(`  ${chalk.yellow("⚠ Degraded Mode: Active")}`);
  }
  console.log();
}

export function registerSync(program: Command): void {
  program
    .command("sync [storyId]")
    .description("Sync state with BMAD tracker")
    .option("--to-bmad", "Push local state to BMAD")
    .option("--from-bmad", "Pull state from BMAD")
    .option("--status", "Show sync status")
    .action(async (storyId: string | undefined, opts) => {
      const startTime = Date.now();

      // Load config
      const config = loadConfig();
      if (!config) {
        console.error(chalk.red("No agent-orchestrator.yaml found. Run 'ao init' first."));
        process.exit(1);
      }

      // Find current project
      const cwd = process.cwd();
      let projectPath: string | null = null;
      for (const [_id, proj] of Object.entries(config.projects)) {
        if (cwd.startsWith(proj.path) || cwd === proj.path) {
          projectPath = proj.path;
          break;
        }
      }

      if (!projectPath) {
        const firstProject = Object.values(config.projects)[0];
        projectPath = firstProject?.path ?? cwd;
      }

      // Create StateManager
      const yamlPath = `${projectPath}/sprint-status.yaml`;
      const stateManager = createStateManager({ yamlPath });
      await stateManager.initialize();

      // Create BMAD Tracker (file-system implementation)
      const bmadTracker = createFileSystemBMADTracker(yamlPath);

      // Create SyncService
      const syncService = createSyncService({
        eventBus: stateManager as unknown as {
          name: string;
          publish: () => Promise<void>;
          subscribe: () => Promise<() => void>;
          close: () => Promise<void>;
        },
        stateManager,
        bmadTracker,
      });

      // Handle --status flag
      if (opts.status) {
        const status = syncService.getStatus();
        displaySyncStatus(status);
        await stateManager.close();
        await syncService.close();
        return;
      }

      // Handle syncing
      try {
        if (opts.toBmad) {
          // Sync to BMAD
          if (storyId) {
            const state = stateManager.get(storyId);
            if (!state) {
              console.error(chalk.red(`Story "${storyId}" not found in sprint-status.yaml`));
              await stateManager.close();
              await syncService.close();
              process.exit(1);
            }

            const spinner = ora(`Syncing ${storyId} to BMAD...`).start();
            const result = await syncService.syncToBMAD(storyId, state);
            if (result.success) {
              spinner.succeed(`Synced ${storyId} to BMAD`);
            } else {
              spinner.fail(`Failed to sync ${storyId}: ${result.error}`);
            }
          } else {
            const spinner = ora("Syncing all stories to BMAD...").start();
            const result = await syncService.syncAll("to-bmad");
            if (result.failed.length === 0) {
              spinner.succeed(`Synced ${result.succeeded.length} stories to BMAD`);
            } else {
              spinner.warn(
                `Synced ${result.succeeded.length} stories to BMAD, ${result.failed.length} failed`,
              );
              result.failed.forEach(({ storyId, error }) => {
                console.error(chalk.red(`  ${storyId}: ${error}`));
              });
            }
          }
        } else if (opts.fromBmad) {
          // Sync from BMAD
          const spinner = ora("Syncing from BMAD...").start();
          const result = await syncService.syncAll("from-bmad");
          if (result.failed.length === 0) {
            spinner.succeed(`Synced ${result.succeeded.length} stories from BMAD`);
          } else {
            spinner.warn(
              `Synced ${result.succeeded.length} stories from BMAD, ${result.failed.length} failed`,
            );
            result.failed.forEach(({ storyId, error }) => {
              console.error(chalk.red(`  ${storyId}: ${error}`));
            });
          }
        } else if (storyId) {
          // Sync specific story bidirectional
          const state = stateManager.get(storyId);
          if (!state) {
            console.error(chalk.red(`Story "${storyId}" not found in sprint-status.yaml`));
            await stateManager.close();
            await syncService.close();
            process.exit(1);
          }

          const spinner = ora(`Syncing ${storyId} with BMAD...`).start();
          const result = await syncService.syncToBMAD(storyId, state);
          if (result.success) {
            spinner.succeed(`Synced ${storyId} with BMAD`);
          } else {
            spinner.fail(`Failed to sync ${storyId}: ${result.error}`);
          }
        } else {
          // Bidirectional sync for all stories
          const spinner = ora("Syncing with BMAD...").start();
          const result = await syncService.syncAll("bidirectional");
          if (result.failed.length === 0 && result.conflicts.length === 0) {
            spinner.succeed(`Synced ${result.succeeded.length} stories with BMAD`);
          } else {
            const warnings = [];
            if (result.conflicts.length > 0) {
              warnings.push(`${result.conflicts.length} conflicts resolved`);
            }
            if (result.failed.length > 0) {
              warnings.push(`${result.failed.length} failed`);
            }
            spinner.warn(`Synced ${result.succeeded.length} stories (${warnings.join(", ")})`);

            if (result.conflicts.length > 0) {
              console.log(chalk.yellow("\n  Conflicts Resolved:"));
              result.conflicts.forEach(({ storyId, info }) => {
                console.log(chalk.gray(`    ${storyId}: ${info.winner} won (${info.type})`));
              });
            }

            if (result.failed.length > 0) {
              console.log(chalk.red("\n  Failed Syncs:"));
              result.failed.forEach(({ storyId, error }) => {
                console.error(chalk.red(`    ${storyId}: ${error}`));
              });
            }
          }

          // Show duration
          const duration = Date.now() - startTime;
          if (duration > 1000) {
            console.warn(
              chalk.yellow(`Warning: Sync took ${duration}ms (>1000ms target for 100 stories)`),
            );
          }
        }
      } finally {
        await stateManager.close();
        await syncService.close();
      }
    });
}

/**
 * Create a file-system BMAD tracker implementation
 * This is a simple implementation that reads/writes sprint-status.yaml
 */
function createFileSystemBMADTracker(yamlPath: string) {
  return {
    name: "file-system",
    async getStory(storyId: string) {
      const { readFile } = await import("node:fs/promises");
      const { parse } = await import("yaml");
      try {
        const content = await readFile(yamlPath, "utf-8");
        const yaml = parse(content);
        const story = yaml.development_status[storyId];

        if (!story) return null;

        return {
          id: storyId,
          status: story.status,
          title: story.title,
          version: story.version,
          updatedAt: story.updatedAt,
        };
      } catch {
        return null;
      }
    },
    async updateStory(_storyId: string, _state: unknown) {
      const { readFile } = await import("node:fs/promises");
      const { parse } = await import("yaml");
      const content = await readFile(yamlPath, "utf-8");
      const yaml = parse(content);

      if (!yaml.development_status) {
        yaml.development_status = {};
      }

      // Update is handled by StateManager, this is a no-op for file-system tracker
      // since StateManager already writes to the same file
    },
    async listStories() {
      const { readFile } = await import("node:fs/promises");
      const { parse } = await import("yaml");
      const content = await readFile(yamlPath, "utf-8");
      const yaml = parse(content);
      const stories = new Map();

      for (const [storyId, story] of Object.entries(yaml.development_status || {})) {
        if (storyId.startsWith("epic-")) continue;

        stories.set(storyId, {
          id: storyId,
          status: story.status,
          title: story.title,
          version: story.version,
          updatedAt: story.updatedAt,
        });
      }

      return stories;
    },
    async isAvailable() {
      const { readFile } = await import("node:fs/promises");
      try {
        await readFile(yamlPath, "utf-8");
        return true;
      } catch {
        return false;
      }
    },
  };
}
