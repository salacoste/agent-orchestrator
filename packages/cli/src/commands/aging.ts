/**
 * ao aging — Story aging detection per column.
 *
 * Usage:
 *   ao aging [project]
 *   ao aging [project] --epic epic-auth --json
 */

import chalk from "chalk";
import type { Command } from "commander";
import { loadConfig } from "@composio/ao-core";
import { computeStoryAging } from "@composio/ao-plugin-tracker-bmad";
import { header } from "../lib/format.js";
import { resolveProject } from "../lib/resolve-project.js";

function formatMs(ms: number): string {
  const hours = ms / (1000 * 60 * 60);
  if (hours < 24) return `${hours.toFixed(1)}h`;
  const days = hours / 24;
  return `${days.toFixed(1)}d`;
}

export function registerAging(program: Command): void {
  program
    .command("aging [project]")
    .description("Show story aging analysis per column")
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
        console.error(chalk.red("Aging requires the bmad tracker plugin."));
        process.exit(1);
      }

      let result: ReturnType<typeof computeStoryAging>;
      try {
        result = computeStoryAging(project, opts.epic);
      } catch (err) {
        console.error(
          chalk.red(`Failed to compute aging: ${err instanceof Error ? err.message : String(err)}`),
        );
        process.exit(1);
      }

      if (opts.json) {
        console.log(JSON.stringify(result, null, 2));
        return;
      }

      console.log(header(`Story Aging: ${project.name || projectId}`));
      console.log();

      if (result.totalActive === 0) {
        console.log(chalk.dim("  No active stories."));
        console.log();
        return;
      }

      console.log(`  Total active stories: ${chalk.cyan(String(result.totalActive))}`);
      console.log();

      for (const [column, stats] of Object.entries(result.columns)) {
        console.log(chalk.bold(`  ${column}`));
        console.log(
          `    P50: ${formatMs(stats.p50Ms)}  P75: ${formatMs(stats.p75Ms)}  P90: ${formatMs(stats.p90Ms)}  P95: ${formatMs(stats.p95Ms)}`,
        );

        for (const story of stats.stories) {
          const ageStr = formatMs(story.ageMs);
          const marker = story.isAging ? chalk.red(" AGING") : "";
          console.log(`    ${story.storyId.padEnd(12)} ${ageStr.padStart(8)}${marker}`);
        }
        console.log();
      }

      if (result.agingStories.length > 0) {
        console.log(
          chalk.red(
            `  ${result.agingStories.length} ${result.agingStories.length === 1 ? "story" : "stories"} flagged as aging (>P90)`,
          ),
        );
        console.log();
      }
    });
}
