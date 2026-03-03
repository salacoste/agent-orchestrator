import chalk from "chalk";
import type { Command } from "commander";
import { type Issue, isTerminalSession, loadConfig } from "@composio/ao-core";
import { header, padCol } from "../lib/format.js";
import { getTracker } from "../lib/plugins.js";
import { getSessionManager } from "../lib/create-session-manager.js";

// Column widths for the stories table
const COL = {
  story: 16,
  title: 40,
  status: 14,
  epic: 20,
};

function stateColor(state: Issue["state"]): string {
  switch (state) {
    case "open":
      return chalk.yellow(state);
    case "in_progress":
      return chalk.blue("in_progress");
    case "closed":
      return chalk.green(state);
    case "cancelled":
      return chalk.dim(state);
    default:
      return state;
  }
}

function printTableHeader(): void {
  const hdr =
    padCol("Story", COL.story) + padCol("Title", COL.title) + padCol("Status", COL.status) + "Epic";
  console.log(chalk.dim(`  ${hdr}`));
  const totalWidth = COL.story + COL.title + COL.status + COL.epic;
  console.log(chalk.dim(`  ${"─".repeat(totalWidth)}`));
}

function printStoryRow(issue: Issue, sessionId: string | null): void {
  const epic = issue.labels.find((l) => l.startsWith("epic-")) ?? "-";
  const sessionTag = sessionId ? chalk.magenta(` [${sessionId}]`) : "";
  const row =
    padCol(chalk.cyan(issue.id), COL.story) +
    padCol(issue.title, COL.title) +
    padCol(stateColor(issue.state), COL.status) +
    chalk.dim(epic) +
    sessionTag;
  console.log(`  ${row}`);
}

export function registerStories(program: Command): void {
  program
    .command("stories [project]")
    .description("List stories with status, epic, and title")
    .option("--state <state>", "Filter by state: open, closed, all", "open")
    .option("--epic <id>", "Filter by epic")
    .option("--json", "Output as JSON")
    .action(
      async (projectArg?: string, opts?: { state?: string; epic?: string; json?: boolean }) => {
        const options = opts ?? {};

        let config: ReturnType<typeof loadConfig>;
        try {
          config = loadConfig();
        } catch {
          console.error(chalk.red("No config found. Run `ao init` first."));
          process.exit(1);
        }

        // Resolve project — use the argument, pick the only one, or error if multiple
        const projectIds = Object.keys(config.projects);
        let projectId: string;
        if (projectArg) {
          if (!config.projects[projectArg]) {
            console.error(
              chalk.red(`Unknown project: ${projectArg}\nAvailable: ${projectIds.join(", ")}`),
            );
            process.exit(1);
          }
          projectId = projectArg;
        } else if (projectIds.length === 1 && projectIds[0]) {
          projectId = projectIds[0];
        } else {
          console.error(
            chalk.red(`Multiple projects found. Specify one: ${projectIds.join(", ")}`),
          );
          process.exit(1);
        }

        const projectConfig = config.projects[projectId];
        const tracker = getTracker(config, projectId);

        if (!tracker) {
          console.error(chalk.red(`No tracker configured for project "${projectId}".`));
          process.exit(1);
        }

        if (!tracker.listIssues) {
          console.error(chalk.red(`Tracker "${tracker.name}" does not support listing issues.`));
          process.exit(1);
        }

        // Build filters
        const filterState = options.state as "open" | "closed" | "all" | undefined;
        const labels = options.epic ? [options.epic] : undefined;

        // Fetch issues and sessions in parallel
        let issues: Issue[];
        try {
          issues = await tracker.listIssues(
            { state: filterState, labels, limit: 200 },
            projectConfig,
          );
        } catch (err) {
          console.error(
            chalk.red(
              `Failed to list stories: ${err instanceof Error ? err.message : String(err)}`,
            ),
          );
          process.exit(1);
        }

        // Build issueId → sessionId map for non-terminal sessions
        const issueSessionMap = new Map<string, string>();
        try {
          const sm = await getSessionManager(config);
          const sessions = await sm.list(projectId);
          for (const session of sessions) {
            if (session.issueId && !isTerminalSession(session)) {
              issueSessionMap.set(session.issueId, session.id);
            }
          }
        } catch {
          // Session lookup failed — not critical, continue without cross-references
        }

        // JSON output
        if (options.json) {
          const output = issues.map((issue) => ({
            ...issue,
            session: issueSessionMap.get(issue.id) ?? null,
          }));
          console.log(JSON.stringify(output, null, 2));
          return;
        }

        // Table output
        console.log();
        console.log(header(`${projectConfig.name || projectId} — Stories`));
        console.log();

        if (issues.length === 0) {
          console.log(chalk.dim("  (no stories found)"));
          console.log();
          return;
        }

        // Group by epic
        const byEpic = new Map<string, Issue[]>();
        for (const issue of issues) {
          const epic = issue.labels.find((l) => l.startsWith("epic-")) ?? "(no-epic)";
          const list = byEpic.get(epic) ?? [];
          list.push(issue);
          byEpic.set(epic, list);
        }

        printTableHeader();

        for (const [_epic, epicIssues] of byEpic) {
          for (const issue of epicIssues) {
            printStoryRow(issue, issueSessionMap.get(issue.id) ?? null);
          }
        }

        console.log();
        console.log(
          chalk.dim(
            `  ${issues.length} stor${issues.length !== 1 ? "ies" : "y"} (filter: ${filterState ?? "open"})`,
          ),
        );
        console.log();
      },
    );
}
