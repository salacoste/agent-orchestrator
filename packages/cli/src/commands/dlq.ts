import chalk from "chalk";
import type { Command } from "commander";
import { confirm } from "@inquirer/prompts";
import { join } from "node:path";
import { createDeadLetterQueue, expandHome, loadConfig, type DLQEntry } from "@composio/ao-core";

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
      const dlqPath = expandHome(join(config.stateDir || ".ao/state", "dlq.jsonl"));
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
      const dlqPath = expandHome(join(config.stateDir || ".ao/state", "dlq.jsonl"));
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

        // For now, we can't actually replay without knowing what operation to execute
        // This would require integration with the actual services (event bus, BMAD sync, etc.)
        // For now, we'll show what would be replayed
        console.log(chalk.yellow("⚠ Replay not fully implemented"));
        console.log(chalk.dim("This requires integration with service-specific replay handlers."));
        console.log();
        console.log(chalk.dim("To manually replay:"));
        console.log(`  1. Extract payload: ${JSON.stringify(entry.payload)}`);
        console.log(`  2. Run operation: ${entry.operation}`);
        console.log(`  3. If successful, run: ao dlq remove ${errorId}`);

        // TODO: Implement service-specific replay handlers
        // const result = await dlq.replay(errorId, async (payload) => {
        //   // Service-specific replay logic here
        //   return await replayOperation(entry.operation, payload);
        // });
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
      const dlqPath = expandHome(join(config.stateDir || ".ao/state", "dlq.jsonl"));
      const dlq = createDeadLetterQueue({ dlqPath, alertThreshold: 1000 });

      try {
        await dlq.start();
        const entries = await dlq.list();

        if (entries.length === 0) {
          console.log(chalk.green("✓ DLQ is empty — nothing to replay"));
          return;
        }

        console.log(
          chalk.bold(`Found ${chalk.yellow(String(entries.length))} failed operations to replay\n`),
        );

        for (const entry of entries) {
          console.log(`  ${chalk.cyan(entry.operation)}: ${entry.failureReason}`);
        }
        console.log();

        if (!opts.force) {
          const confirmed = await confirm({
            message: "Replay all failed operations?",
            default: false,
          });

          if (!confirmed) {
            console.log(chalk.dim("Replay cancelled"));
            return;
          }
        }

        // For now, show what would be replayed
        // TODO: Implement service-specific replay handlers
        console.log(chalk.yellow("⚠ Replay not fully implemented"));
        console.log(chalk.dim("This requires integration with service-specific replay handlers."));
        console.log();
        console.log(chalk.dim("To manually replay each operation:"));
        console.log(`  Run: ${chalk.bold("ao dlq list")}`);
        console.log(`  Then: ${chalk.bold("ao dlq replay <error-id>")}`);
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
      const dlqPath = expandHome(join(config.stateDir || ".ao/state", "dlq.jsonl"));
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
      const dlqPath = expandHome(join(config.stateDir || ".ao/state", "dlq.jsonl"));
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
