/**
 * ao history — Query sprint transition history with filtering.
 *
 * Usage:
 *   ao history [project]
 *   ao history [project] --story s1 --from 2026-01-01 --to 2026-01-31
 */

import chalk from "chalk";
import type { Command } from "commander";
import { loadConfig } from "@composio/ao-core";
import { queryHistory } from "@composio/ao-plugin-tracker-bmad";
import { header } from "../lib/format.js";
import { resolveProject } from "../lib/resolve-project.js";

function formatTimestamp(ts: string): string {
  return ts.replace("T", " ").replace(/\.\d{3}Z$/, "");
}

export function registerHistory(program: Command): void {
  program
    .command("history [project]")
    .description("Show sprint transition history with optional filters")
    .option("--story <id>", "Filter by story ID")
    .option("--epic <id>", "Filter by epic ID")
    .option("--from <date>", "Start date (YYYY-MM-DD, inclusive)")
    .option("--to <date>", "End date (YYYY-MM-DD, inclusive)")
    .option("--status <status>", "Filter by target status")
    .option("--search <text>", "Search history by text")
    .option("--limit <n>", "Limit number of entries (default: 50)", "50")
    .option("--json", "Output as JSON")
    .action(
      async (
        projectArg: string | undefined,
        opts: {
          story?: string;
          epic?: string;
          from?: string;
          to?: string;
          status?: string;
          search?: string;
          limit: string;
          json?: boolean;
        },
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
          console.error(chalk.red("History requires the bmad tracker plugin."));
          process.exit(1);
        }

        const limit = Math.max(1, parseInt(opts.limit, 10) || 50);

        let result: ReturnType<typeof queryHistory>;
        try {
          result = queryHistory(project, {
            storyId: opts.story,
            epic: opts.epic,
            fromDate: opts.from,
            toDate: opts.to,
            toStatus: opts.status,
            search: opts.search,
            limit,
          });
        } catch (err) {
          console.error(
            chalk.red(
              `Failed to query history: ${err instanceof Error ? err.message : String(err)}`,
            ),
          );
          process.exit(1);
        }

        if (opts.json) {
          console.log(JSON.stringify(result, null, 2));
          return;
        }

        console.log(header(`Sprint History: ${project.name || projectId}`));
        console.log();

        if (result.entries.length === 0) {
          console.log(chalk.dim("  (no matching history entries)"));
          console.log();
          return;
        }

        if (result.total > result.entries.length) {
          console.log(
            chalk.dim(`  Showing last ${result.entries.length} of ${result.total} entries`),
          );
          console.log();
        }

        for (const entry of result.entries) {
          const ts = chalk.dim(formatTimestamp(entry.timestamp));
          const story = chalk.cyan(entry.storyId.padEnd(12));
          const transition = `${chalk.dim(entry.fromStatus)} → ${chalk.white(entry.toStatus)}`;
          console.log(`  ${ts}  ${story}  ${transition}`);
          if (entry.comment) {
            console.log(`                              ${chalk.dim(`"${entry.comment}"`)}`);
          }
        }
        console.log();
      },
    );
}
