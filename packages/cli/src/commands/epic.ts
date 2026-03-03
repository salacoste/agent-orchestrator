/**
 * ao epic — Show epic-level progress with stories and completion percentage.
 *
 * Usage:
 *   ao epic [project] [epic-id]
 *
 * Without epic-id: shows all epics with summary stats.
 * With epic-id: shows detailed view of a single epic's stories.
 */

import chalk from "chalk";
import type { Command } from "commander";
import { type Issue, type ProjectConfig, loadConfig } from "@composio/ao-core";
import { readEpicTitle } from "@composio/ao-plugin-tracker-bmad";
import { getTracker } from "../lib/plugins.js";
import { header } from "../lib/format.js";
import { resolveProject } from "../lib/resolve-project.js";

function progressBar(done: number, total: number, width = 16): string {
  if (total === 0) return "\u2591".repeat(width);
  const filled = Math.round((done / total) * width);
  return "\u2588".repeat(filled) + "\u2591".repeat(width - filled);
}

function stateCategory(issue: Issue): "open" | "in-progress" | "done" {
  if (issue.state === "closed") return "done";
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

function groupByEpic(stories: Issue[], project: ProjectConfig, isBmad: boolean): EpicSummary[] {
  const epicMap = new Map<string, Issue[]>();

  for (const story of stories) {
    const epicId = story.labels.find((l) => l.startsWith("epic-")) ?? "(no-epic)";
    const list = epicMap.get(epicId) ?? [];
    list.push(story);
    epicMap.set(epicId, list);
  }

  const summaries: EpicSummary[] = [];
  for (const [epicId, epicStories] of epicMap) {
    const title = isBmad && epicId !== "(no-epic)" ? readEpicTitle(epicId, project) : epicId;
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
      const status = lastLabel && !lastLabel.startsWith("epic-") ? lastLabel : "backlog";
      stateStr = chalk.dim(status);
    }

    // Pad the story ID and title for alignment
    const idStr = story.id.padEnd(6);
    const titleStr = story.title.length > 30 ? story.title.slice(0, 27) + "..." : story.title;
    console.log(`    ${chalk.cyan(idStr)} ${titleStr.padEnd(30)} ${stateStr}`);
  }

  console.log();
}

// ---------------------------------------------------------------------------
// Command registration
// ---------------------------------------------------------------------------

export function registerEpic(program: Command): void {
  program
    .command("epic [project] [epic-id]")
    .description("Show epic-level progress with stories and completion percentage")
    .option("--json", "Output as JSON")
    .action(
      async (
        projectArg: string | undefined,
        epicId: string | undefined,
        opts: { json?: boolean },
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
        const isBmad = project.tracker?.plugin === "bmad";
        let stories: Issue[];
        try {
          stories = await tracker.listIssues({ state: "all", limit: 200 }, project);
        } catch (err) {
          console.error(
            chalk.red(
              `Failed to list stories: ${err instanceof Error ? err.message : String(err)}`,
            ),
          );
          process.exit(1);
        }
        const epics = groupByEpic(stories, project, isBmad);

        if (opts.json) {
          const jsonData = epicId
            ? (epics.find((e) => e.id === epicId) ?? null)
            : epics.map((e) => ({
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
