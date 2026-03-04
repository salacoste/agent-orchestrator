import chalk from "chalk";
import type { Command } from "commander";
import { loadConfig } from "@composio/ao-core";
import {
  computeSprintHealth,
  type SprintHealthResult,
  type HealthIndicator,
} from "@composio/ao-plugin-tracker-bmad";
import { getTracker } from "../lib/plugins.js";
import { header } from "../lib/format.js";
import { resolveProject } from "../lib/resolve-project.js";

function severityBadge(severity: string): string {
  switch (severity) {
    case "critical":
      return chalk.red("● CRITICAL");
    case "warning":
      return chalk.yellow("▲ WARNING");
    default:
      return chalk.green("✓ OK");
  }
}

function renderIndicator(indicator: HealthIndicator): void {
  console.log(`  ${severityBadge(indicator.severity)}  ${indicator.message}`);
  if (indicator.details.length > 0) {
    for (const detail of indicator.details) {
      console.log(`    ${chalk.dim("→")} ${chalk.dim(detail)}`);
    }
  }
}

export function registerHealth(program: Command): void {
  program
    .command("health [project]")
    .description("Show sprint health indicators — stuck stories, WIP alerts, bottlenecks")
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
        console.error(chalk.red("Health indicators require the bmad tracker plugin."));
        process.exit(1);
      }

      let result: SprintHealthResult;
      try {
        result = computeSprintHealth(project);
      } catch (err) {
        console.error(
          chalk.red(
            `Failed to compute health: ${err instanceof Error ? err.message : String(err)}`,
          ),
        );
        process.exit(1);
      }

      // JSON output
      if (opts.json) {
        console.log(JSON.stringify(result, null, 2));
        return;
      }

      // Formatted output
      console.log(header(`Sprint Health: ${project.name || projectId}`));
      console.log();

      if (result.indicators.length === 0) {
        console.log(`  ${chalk.green("✓")} Sprint Health: ${chalk.green("OK")}`);
        console.log(chalk.dim("  No issues detected."));
        return;
      }

      console.log(`  Overall: ${severityBadge(result.overall)}`);
      console.log();

      for (const indicator of result.indicators) {
        renderIndicator(indicator);
        console.log();
      }
    });
}
