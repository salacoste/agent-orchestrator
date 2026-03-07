/**
 * ao epic — Epic management: list, show, create, rename, delete.
 *
 * Usage:
 *   ao epic [project] [epic-id]           — list all or show single epic
 *   ao epic create <title> [project]      — create a new epic
 *   ao epic rename <epic-id> <title> [project] — rename an epic
 *   ao epic delete <epic-id> [project]    — delete an epic
 */

import chalk from "chalk";
import type { Command } from "commander";
import { type Issue, type ProjectConfig, type Tracker, loadConfig } from "@composio/ao-core";
import {
  createEpic as pluginCreateEpic,
  renameEpic as pluginRenameEpic,
  deleteEpic as pluginDeleteEpic,
} from "@composio/ao-plugin-tracker-bmad";
import { getTracker } from "../lib/plugins.js";
import { header } from "../lib/format.js";
import { resolveProject } from "../lib/resolve-project.js";

function progressBar(done: number, total: number, width = 16): string {
  if (total === 0) return "\u2591".repeat(width);
  const filled = Math.round((done / total) * width);
  return "\u2588".repeat(filled) + "\u2591".repeat(width - filled);
}

function stateCategory(issue: Issue): "open" | "in-progress" | "done" {
  if (issue.state === "closed" || issue.state === "cancelled") return "done";
  if (issue.state === "in_progress") return "in-progress";
  return "open";
}

interface EpicSummary {
  id: string;
  title: string;
  stories: Issue[];
  open: number;
  inProgress: number;
  done: number;
}

function groupByEpic(stories: Issue[], project: ProjectConfig, tracker: Tracker): EpicSummary[] {
  const epicMap = new Map<string, Issue[]>();

  for (const story of stories) {
    const epicId = story.labels.find((l) => l.startsWith("epic-")) ?? "(no-epic)";
    const list = epicMap.get(epicId) ?? [];
    list.push(story);
    epicMap.set(epicId, list);
  }

  const summaries: EpicSummary[] = [];
  for (const [epicId, epicStories] of epicMap) {
    const title =
      epicId !== "(no-epic)" ? (tracker.getEpicTitle?.(epicId, project) ?? epicId) : epicId;
    let open = 0;
    let inProgress = 0;
    let done = 0;

    for (const s of epicStories) {
      const cat = stateCategory(s);
      if (cat === "done") done++;
      else if (cat === "in-progress") inProgress++;
      else open++;
    }

    summaries.push({ id: epicId, title, stories: epicStories, open, inProgress, done });
  }

  return summaries;
}

// ---------------------------------------------------------------------------
// Display functions
// ---------------------------------------------------------------------------

function printAllEpics(projectName: string, epics: EpicSummary[]): void {
  console.log(header(`Epic Progress: ${projectName}`));
  console.log();

  if (epics.length === 0) {
    console.log(chalk.dim("  (no epics found)"));
    console.log();
    return;
  }

  for (const epic of epics) {
    const total = epic.open + epic.inProgress + epic.done;
    const pct = total > 0 ? Math.round((epic.done / total) * 100) : 0;
    const bar = progressBar(epic.done, total);

    console.log(`  ${chalk.cyan(epic.id)}  ${chalk.bold(epic.title)}`);
    console.log(`          [${chalk.green(bar)}] ${epic.done}/${total} stories (${pct}%)`);
    console.log(
      `          ${chalk.dim("open:")} ${epic.open}  ${chalk.dim("in-progress:")} ${epic.inProgress}  ${chalk.dim("done:")} ${epic.done}`,
    );
    console.log();
  }
}

function printSingleEpic(epic: EpicSummary): void {
  console.log(header(`Epic: ${epic.title} (${epic.id})`));
  console.log();

  const total = epic.open + epic.inProgress + epic.done;
  const pct = total > 0 ? Math.round((epic.done / total) * 100) : 0;
  const bar = progressBar(epic.done, total);

  console.log(`  [${chalk.green(bar)}] ${epic.done}/${total} stories (${pct}%)`);
  console.log();
  console.log(chalk.bold("  Stories:"));

  for (const story of epic.stories) {
    const cat = stateCategory(story);
    let stateStr: string;
    if (cat === "done") stateStr = chalk.green("done");
    else if (cat === "in-progress") stateStr = chalk.yellow("in-progress");
    else {
      const lastLabel = story.labels[story.labels.length - 1];
      const status =
        typeof lastLabel === "string" && !lastLabel.startsWith("epic-") ? lastLabel : "backlog";
      stateStr = chalk.dim(status);
    }

    // Pad the story ID and title for alignment
    const idStr = story.id.padEnd(24);
    const titleStr = story.title.length > 36 ? story.title.slice(0, 33) + "..." : story.title;
    console.log(`    ${chalk.cyan(idStr)} ${titleStr.padEnd(36)} ${stateStr}`);
  }

  console.log();
}

// ---------------------------------------------------------------------------
// Subcommand helpers
// ---------------------------------------------------------------------------

function getConfigAndProject(projectArg: string | undefined): {
  config: ReturnType<typeof loadConfig>;
  projectId: string;
  project: ProjectConfig;
} {
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
    console.error(chalk.red("Epic management requires the bmad tracker plugin."));
    process.exit(1);
  }

  return { config, projectId, project };
}

// ---------------------------------------------------------------------------
// Command registration
// ---------------------------------------------------------------------------

export function registerEpic(program: Command): void {
  const epicCmd = program
    .command("epic [project] [epic-id]")
    .description("Epic management: list/show epics, or use subcommands (create, rename, delete)")
    .option("--json", "Output as JSON");

  // Subcommand: ao epic create <title> [project]
  epicCmd
    .command("create <title>")
    .description("Create a new epic")
    .argument("[project]", "Project ID")
    .option("--description <text>", "Epic description")
    .option("--json", "Output as JSON")
    .action(
      async (
        title: string,
        projectArg: string | undefined,
        opts: { description?: string; json?: boolean },
      ) => {
        const { project } = getConfigAndProject(projectArg);

        try {
          const result = pluginCreateEpic(project, title, opts.description);
          if (opts.json) {
            console.log(JSON.stringify(result, null, 2));
          } else {
            console.log(chalk.green(`Created epic: ${result.epicId}`));
            console.log(chalk.dim(`  File: ${result.filePath}`));
          }
        } catch (err) {
          console.error(
            chalk.red(`Failed to create epic: ${err instanceof Error ? err.message : String(err)}`),
          );
          process.exit(1);
        }
      },
    );

  // Subcommand: ao epic rename <epic-id> <new-title> [project]
  epicCmd
    .command("rename <epic-id> <new-title>")
    .description("Rename an epic")
    .argument("[project]", "Project ID")
    .option("--json", "Output as JSON")
    .action(
      async (
        epicId: string,
        newTitle: string,
        projectArg: string | undefined,
        opts: { json?: boolean },
      ) => {
        const { project } = getConfigAndProject(projectArg);

        try {
          pluginRenameEpic(project, epicId, newTitle);
          if (opts.json) {
            console.log(JSON.stringify({ epicId, newTitle }, null, 2));
          } else {
            console.log(chalk.green(`Renamed ${epicId} → "${newTitle}"`));
          }
        } catch (err) {
          console.error(
            chalk.red(`Failed to rename epic: ${err instanceof Error ? err.message : String(err)}`),
          );
          process.exit(1);
        }
      },
    );

  // Subcommand: ao epic delete <epic-id> [project]
  epicCmd
    .command("delete <epic-id>")
    .description("Delete an epic")
    .argument("[project]", "Project ID")
    .option("--clear-stories", "Clear epic field from associated stories")
    .option("--json", "Output as JSON")
    .action(
      async (
        epicId: string,
        projectArg: string | undefined,
        opts: { clearStories?: boolean; json?: boolean },
      ) => {
        const { project } = getConfigAndProject(projectArg);

        try {
          const result = pluginDeleteEpic(project, epicId, {
            clearStories: opts.clearStories,
          });
          if (opts.json) {
            console.log(JSON.stringify({ epicId, ...result }, null, 2));
          } else {
            console.log(chalk.green(`Deleted epic: ${epicId}`));
            if (result.affectedStories.length > 0) {
              console.log(chalk.dim(`  Affected stories: ${result.affectedStories.join(", ")}`));
            }
          }
        } catch (err) {
          console.error(
            chalk.red(`Failed to delete epic: ${err instanceof Error ? err.message : String(err)}`),
          );
          process.exit(1);
        }
      },
    );

  // Default action — list/show epics (when no subcommand matches)
  epicCmd.action(
    async (
      projectArg: string | undefined,
      epicId: string | undefined,
      opts: { json?: boolean },
    ) => {
      // If projectArg is a subcommand, Commander handles it.
      // This action only runs for the list/show case.
      let config: ReturnType<typeof loadConfig>;
      try {
        config = loadConfig();
      } catch {
        console.error(chalk.red("No config found. Run `ao init` first."));
        process.exit(1);
      }

      const projectId = resolveProject(config, projectArg);
      const project = config.projects[projectId];
      const tracker = getTracker(config, projectId);

      if (!tracker) {
        console.error(chalk.red("No tracker configured for this project."));
        process.exit(1);
      }

      if (!tracker.listIssues) {
        console.error(chalk.red("Tracker does not support listing issues."));
        process.exit(1);
      }

      // Fetch all stories
      let stories: Issue[];
      try {
        stories = await tracker.listIssues({ state: "all", limit: 200 }, project);
      } catch (err) {
        console.error(
          chalk.red(`Failed to list stories: ${err instanceof Error ? err.message : String(err)}`),
        );
        process.exit(1);
      }
      const epics = groupByEpic(stories, project, tracker);

      if (opts.json) {
        if (epicId) {
          const epic = epics.find((e) => e.id === epicId);
          if (!epic) {
            console.error(JSON.stringify({ error: `Epic not found: ${epicId}` }));
            process.exit(1);
          }
          console.log(JSON.stringify(epic, null, 2));
        } else {
          const jsonData = epics.map((e) => ({
            id: e.id,
            title: e.title,
            open: e.open,
            inProgress: e.inProgress,
            done: e.done,
            total: e.open + e.inProgress + e.done,
            stories: e.stories.map((s) => ({
              id: s.id,
              title: s.title,
              state: s.state,
            })),
          }));
          console.log(JSON.stringify(jsonData, null, 2));
        }
        return;
      }

      if (epicId) {
        const epic = epics.find((e) => e.id === epicId);
        if (!epic) {
          console.error(chalk.red(`Epic not found: ${epicId}`));
          process.exit(1);
        }
        printSingleEpic(epic);
      } else {
        printAllEpics(project.name || projectId, epics);
      }
    },
  );
}
