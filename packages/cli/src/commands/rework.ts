/**
 * ao rework — Rework/churn detection for sprint stories.
 *
 * Usage:
 *   ao rework [project]
 *   ao rework [project] --epic epic-auth --json
 */

import chalk from "chalk";
import type { Command } from "commander";
import { loadConfig } from "@composio/ao-core";
import { computeRework } from "@composio/ao-plugin-tracker-bmad";
import { header } from "../lib/format.js";
import { resolveProject } from "../lib/resolve-project.js";

function formatMs(ms: number): string {
  const hours = ms / (1000 * 60 * 60);
  if (hours < 24) return `${hours.toFixed(1)}h`;
  const days = hours / 24;
  return `${days.toFixed(1)}d`;
}

export function registerRework(program: Command): void {
  program
    .command("rework [project]")
    .description("Show rework/churn detection for sprint stories")
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
        console.error(chalk.red("Rework detection requires the bmad tracker plugin."));
        process.exit(1);
      }

      let result: ReturnType<typeof computeRework>;
      try {
        result = computeRework(project, opts.epic);
      } catch (err) {
        console.error(
          chalk.red(
            `Failed to compute rework: ${err instanceof Error ? err.message : String(err)}`,
          ),
        );
        process.exit(1);
      }

      if (opts.json) {
        console.log(JSON.stringify(result, null, 2));
        return;
      }

      console.log(header(`Rework Detection: ${project.name || projectId}`));
      console.log();

      if (result.totalReworkEvents === 0) {
        console.log(chalk.dim("  No rework detected. All transitions were forward."));
        console.log();
        return;
      }

      // Summary stats
      console.log(`  Rework rate:     ${chalk.yellow(`${result.reworkRate.toFixed(1)}%`)}`);
      console.log(`  Total events:    ${chalk.cyan(String(result.totalReworkEvents))}`);
      console.log(`  Total rework:    ${chalk.cyan(formatMs(result.totalReworkTimeMs))}`);
      console.log();

      // Transition stats table
      if (result.transitionStats.length > 0) {
        console.log(chalk.bold("  Transition Stats:"));
        console.log(
          chalk.dim("  From".padEnd(20) + "To".padEnd(20) + "Count".padStart(6) + "  Avg Time"),
        );

        for (const stat of result.transitionStats) {
          const from = stat.from.padEnd(18);
          const to = stat.to.padEnd(18);
          const count = String(stat.count).padStart(6);
          const avgTime = stat.averageReworkTimeMs > 0 ? formatMs(stat.averageReworkTimeMs) : "-";
          console.log(`  ${from}  ${to}${count}  ${avgTime}`);
        }
        console.log();
      }

      // Worst offenders
      if (result.worstOffenders.length > 0) {
        console.log(chalk.bold("  Worst Offenders:"));
        for (const offender of result.worstOffenders) {
          const reworkTime =
            offender.totalReworkTimeMs > 0 ? ` (${formatMs(offender.totalReworkTimeMs)})` : "";
          console.log(
            `    ${offender.storyId.padEnd(12)} ${chalk.red(`${offender.reworkCount} rework${offender.reworkCount !== 1 ? "s" : ""}`)}${reworkTime}`,
          );
        }
        console.log();
      }
    });
}
