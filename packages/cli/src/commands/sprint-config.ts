import { readFileSync, writeFileSync } from "node:fs";
import chalk from "chalk";
import type { Command } from "commander";
import { parse as parseYaml, stringify as stringifyYaml } from "yaml";
import { loadConfig, findConfig } from "@composio/ao-core";
import { header } from "../lib/format.js";
import { resolveProject } from "../lib/resolve-project.js";

export function registerSprintConfig(program: Command): void {
  program
    .command("sprint-config [project]")
    .description("View or set sprint configuration (e.g. sprint end date)")
    .option("--end-date <date>", "Set sprint end date (YYYY-MM-DD)")
    .option("--clear-end-date", "Remove sprint end date")
    .option("--json", "Output as JSON")
    .action(
      async (
        projectArg: string | undefined,
        opts: { endDate?: string; clearEndDate?: boolean; json?: boolean },
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

        // Read-only: show current config
        if (!opts.endDate && !opts.clearEndDate) {
          const endDate = project.tracker?.["sprintEndDate"] ?? null;

          if (opts.json) {
            console.log(JSON.stringify({ projectId, sprintEndDate: endDate }, null, 2));
            return;
          }

          console.log(header(`Sprint Config: ${project.name || projectId}`));
          console.log();
          if (endDate) {
            console.log(`  Sprint end date: ${chalk.cyan(String(endDate))}`);
          } else {
            console.log(`  Sprint end date: ${chalk.dim("(not set)")}`);
            console.log(
              chalk.dim(`  Set with: ao sprint-config ${projectId} --end-date YYYY-MM-DD`),
            );
          }
          console.log();
          return;
        }

        // Validate date format
        if (opts.endDate) {
          const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
          if (!dateRegex.test(opts.endDate)) {
            console.error(chalk.red("Invalid date format. Use YYYY-MM-DD."));
            process.exit(1);
          }

          const parsed = new Date(opts.endDate);
          if (isNaN(parsed.getTime())) {
            console.error(chalk.red("Invalid date."));
            process.exit(1);
          }

          const today = new Date();
          today.setHours(0, 0, 0, 0);
          if (parsed < today) {
            console.error(chalk.red("Sprint end date must be in the future."));
            process.exit(1);
          }
        }

        // Find and update the raw YAML config
        const configPath = findConfig();
        if (!configPath) {
          console.error(chalk.red("Cannot find agent-orchestrator.yaml to update."));
          process.exit(1);
        }

        const rawContent = readFileSync(configPath, "utf-8");
        const rawConfig = parseYaml(rawContent) as Record<string, unknown>;

        const projects = rawConfig["projects"] as Record<string, Record<string, unknown>>;
        if (!projects?.[projectId]) {
          console.error(chalk.red(`Project '${projectId}' not found in config file.`));
          process.exit(1);
        }

        const projectConfig = projects[projectId];

        // Ensure tracker section exists
        if (!projectConfig["tracker"] || typeof projectConfig["tracker"] !== "object") {
          projectConfig["tracker"] = { plugin: "bmad" };
        }

        const tracker = projectConfig["tracker"] as Record<string, unknown>;

        if (opts.clearEndDate) {
          delete tracker["sprintEndDate"];
          console.log(chalk.green(`Cleared sprint end date for ${projectId}.`));
        } else if (opts.endDate) {
          tracker["sprintEndDate"] = opts.endDate;
          console.log(chalk.green(`Set sprint end date to ${opts.endDate} for ${projectId}.`));
        }

        writeFileSync(configPath, stringifyYaml(rawConfig, { indent: 2 }), "utf-8");
      },
    );
}
