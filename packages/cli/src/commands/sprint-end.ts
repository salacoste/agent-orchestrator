import { readFileSync, writeFileSync } from "node:fs";
import chalk from "chalk";
import type { Command } from "commander";
import { parse as parseYaml, stringify as stringifyYaml } from "yaml";
import { loadConfig, findConfig } from "@composio/ao-core";
import {
  computeRetrospective,
  computeForecast,
  computeSprintHealth,
  archiveSprint,
} from "@composio/ao-plugin-tracker-bmad";
import { getTracker } from "../lib/plugins.js";
import { header } from "../lib/format.js";
import { resolveProject } from "../lib/resolve-project.js";

interface SprintEndOpts {
  clear?: boolean;
  archiveDone?: boolean;
  json?: boolean;
}

export function registerSprintEnd(program: Command): void {
  program
    .command("sprint-end [project]")
    .description("End a sprint — generate final metrics report")
    .option("--clear", "Archive sprint history and clear config dates/goal")
    .option("--archive-done", "Also remove done stories from sprint-status.yaml (use with --clear)")
    .option("--json", "Output as JSON")
    .action(async (projectArg: string | undefined, opts: SprintEndOpts) => {
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
        console.error(chalk.red("Sprint end requires the bmad tracker plugin."));
        process.exit(1);
      }

      // Compute final metrics
      let report: Record<string, unknown>;
      try {
        const retro = computeRetrospective(project);
        const forecast = computeForecast(project);
        const health = computeSprintHealth(project);

        report = {
          projectId,
          retrospective: retro,
          forecast,
          health: {
            overall: health.overall,
            indicatorCount: health.indicators.length,
          },
        };
      } catch (err) {
        console.error(
          chalk.red(
            `Failed to compute sprint metrics: ${err instanceof Error ? err.message : String(err)}`,
          ),
        );
        process.exit(1);
      }

      // Archive and clear sprint config if requested
      if (opts.clear) {
        // Archive sprint history
        const archiveResult = archiveSprint(project, { archiveDone: opts.archiveDone });
        report["archive"] = {
          archivePath: archiveResult.archivePath,
          carriedOver: archiveResult.carriedOver.length,
          removedDone: archiveResult.removedDone.length,
        };

        // Clear sprint dates/goal from config
        const configPath = findConfig();
        if (configPath) {
          const rawContent = readFileSync(configPath, "utf-8");
          const rawConfig = parseYaml(rawContent) as Record<string, unknown>;
          const projects = rawConfig["projects"] as Record<string, Record<string, unknown>>;
          if (projects?.[projectId]) {
            const trackerCfg = projects[projectId]["tracker"];
            if (trackerCfg && typeof trackerCfg === "object") {
              const t = trackerCfg as Record<string, unknown>;
              delete t["sprintStartDate"];
              delete t["sprintEndDate"];
              delete t["sprintGoal"];
            }
            writeFileSync(configPath, stringifyYaml(rawConfig, { indent: 2 }), "utf-8");
          }
        }
        report["cleared"] = true;
      }

      // JSON output
      if (opts.json) {
        console.log(JSON.stringify(report, null, 2));
        return;
      }

      // Formatted output
      console.log(header(`Sprint Report: ${project.name || projectId}`));
      console.log();

      const retro = report["retrospective"] as Record<string, unknown> | undefined;
      if (retro) {
        const period = retro["period"] as Record<string, unknown> | undefined;
        if (period) {
          console.log(
            `  Period: ${chalk.cyan(String(period["startDate"] ?? "?"))} → ${chalk.cyan(String(period["endDate"] ?? "?"))}`,
          );
        }
        console.log(`  Velocity: ${chalk.cyan(String(retro["velocity"] ?? "N/A"))} stories`);
        console.log(`  Completed: ${chalk.cyan(String(retro["completedCount"] ?? 0))}`);
        console.log(
          `  Avg cycle time: ${chalk.cyan(String(retro["avgCycleTimeHours"] !== null && retro["avgCycleTimeHours"] !== undefined ? `${Number(retro["avgCycleTimeHours"]).toFixed(1)}h` : "N/A"))}`,
        );
      }

      const health = report["health"] as Record<string, unknown> | undefined;
      if (health) {
        const overall = String(health["overall"] ?? "ok");
        const badge =
          overall === "critical"
            ? chalk.red("CRITICAL")
            : overall === "warning"
              ? chalk.yellow("WARNING")
              : chalk.green("OK");
        console.log(`  Health: ${badge}`);
      }

      const forecast = report["forecast"] as Record<string, unknown> | undefined;
      if (forecast) {
        console.log(`  Pace: ${chalk.cyan(String(forecast["pace"] ?? "N/A"))}`);
      }

      if (opts.clear) {
        console.log();
        console.log(chalk.dim("  Sprint dates and goal cleared from config."));
        const archive = report["archive"] as Record<string, unknown> | undefined;
        if (archive) {
          if (archive["archivePath"]) {
            console.log(chalk.dim(`  History archived to: ${String(archive["archivePath"])}`));
          }
          console.log(chalk.dim(`  Carried over: ${String(archive["carriedOver"])} stories`));
          if (Number(archive["removedDone"]) > 0) {
            console.log(chalk.dim(`  Removed done: ${String(archive["removedDone"])} stories`));
          }
        }
      }

      console.log();
    });
}
