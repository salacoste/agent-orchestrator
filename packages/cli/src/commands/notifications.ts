import chalk from "chalk";
import type { Command } from "commander";
import { loadConfig } from "@composio/ao-core";
import {
  checkSprintNotifications,
  type SprintNotification,
} from "@composio/ao-plugin-tracker-bmad";
import { getTracker } from "../lib/plugins.js";
import { header } from "../lib/format.js";
import { resolveProject } from "../lib/resolve-project.js";

function severityBadge(severity: string): string {
  switch (severity) {
    case "critical":
      return chalk.red("● CRITICAL");
    case "warning":
      return chalk.yellow("▲ WARNING");
    default:
      return chalk.dim("ℹ INFO");
  }
}

function renderNotification(notification: SprintNotification): void {
  console.log(`  ${severityBadge(notification.severity)}  ${notification.title}`);
  console.log(`    ${chalk.dim(notification.message)}`);
  if (notification.details.length > 0) {
    for (const detail of notification.details) {
      console.log(`    ${chalk.dim("→")} ${chalk.dim(detail)}`);
    }
  }
}

export function registerNotifications(program: Command): void {
  program
    .command("notifications [project]")
    .description("Show sprint notifications — health alerts, stuck stories, forecast warnings")
    .option("--json", "Output as JSON")
    .action(async (projectArg: string | undefined, opts: { json?: boolean }) => {
      let config: ReturnType<typeof loadConfig>;
      try {
        config = loadConfig();
      } catch {
        console.error(chalk.red("No config found. Run `ao init` first."));
        process.exit(1);
      }

      const projectId = resolveProject(config, projectArg);
      const project = config.projects[projectId];
      if (!project) {
        console.error(chalk.red(`Project config not found: ${projectId}`));
        process.exit(1);
      }

      // Verify tracker is bmad
      const tracker = getTracker(config, projectId);
      if (!tracker || tracker.name !== "bmad") {
        console.error(chalk.red("Notifications require the bmad tracker plugin."));
        process.exit(1);
      }

      let notifications: SprintNotification[];
      try {
        notifications = checkSprintNotifications(project);
      } catch (err) {
        console.error(
          chalk.red(
            `Failed to check notifications: ${err instanceof Error ? err.message : String(err)}`,
          ),
        );
        process.exit(1);
      }

      // JSON output
      if (opts.json) {
        console.log(JSON.stringify(notifications, null, 2));
        return;
      }

      // Formatted output
      console.log(header(`Sprint Notifications: ${project.name || projectId}`));
      console.log();

      if (notifications.length === 0) {
        console.log(`  ${chalk.green("✓")} No notifications.`);
        return;
      }

      for (const notification of notifications) {
        renderNotification(notification);
        console.log();
      }
    });
}
