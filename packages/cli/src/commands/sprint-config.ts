import { readFileSync, writeFileSync } from "node:fs";
import chalk from "chalk";
import type { Command } from "commander";
import { parse as parseYaml, stringify as stringifyYaml } from "yaml";
import { loadConfig, findConfig } from "@composio/ao-core";
import { header } from "../lib/format.js";
import { resolveProject } from "../lib/resolve-project.js";

interface SprintConfigOpts {
  endDate?: string;
  startDate?: string;
  clearEndDate?: boolean;
  goal?: string;
  targetVelocity?: string;
  wipLimit?: string[];
  json?: boolean;
}

export function registerSprintConfig(program: Command): void {
  program
    .command("sprint-config [project]")
    .description("View or set sprint configuration")
    .option("--end-date <date>", "Set sprint end date (YYYY-MM-DD)")
    .option("--start-date <date>", "Set sprint start date (YYYY-MM-DD)")
    .option("--clear-end-date", "Remove sprint end date")
    .option("--goal <text>", "Set sprint goal")
    .option("--target-velocity <n>", "Set target velocity (stories/sprint)")
    .option("--wip-limit <col:n>", "Set WIP limit (e.g. in-progress:3)", collectOption, [])
    .option("--json", "Output as JSON")
    .action(async (projectArg: string | undefined, opts: SprintConfigOpts) => {
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

      const hasWrite =
        opts.endDate !== undefined ||
        opts.startDate !== undefined ||
        opts.clearEndDate ||
        opts.goal !== undefined ||
        opts.targetVelocity !== undefined ||
        (opts.wipLimit && opts.wipLimit.length > 0);

      // Read-only: show current config
      if (!hasWrite) {
        const t: Record<string, unknown> = project.tracker ?? {};
        const data = {
          projectId,
          sprintStartDate: t["sprintStartDate"] ?? null,
          sprintEndDate: t["sprintEndDate"] ?? null,
          sprintGoal: t["sprintGoal"] ?? null,
          targetVelocity: t["targetVelocity"] ?? null,
          wipLimits: t["wipLimits"] ?? null,
        };

        if (opts.json) {
          console.log(JSON.stringify(data, null, 2));
          return;
        }

        console.log(header(`Sprint Config: ${project.name || projectId}`));
        console.log();
        printField("Start date", data.sprintStartDate);
        printField("End date", data.sprintEndDate);
        printField("Goal", data.sprintGoal);
        printField("Target velocity", data.targetVelocity);
        if (data.wipLimits && typeof data.wipLimits === "object") {
          const entries = Object.entries(data.wipLimits as Record<string, unknown>);
          if (entries.length > 0) {
            console.log(`  WIP limits: ${entries.map(([k, v]) => `${k}:${v}`).join(", ")}`);
          } else {
            printField("WIP limits", null);
          }
        } else {
          printField("WIP limits", null);
        }
        console.log();
        return;
      }

      // Validate dates
      if (opts.endDate) validateDate(opts.endDate, "end");
      if (opts.startDate) validateDate(opts.startDate, "start");

      // Validate target velocity
      let targetVelocityNum: number | undefined;
      if (opts.targetVelocity !== undefined) {
        targetVelocityNum = parseInt(opts.targetVelocity, 10);
        if (isNaN(targetVelocityNum) || targetVelocityNum <= 0) {
          console.error(chalk.red("Target velocity must be a positive number."));
          process.exit(1);
        }
      }

      // Validate WIP limits
      const wipUpdates: Record<string, number> = {};
      if (opts.wipLimit) {
        for (const entry of opts.wipLimit) {
          const [col, numStr] = entry.split(":");
          if (!col || !numStr) {
            console.error(chalk.red(`Invalid WIP limit format: '${entry}'. Use col:n`));
            process.exit(1);
          }
          const num = parseInt(numStr, 10);
          if (isNaN(num) || num <= 0) {
            console.error(chalk.red(`Invalid WIP limit number: '${numStr}'`));
            process.exit(1);
          }
          wipUpdates[col] = num;
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
      const changes: string[] = [];

      if (opts.clearEndDate) {
        delete tracker["sprintEndDate"];
        changes.push("Cleared sprint end date");
      }
      if (opts.endDate) {
        tracker["sprintEndDate"] = opts.endDate;
        changes.push(`Set end date to ${opts.endDate}`);
      }
      if (opts.startDate) {
        tracker["sprintStartDate"] = opts.startDate;
        changes.push(`Set start date to ${opts.startDate}`);
      }
      if (opts.goal !== undefined) {
        tracker["sprintGoal"] = opts.goal;
        changes.push(`Set goal to "${opts.goal}"`);
      }
      if (targetVelocityNum !== undefined) {
        tracker["targetVelocity"] = targetVelocityNum;
        changes.push(`Set target velocity to ${targetVelocityNum}`);
      }
      if (Object.keys(wipUpdates).length > 0) {
        const existing =
          tracker["wipLimits"] && typeof tracker["wipLimits"] === "object"
            ? { ...(tracker["wipLimits"] as Record<string, unknown>) }
            : {};
        Object.assign(existing, wipUpdates);
        tracker["wipLimits"] = existing;
        changes.push(
          `Set WIP limits: ${Object.entries(wipUpdates)
            .map(([k, v]) => `${k}:${v}`)
            .join(", ")}`,
        );
      }

      writeFileSync(configPath, stringifyYaml(rawConfig, { indent: 2 }), "utf-8");

      for (const c of changes) {
        console.log(chalk.green(`${c} for ${projectId}.`));
      }
    });
}

function printField(label: string, value: unknown): void {
  if (value !== null && value !== undefined) {
    console.log(`  ${label}: ${chalk.cyan(String(value))}`);
  } else {
    console.log(`  ${label}: ${chalk.dim("(not set)")}`);
  }
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

function collectOption(value: string, previous: string[]): string[] {
  return [...previous, value];
}
