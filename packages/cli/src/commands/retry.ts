/**
 * Retry Command — Retry failed operations bypassing circuit breaker
 */

import chalk from "chalk";
import type { Command } from "commander";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

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
  return join(cwd, ".ao-error-logs");
}

/**
 * Format timestamp for display
 */
function formatTimestamp(timestamp: string): string {
  const date = new Date(timestamp);
  return date.toLocaleString();
}

/**
 * Determine if an error is retryable based on its type/context
 */
function isRetryableError(error: ErrorLogEntry): boolean {
  // Non-retryable error types
  const nonRetryableTypes = [
    "AuthenticationError",
    "AuthorizationError",
    "ValidationError",
    "NotFoundError",
    "ConflictError",
  ];

  // Check error type
  if (nonRetryableTypes.includes(error.type)) {
    return false;
  }

  // Check for non-retryable context flags
  if (error.context?.nonRetryable === true) {
    return false;
  }

  // Check error message patterns
  const nonRetryablePatterns = [
    /unauthorized/i,
    /forbidden/i,
    /not found/i,
    /invalid.*token/i,
    /authentication.*failed/i,
    /validation.*error/i,
  ];

  for (const pattern of nonRetryablePatterns) {
    if (pattern.test(error.message)) {
      return false;
    }
  }

  // Default to retryable for transient errors
  return true;
}

/**
 * Display error details
 */
function displayErrorDetails(error: ErrorLogEntry): void {
  console.log(chalk.bold("\nError Details:"));
  console.log(chalk.dim("─".repeat(60)));

  console.log(`${chalk.yellow("Error ID:")}      ${error.errorId}`);
  console.log(`${chalk.yellow("Timestamp:")}     ${formatTimestamp(error.timestamp)}`);
  console.log(`${chalk.yellow("Type:")}          ${chalk.red(error.type)}`);
  console.log(`${chalk.yellow("Message:")}       ${error.message}`);

  if (error.component) {
    console.log(`${chalk.yellow("Component:")}     ${error.component}`);
  }
  if (error.storyId) {
    console.log(`${chalk.yellow("Story ID:")}      ${error.storyId}`);
  }
  if (error.agentId) {
    console.log(`${chalk.yellow("Agent ID:")}      ${error.agentId}`);
  }
  if (error.correlationId) {
    console.log(`${chalk.yellow("Correlation ID:")} ${error.correlationId}`);
  }

  // Display retryable status
  const retryable = isRetryableError(error);
  const statusColor = retryable ? chalk.green : chalk.red;
  const statusText = retryable ? "Retryable" : "Non-retryable";
  console.log(`${chalk.yellow("Status:")}        ${statusColor(statusText)}`);

  // Display context if available
  if (error.context && Object.keys(error.context).length > 0) {
    console.log(chalk.yellow("\nContext:"));
    for (const [key, value] of Object.entries(error.context)) {
      console.log(`  ${chalk.dim(key + ":")} ${JSON.stringify(value)}`);
    }
  }

  // Display stack trace if available and verbose
  if (error.stack) {
    console.log(chalk.yellow("\nStack Trace:"));
    console.log(chalk.dim(error.stack.split("\n").slice(0, 5).join("\n")));
    if (error.stack.split("\n").length > 5) {
      console.log(chalk.dim("  ..."));
    }
  }

  console.log(chalk.dim("─".repeat(60)));
}

export function registerRetry(program: Command): void {
  program
    .command("retry")
    .description("Retry a failed operation by error ID (bypasses circuit breaker)")
    .option("--error-id <id>", "Error ID to retry")
    .option("--force", "Force retry even for non-retryable errors")
    .action(async (opts) => {
      if (!opts.errorId) {
        console.error(chalk.red("Error: --error-id is required"));
        console.error(chalk.dim("Example: ao retry --error-id err_1234567890"));
        console.error(chalk.dim("\nTo list errors, use: ao errors"));
        process.exit(1);
      }

      // Get error log directory
      const logDir = getDefaultLogDir();
      const errorFilePath = join(logDir, `${opts.errorId}.json`);

      // Check if error file exists
      if (!existsSync(errorFilePath)) {
        console.error(chalk.red(`Error not found: ${opts.errorId}`));
        console.error(chalk.dim(`Expected file: ${errorFilePath}`));
        console.error(chalk.dim("\nTo list available errors, use: ao errors"));
        process.exit(1);
      }

      // Read error log
      let error: ErrorLogEntry;
      try {
        const content = readFileSync(errorFilePath, "utf-8");
        error = JSON.parse(content) as ErrorLogEntry;
      } catch (parseError) {
        console.error(chalk.red("Failed to parse error log"));
        console.error(
          chalk.dim(parseError instanceof Error ? parseError.message : String(parseError)),
        );
        process.exit(1);
      }

      // Display error details
      displayErrorDetails(error);

      // Check if error is retryable
      const retryable = isRetryableError(error);

      if (!retryable && !opts.force) {
        console.log(chalk.red("\n✗ Error is non-retryable"));
        console.log(chalk.dim("  This error type cannot be retried automatically."));
        console.log(chalk.dim("  Use --force to attempt retry anyway."));
        process.exit(1);
      }

      // Display retry information
      console.log(chalk.cyan(`\n⟳ Retry Information:`));
      console.log(chalk.dim("  Error ID:         " + error.errorId));
      console.log(
        chalk.dim(
          "  Retry Status:     " +
            (retryable ? "Eligible for retry" : "Not retryable (use --force)"),
        ),
      );
      console.log(chalk.dim("  Recommendation:   "));

      if (retryable) {
        console.log(chalk.dim("  This error can be retried. To retry the operation:"));
        console.log(chalk.dim("  1. Check if the original issue is resolved"));
        console.log(chalk.dim("  2. Re-run the operation that produced this error"));
        console.log(chalk.dim("  3. Verify the fix with your test suite"));
        console.log(
          chalk.yellow(
            "\n  Note: The error log contains the error details but not the operation context.",
          ),
        );
        console.log(
          chalk.yellow("        Automatic retry requires storing operation context with errors."),
        );
      } else {
        console.log(chalk.dim("  This error requires manual intervention:"));
        console.log(chalk.dim("  1. Fix the underlying issue (auth, validation, etc.)"));
        console.log(chalk.dim("  2. Re-run the operation after fixing"));
        console.log(chalk.yellow("\n  Use --force to bypass this check if needed."));
      }

      console.log(chalk.dim("\n" + "─".repeat(60)));
    });
}
