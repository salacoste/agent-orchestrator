/**
 * Logs Command — view agent session logs (tail, follow, time filter)
 */

import chalk from "chalk";
import type { Command } from "commander";
import {
  loadConfig,
  getLogFilePath,
  readLastLogLines,
  hasLogFile,
  getAgentRegistry,
  getSessionsDir,
} from "@composio/ao-core";
import { parseTimeDelta } from "../lib/format.js";
import { statSync } from "node:fs";

/**
 * Register the logs command
 */
export function registerLogs(program: Command): void {
  program
    .command("logs [agent-id]")
    .description("View agent session logs")
    .option("--follow", "Stream live output (like tail -f)", false)
    .option("--since <time>", "Filter by time window (e.g., 30m, 2h, 1d)")
    .option("--lines <n>", "Number of lines to show", "50")
    .option("--json", "Output as JSON", false)
    .action(
      async (
        agentId: string | undefined,
        opts: { follow?: boolean; since?: string; lines?: string; json?: boolean },
      ) => {
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
        const registry = getAgentRegistry(sessionsDir, config);
        await registry.reload();

        const lineCount = parseInt(opts.lines ?? "50", 10);

        // No agent specified → show all agents interleaved
        if (!agentId) {
          await showAllAgentLogs(registry, sessionsDir, lineCount, opts.json ?? false);
          return;
        }

        // Check agent exists
        const assignment = registry.getByAgent(agentId);
        if (!assignment) {
          showAgentNotFound(agentId, registry);
          process.exit(1);
        }

        // Check log file exists
        if (!hasLogFile(sessionsDir, agentId)) {
          console.log(
            chalk.yellow(
              `No logs available for agent "${agentId}". Session may still be starting.`,
            ),
          );
          return;
        }

        const logPath = getLogFilePath(sessionsDir, agentId);

        // Follow mode
        if (opts.follow) {
          await followMode(logPath, agentId, lineCount);
          return;
        }

        // Time filter
        if (opts.since) {
          const deltaMs = parseTimeDelta(opts.since);
          if (deltaMs === 0) {
            console.error(chalk.red(`Invalid time format: "${opts.since}". Use: 30s, 5m, 2h, 1d`));
            process.exit(1);
          }
          showFilteredLogs(logPath, agentId, deltaMs, lineCount, opts.json ?? false);
          return;
        }

        // Default: tail mode
        showTailLogs(logPath, agentId, lineCount, opts.json ?? false);
      },
    );
}

/**
 * Show last N lines from log file
 */
function showTailLogs(logPath: string, agentId: string, lines: number, json: boolean): void {
  const logLines = readLastLogLines(logPath, lines);

  if (json) {
    console.log(JSON.stringify({ agentId, lines: logLines, count: logLines.length }, null, 2));
    return;
  }

  console.log(chalk.bold(`\n  Logs for ${chalk.cyan(agentId)} (last ${logLines.length} lines)\n`));
  for (const line of logLines) {
    console.log(`  ${line}`);
  }
  console.log("");
}

/**
 * Show logs filtered by time window
 */
function showFilteredLogs(
  logPath: string,
  agentId: string,
  deltaMs: number,
  lines: number,
  json: boolean,
): void {
  // Check if log file was modified within the time window
  try {
    const stat = statSync(logPath);
    const fileAge = Date.now() - stat.mtimeMs;

    if (fileAge > deltaMs) {
      console.log(chalk.yellow(`No logs within the specified time window for agent "${agentId}".`));
      return;
    }
  } catch {
    console.log(chalk.yellow(`Cannot read log file for agent "${agentId}".`));
    return;
  }

  // File is within window — show last N lines
  showTailLogs(logPath, agentId, lines, json);
}

/**
 * Follow mode — poll log file for new content
 */
async function followMode(logPath: string, agentId: string, initialLines: number): Promise<void> {
  console.log(chalk.bold(`\n  Following logs for ${chalk.cyan(agentId)} (Ctrl+C to stop)\n`));

  // Show initial lines
  const initial = readLastLogLines(logPath, initialLines);
  for (const line of initial) {
    console.log(`  ${line}`);
  }

  let lastLineCount = initial.length;

  const intervalId = setInterval(() => {
    const current = readLastLogLines(logPath, 500);
    // Handle log rotation: if file got shorter, reset tracking
    if (current.length < lastLineCount) {
      lastLineCount = 0;
    }
    if (current.length > lastLineCount) {
      const newLines = current.slice(lastLineCount);
      for (const line of newLines) {
        console.log(`  ${line}`);
      }
      lastLineCount = current.length;
    }
  }, 1000);

  // Clean exit
  const cleanup = () => {
    clearInterval(intervalId);
    console.log(chalk.dim("\n  Log streaming stopped."));
    process.exit(0);
  };
  process.once("SIGINT", cleanup);
  process.once("SIGTERM", cleanup);

  // Keep alive
  await new Promise<never>(() => {});
}

/**
 * Show interleaved logs from all active agents
 */
async function showAllAgentLogs(
  registry: ReturnType<typeof getAgentRegistry>,
  sessionsDir: string,
  linesPerAgent: number,
  json: boolean,
): Promise<void> {
  const assignments = registry.list();

  if (assignments.length === 0) {
    console.log(chalk.yellow("\nNo active agents. Use `ao spawn` to start one.\n"));
    return;
  }

  if (json) {
    const result: Record<string, string[]> = {};
    for (const a of assignments) {
      if (hasLogFile(sessionsDir, a.agentId)) {
        const logPath = getLogFilePath(sessionsDir, a.agentId);
        result[a.agentId] = readLastLogLines(logPath, linesPerAgent);
      }
    }
    console.log(JSON.stringify({ agents: result, count: assignments.length }, null, 2));
    return;
  }

  console.log(chalk.bold(`\n  Logs from ${assignments.length} agent(s)\n`));

  let anyLogs = false;
  for (const a of assignments) {
    if (!hasLogFile(sessionsDir, a.agentId)) {
      continue;
    }

    const logPath = getLogFilePath(sessionsDir, a.agentId);
    const lines = readLastLogLines(logPath, linesPerAgent);

    if (lines.length > 0) {
      anyLogs = true;
      for (const line of lines) {
        console.log(`  ${chalk.cyan(`[${a.agentId}]`)} ${line}`);
      }
    }
  }

  if (!anyLogs) {
    console.log(chalk.yellow("  No log files found for any active agent."));
  }

  console.log("");
}

/**
 * Show agent not found error with list of active agents
 */
function showAgentNotFound(agentId: string, registry: ReturnType<typeof getAgentRegistry>): void {
  console.error(chalk.red(`Agent "${agentId}" not found.`));

  const agents = registry.list();
  if (agents.length > 0) {
    console.log(chalk.gray("\nActive agents:"));
    for (const a of agents) {
      console.log(chalk.gray(`  - ${a.agentId} (${a.status}, story: ${a.storyId})`));
    }
  } else {
    console.log(chalk.gray("\nNo active agents. Use `ao spawn` to start one."));
  }
}
