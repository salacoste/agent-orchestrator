import chalk from "chalk";
import type { Command } from "commander";
import { loadConfig } from "@composio/ao-core";
import { computeRetrospective, type RetrospectiveResult } from "@composio/ao-plugin-tracker-bmad";
import { getTracker } from "../lib/plugins.js";
import { header } from "../lib/format.js";
import { resolveProject } from "../lib/resolve-project.js";

/** Format milliseconds as a human-readable duration. */
function formatDuration(ms: number): string {
  if (ms < 0) return "0m";
  const totalMinutes = Math.floor(ms / (1000 * 60));
  const totalHours = Math.floor(totalMinutes / 60);
  const totalDays = Math.floor(totalHours / 24);

  if (totalDays > 0) {
    const remainingHours = totalHours % 24;
    return remainingHours > 0 ? `${totalDays}d ${remainingHours}h` : `${totalDays}d`;
  }
  if (totalHours > 0) {
    const remainingMinutes = totalMinutes % 60;
    return remainingMinutes > 0 ? `${totalHours}h ${remainingMinutes}m` : `${totalHours}h`;
  }
  return `${totalMinutes}m`;
}

export function registerRetro(program: Command): void {
  program
    .command("retro [project]")
    .description("Show sprint retrospective analytics — velocity trends, carry-over, cycle times")
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
        console.error(chalk.red("Retrospective requires the bmad tracker plugin."));
        process.exit(1);
      }

      let result: RetrospectiveResult;
      try {
        result = computeRetrospective(project);
      } catch (err) {
        console.error(
          chalk.red(
            `Failed to compute retrospective: ${err instanceof Error ? err.message : String(err)}`,
          ),
        );
        process.exit(1);
      }

      // JSON output
      if (opts.json) {
        console.log(JSON.stringify(result, null, 2));
        return;
      }

      // Formatted output
      console.log(header(`Sprint Retrospective: ${project.name || projectId}`));
      console.log();

      if (result.periods.length === 0) {
        console.log(
          chalk.dim(
            "  No completed stories yet. Retrospective data will appear as stories are done.",
          ),
        );
        return;
      }

      // Period rows
      console.log(
        chalk.bold(
          `  ${"Week".padEnd(14)}${"Completed".padEnd(12)}${"Avg Cycle".padEnd(12)}${"Carry-over".padEnd(12)}`,
        ),
      );
      console.log(chalk.dim("  " + "─".repeat(50)));

      for (const period of result.periods) {
        const weekLabel = period.startDate;
        const completed = String(period.completedCount);
        const avgCycle = formatDuration(period.averageCycleTimeMs);
        const carryOver = String(period.carryOverCount);
        console.log(
          `  ${chalk.cyan(weekLabel.padEnd(14))}${completed.padEnd(12)}${avgCycle.padEnd(12)}${carryOver.padEnd(12)}`,
        );
      }
      console.log();

      // Velocity summary
      console.log(`  ${chalk.bold("Total completed:")}   ${result.totalCompleted}`);
      console.log(
        `  ${chalk.bold("Average velocity:")}  ${result.averageVelocity.toFixed(1)} stories/week`,
      );

      const changeSign = result.velocityChange >= 0 ? "+" : "";
      const changeColor = result.velocityChange >= 0 ? chalk.green : chalk.red;
      console.log(
        `  ${chalk.bold("Velocity change:")}   ${changeColor(`${changeSign}${result.velocityChange.toFixed(1)}%`)}`,
      );
      console.log(
        `  ${chalk.bold("Avg cycle time:")}    ${formatDuration(result.overallAverageCycleTimeMs)}`,
      );
      console.log();
    });
}
