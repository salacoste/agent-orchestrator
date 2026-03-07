/**
 * ao workload — Team workload analysis per assignee.
 *
 * Usage:
 *   ao workload [project]
 *   ao workload [project] --epic epic-auth --json
 */

import chalk from "chalk";
import type { Command } from "commander";
import { loadConfig } from "@composio/ao-core";
import { computeTeamWorkload } from "@composio/ao-plugin-tracker-bmad";
import { header } from "../lib/format.js";
import { resolveProject } from "../lib/resolve-project.js";

export function registerWorkload(program: Command): void {
  program
    .command("workload [project]")
    .description("Show team workload per assignee")
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
        console.error(chalk.red("Workload requires the bmad tracker plugin."));
        process.exit(1);
      }

      let result: ReturnType<typeof computeTeamWorkload>;
      try {
        result = computeTeamWorkload(project, opts.epic);
      } catch (err) {
        console.error(
          chalk.red(
            `Failed to compute workload: ${err instanceof Error ? err.message : String(err)}`,
          ),
        );
        process.exit(1);
      }

      if (opts.json) {
        console.log(JSON.stringify(result, null, 2));
        return;
      }

      console.log(header(`Team Workload: ${project.name || projectId}`));
      console.log();

      if (result.members.length === 0 && result.unassigned.length === 0) {
        console.log(chalk.dim("  No active stories."));
        console.log();
        return;
      }

      console.log(`  Overload threshold: ${chalk.cyan(String(result.overloadThreshold))}`);
      console.log();

      for (const member of result.members) {
        const status = member.isOverloaded ? chalk.red(" OVERLOADED") : "";
        console.log(chalk.bold(`  ${member.sessionId}${status}`));
        console.log(`    In-flight: ${member.totalInFlight}  Total points: ${member.totalPoints}`);

        for (const [col, storyIds] of Object.entries(member.storiesByColumn)) {
          console.log(`    ${chalk.dim(col)}: ${storyIds.join(", ")}`);
        }
        console.log();
      }

      if (result.unassigned.length > 0) {
        console.log(chalk.yellow(`  Unassigned (${result.unassigned.length})`));
        for (const story of result.unassigned) {
          console.log(`    ${story.storyId.padEnd(12)} ${chalk.dim(story.column)}`);
        }
        console.log();
      }
    });
}
