import chalk from "chalk";
import type { Command } from "commander";
import { loadConfig, type Issue, type Session } from "@composio/ao-core";
import { getBmadStatus, categorizeStatus, BMAD_COLUMNS } from "@composio/ao-plugin-tracker-bmad";
import { getTracker } from "../lib/plugins.js";
import { getSessionManager } from "../lib/create-session-manager.js";
import { header } from "../lib/format.js";
import { resolveProject } from "../lib/resolve-project.js";

/** Ordered sprint columns — sourced from tracker-bmad for consistency. */
const COLUMNS = BMAD_COLUMNS;

/** Render a progress bar: [████░░░░] n/total */
function progressBar(done: number, total: number, width: number = 20): string {
  if (total === 0) return `[${"░".repeat(width)}] 0/0 stories`;
  const filled = Math.round((done / total) * width);
  const empty = width - filled;
  const bar = chalk.green("█".repeat(filled)) + chalk.dim("░".repeat(empty));
  return `[${bar}] ${done}/${total} stories`;
}

/** Column display color */
function columnColor(col: string): string {
  switch (col) {
    case "done":
      return chalk.green(col);
    case "in-progress":
      return chalk.cyan(col);
    case "review":
      return chalk.blue(col);
    case "ready-for-dev":
      return chalk.yellow(col);
    case "backlog":
      return chalk.dim(col);
    default:
      return chalk.white(col);
  }
}

interface SprintData {
  projectId: string;
  totalStories: number;
  doneCount: number;
  inProgressCount: number;
  openCount: number;
  columns: Record<string, Array<{ id: string; title: string; sessionInfo: string | null }>>;
}

export function registerSprint(program: Command): void {
  program
    .command("sprint [project]")
    .description("Show sprint progress — stories grouped by status column")
    .option("--compact", "Show only column counts")
    .option("--json", "Output as JSON")
    .action(async (projectArg: string | undefined, opts: { compact?: boolean; json?: boolean }) => {
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

      // Get tracker and list all issues
      const tracker = getTracker(config, projectId);
      if (!tracker) {
        console.error(chalk.red("No tracker configured for this project."));
        process.exit(1);
      }
      if (!tracker.listIssues) {
        console.error(chalk.red("Tracker plugin does not support listing issues."));
        process.exit(1);
      }

      let issues: Issue[];
      try {
        issues = await tracker.listIssues({ state: "all", limit: 200 }, project);
      } catch (err) {
        console.error(
          chalk.red(`Failed to list issues: ${err instanceof Error ? err.message : String(err)}`),
        );
        process.exit(1);
      }

      // Get active sessions for cross-reference
      let sessions: Session[] = [];
      try {
        const sm = await getSessionManager(config);
        sessions = await sm.list(projectId);
      } catch {
        // Session lookup not critical — continue without session info
      }

      // Build issue-to-session map (by issueId)
      const issueSessionMap = new Map<string, Session>();
      for (const s of sessions) {
        if (s.issueId) {
          issueSessionMap.set(s.issueId.toLowerCase(), s);
        }
      }

      // Group issues by BMad status column
      const grouped = new Map<string, Issue[]>();
      for (const col of COLUMNS) {
        grouped.set(col, []);
      }

      for (const issue of issues) {
        const status = getBmadStatus(issue.labels);
        const existing = grouped.get(status);
        if (existing) {
          existing.push(issue);
        } else {
          // Unknown status — put it in backlog
          grouped.get("backlog")?.push(issue);
        }
      }

      const totalStories = issues.length;
      let doneCount = 0;
      let inProgressCount = 0;
      for (const issue of issues) {
        const cat = categorizeStatus(getBmadStatus(issue.labels));
        if (cat === "done") doneCount++;
        else if (cat === "in-progress") inProgressCount++;
      }
      const openCount = totalStories - doneCount - inProgressCount;

      // JSON output
      if (opts.json) {
        const data: SprintData = {
          projectId,
          totalStories,
          doneCount,
          inProgressCount,
          openCount,
          columns: {},
        };

        for (const col of COLUMNS) {
          const colIssues = grouped.get(col) ?? [];
          data.columns[col] = colIssues.map((issue) => {
            const session = issueSessionMap.get(issue.id.toLowerCase());
            return {
              id: issue.id,
              title: issue.title,
              sessionInfo: session ? `${session.id} (${session.activity ?? session.status})` : null,
            };
          });
        }

        console.log(JSON.stringify(data, null, 2));
        return;
      }

      // Normal / compact output
      console.log(header(`Sprint Progress: ${project.name || projectId}`));
      console.log();
      console.log(`  ${progressBar(doneCount, totalStories)}`);
      console.log();

      for (const col of COLUMNS) {
        const colIssues = grouped.get(col) ?? [];
        const countStr = `(${colIssues.length})`;

        console.log(`  ${columnColor(col)} ${chalk.dim(countStr)}`);

        if (opts.compact) {
          continue;
        }

        for (const issue of colIssues) {
          const idStr = chalk.dim(issue.id.padEnd(24));
          const session = issueSessionMap.get(issue.id.toLowerCase());
          let sessionStr = "";
          if (session) {
            const activity = session.activity ?? session.status;
            sessionStr = chalk.dim("  \u2190 ") + chalk.yellow(`${session.id} (${activity})`);
          }
          console.log(`    ${idStr}${issue.title}${sessionStr}`);
        }

        console.log();
      }
    });
}
