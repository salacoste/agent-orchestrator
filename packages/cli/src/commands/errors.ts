/**
 * Errors Command — Search and display error logs
 */

import chalk from "chalk";
import type { Command } from "commander";
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import Table from "cli-table3";

/**
 * Error log entry from JSON file
 */
interface ErrorLogEntry {
  errorId: string;
  timestamp: string;
  type: string;
  message: string;
  stack?: string;
  component?: string;
  storyId?: string;
  agentId?: string;
  correlationId?: string;
  context?: Record<string, unknown>;
  stateSnapshot?: Record<string, unknown>;
}

/**
 * Error rate summary entry
 */
interface ErrorRateSummary {
  type: "ErrorRateSummary";
  timestamp: string;
  errorCount: number;
  windowMs: number;
  threshold: number;
}

type ErrorLog = ErrorLogEntry | ErrorRateSummary;

/**
 * Parse duration string to milliseconds
 * Supports: 1h, 30m, 1s, etc.
 */
function parseDuration(duration: string): number {
  const match = duration.match(/^(\d+)([hms])$/);
  if (!match) {
    throw new Error(`Invalid duration format: ${duration}. Use format like 1h, 30m, 1s`);
  }

  const value = parseInt(match[1], 10);
  const unit = match[2];

  switch (unit) {
    case "h":
      return value * 60 * 60 * 1000;
    case "m":
      return value * 60 * 1000;
    case "s":
      return value * 1000;
    default:
      throw new Error(`Unknown duration unit: ${unit}`);
  }
}

/**
 * Format timestamp for display
 */
function formatTimestamp(timestamp: string): string {
  const date = new Date(timestamp);
  return date.toLocaleString();
}

/**
 * Format error type with color
 */
function formatErrorType(type: string): string {
  if (type === "ErrorRateSummary") {
    return chalk.yellow(type);
  }
  return chalk.red(type);
}

/**
 * Format message (truncate if too long)
 */
function formatMessage(message: string, maxLength = 50): string {
  if (message.length <= maxLength) {
    return message;
  }
  return message.substring(0, maxLength) + chalk.dim("...");
}

/**
 * Read all error logs from directory
 */
function readErrorLogs(logDir: string): ErrorLog[] {
  if (!existsSync(logDir)) {
    return [];
  }

  const files = readdirSync(logDir);
  const logs: ErrorLog[] = [];

  for (const file of files) {
    if (!file.endsWith(".json")) {
      continue;
    }

    try {
      const content = readFileSync(join(logDir, file), "utf-8");
      const log = JSON.parse(content) as ErrorLog;
      logs.push(log);
    } catch {
      // Skip invalid JSON files
    }
  }

  return logs.sort((a, b) => {
    // Sort by timestamp descending (newest first)
    return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
  });
}

/**
 * Filter error logs based on criteria
 */
function filterErrorLogs(
  logs: ErrorLog[],
  filters: {
    type?: string;
    errorId?: string;
    startTime?: Date;
    endTime?: Date;
    component?: string;
    storyId?: string;
    agentId?: string;
  },
): ErrorLog[] {
  return logs.filter((log) => {
    // Skip ErrorRateSummary when filtering by most fields
    if (log.type === "ErrorRateSummary") {
      if (filters.type && filters.type !== "ErrorRateSummary") {
        return false;
      }
      // For summaries, only check type
      return true;
    }

    const entry = log as ErrorLogEntry;

    if (filters.type && entry.type !== filters.type) {
      return false;
    }

    if (filters.errorId && !entry.errorId.startsWith(filters.errorId)) {
      return false;
    }

    if (filters.component && entry.component !== filters.component) {
      return false;
    }

    if (filters.storyId && entry.storyId !== filters.storyId) {
      return false;
    }

    if (filters.agentId && entry.agentId !== filters.agentId) {
      return false;
    }

    if (filters.startTime || filters.endTime) {
      const logTime = new Date(entry.timestamp).getTime();
      if (filters.startTime && logTime < filters.startTime.getTime()) {
        return false;
      }
      if (filters.endTime && logTime > filters.endTime.getTime()) {
        return false;
      }
    }

    return true;
  });
}

/**
 * Display error logs in table format
 */
function displayErrorTable(logs: ErrorLog[]): void {
  if (logs.length === 0) {
    console.log(chalk.dim("No errors found."));
    return;
  }

  const table = new Table({
    head: [
      chalk.bold("Error ID"),
      chalk.bold("Time"),
      chalk.bold("Type"),
      chalk.bold("Component"),
      chalk.bold("Message"),
    ],
    colWidths: [22, 20, 15, 15, 52],
    wordWrap: true,
  });

  for (const log of logs) {
    if (log.type === "ErrorRateSummary") {
      const summary = log as ErrorRateSummary;
      table.push([
        chalk.yellow("SUMMARY"),
        formatTimestamp(summary.timestamp),
        chalk.yellow("Rate"),
        chalk.dim("-"),
        chalk.yellow(`${summary.errorCount} errors in ${summary.windowMs / 1000}s`),
      ]);
    } else {
      const entry = log as ErrorLogEntry;
      table.push([
        entry.errorId.substring(0, 20), // Truncate for display
        formatTimestamp(entry.timestamp),
        formatErrorType(entry.type),
        entry.component || chalk.dim("-"),
        formatMessage(entry.message),
      ]);
    }
  }

  console.log(table.toString());
  console.log(chalk.dim(`\nShowing ${logs.length} error${logs.length !== 1 ? "s" : ""}`));
}

/**
 * Display single error with full details
 */
function displayErrorDetail(log: ErrorLog): void {
  if (log.type === "ErrorRateSummary") {
    const summary = log as ErrorRateSummary;
    console.log(chalk.yellow.bold("\n=== Error Rate Summary ==="));
    console.log(chalk.dim("Type:"), chalk.yellow(summary.type));
    console.log(chalk.dim("Time:"), formatTimestamp(summary.timestamp));
    console.log(chalk.dim("Count:"), chalk.yellow(summary.errorCount.toString()));
    console.log(chalk.dim("Window:"), chalk.yellow(`${summary.windowMs / 1000}s`));
    console.log(chalk.dim("Threshold:"), chalk.yellow(summary.threshold.toString()));
    return;
  }

  const entry = log as ErrorLogEntry;
  console.log(chalk.bold(`\n=== Error: ${entry.errorId} ===`));
  console.log(chalk.dim("Time:"), formatTimestamp(entry.timestamp));
  console.log(chalk.dim("Type:"), formatErrorType(entry.type));
  console.log(chalk.dim("Message:"), chalk.red(entry.message));

  if (entry.component) {
    console.log(chalk.dim("Component:"), chalk.cyan(entry.component));
  }

  if (entry.storyId) {
    console.log(chalk.dim("Story:"), chalk.cyan(entry.storyId));
  }

  if (entry.agentId) {
    console.log(chalk.dim("Agent:"), chalk.cyan(entry.agentId));
  }

  if (entry.correlationId) {
    console.log(chalk.dim("Correlation ID:"), entry.correlationId);
  }

  if (entry.stack) {
    console.log(chalk.dim("\nStack Trace:"));
    console.log(chalk.gray(entry.stack));
  }

  if (entry.context && Object.keys(entry.context).length > 0) {
    console.log(chalk.dim("\nContext:"));
    console.log(chalk.gray(JSON.stringify(entry.context, null, 2)));
  }

  if (entry.stateSnapshot && Object.keys(entry.stateSnapshot).length > 0) {
    console.log(chalk.dim("\nState Snapshot:"));
    console.log(chalk.gray(JSON.stringify(entry.stateSnapshot, null, 2)));
  }
}

/**
 * Get default log directory
 */
function getDefaultLogDir(): string {
  const cwd = process.cwd();
  // Check for common error log directories
  const possibleDirs = [
    join(cwd, ".ao-error-logs"),
    join(cwd, ".error-logs"),
    join(cwd, "logs", "errors"),
  ];

  for (const dir of possibleDirs) {
    if (existsSync(dir)) {
      return dir;
    }
  }

  // Default to .ao-error-logs
  return possibleDirs[0];
}

/**
 * Register the errors command
 */
export function registerErrors(program: Command): void {
  program
    .command("errors")
    .description("Search and display error logs")
    .option("--type <type>", "Filter by error type")
    .option("--id <errorId>", "Search by error ID prefix")
    .option("--last <duration>", "Show errors from last duration (e.g., 1h, 30m, 1s)")
    .option("--start <timestamp>", "Show errors after this ISO timestamp")
    .option("--end <timestamp>", "Show errors before this ISO timestamp")
    .option("--component <name>", "Filter by component/service name")
    .option("--story <id>", "Filter by story ID")
    .option("--agent <id>", "Filter by agent ID")
    .option("--dir <path>", "Error log directory (default: .ao-error-logs)")
    .option("--format <format>", "Output format (table, json)", "table")
    .option("--detail <errorId>", "Show full details for a specific error")
    .action(async (opts) => {
      const logDir = opts.dir || getDefaultLogDir();

      if (!existsSync(logDir)) {
        console.error(chalk.red(`Error log directory not found: ${logDir}`));
        console.error(chalk.dim("Make sure error logging has been configured."));
        process.exit(1);
      }

      // Read all error logs
      const logs = readErrorLogs(logDir);

      // Build filter criteria
      const filters: {
        type?: string;
        errorId?: string;
        startTime?: Date;
        endTime?: Date;
        component?: string;
        storyId?: string;
        agentId?: string;
      } = {};

      if (opts.type) {
        filters.type = opts.type;
      }

      if (opts.id) {
        filters.errorId = opts.id;
      }

      if (opts.last) {
        const duration = parseDuration(opts.last);
        filters.startTime = new Date(Date.now() - duration);
      }

      if (opts.start) {
        filters.startTime = new Date(opts.start);
      }

      if (opts.end) {
        filters.endTime = new Date(opts.end);
      }

      if (opts.component) {
        filters.component = opts.component;
      }

      if (opts.story) {
        filters.storyId = opts.story;
      }

      if (opts.agent) {
        filters.agentId = opts.agent;
      }

      // Filter logs
      const filteredLogs = filterErrorLogs(logs, filters);

      // Show detail view if requested
      if (opts.detail) {
        const detailLog = filteredLogs.find((log) => {
          if (log.type === "ErrorRateSummary") {
            return false;
          }
          const entry = log as ErrorLogEntry;
          return entry.errorId.startsWith(opts.detail);
        });

        if (!detailLog) {
          console.error(chalk.red(`Error not found: ${opts.detail}`));
          process.exit(1);
        }

        displayErrorDetail(detailLog);
        return;
      }

      // Output based on format
      if (opts.format === "json") {
        console.log(JSON.stringify(filteredLogs, null, 2));
      } else {
        displayErrorTable(filteredLogs);
      }
    });
}
