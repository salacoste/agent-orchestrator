import chalk from "chalk";
import type { Command } from "commander";
import { loadConfig } from "@composio/ao-core";
import { getStoryDetail, type StoryDetail } from "@composio/ao-plugin-tracker-bmad";
import { getTracker } from "../lib/plugins.js";
import { header } from "../lib/format.js";
import { resolveProject } from "../lib/resolve-project.js";

/** Format milliseconds as a human-readable duration. */
function formatDuration(ms: number): string {
  if (ms < 0) return "0m";
  const totalMinutes = Math.floor(ms / (1000 * 60));
  const totalHours = Math.floor(totalMinutes / 60);
  const totalDays = Math.floor(totalHours / 24);

  if (totalDays > 0) {
    const remainingHours = totalHours % 24;
    return remainingHours > 0 ? `${totalDays}d ${remainingHours}h` : `${totalDays}d`;
  }
  if (totalHours > 0) {
    const remainingMinutes = totalMinutes % 60;
    return remainingMinutes > 0 ? `${totalHours}h ${remainingMinutes}m` : `${totalHours}h`;
  }
  return `${totalMinutes}m`;
}

/** Format an ISO timestamp to a short human-readable form. */
function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

/** Color a BMad status string. */
function colorStatus(status: string): string {
  switch (status) {
    case "backlog":
      return chalk.gray(status);
    case "ready-for-dev":
      return chalk.yellow(status);
    case "in-progress":
      return chalk.blue(status);
    case "review":
      return chalk.magenta(status);
    case "done":
      return chalk.green(status);
    default:
      return chalk.dim(status);
  }
}

/** Render a simple horizontal bar. */
function horizontalBar(value: number, maxValue: number, width: number = 30): string {
  if (maxValue === 0) return "";
  const filled = Math.round((value / maxValue) * width);
  return chalk.cyan("\u2588".repeat(filled)) + chalk.dim("\u2591".repeat(width - filled));
}

export function registerStory(program: Command): void {
  program
    .command("story <id> [project]")
    .description("Show story detail — transitions, column dwells, cycle time")
    .option("--json", "Output as JSON")
    .action(async (id: string, projectArg: string | undefined, opts: { json?: boolean }) => {
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
        console.error(chalk.red("Story detail requires the bmad tracker plugin."));
        process.exit(1);
      }

      let detail: StoryDetail;
      try {
        detail = getStoryDetail(id, project);
      } catch (err) {
        console.error(
          chalk.red(
            `Failed to get story detail: ${err instanceof Error ? err.message : String(err)}`,
          ),
        );
        process.exit(1);
      }

      // JSON output
      if (opts.json) {
        console.log(JSON.stringify(detail, null, 2));
        return;
      }

      // Formatted output
      console.log(header(`Story: ${detail.storyId}`));
      console.log();

      // Current status
      console.log(`  ${chalk.bold("Status:")}  ${colorStatus(detail.currentStatus)}`);

      // Epic
      if (detail.epic) {
        console.log(`  ${chalk.bold("Epic:")}    ${detail.epic}`);
      }

      // Cycle time
      if (detail.isCompleted && detail.totalCycleTimeMs !== null) {
        console.log(`  ${chalk.bold("Cycle time:")} ${formatDuration(detail.totalCycleTimeMs)}`);
      }
      console.log();

      // Timeline
      if (detail.transitions.length > 0) {
        console.log(chalk.bold("  Timeline:"));
        for (const t of detail.transitions) {
          const ts = formatTimestamp(t.timestamp);
          const arrow = `${colorStatus(t.fromStatus)} ${chalk.dim("\u2192")} ${colorStatus(t.toStatus)}`;
          const dwell =
            t.dwellMs !== null ? chalk.dim(` (after ${formatDuration(t.dwellMs)})`) : "";
          console.log(`    ${chalk.dim(ts)}  ${arrow}${dwell}`);
        }
        console.log();
      } else {
        console.log(chalk.dim("  No transitions recorded yet."));
        console.log();
      }

      // Column dwells
      if (detail.columnDwells.length > 0) {
        console.log(chalk.bold("  Column Dwell Times:"));
        const maxDwell = Math.max(...detail.columnDwells.map((d) => d.totalDwellMs));
        for (const dwell of detail.columnDwells) {
          const label = dwell.column.padEnd(16);
          const bar = horizontalBar(dwell.totalDwellMs, maxDwell);
          const duration = formatDuration(dwell.totalDwellMs);
          console.log(`    ${chalk.dim(label)} ${bar} ${duration}`);
        }
        console.log();
      }
    });
}
