import chalk from "chalk";
import type { Command } from "commander";
import { loadConfig } from "@composio/ao-core";
import { computeSprintGoals, type SprintGoal } from "@composio/ao-plugin-tracker-bmad";

interface SprintGoalWithConfidence extends SprintGoal {
  confidence: number;
}
import { getTracker } from "../lib/plugins.js";
import { header } from "../lib/format.js";
import { resolveProject } from "../lib/resolve-project.js";

function statusBadge(status: SprintGoal["status"]): string {
  switch (status) {
    case "done":
      return chalk.green("✓ DONE");
    case "in-progress":
      return chalk.blue("● IN PROGRESS");
    case "at-risk":
      return chalk.red("▲ AT RISK");
    default:
      return chalk.dim("○ PENDING");
  }
}

function progressBar(pct: number): string {
  const width = 20;
  const filled = Math.round((pct / 100) * width);
  const empty = width - filled;
  return chalk.green("█".repeat(filled)) + chalk.dim("░".repeat(empty)) + ` ${pct}%`;
}

export function registerGoals(program: Command): void {
  program
    .command("goals [project]")
    .description("Show sprint goals and progress")
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
        console.error(chalk.red("Goals require the bmad tracker plugin."));
        process.exit(1);
      }

      try {
        const result = computeSprintGoals(project);

        if (opts.json) {
          console.log(JSON.stringify(result, null, 2));
          return;
        }

        console.log(header(`Sprint Goals: ${project.name || projectId}`));
        console.log();

        if (result.goals.length === 0) {
          console.log(`  ${chalk.dim("No sprint goals configured.")}`);
          console.log(`  ${chalk.dim("Add 'sprintGoals' to your tracker config.")}`);
          return;
        }

        for (const goal of result.goals as SprintGoalWithConfidence[]) {
          console.log(`  ${statusBadge(goal.status)}  ${goal.title}`);
          console.log(`    ${progressBar(goal.progress)}`);
          console.log(`    ${chalk.dim(goal.details)}${goal.confidence ? ` | Confidence: ${chalk[goal.confidence >= 75 ? "green" : goal.confidence >= 50 ? "yellow" : "red"](goal.confidence + "%")}` : ""}`);
          console.log();
        }

        console.log(
          `  Overall: ${progressBar(result.overallProgress)}  ${result.onTrack ? chalk.green("On Track") : chalk.red("At Risk")}`,
        );
      } catch (err) {
        console.error(chalk.red(`Failed: ${err instanceof Error ? err.message : String(err)}`));
        process.exit(1);
      }
    });
}
