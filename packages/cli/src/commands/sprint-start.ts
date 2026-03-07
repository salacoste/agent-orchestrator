import { readFileSync, writeFileSync } from "node:fs";
import chalk from "chalk";
import type { Command } from "commander";
import { parse as parseYaml, stringify as stringifyYaml } from "yaml";
import { loadConfig, findConfig } from "@composio/ao-core";
import { header } from "../lib/format.js";
import { resolveProject } from "../lib/resolve-project.js";

interface SprintStartOpts {
  goal?: string;
  velocity?: string;
  startDate?: string;
  endDate?: string;
  sprintNumber?: string;
  json?: boolean;
}

export function registerSprintStart(program: Command): void {
  program
    .command("sprint-start [project]")
    .description("Start a new sprint — set dates, goal, and target velocity")
    .option("--goal <text>", "Sprint goal")
    .option("--velocity <n>", "Target velocity (stories/sprint)")
    .option("--start-date <date>", "Sprint start date (YYYY-MM-DD, defaults to today)")
    .option("--end-date <date>", "Sprint end date (YYYY-MM-DD)")
    .option("--sprint-number <n>", "Sprint number (auto-increments if not set)")
    .option("--json", "Output as JSON")
    .action(async (projectArg: string | undefined, opts: SprintStartOpts) => {
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

      // Default start date to today
      const startDate = opts.startDate ?? new Date().toISOString().slice(0, 10);
      validateDate(startDate, "start");

      if (opts.endDate) {
        validateDate(opts.endDate, "end");
      }

      // Validate velocity
      let targetVelocity: number | undefined;
      if (opts.velocity !== undefined) {
        targetVelocity = parseInt(opts.velocity, 10);
        if (isNaN(targetVelocity) || targetVelocity <= 0) {
          console.error(chalk.red("Target velocity must be a positive number."));
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
      const changes: Record<string, unknown> = {};

      // Sprint number — explicit, auto-increment, or leave alone
      if (opts.sprintNumber !== undefined) {
        const num = parseInt(opts.sprintNumber, 10);
        if (isNaN(num) || num <= 0) {
          console.error(chalk.red("Sprint number must be a positive integer."));
          process.exit(1);
        }
        tracker["sprintNumber"] = num;
        changes["sprintNumber"] = num;
      } else {
        const prev = typeof tracker["sprintNumber"] === "number" ? tracker["sprintNumber"] : 0;
        const next = (prev as number) + 1;
        tracker["sprintNumber"] = next;
        changes["sprintNumber"] = next;
      }

      tracker["sprintStartDate"] = startDate;
      changes["sprintStartDate"] = startDate;

      if (opts.endDate) {
        tracker["sprintEndDate"] = opts.endDate;
        changes["sprintEndDate"] = opts.endDate;
      }

      if (opts.goal) {
        tracker["sprintGoal"] = opts.goal;
        changes["sprintGoal"] = opts.goal;
      }

      if (targetVelocity !== undefined) {
        tracker["targetVelocity"] = targetVelocity;
        changes["targetVelocity"] = targetVelocity;
      }

      writeFileSync(configPath, stringifyYaml(rawConfig, { indent: 2 }), "utf-8");

      // Output
      if (opts.json) {
        console.log(JSON.stringify({ projectId, ...changes }, null, 2));
        return;
      }

      console.log(header(`Sprint Started: ${project.name || projectId}`));
      console.log();
      if (changes["sprintNumber"] !== undefined) {
        console.log(`  Sprint #${chalk.cyan(String(changes["sprintNumber"]))}`);
      }
      if (opts.goal) {
        console.log(`  Goal: ${chalk.cyan(opts.goal)}`);
      }
      console.log(`  Start: ${chalk.cyan(startDate)}`);
      if (opts.endDate) {
        console.log(`  End: ${chalk.cyan(opts.endDate)}`);
      }
      if (targetVelocity !== undefined) {
        console.log(`  Target velocity: ${chalk.cyan(String(targetVelocity))}`);
      }
      console.log();
    });
}

function validateDate(date: string, label: string): void {
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(date)) {
    console.error(chalk.red(`Invalid ${label} date format. Use YYYY-MM-DD.`));
    process.exit(1);
  }
  const parsed = new Date(date);
  if (isNaN(parsed.getTime())) {
    console.error(chalk.red(`Invalid ${label} date.`));
    process.exit(1);
  }
}
