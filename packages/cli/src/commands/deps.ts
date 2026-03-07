import chalk from "chalk";
import type { Command } from "commander";
import { loadConfig } from "@composio/ao-core";
import { computeDependencyGraph, detectDependencyCycles } from "@composio/ao-plugin-tracker-bmad";
import { getTracker } from "../lib/plugins.js";
import { header } from "../lib/format.js";
import { resolveProject } from "../lib/resolve-project.js";

export function registerDeps(program: Command): void {
  program
    .command("deps [project]")
    .description("Show dependency graph and detect cycles")
    .option("--cycles", "Show only dependency cycles")
    .option("--json", "Output as JSON")
    .action(async (projectArg: string | undefined, opts: { cycles?: boolean; json?: boolean }) => {
      let config;
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

      const tracker = getTracker(config, projectId);
      if (!tracker || tracker.name !== "bmad") {
        console.error(chalk.red("Dependencies require the bmad tracker plugin."));
        process.exit(1);
      }

      try {
        if (opts.cycles) {
          const result = detectDependencyCycles(project);

          if (opts.json) {
            console.log(JSON.stringify(result, null, 2));
            return;
          }

          console.log(header(`Dependency Cycles: ${project.name || projectId}`));
          console.log();

          if (result.totalCycles === 0) {
            console.log(`  ${chalk.green("\u2713")} No dependency cycles detected.`);
            return;
          }

          console.log(`  ${chalk.red(`${result.totalCycles} cycle(s) detected`)}`);
          console.log();

          for (const cycle of result.cycles) {
            const chain = cycle.cycle.map((id) => {
              const status = cycle.statuses[id] ?? "unknown";
              return `${id} ${chalk.dim(`[${status}]`)}`;
            });
            console.log(
              `  ${chalk.red("\u25CF")} ${chain.join(" \u2192 ")} \u2192 ${cycle.cycle[0]}`,
            );
          }

          console.log();
          console.log(`  Affected stories: ${chalk.yellow(result.affectedStories.join(", "))}`);
        } else {
          const graph = computeDependencyGraph(project);

          if (opts.json) {
            console.log(JSON.stringify(graph, null, 2));
            return;
          }

          console.log(header(`Dependencies: ${project.name || projectId}`));
          console.log();

          const nodesWithDeps = Object.values(graph.nodes).filter(
            (n) => n.dependsOn.length > 0 || n.blocks.length > 0,
          );

          if (nodesWithDeps.length === 0) {
            console.log(`  ${chalk.dim("No dependencies configured.")}`);
            return;
          }

          for (const node of nodesWithDeps) {
            const blocked = node.isBlocked ? chalk.red(" [BLOCKED]") : "";
            console.log(`  ${node.storyId}${blocked}`);
            if (node.dependsOn.length > 0) {
              console.log(`    ${chalk.dim("depends on:")} ${node.dependsOn.join(", ")}`);
            }
            if (node.blocks.length > 0) {
              console.log(`    ${chalk.dim("blocks:")} ${node.blocks.join(", ")}`);
            }
          }

          if (graph.circularWarnings.length > 0) {
            console.log();
            console.log(
              `  ${chalk.red(`\u26A0 ${graph.circularWarnings.length} cycle(s) detected`)}`,
            );
            for (const cycle of graph.circularWarnings) {
              console.log(`    ${cycle.join(" \u2192 ")} \u2192 ${cycle[0]}`);
            }
          }

          if (graph.missingWarnings.length > 0) {
            console.log();
            console.log(
              `  ${chalk.yellow(`Missing references: ${graph.missingWarnings.join(", ")}`)}`,
            );
          }
        }
      } catch (err) {
        console.error(chalk.red(`Failed: ${err instanceof Error ? err.message : String(err)}`));
        process.exit(1);
      }
    });
}
