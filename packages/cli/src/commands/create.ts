import chalk from "chalk";
import type { Command } from "commander";
import { loadConfig } from "@composio/ao-core";
import { getTracker } from "../lib/plugins.js";
import { header } from "../lib/format.js";
import { resolveProject } from "../lib/resolve-project.js";

export function registerCreate(program: Command): void {
  program
    .command("create [project]")
    .description("Create a new story in the BMad tracker")
    .requiredOption("-t, --title <title>", "Story title")
    .option("-e, --epic <epic>", "Epic identifier (e.g. epic-auth)")
    .option("-d, --description <desc>", "Story description")
    .option("--json", "Output as JSON")
    .action(
      async (
        projectArg: string | undefined,
        opts: { title: string; epic?: string; description?: string; json?: boolean },
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

        const tracker = getTracker(config, projectId);
        if (!tracker || tracker.name !== "bmad") {
          console.error(chalk.red("Story creation requires the bmad tracker plugin."));
          process.exit(1);
        }

        if (!tracker.createIssue) {
          console.error(chalk.red("Tracker does not support issue creation."));
          process.exit(1);
        }

        const labels: string[] = [];
        if (opts.epic) labels.push(opts.epic);

        try {
          const issue = await tracker.createIssue(
            {
              title: opts.title,
              description: opts.description ?? "",
              labels,
            },
            project,
          );

          if (opts.json) {
            console.log(JSON.stringify(issue, null, 2));
            return;
          }

          console.log(header("Story Created"));
          console.log();
          console.log(`  ${chalk.bold("ID:")}    ${issue.id}`);
          console.log(`  ${chalk.bold("Title:")} ${issue.title}`);
          console.log(`  ${chalk.bold("State:")} ${chalk.green("backlog")}`);
          if (opts.epic) {
            console.log(`  ${chalk.bold("Epic:")}  ${opts.epic}`);
          }
          console.log();
          console.log(chalk.dim(`  Story file: story-${issue.id}.md`));
        } catch (err) {
          console.error(
            chalk.red(
              `Failed to create story: ${err instanceof Error ? err.message : String(err)}`,
            ),
          );
          process.exit(1);
        }
      },
    );
}
