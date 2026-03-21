/**
 * Burndown Command — ASCII burndown chart + sprint analytics
 */

import chalk from "chalk";
import type { Command } from "commander";
import { loadConfig, createBurndownService } from "@composio/ao-core";
import { renderBurndownChart } from "../lib/chart.js";
import { header } from "../lib/format.js";

/** Pace indicator with emoji */
function paceIndicator(pace: string): string {
  switch (pace) {
    case "ahead":
      return chalk.green("🟢 Ahead of schedule");
    case "on-pace":
      return chalk.yellow("🟡 On pace");
    case "behind":
      return chalk.red("🔴 Behind schedule");
    default:
      return chalk.gray("⚪ No data");
  }
}

/**
 * Register the burndown command
 */
export function registerBurndown(program: Command): void {
  program
    .command("burndown [project]")
    .description("View sprint burndown chart (ASCII)")
    .option("--json", "Output raw BurndownResult as JSON", false)
    .option("--points", "Show story points instead of story count", false)
    .action(async (projectArg: string | undefined, opts: { json?: boolean; points?: boolean }) => {
      let config: ReturnType<typeof loadConfig>;
      try {
        config = loadConfig();
      } catch {
        console.error(chalk.red("No config found. Run `ao init` first."));
        process.exit(1);
      }

      // Resolve project
      const cwd = process.cwd();
      const projectId =
        projectArg ??
        Object.keys(config.projects).find((id) => cwd.startsWith(config.projects[id].path));

      if (!projectId || !config.projects[projectId]) {
        console.error(
          chalk.red("Project not found. Specify project name or run from project directory."),
        );
        process.exit(1);
      }

      const project = config.projects[projectId];

      // Create burndown service and calculate
      let result: ReturnType<ReturnType<typeof createBurndownService>["recalculate"]>;
      try {
        const service = createBurndownService({ projectPath: project.path });
        result = service.recalculate();
      } catch (err) {
        console.error(
          chalk.red(
            `Burndown calculation failed: ${err instanceof Error ? err.message : String(err)}`,
          ),
        );
        process.exit(1);
      }

      // JSON output
      if (opts.json) {
        console.log(JSON.stringify(result, null, 2));
        return;
      }

      // No data check
      if (result.totalStories === 0) {
        console.log(
          chalk.yellow("\nNo sprint data found. Run `ao sprint-start` to begin a sprint.\n"),
        );
        return;
      }

      // Header
      console.log(header(`Sprint Burndown — ${project.name ?? projectId}`));
      console.log("");

      // Chart
      const chartLines = renderBurndownChart(result);
      for (const line of chartLines) {
        console.log(line);
      }

      // Summary footer
      console.log("");
      const usePoints =
        opts.points &&
        result.totalPoints !== undefined &&
        result.completedPoints !== undefined &&
        result.remainingPoints !== undefined;
      const total = usePoints ? result.totalPoints : result.totalStories;
      const completed = usePoints ? result.completedPoints : result.completedStories;
      const remaining = usePoints ? result.remainingPoints : result.remainingStories;
      const unit = usePoints ? "pts" : "stories";
      const pct = result.completionPercentage.toFixed(0);

      console.log(
        `  ${paceIndicator(result.currentPace)} | ` +
          chalk.bold(`${completed}/${total} ${unit} done (${pct}%)`) +
          ` | ${remaining} remaining`,
      );

      if (result.sprintStart && result.sprintEnd) {
        console.log(chalk.gray(`  Sprint: ${result.sprintStart} → ${result.sprintEnd}`));
      }
      console.log(chalk.gray(`  Last updated: ${result.lastUpdated}`));
      console.log("");
    });
}
