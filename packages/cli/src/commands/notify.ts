/**
 * Notify Command — Test desktop notifications
 */

import chalk from "chalk";
import type { Command } from "commander";
import { type Notification } from "@composio/ao-core";
import { createNotificationPlugin } from "@composio/ao-plugin-notifier-desktop";

export function registerNotify(program: Command): void {
  program
    .command("notify")
    .description("Send a test desktop notification")
    .option("--priority <level>", "Notification priority: critical, warning, or info", "info")
    .option("--title <text>", "Custom notification title")
    .option("--message <text>", "Custom notification message")
    .option("--event-type <type>", "Event type for notification", "test.notification")
    .action(async (opts) => {
      // Validate priority
      const validPriorities = ["critical", "warning", "info"];
      const priority = opts.priority.toLowerCase();
      if (!validPriorities.includes(priority)) {
        console.error(chalk.red(`Invalid priority: ${opts.priority}`));
        console.error(chalk.dim("Valid options: critical, warning, info"));
        process.exit(1);
      }

      // Create notification plugin
      const plugin = createNotificationPlugin();

      // Check if plugin is available
      const isAvailable = await plugin.isAvailable();
      if (!isAvailable) {
        console.error(chalk.red("Desktop notifications are not available on this system"));
        process.exit(1);
      }

      // Build test notification
      const notification: Notification = {
        eventId: `test-${Date.now()}`,
        eventType: opts.eventType,
        priority: priority as "critical" | "warning" | "info",
        title: opts.title || "Agent Orchestrator Test",
        message: opts.message || "This is a test notification from Agent Orchestrator",
        timestamp: new Date().toISOString(),
      };

      console.log(chalk.dim(`Sending test notification (${priority} priority)...`));

      try {
        await plugin.send(notification);
        console.log(chalk.green("✓ Test notification sent"));
        console.log(chalk.dim(`  Title: ${notification.title}`));
        console.log(chalk.dim(`  Message: ${notification.message}`));
        console.log(chalk.dim(`  Priority: ${priority}`));
      } catch (error) {
        console.error(chalk.red("Failed to send test notification"));
        if (error instanceof Error) {
          console.error(chalk.dim(error.message));
        }
        process.exit(1);
      }
    });
}
