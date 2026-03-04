import chalk from "chalk";
import type { Command } from "commander";
import { loadConfig } from "@composio/ao-core";
import { computeSprintPlan } from "@composio/ao-plugin-tracker-bmad";
import { header } from "../lib/format.js";
import { resolveProject } from "../lib/resolve-project.js";

export function registerPlan(program: Command): void {
  program
    .command("plan [project]")
    .description("Show sprint planning — recommended stories, capacity, and blockers")
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

      if (!project.tracker || project.tracker.plugin !== "bmad") {
        console.error(chalk.red("Sprint planning requires the bmad tracker plugin."));
        process.exit(1);
      }

      let result: ReturnType<typeof computeSprintPlan>;
      try {
        result = computeSprintPlan(project);
      } catch (err) {
        console.error(
          chalk.red(`Failed to compute plan: ${err instanceof Error ? err.message : String(err)}`),
        );
        process.exit(1);
      }

      if (opts.json) {
        console.log(JSON.stringify(result, null, 2));
        return;
      }

      console.log(header(`Sprint Planning: ${project.name || projectId}`));
      console.log();

      // Sprint config
      if (result.sprintConfig.goal) {
        console.log(`  Goal: ${chalk.cyan(result.sprintConfig.goal)}`);
      }
      if (result.sprintConfig.startDate || result.sprintConfig.endDate) {
        const start = result.sprintConfig.startDate ?? "?";
        const end = result.sprintConfig.endDate ?? "?";
        console.log(`  Sprint: ${chalk.dim(start)} → ${chalk.dim(end)}`);
      }

      // Capacity
      const cap = result.capacity;
      const targetLabel = cap.targetVelocity !== null ? `Target: ${cap.targetVelocity}` : "";
      const histLabel =
        cap.historicalVelocity > 0 ? `Historical: ${cap.historicalVelocity.toFixed(1)}/week` : "";
      const capParts = [targetLabel, histLabel].filter(Boolean);
      if (capParts.length > 0) {
        console.log(`  ${capParts.join(chalk.dim("  —  "))}`);
      }

      const loadColors: Record<string, (s: string) => string> = {
        under: chalk.green,
        "at-capacity": chalk.yellow,
        over: chalk.red,
        "no-data": chalk.dim,
      };
      const loadColor = loadColors[result.loadStatus] ?? chalk.dim;
      console.log(
        `  Load: ${cap.inProgressCount} in-progress, ${chalk.cyan(String(cap.remainingCapacity))} remaining capacity ${loadColor(`(${result.loadStatus})`)}`,
      );
      console.log();

      // Recommended stories
      const unblocked = result.backlogStories.filter((s) => !s.isBlocked);
      const blocked = result.backlogStories.filter((s) => s.isBlocked);

      if (result.recommended.length > 0) {
        console.log(
          `  ${chalk.green("Recommended")} (${result.recommended.length} ${result.recommended.length === 1 ? "story" : "stories"}):`,
        );
        for (const story of result.recommended) {
          const epicStr = story.epic ? chalk.dim(` ${story.epic}`) : "";
          console.log(`    ${chalk.dim(story.id.padEnd(16))}${story.title}${epicStr}`);
        }
        console.log();
      } else if (unblocked.length === 0 && blocked.length > 0) {
        console.log(chalk.yellow("  All backlog stories are blocked by dependencies."));
        console.log();
      } else if (result.backlogStories.length === 0) {
        console.log(chalk.dim("  No stories in backlog."));
        console.log();
      }

      // Blocked stories
      if (blocked.length > 0) {
        console.log(
          `  ${chalk.red("Blocked")} (${blocked.length} ${blocked.length === 1 ? "story" : "stories"}):`,
        );
        for (const story of blocked) {
          const blockerStr = chalk.red(`blocked by ${story.blockers.join(", ")}`);
          const epicStr = story.epic ? chalk.dim(` ${story.epic}`) : "";
          console.log(`    ${chalk.dim(story.id.padEnd(16))}⊘ ${blockerStr}${epicStr}`);
        }
        console.log();
      }
    });
}
