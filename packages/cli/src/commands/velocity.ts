import chalk from "chalk";
import type { Command } from "commander";
import { loadConfig } from "@composio/ao-core";
import { computeVelocityComparison } from "@composio/ao-plugin-tracker-bmad";
import { header } from "../lib/format.js";
import { resolveProject } from "../lib/resolve-project.js";

export function registerVelocity(program: Command): void {
  program
    .command("velocity [project]")
    .description("Show weekly velocity history with trend analysis")
    .option("--weeks <n>", "Number of weeks to show (default: 8)", "8")
    .option("--json", "Output as JSON")
    .action(async (projectArg: string | undefined, opts: { weeks: string; json?: boolean }) => {
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
        console.error(chalk.red("Velocity requires the bmad tracker plugin."));
        process.exit(1);
      }

      const maxWeeks = Math.max(1, parseInt(opts.weeks, 10) || 8);

      let result: ReturnType<typeof computeVelocityComparison>;
      try {
        result = computeVelocityComparison(project);
      } catch (err) {
        console.error(
          chalk.red(
            `Failed to compute velocity: ${err instanceof Error ? err.message : String(err)}`,
          ),
        );
        process.exit(1);
      }

      // Trim to requested week count
      const weeks = result.weeks.slice(-maxWeeks);

      if (opts.json) {
        console.log(JSON.stringify({ ...result, weeks }, null, 2));
        return;
      }

      console.log(header(`Velocity History: ${project.name || projectId}`));
      console.log();

      if (weeks.length === 0) {
        console.log(chalk.dim("  No completed stories yet."));
        console.log();
        return;
      }

      // Find max count for bar scaling
      const maxCount = Math.max(...weeks.map((w) => w.completedCount), 1);
      const barWidth = 20;

      for (const week of weeks) {
        const wNum = `W${week.weekStart.slice(5, 7)}${week.weekStart.slice(8, 10)}`;
        const filled = Math.round((week.completedCount / maxCount) * barWidth);
        const bar = chalk.green("█".repeat(filled)) + chalk.dim("░".repeat(barWidth - filled));
        const label = `${week.completedCount} ${week.completedCount === 1 ? "story" : "stories"}`;
        console.log(`    ${chalk.dim(wNum)}  ${bar}  ${label}`);
      }

      console.log();

      // Trend
      const trendIcons: Record<string, string> = {
        improving: chalk.green("↑"),
        stable: chalk.yellow("→"),
        declining: chalk.red("↓"),
      };
      const trendIcon = trendIcons[result.trend] ?? "→";

      const parts: string[] = [];
      parts.push(`Average: ${chalk.cyan(result.averageVelocity.toFixed(1))}/week`);
      parts.push(`Trend: ${result.trend} ${trendIcon}`);
      parts.push(`Next week: ~${chalk.cyan(Math.round(result.nextWeekEstimate).toString())}`);
      console.log(`    ${parts.join(chalk.dim("  —  "))}`);

      if (result.completionWeeks !== null && result.remainingStories > 0) {
        console.log(
          `    At current pace: ~${chalk.cyan(Math.ceil(result.completionWeeks).toString())} weeks to complete ${result.remainingStories} remaining stories`,
        );
      }

      if (result.currentWeekSoFar > 0) {
        console.log(
          chalk.dim(`    Current week so far: ${result.currentWeekSoFar} stories completed`),
        );
      }

      console.log();
    });
}
