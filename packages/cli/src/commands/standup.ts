/**
 * ao standup — Daily standup report generator.
 *
 * Usage:
 *   ao standup [project]
 *   ao standup [project] --epic epic-auth --json
 *   ao standup [project] --markdown
 */

import chalk from "chalk";
import type { Command } from "commander";
import { loadConfig } from "@composio/ao-core";
import { generateStandup } from "@composio/ao-plugin-tracker-bmad";
import { header } from "../lib/format.js";
import { resolveProject } from "../lib/resolve-project.js";

function formatMs(ms: number): string {
  const hours = ms / (1000 * 60 * 60);
  if (hours < 24) return `${hours.toFixed(1)}h`;
  const days = hours / 24;
  return `${days.toFixed(1)}d`;
}

function paceColor(pace: string): string {
  switch (pace) {
    case "ahead":
      return chalk.green(pace);
    case "on-pace":
      return chalk.cyan(pace);
    case "behind":
      return chalk.red(pace);
    default:
      return chalk.dim(pace);
  }
}

export function registerStandup(program: Command): void {
  program
    .command("standup [project]")
    .description("Generate a daily standup report")
    .option("--epic <id>", "Filter by epic ID")
    .option("--json", "Output as JSON")
    .option("--markdown", "Output raw markdown")
    .action(
      async (
        projectArg: string | undefined,
        opts: { epic?: string; json?: boolean; markdown?: boolean },
      ) => {
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

        if (!project.tracker || project.tracker.plugin !== "bmad") {
          console.error(chalk.red("Standup requires the bmad tracker plugin."));
          process.exit(1);
        }

        let result: ReturnType<typeof generateStandup>;
        try {
          result = generateStandup(project, opts.epic);
        } catch (err) {
          console.error(
            chalk.red(
              `Failed to generate standup: ${err instanceof Error ? err.message : String(err)}`,
            ),
          );
          process.exit(1);
        }

        if (opts.json) {
          console.log(JSON.stringify(result, null, 2));
          return;
        }

        if (opts.markdown) {
          console.log(result.markdown);
          return;
        }

        // Formatted console output
        console.log(header(`Standup: ${project.name || projectId}`));
        console.log();

        // Completed yesterday
        console.log(chalk.bold("  Completed Yesterday"));
        if (result.completedYesterday.length === 0) {
          console.log(chalk.dim("    No stories completed in the last 24h."));
        } else {
          for (const story of result.completedYesterday) {
            console.log(`    ${chalk.green("+")} ${story.storyId.padEnd(10)} ${story.title}`);
          }
        }
        console.log();

        // In progress
        console.log(chalk.bold("  In Progress"));
        if (result.inProgress.length === 0) {
          console.log(chalk.dim("    No stories currently in progress."));
        } else {
          for (const story of result.inProgress) {
            const age = formatMs(story.ageMs);
            const session = story.assignedSession ? chalk.dim(` [${story.assignedSession}]`) : "";
            console.log(
              `    ${chalk.blue(">")} ${story.storyId.padEnd(10)} ${story.title} ${chalk.dim(`(${story.status}, ${age})`)}${session}`,
            );
          }
        }
        console.log();

        // Blocked
        if (result.blocked.length > 0) {
          console.log(chalk.bold.red("  Blocked"));
          for (const story of result.blocked) {
            console.log(`    ${chalk.red("!")} ${story.storyId.padEnd(10)} ${story.reason}`);
          }
          console.log();
        }

        // Rework alerts
        if (result.reworkAlerts.length > 0) {
          console.log(chalk.bold.yellow("  Rework Alerts"));
          for (const alert of result.reworkAlerts) {
            console.log(
              `    ${chalk.yellow("~")} ${alert.storyId.padEnd(10)} ${alert.from} -> ${alert.to}`,
            );
          }
          console.log();
        }

        // Health summary
        console.log(chalk.bold("  Sprint Health"));
        console.log(`    Pace: ${paceColor(result.health.pace)}`);
        console.log(
          `    Progress: ${chalk.cyan(`${result.health.completedStories}/${result.health.totalStories}`)} (${result.health.remainingStories} remaining)`,
        );
        if (result.health.projectedCompletion) {
          console.log(`    Projected: ${result.health.projectedCompletion}`);
        }
        console.log();
      },
    );
}
