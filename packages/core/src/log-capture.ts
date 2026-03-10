/**
 * Log Capture — Capture and store agent session logs
 *
 * Provides utilities for capturing tmux session output to files
 * and managing log storage for resume functionality.
 */

import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { writeFileSync, existsSync, mkdirSync, unlinkSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";

const execFileAsync = promisify(execFile);

/** Maximum number of log lines to store per session */
const MAX_LOG_LINES = 1000;

/** Default number of lines to capture from tmux pane */
const DEFAULT_CAPTURE_LINES = 10000;

/**
 * Capture tmux session output to a log file
 *
 * @param tmuxSessionName - The tmux session name (e.g., "ao-1-7-test")
 * @param logFilePath - Destination file path for the log
 * @param lines - Number of lines to capture (defaults to DEFAULT_CAPTURE_LINES)
 * @returns True if capture succeeded, false otherwise
 */
export async function captureTmuxSessionLogs(
  tmuxSessionName: string,
  logFilePath: string,
  lines = DEFAULT_CAPTURE_LINES,
): Promise<boolean> {
  try {
    // Ensure log directory exists
    mkdirSync(dirname(logFilePath), { recursive: true });

    // Capture pane output using tmux capture-pane
    const { stdout } = await execFileAsync(
      "tmux",
      ["capture-pane", "-t", tmuxSessionName, "-p", "-S", `-${lines}`],
      { timeout: 30000 },
    );

    // Truncate to last MAX_LOG_LINES if needed
    const logLines = stdout.split("\n");
    const truncatedLogs =
      logLines.length > MAX_LOG_LINES ? logLines.slice(-MAX_LOG_LINES) : logLines;

    // Add truncation notice if logs were truncated
    const header =
      logLines.length > MAX_LOG_LINES
        ? `=== LOG TRUNCATED: Showing last ${MAX_LOG_LINES} of ${logLines.length} lines ===\n\n`
        : "";

    // Write to log file
    writeFileSync(logFilePath, header + truncatedLogs.join("\n"), "utf-8");

    return true;
  } catch (err) {
    // Log capture failures are non-fatal
    // eslint-disable-next-line no-console
    console.error(`Failed to capture logs for session ${tmuxSessionName}:`, err);
    return false;
  }
}

/**
 * Read the last N lines from a log file
 *
 * @param logFilePath - Path to the log file
 * @param lines - Number of lines to read from the end
 * @returns Array of log lines, or empty array if file doesn't exist
 */
export function readLastLogLines(logFilePath: string, lines = 100): string[] {
  try {
    if (!existsSync(logFilePath)) {
      return [];
    }

    const content = readFileSync(logFilePath, "utf-8");
    const allLines = content.split("\n");

    return allLines.slice(-lines);
  } catch {
    return [];
  }
}

/**
 * Store log file path in session metadata
 *
 * @param sessionsDir - Sessions directory path
 * @param sessionId - Session ID
 * @param logFilePath - Path to the log file
 */
export async function storeLogPathInMetadata(
  sessionsDir: string,
  sessionId: string,
  logFilePath: string,
): Promise<void> {
  // Import here to avoid circular dependency
  const { updateMetadata } = await import("./metadata.js");

  // sessionId is typed as string which matches SessionId
  updateMetadata(sessionsDir, sessionId, {
    previousLogsPath: logFilePath,
  });
}

/**
 * Get log file path for a session
 *
 * @param sessionsDir - Sessions directory path
 * @param sessionId - Session ID
 * @returns Path to the log file
 */
export function getLogFilePath(sessionsDir: string, sessionId: string): string {
  return join(sessionsDir, "logs", `${sessionId}.log`);
}

/**
 * Check if a log file exists for a session
 *
 * @param sessionsDir - Sessions directory path
 * @param sessionId - Session ID
 * @returns True if log file exists
 */
export function hasLogFile(sessionsDir: string, sessionId: string): boolean {
  const logPath = getLogFilePath(sessionsDir, sessionId);
  return existsSync(logPath);
}

/**
 * Delete a log file
 *
 * @param logFilePath - Path to the log file
 * @returns True if deletion succeeded
 */
export function deleteLogFile(logFilePath: string): boolean {
  try {
    if (existsSync(logFilePath)) {
      unlinkSync(logFilePath);
    }
    return true;
  } catch {
    return false;
  }
}
