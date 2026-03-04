import chalk from "chalk";
import type { Command } from "commander";
import { loadConfig } from "@composio/ao-core";
import { computeCycleTime, type CycleTimeStats } from "@composio/ao-plugin-tracker-bmad";
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

/** Render a simple horizontal bar. */
function horizontalBar(value: number, maxValue: number, width: number = 30): string {
  if (maxValue === 0) return "";
  const filled = Math.round((value / maxValue) * width);
  return chalk.cyan("█".repeat(filled)) + chalk.dim("░".repeat(width - filled));
}

export function registerMetrics(program: Command): void {
  program
    .command("metrics [project]")
    .description("Show cycle time analytics — dwell times, throughput, bottlenecks")
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
        console.error(chalk.red("Metrics require the bmad tracker plugin."));
        process.exit(1);
      }

      let stats: CycleTimeStats;
      try {
        stats = computeCycleTime(project);
      } catch (err) {
        console.error(
          chalk.red(
            `Failed to compute metrics: ${err instanceof Error ? err.message : String(err)}`,
          ),
        );
        process.exit(1);
      }

      // JSON output
      if (opts.json) {
        console.log(JSON.stringify(stats, null, 2));
        return;
      }

      // Formatted output
      console.log(header(`Cycle Time Metrics: ${project.name || projectId}`));
      console.log();

      if (stats.completedCount === 0) {
        console.log(
          chalk.dim("  No completed stories yet. Metrics will appear as stories are done."),
        );
        return;
      }

      // Summary stats
      console.log(`  ${chalk.bold("Completed stories:")} ${stats.completedCount}`);
      console.log(
        `  ${chalk.bold("Average cycle time:")} ${formatDuration(stats.averageCycleTimeMs)}`,
      );
      console.log(
        `  ${chalk.bold("Median cycle time:")}  ${formatDuration(stats.medianCycleTimeMs)}`,
      );
      console.log(
        `  ${chalk.bold("Throughput (7d):")}    ${stats.throughputPerDay.toFixed(2)} stories/day`,
      );
      console.log(
        `  ${chalk.bold("Throughput (4w):")}    ${stats.throughputPerWeek.toFixed(1)} stories/week`,
      );
      console.log();

      // Column dwell times
      if (stats.averageColumnDwells.length > 0) {
        console.log(chalk.bold("  Column Dwell Times (avg):"));
        const maxDwell = Math.max(...stats.averageColumnDwells.map((d) => d.dwellMs));
        for (const dwell of stats.averageColumnDwells) {
          const isBottleneck = dwell.column === stats.bottleneckColumn;
          const label = dwell.column.padEnd(16);
          const bar = horizontalBar(dwell.dwellMs, maxDwell);
          const duration = formatDuration(dwell.dwellMs);
          const marker = isBottleneck ? chalk.red(" ← bottleneck") : "";
          console.log(
            `    ${isBottleneck ? chalk.red(label) : chalk.dim(label)} ${bar} ${duration}${marker}`,
          );
        }
        console.log();
      }
    });
}
