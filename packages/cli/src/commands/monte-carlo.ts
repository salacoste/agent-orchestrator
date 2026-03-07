/**
 * ao monte-carlo — Monte Carlo probabilistic forecast.
 *
 * Usage:
 *   ao monte-carlo [project]
 *   ao mc [project] --epic epic-auth --simulations 5000 --json
 */

import chalk from "chalk";
import type { Command } from "commander";
import { loadConfig } from "@composio/ao-core";
import { computeMonteCarloForecast } from "@composio/ao-plugin-tracker-bmad";
import { header } from "../lib/format.js";
import { resolveProject } from "../lib/resolve-project.js";

export function registerMonteCarlo(program: Command): void {
  program
    .command("monte-carlo [project]")
    .alias("mc")
    .description("Monte Carlo probabilistic forecast for sprint completion")
    .option("--epic <id>", "Filter by epic ID")
    .option("--simulations <n>", "Number of simulations (default: 10000)")
    .option("--json", "Output as JSON")
    .action(
      async (
        projectArg: string | undefined,
        opts: { epic?: string; simulations?: string; json?: boolean },
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
          console.error(chalk.red("Monte Carlo forecast requires the bmad tracker plugin."));
          process.exit(1);
        }

        const simulations = opts.simulations ? parseInt(opts.simulations, 10) : undefined;

        let result: ReturnType<typeof computeMonteCarloForecast>;
        try {
          result = computeMonteCarloForecast(project, opts.epic, {
            simulations,
          });
        } catch (err) {
          console.error(
            chalk.red(
              `Failed to compute forecast: ${err instanceof Error ? err.message : String(err)}`,
            ),
          );
          process.exit(1);
        }

        if (opts.json) {
          console.log(JSON.stringify(result, null, 2));
          return;
        }

        console.log(header(`Monte Carlo Forecast: ${project.name || projectId}`));
        console.log();

        if (!result.percentiles.p50) {
          console.log(
            chalk.dim("  No data available. Complete some stories to generate a forecast."),
          );
          console.log();
          return;
        }

        console.log(`  Remaining stories: ${chalk.cyan(String(result.remainingStories))}`);
        console.log(`  Simulations:       ${chalk.cyan(String(result.simulationCount))}`);
        console.log(`  Sample size:       ${chalk.cyan(String(result.sampleSize))} days`);
        console.log(
          `  Avg daily rate:    ${chalk.cyan(result.averageDailyRate.toFixed(2))} stories/day`,
        );
        console.log();

        console.log(chalk.bold("  Percentile Forecasts:"));
        console.log(`    P50 (likely):       ${chalk.green(result.percentiles.p50)}`);
        console.log(`    P85 (conservative): ${chalk.yellow(result.percentiles.p85)}`);
        console.log(`    P95 (safe):         ${chalk.red(result.percentiles.p95)}`);
        console.log();

        if (result.linearCompletionDate) {
          console.log(chalk.bold("  Linear Comparison:"));
          console.log(`    Linear forecast:    ${result.linearCompletionDate}`);
          console.log(
            `    Linear confidence:  ${chalk.cyan((result.linearConfidence * 100).toFixed(1))}% of simulations`,
          );
          console.log();
        }
      },
    );
}
