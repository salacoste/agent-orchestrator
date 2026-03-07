/**
 * ao cfd — Cumulative Flow Diagram data.
 *
 * Usage:
 *   ao cfd [project]
 *   ao cfd [project] --epic epic-auth --days 14 --json
 */

import chalk from "chalk";
import type { Command } from "commander";
import { loadConfig } from "@composio/ao-core";
import { computeCfd } from "@composio/ao-plugin-tracker-bmad";
import { header } from "../lib/format.js";
import { resolveProject } from "../lib/resolve-project.js";

const COLUMN_CHARS: Record<string, string> = {
  backlog: chalk.dim("\u2591"),
  "ready-for-dev": chalk.yellow("\u2592"),
  "in-progress": chalk.blue("\u2593"),
  review: chalk.magenta("\u2593"),
  done: chalk.green("\u2588"),
};

export function registerCfd(program: Command): void {
  program
    .command("cfd [project]")
    .description("Show cumulative flow diagram data")
    .option("--epic <id>", "Filter by epic ID")
    .option("--days <n>", "Number of days (default 30)", "30")
    .option("--json", "Output as JSON")
    .action(
      async (
        projectArg: string | undefined,
        opts: { epic?: string; days?: string; json?: boolean },
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
          console.error(chalk.red("CFD requires the bmad tracker plugin."));
          process.exit(1);
        }

        const days = parseInt(opts.days ?? "30", 10) || 30;

        let result: ReturnType<typeof computeCfd>;
        try {
          result = computeCfd(project, { epicFilter: opts.epic, days });
        } catch (err) {
          console.error(
            chalk.red(`Failed to compute CFD: ${err instanceof Error ? err.message : String(err)}`),
          );
          process.exit(1);
        }

        if (opts.json) {
          console.log(JSON.stringify(result, null, 2));
          return;
        }

        console.log(header(`Cumulative Flow Diagram: ${project.name || projectId}`));
        console.log();

        if (result.dataPoints.length === 0) {
          console.log(chalk.dim("  No data available."));
          console.log();
          return;
        }

        // ASCII stacked bar per day
        const maxTotal = Math.max(
          ...result.dataPoints.map((dp) => Object.values(dp.columns).reduce((s, v) => s + v, 0)),
          1,
        );
        const barWidth = 30;

        for (const dp of result.dataPoints) {
          const label = dp.date.slice(5); // MM-DD
          let bar = "";
          for (const col of result.columns) {
            const count = dp.columns[col] ?? 0;
            const width = Math.round((count / maxTotal) * barWidth);
            const ch = COLUMN_CHARS[col] ?? chalk.dim("\u2591");
            bar += ch.repeat(width);
          }
          console.log(`  ${chalk.dim(label)}  ${bar}`);
        }

        console.log();
        console.log(
          `  Legend: ${chalk.dim("\u2591")} backlog  ${chalk.yellow("\u2592")} ready  ${chalk.blue("\u2593")} in-progress  ${chalk.magenta("\u2593")} review  ${chalk.green("\u2588")} done`,
        );
        console.log();
      },
    );
}
