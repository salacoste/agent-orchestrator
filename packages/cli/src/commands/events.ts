import chalk from "chalk";
import type { Command } from "commander";
import { join } from "node:path";
import {
  createDegradedModeService,
  expandHome,
  loadConfig,
  getDegradedModeService,
  getEventPublisher,
} from "@composio/ao-core";

/**
 * Format event count for display
 */
function formatEventCount(count: number): string {
  if (count === 0) {
    return chalk.green("0");
  }
  if (count < 10) {
    return chalk.yellow(String(count));
  }
  return chalk.red(String(count));
}

export function registerEvents(program: Command): void {
  const eventsCmd = program.command("events").description("Manage event publishing and queue");

  // Drain queued events
  eventsCmd
    .command("drain")
    .description("Manually drain queued events when event bus is available")
    .option("--force", "Force drain even if event bus is unavailable")
    .option("--timeout <ms>", "Timeout in milliseconds (default: 30000)", "30000")
    .option("--json", "Output as JSON")
    .action(async (opts: { force?: boolean; timeout: string; json?: boolean }) => {
      let config: ReturnType<typeof loadConfig>;
      try {
        config = loadConfig();
      } catch {
        console.error(chalk.red("No config found. Run `ao init` first."));
        process.exit(1);
      }

      // Try to get the registered EventPublisher (from running application)
      const eventPublisher = getEventPublisher();
      const degradedMode = getDegradedModeService();

      // If EventPublisher is registered, use it for actual drain
      if (eventPublisher && degradedMode) {
        const status = degradedMode.getStatus();
        const eventBusAvailable = status.services["event-bus"]?.available ?? true;

        if (!eventBusAvailable && !opts.force) {
          console.error(chalk.red("Event bus is currently unavailable"));
          console.log(chalk.dim("\nQueued events:"));
          console.log(`  Events: ${formatEventCount(status.queuedEvents)}`);
          console.log(`  Syncs: ${formatEventCount(status.queuedSyncs)}`);
          console.log();
          console.log(chalk.dim("Use --force to attempt drain anyway"));
          process.exit(1);
        }

        const initialQueueSize = eventPublisher.getQueueSize();
        const droppedCount = eventPublisher.getDroppedEventsCount();

        if (opts.json) {
          console.log(
            JSON.stringify(
              {
                eventBusAvailable,
                queuedEvents: initialQueueSize,
                droppedEvents: droppedCount,
                mode: status.mode,
              },
              null,
              2,
            ),
          );
          return;
        }

        console.log(chalk.bold("Event Drain Status\n"));
        console.log(
          `  Event bus: ${eventBusAvailable ? chalk.green("Connected") : chalk.red("Disconnected")}`,
        );
        console.log(
          `  Degraded mode: ${status.mode === "normal" ? chalk.green("Normal") : chalk.yellow(status.mode)}`,
        );
        console.log(`  Queued events: ${formatEventCount(initialQueueSize)}`);
        if (droppedCount > 0) {
          console.log(`  Dropped events: ${chalk.red(String(droppedCount))}`);
        }

        if (initialQueueSize === 0) {
          console.log();
          console.log(chalk.green("✓ No queued events to drain"));
          return;
        }

        // If force is specified, trigger actual drain
        if (opts.force) {
          console.log();
          console.log(chalk.yellow("Force draining queued events..."));
          console.log();

          try {
            const timeoutMs = Number.parseInt(opts.timeout, 10);
            const startTime = Date.now();

            await eventPublisher.flush(timeoutMs);

            const elapsed = Date.now() - startTime;
            const finalQueueSize = eventPublisher.getQueueSize();

            console.log();
            console.log(chalk.green(`✓ Drain completed in ${elapsed}ms`));
            console.log(
              `  Events drained: ${chalk.green(String(initialQueueSize - finalQueueSize))}`,
            );
            if (finalQueueSize > 0) {
              console.log(`  Events remaining: ${chalk.yellow(String(finalQueueSize))}`);
            }
          } catch (error) {
            console.log();
            console.error(chalk.red("✗ Drain failed:"), error);
            console.log(chalk.dim("Events remain queued and will be retried on next recovery"));
            process.exit(1);
          }
        } else {
          console.log();
          console.log(chalk.dim("Event drain is handled automatically by EventPublisher"));
          console.log(chalk.dim("when the event bus reconnects. Use --force to drain manually."));
        }
      } else {
        // Fallback: No EventPublisher registered, show basic status
        const eventsBackupPath = expandHome(
          join(config.stateDir || ".ao/state", ".ao-events/degraded-events.jsonl"),
        );
        const syncBackupPath = expandHome(
          join(config.stateDir || ".ao/state", ".ao-events/degraded-syncs.jsonl"),
        );

        const fallbackDegradedMode = createDegradedModeService({
          eventsBackupPath,
          syncBackupPath,
          healthCheckIntervalMs: 5000,
          recoveryTimeoutMs: Number.parseInt(opts.timeout, 10),
        });

        try {
          await fallbackDegradedMode.start();

          const status = fallbackDegradedMode.getStatus();
          const eventBusAvailable = status.services["event-bus"]?.available ?? true;

          if (opts.json) {
            console.log(
              JSON.stringify(
                {
                  eventBusAvailable,
                  queuedEvents: status.queuedEvents,
                  queuedSyncs: status.queuedSyncs,
                  mode: status.mode,
                },
                null,
                2,
              ),
            );
            return;
          }

          console.log(chalk.bold("Event Queue Status\n"));
          console.log(
            `  Event bus: ${eventBusAvailable ? chalk.green("Connected") : chalk.red("Disconnected")}`,
          );
          console.log(
            `  Degraded mode: ${status.mode === "normal" ? chalk.green("Normal") : chalk.yellow(status.mode)}`,
          );
          console.log(`  Queued events: ${formatEventCount(status.queuedEvents)}`);
          console.log(`  Queued syncs: ${formatEventCount(status.queuedSyncs)}`);

          if (status.queuedEvents === 0 && status.queuedSyncs === 0) {
            console.log();
            console.log(chalk.green("✓ No queued events"));
          } else {
            console.log();
            console.log(chalk.yellow("⚠ EventPublisher is not registered"));
            console.log(chalk.dim("Start the application to enable event drain functionality"));
          }
        } finally {
          await fallbackDegradedMode.stop();
        }
      }
    });

  // Show queue status
  eventsCmd
    .command("status")
    .description("Show current event queue status")
    .option("--json", "Output as JSON")
    .action(async (opts: { json?: boolean }) => {
      let config: ReturnType<typeof loadConfig>;
      try {
        config = loadConfig();
      } catch {
        console.error(chalk.red("No config found. Run `ao init` first."));
        process.exit(1);
      }

      // Try to get the registered EventPublisher (from running application)
      const eventPublisher = getEventPublisher();
      const degradedMode = getDegradedModeService();

      // If EventPublisher is registered, use it for detailed status
      if (eventPublisher && degradedMode) {
        const status = degradedMode.getStatus();
        const droppedCount = eventPublisher.getDroppedEventsCount();

        if (opts.json) {
          console.log(
            JSON.stringify(
              {
                ...status,
                droppedEvents: droppedCount,
                publisherRegistered: true,
              },
              null,
              2,
            ),
          );
          return;
        }

        console.log(chalk.bold("Event Queue Status\n"));

        console.log(
          `  Degraded mode: ${status.mode === "normal" ? chalk.green("Normal") : chalk.yellow(status.mode)}`,
        );
        console.log(
          `  Local state: ${status.localStateOperational ? chalk.green("Operational") : chalk.red("Failed")}`,
        );
        console.log(`  Publisher registered: ${chalk.green("Yes")}`);

        console.log(chalk.dim("\nService Availability:"));
        for (const [service, availability] of Object.entries(status.services)) {
          const statusText = availability.available
            ? chalk.green("Available")
            : chalk.red("Unavailable");
          console.log(`  ${service}: ${statusText}`);
          if (availability.lastError) {
            console.log(`    Error: ${chalk.dim(availability.lastError)}`);
          }
        }

        console.log(chalk.dim("\nQueued Operations:"));
        console.log(`  Events: ${formatEventCount(eventPublisher.getQueueSize())}`);
        console.log(`  Syncs: ${formatEventCount(status.queuedSyncs)}`);
        if (droppedCount > 0) {
          console.log(`  Dropped events: ${chalk.red(String(droppedCount))}`);
        }

        if (eventPublisher.getQueueSize() > 0 || status.queuedSyncs > 0) {
          console.log();
          if (status.enteredAt) {
            const degradedDuration = Date.now() - status.enteredAt.getTime();
            const minutes = Math.floor(degradedDuration / 60000);
            console.log(chalk.dim(`In degraded mode for ${minutes} minutes`));
          }
          console.log(chalk.dim("Events will be automatically flushed when services recover"));
        }

        if (status.mode !== "normal") {
          console.log();
          console.log(chalk.yellow(`⚠ Currently in degraded mode: ${chalk.bold(status.mode)}`));
          console.log(chalk.dim("Events are being queued and will flush when services recover"));
        }
      } else {
        // Fallback: No EventPublisher registered, show basic status from file
        const eventsBackupPath = expandHome(
          join(config.stateDir || ".ao/state", ".ao-events/degraded-events.jsonl"),
        );
        const syncBackupPath = expandHome(
          join(config.stateDir || ".ao/state", ".ao-events/degraded-syncs.jsonl"),
        );

        const fallbackDegradedMode = createDegradedModeService({
          eventsBackupPath,
          syncBackupPath,
          healthCheckIntervalMs: 5000,
        });

        try {
          await fallbackDegradedMode.start();

          const status = fallbackDegradedMode.getStatus();

          if (opts.json) {
            console.log(
              JSON.stringify(
                {
                  ...status,
                  publisherRegistered: false,
                },
                null,
                2,
              ),
            );
            return;
          }

          console.log(chalk.bold("Event Queue Status\n"));

          console.log(
            `  Degraded mode: ${status.mode === "normal" ? chalk.green("Normal") : chalk.yellow(status.mode)}`,
          );
          console.log(
            `  Local state: ${status.localStateOperational ? chalk.green("Operational") : chalk.red("Failed")}`,
          );
          console.log(`  Publisher registered: ${chalk.red("No")}`);

          console.log(chalk.dim("\nQueued Operations (from backup files):"));
          console.log(`  Events: ${formatEventCount(status.queuedEvents)}`);
          console.log(`  Syncs: ${formatEventCount(status.queuedSyncs)}`);

          if (status.queuedEvents > 0 || status.queuedSyncs > 0) {
            console.log();
            console.log(chalk.yellow("⚠ EventPublisher is not registered"));
            console.log(chalk.dim("Start the application to enable event queue management"));
          }

          if (status.mode !== "normal") {
            console.log();
            console.log(chalk.yellow(`⚠ Currently in degraded mode: ${chalk.bold(status.mode)}`));
          }
        } finally {
          await fallbackDegradedMode.stop();
        }
      }
    });
}
