/**
 * Agent History Command — view agent learning history
 */

import chalk from "chalk";
import type { Command } from "commander";
import {
  loadConfig,
  createLearningStore,
  getSessionsDir,
  type SessionLearning,
} from "@composio/ao-core";
import { join } from "node:path";
import { parseTimeDelta } from "../lib/format.js";

/** Map outcome to display emoji */
function outcomeEmoji(outcome: SessionLearning["outcome"]): string {
  switch (outcome) {
    case "completed":
      return "🟢";
    case "failed":
      return "🔴";
    case "blocked":
      return "🟡";
    case "abandoned":
      return "⚫";
    default:
      return "❓";
  }
}

/** Format duration in ms to human-readable */
function formatDurationMs(ms: number): string {
  const totalMinutes = Math.floor(ms / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${totalMinutes}m`;
}

/**
 * Register the agent-history command
 */
export function registerAgentHistory(program: Command): void {
  program
    .command("agent-history <agent-id>")
    .description("View agent learning history")
    .option("--since <time>", "Filter by time window (e.g., 7d, 30d)")
    .option("--limit <n>", "Max records to show", "20")
    .option("--json", "Output as JSONL", false)
    .action(async (agentId: string, opts: { since?: string; limit: string; json?: boolean }) => {
      let config: ReturnType<typeof loadConfig>;
      try {
        config = loadConfig();
      } catch {
        console.error(chalk.red("No config found. Run `ao init` first."));
        process.exit(1);
      }

      // Resolve project
      const cwd = process.cwd();
      const projectId = Object.keys(config.projects).find((id) =>
        cwd.startsWith(config.projects[id].path),
      );

      if (!projectId) {
        console.error(chalk.red("Not in a project directory."));
        process.exit(1);
      }

      const sessionsDir = getSessionsDir(config.configPath, projectId);
      const learningsPath = join(sessionsDir, "learnings.jsonl");

      // Create and load learning store
      const store = createLearningStore({ learningsPath });
      await store.start();

      // Parse time filter
      let sinceMs: number | undefined;
      if (opts.since) {
        sinceMs = parseTimeDelta(opts.since);
        if (sinceMs === 0) {
          console.error(chalk.red(`Invalid time format: "${opts.since}". Use: 7d, 30d, 2h`));
          process.exit(1);
        }
      }

      // Query
      const limit = parseInt(opts.limit, 10);
      const results = store.query({ agentId, sinceMs, limit });

      // JSON output
      if (opts.json) {
        for (const r of results) {
          console.log(JSON.stringify(r));
        }
        return;
      }

      // Empty state
      if (results.length === 0) {
        console.log(chalk.yellow(`\nNo learning history for agent "${agentId}".\n`));
        return;
      }

      // Table output
      console.log(
        chalk.bold(
          `\n  Learning History for ${chalk.cyan(agentId)} (${results.length} sessions)\n`,
        ),
      );
      console.log(
        chalk.dim(
          `  ${"Story".padEnd(30)} ${"Outcome".padEnd(12)} ${"Duration".padEnd(10)} ${"Domains".padEnd(25)} Date`,
        ),
      );
      console.log(
        chalk.dim(
          `  ${"─".repeat(30)} ${"─".repeat(12)} ${"─".repeat(10)} ${"─".repeat(25)} ${"─".repeat(12)}`,
        ),
      );

      for (const r of results) {
        const story = r.storyId.padEnd(30);
        const outcome = `${outcomeEmoji(r.outcome)} ${r.outcome}`.padEnd(12);
        const duration = formatDurationMs(r.durationMs).padEnd(10);
        const domains = (r.domainTags.join(", ") || "—").padEnd(25);
        const date = r.completedAt.split("T")[0];

        console.log(`  ${story} ${outcome} ${duration} ${domains} ${date}`);
      }

      console.log("");
    });
}
