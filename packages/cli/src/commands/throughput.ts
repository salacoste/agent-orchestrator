/**
 * ao throughput — Throughput analytics with lead time, flow efficiency, and trends.
 *
 * Usage:
 *   ao throughput [project]
 *   ao throughput [project] --epic epic-auth --json
 */

import chalk from "chalk";
import type { Command } from "commander";
import { loadConfig } from "@composio/ao-core";
import { computeThroughput } from "@composio/ao-plugin-tracker-bmad";
import { header } from "../lib/format.js";
import { resolveProject } from "../lib/resolve-project.js";

function formatMs(ms: number): string {
  const hours = ms / (1000 * 60 * 60);
  if (hours < 24) return `${hours.toFixed(1)}h`;
  const days = hours / 24;
  return `${days.toFixed(1)}d`;
}

export function registerThroughput(program: Command): void {
  program
    .command("throughput [project]")
    .description("Show throughput analytics: lead time, flow efficiency, and trends")
    .option("--epic <id>", "Filter by epic ID")
    .option("--json", "Output as JSON")
    .action(async (projectArg: string | undefined, opts: { epic?: string; json?: boolean }) => {
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
        console.error(chalk.red("Throughput requires the bmad tracker plugin."));
        process.exit(1);
      }

      let result: ReturnType<typeof computeThroughput>;
      try {
        result = computeThroughput(project, opts.epic);
      } catch (err) {
        console.error(
          chalk.red(
            `Failed to compute throughput: ${err instanceof Error ? err.message : String(err)}`,
          ),
        );
        process.exit(1);
      }

      if (opts.json) {
        console.log(JSON.stringify(result, null, 2));
        return;
      }

      console.log(header(`Throughput Analytics: ${project.name || projectId}`));
      console.log();

      if (result.leadTimes.length === 0) {
        console.log(chalk.dim("  No completed stories yet."));
        console.log();
        return;
      }

      // Summary stats
      console.log(chalk.bold("  Key Metrics"));
      console.log(
        `    Avg Lead Time:    ${chalk.cyan(formatMs(result.averageLeadTimeMs))}   Median: ${chalk.cyan(formatMs(result.medianLeadTimeMs))}`,
      );
      console.log(
        `    Avg Cycle Time:   ${chalk.cyan(formatMs(result.averageCycleTimeMs))}   Median: ${chalk.cyan(formatMs(result.medianCycleTimeMs))}`,
      );
      console.log(
        `    Flow Efficiency:  ${chalk.cyan(`${(result.flowEfficiency * 100).toFixed(0)}%`)}`,
      );
      console.log(`    Stories Completed: ${chalk.cyan(String(result.leadTimes.length))}`);
      console.log();

      // Weekly throughput
      if (result.weeklyThroughput.length > 0) {
        console.log(chalk.bold("  Weekly Throughput"));
        const maxCount = Math.max(
          ...result.weeklyThroughput.map((w: { count: number }) => w.count),
          1,
        );
        const barWidth = 20;

        for (const week of result.weeklyThroughput.slice(-8)) {
          const label = week.weekStart.slice(5);
          const filled = Math.round((week.count / maxCount) * barWidth);
          const bar =
            chalk.green("\u2588".repeat(filled)) + chalk.dim("\u2591".repeat(barWidth - filled));
          console.log(`    ${chalk.dim(label)}  ${bar}  ${week.count} (${week.points}pt)`);
        }
        console.log();
      }

      // Column trends
      if (result.columnTrends.length > 0) {
        console.log(chalk.bold("  Column Trends"));
        const trendIcons: Record<string, string> = {
          increasing: chalk.red("\u2191"),
          stable: chalk.yellow("\u2192"),
          decreasing: chalk.green("\u2193"),
        };

        for (const trend of result.columnTrends) {
          const icon = trendIcons[trend.trend] ?? "\u2192";
          console.log(`    ${trend.column.padEnd(16)} ${trend.trend} ${icon}`);
        }

        if (result.bottleneckTrend) {
          console.log();
          console.log(
            `    ${chalk.red("Bottleneck trend:")} ${chalk.yellow(result.bottleneckTrend)} (getting slower)`,
          );
        }
        console.log();
      }
    });
}
