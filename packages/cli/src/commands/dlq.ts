import chalk from "chalk";
import type { Command } from "commander";
import { confirm } from "@inquirer/prompts";
import { join, dirname } from "node:path";
import {
  createDeadLetterQueue,
  expandHome,
  loadConfig,
  getEventPublisher,
  getBMADTracker,
  getRegisteredOperationTypes,
  replayEntry,
  type DLQEntry,
} from "@composio/ao-core";

/**
 * Get the DLQ path based on config location
 */
function getDlqPath(config: ReturnType<typeof loadConfig>): string {
  // DLQ is stored relative to the config file location
  // Default to ~/.agent-orchestrator/dlq.jsonl for global state
  const configDir = dirname(config.configPath);
  return expandHome(join(configDir, ".ao/state/dlq.jsonl"));
}

/**
 * Helper to derive dataDir from config
 */
function getDataDir(config: ReturnType<typeof loadConfig>): string {
  const configDir = dirname(config.configPath);
  return expandHome(join(configDir, ".ao/state"));
}

/**
 * Format a DLQ entry for display
 */
function formatEntry(entry: DLQEntry): string {
  const timestamp = new Date(entry.failedAt).toLocaleString();
  return [
    chalk.bold(`Error ID: ${entry.errorId}`),
    `  Operation: ${chalk.cyan(entry.operation)}`,
    `  Failed: ${chalk.dim(timestamp)}`,
    `  Reason: ${chalk.yellow(entry.failureReason)}`,
    `  Retries: ${entry.retryCount}`,
    entry.originalError
      ? `  Original: ${chalk.dim(entry.originalError.message || entry.originalError)}`
      : "",
  ]
    .filter(Boolean)
    .join("\n");
}

/**
 * Parse time duration string to milliseconds
 * Supports: 1d, 7d, 24h, 60m, 30s
 */
function parseDuration(duration: string): number {
  const match = duration.match(/^(\d+)([dhms])$/);
  if (!match) {
    throw new Error(`Invalid duration format: ${duration}. Use format like 7d, 24h, 60m, 30s`);
  }

  const value = Number.parseInt(match[1], 10);
  const unit = match[2];

  const multipliers: Record<string, number> = {
    d: 24 * 60 * 60 * 1000,
    h: 60 * 60 * 1000,
    m: 60 * 1000,
    s: 1000,
  };

  return value * multipliers[unit];
}

/**
 * Format duration for display
 */
function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) {
    return `${days} day${days === 1 ? "" : "s"}`;
  }
  if (hours > 0) {
    return `${hours} hour${hours === 1 ? "" : "s"}`;
  }
  if (minutes > 0) {
    return `${minutes} minute${minutes === 1 ? "" : "s"}`;
  }
  return `${seconds} second${seconds === 1 ? "" : "s"}`;
}

export function registerDLQ(program: Command): void {
  const dlqCmd = program
    .command("dlq")
    .description("Manage dead letter queue for failed operations");

  // List all failed operations
  dlqCmd
    .command("list")
    .description("List all failed operations in the DLQ")
    .option("--json", "Output as JSON")
    .action(async (opts: { json?: boolean }) => {
      let config: ReturnType<typeof loadConfig>;
      try {
        config = loadConfig();
      } catch {
        console.error(chalk.red("No config found. Run `ao init` first."));
        process.exit(1);
      }

      // Default DLQ path
      const dlqPath = getDlqPath(config);
      const dlq = createDeadLetterQueue({ dlqPath, alertThreshold: 1000 });

      try {
        await dlq.start();
        const entries = await dlq.list();

        if (opts.json) {
          console.log(JSON.stringify(entries, null, 2));
          return;
        }

        if (entries.length === 0) {
          console.log(chalk.green("✓ DLQ is empty — no failed operations"));
          return;
        }

        console.log(chalk.bold(`Dead Letter Queue (${entries.length} entries)\n`));

        for (const entry of entries) {
          console.log(formatEntry(entry));
          console.log();
        }

        // Show stats
        const stats = await dlq.getStats();
        console.log(chalk.dim("Summary by operation:"));
        for (const [op, count] of Object.entries(stats.byOperation)) {
          console.log(`  ${chalk.cyan(op)}: ${count}`);
        }
      } finally {
        await dlq.stop();
      }
    });

  // Replay a failed operation
  dlqCmd
    .command("replay <errorId>")
    .description("Replay a failed operation (bypasses circuit breaker)")
    .action(async (errorId: string) => {
      let config: ReturnType<typeof loadConfig>;
      try {
        config = loadConfig();
      } catch {
        console.error(chalk.red("No config found. Run `ao init` first."));
        process.exit(1);
      }

      // Default DLQ path
      const dlqPath = getDlqPath(config);
      const dlq = createDeadLetterQueue({ dlqPath, alertThreshold: 1000 });

      try {
        await dlq.start();

        const entry = await dlq.get(errorId);
        if (!entry) {
          console.error(chalk.red(`Error ID not found: ${errorId}`));
          console.log(chalk.dim("\nRun 'ao dlq list' to see all failed operations"));
          process.exit(1);
        }

        console.log(chalk.bold(`Replaying operation: ${entry.operation}\n`));
        console.log(chalk.dim(`Payload: ${JSON.stringify(entry.payload, null, 2)}`));
        console.log();

        // Build replay context from registered services
        const eventPublisher = getEventPublisher();
        const bmadTracker = getBMADTracker();

        // Check if we have handlers for this operation type
        const registeredTypes = getRegisteredOperationTypes();
        if (!registeredTypes.includes(entry.operation)) {
          console.log(chalk.yellow(`⚠ No replay handler for operation type: ${entry.operation}`));
          console.log(chalk.dim(`Supported types: ${registeredTypes.join(", ")}`));
          console.log();
          console.log(chalk.dim("To manually replay:"));
          console.log(`  1. Extract payload: ${JSON.stringify(entry.payload)}`);
          console.log(`  2. Run operation: ${entry.operation}`);
          console.log(`  3. If successful, run: ao dlq remove ${errorId}`);
          process.exit(1);
        }

        // Check service availability
        if (entry.operation === "event_publish" && !eventPublisher) {
          console.log(chalk.yellow("⚠ Event publisher not available"));
          console.log(chalk.dim("Start the application to enable event replay."));
          process.exit(1);
        }

        if (entry.operation === "bmad_sync" && !bmadTracker) {
          console.log(chalk.yellow("⚠ BMAD tracker not available"));
          console.log(chalk.dim("Start the application to enable BMAD sync replay."));
          process.exit(1);
        }

        // Attempt replay
        const result = await replayEntry(entry, {
          eventPublisher,
          bmadTracker,
          dataDir: getDataDir(config),
        });

        if (result.success) {
          console.log(chalk.green(`✓ Replay successful`));
          // Remove from DLQ on success
          await dlq.remove(errorId);
          console.log(chalk.dim(`Removed entry ${errorId} from DLQ`));
        } else {
          console.log(chalk.red(`✗ Replay failed: ${result.error}`));
          console.log(chalk.dim("Entry remains in DLQ for future retry"));
          process.exit(1);
        }
      } finally {
        await dlq.stop();
      }
    });

  // Replay all failed operations
  dlqCmd
    .command("replay-all")
    .description("Replay all failed operations in the DLQ")
    .option("--force", "Skip confirmation prompt")
    .action(async (opts: { force?: boolean }) => {
      let config: ReturnType<typeof loadConfig>;
      try {
        config = loadConfig();
      } catch {
        console.error(chalk.red("No config found. Run `ao init` first."));
        process.exit(1);
      }

      // Default DLQ path
      const dlqPath = getDlqPath(config);
      const dlq = createDeadLetterQueue({ dlqPath, alertThreshold: 1000 });

      try {
        await dlq.start();
        const entries = await dlq.list();

        if (entries.length === 0) {
          console.log(chalk.green("✓ DLQ is empty — nothing to replay"));
          return;
        }

        // Build replay context from registered services
        const eventPublisher = getEventPublisher();
        const bmadTracker = getBMADTracker();
        const registeredTypes = getRegisteredOperationTypes();

        // Categorize entries
        const supported: DLQEntry[] = [];
        const unsupported: DLQEntry[] = [];

        for (const entry of entries) {
          if (registeredTypes.includes(entry.operation)) {
            supported.push(entry);
          } else {
            unsupported.push(entry);
          }
        }

        console.log(
          chalk.bold(`Found ${chalk.yellow(String(entries.length))} failed operations\n`),
        );
        console.log(`  Supported: ${chalk.green(String(supported.length))}`);
        console.log(`  Unsupported: ${chalk.red(String(unsupported.length))}`);

        if (unsupported.length > 0) {
          console.log();
          console.log(chalk.dim("Unsupported operation types:"));
          const unsupportedTypes = [...new Set(unsupported.map((e) => e.operation))];
          for (const type of unsupportedTypes) {
            console.log(`  - ${type}`);
          }
        }

        if (supported.length === 0) {
          console.log();
          console.log(chalk.yellow("No supported operations to replay"));
          return;
        }

        console.log();
        console.log(chalk.dim("Operations to replay:"));
        for (const entry of supported) {
          console.log(`  ${chalk.cyan(entry.operation)}: ${entry.failureReason}`);
        }
        console.log();

        if (!opts.force) {
          const confirmed = await confirm({
            message: `Replay ${supported.length} supported operations?`,
            default: false,
          });

          if (!confirmed) {
            console.log(chalk.dim("Replay cancelled"));
            return;
          }
        }

        // Replay each supported entry
        let successCount = 0;
        let failCount = 0;

        for (const entry of supported) {
          const result = await replayEntry(entry, {
            eventPublisher,
            bmadTracker,
            dataDir: getDataDir(config),
          });

          if (result.success) {
            await dlq.remove(entry.errorId);
            console.log(chalk.green(`  ✓ ${entry.operation} (${entry.errorId})`));
            successCount++;
          } else {
            console.log(chalk.red(`  ✗ ${entry.operation} (${entry.errorId}): ${result.error}`));
            failCount++;
          }
        }

        console.log();
        console.log(chalk.bold("Replay Summary"));
        console.log(`  Successful: ${chalk.green(String(successCount))}`);
        console.log(`  Failed: ${chalk.red(String(failCount))}`);

        if (failCount > 0) {
          console.log();
          console.log(chalk.dim("Failed entries remain in DLQ for future retry"));
          process.exit(1);
        }
      } finally {
        await dlq.stop();
      }
    });

  // Purge old entries
  dlqCmd
    .command("purge")
    .description("Remove DLQ entries older than specified duration")
    .option("--older-than <duration>", "Duration threshold (e.g., 7d, 24h, 60m)", "7d")
    .option("--yes", "Skip confirmation prompt")
    .action(async (opts: { olderThan: string; yes?: boolean }) => {
      let config: ReturnType<typeof loadConfig>;
      try {
        config = loadConfig();
      } catch {
        console.error(chalk.red("No config found. Run `ao init` first."));
        process.exit(1);
      }

      // Default DLQ path
      const dlqPath = getDlqPath(config);
      const dlq = createDeadLetterQueue({ dlqPath, alertThreshold: 1000 });

      try {
        await dlq.start();

        const olderThanMs = parseDuration(opts.olderThan);
        const stats = await dlq.getStats();

        if (stats.totalEntries === 0) {
          console.log(chalk.green("✓ DLQ is empty — nothing to purge"));
          return;
        }

        // Count entries that would be purged
        const now = Date.now();
        let purgeCount = 0;
        const entries = await dlq.list();
        for (const entry of entries) {
          const entryTime = new Date(entry.failedAt).getTime();
          const age = now - entryTime;
          if (age > olderThanMs) {
            purgeCount++;
          }
        }

        if (purgeCount === 0) {
          console.log(
            chalk.green(
              `✓ No entries older than ${chalk.bold(formatDuration(olderThanMs))} to purge`,
            ),
          );
          return;
        }

        console.log(
          chalk.bold(
            `Will purge ${chalk.red(String(purgeCount))} of ${chalk.bold(String(stats.totalEntries))} entries`,
          ),
        );
        console.log(chalk.dim(`(older than ${formatDuration(olderThanMs)})\n`));

        if (!opts.yes) {
          const confirmed = await confirm({
            message: "Continue with purge?",
            default: false,
          });

          if (!confirmed) {
            console.log(chalk.dim("Purge cancelled"));
            return;
          }
        }

        const purged = await dlq.purge(olderThanMs);
        console.log(chalk.green(`✓ Purged ${chalk.bold(String(purged))} entries from DLQ`));
      } finally {
        await dlq.stop();
      }
    });

  // Show DLQ stats
  dlqCmd
    .command("stats")
    .description("Show statistics about the DLQ")
    .option("--json", "Output as JSON")
    .action(async (opts: { json?: boolean }) => {
      let config: ReturnType<typeof loadConfig>;
      try {
        config = loadConfig();
      } catch {
        console.error(chalk.red("No config found. Run `ao init` first."));
        process.exit(1);
      }

      // Default DLQ path
      const dlqPath = getDlqPath(config);
      const dlq = createDeadLetterQueue({ dlqPath, alertThreshold: 1000 });

      try {
        await dlq.start();
        const stats = await dlq.getStats();

        if (opts.json) {
          console.log(JSON.stringify(stats, null, 2));
          return;
        }

        console.log(chalk.bold("Dead Letter Queue Statistics\n"));

        console.log(`  Total entries: ${chalk.bold(String(stats.totalEntries))}`);

        if (stats.totalEntries > 0) {
          console.log(
            `  Oldest entry: ${chalk.dim(stats.oldestEntry ? new Date(stats.oldestEntry).toLocaleString() : "N/A")}`,
          );
          console.log(
            `  Newest entry: ${chalk.dim(stats.newestEntry ? new Date(stats.newestEntry).toLocaleString() : "N/A")}`,
          );

          console.log(chalk.dim("\nBy operation:"));
          for (const [op, count] of Object.entries(stats.byOperation)) {
            console.log(`  ${chalk.cyan(op)}: ${count}`);
          }

          // Alert if DLQ is getting large
          if (stats.totalEntries > 100) {
            console.log();
            console.log(
              chalk.yellow(
                `⚠ DLQ size is ${chalk.bold(String(stats.totalEntries))} entries (consider purging old entries)`,
              ),
            );
            console.log(chalk.dim(`Run: ao dlq purge --older-than 7d`));
          }
        }
      } finally {
        await dlq.stop();
      }
    });
}
