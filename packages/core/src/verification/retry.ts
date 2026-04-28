/**
 * Verification retry logic — auto-retry on verification failure.
 *
 * Story 61-4, AC #2-5, #7-8.
 */

import { appendFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type {
  SessionId,
  VerificationConfig,
  VerificationResult,
  VerificationRetryAttempt,
} from "../types.js";
import { readMetadataRaw, updateMetadata } from "../metadata.js";

const MAX_NOTEPAD_STDERR = 300;

function truncate(str: string, max: number): string {
  if (str.length <= max) return str;
  return "...(truncated)\n" + str.slice(-(max - 16));
}

/**
 * Get current verification retry count from session metadata.
 */
export function getVerificationRetryCount(sessionsDir: string, sessionId: SessionId): number {
  try {
    const raw = readMetadataRaw(sessionsDir, sessionId);
    if (!raw) return 0;
    const count = raw["verification_retry_count"];
    if (!count || typeof count !== "string") return 0;
    return parseInt(count, 10) || 0;
  } catch {
    return 0;
  }
}

/**
 * Store a verification retry attempt in session metadata history.
 * Appends to the `verification_retry_history` array.
 */
export function storeVerificationRetryAttempt(
  sessionsDir: string,
  sessionId: SessionId,
  attempt: VerificationRetryAttempt,
): void {
  try {
    const history = loadVerificationRetryHistory(sessionsDir, sessionId);
    history.push(attempt);
    const newCount = String(history.length);
    updateMetadata(sessionsDir, sessionId, {
      verification_retry_count: newCount,
      verification_retry_history: JSON.stringify(history),
    });
  } catch {
    // Storage failure must never block retry scheduling
  }
}

/**
 * Load all verification retry attempts from session metadata.
 * Returns empty array if no history stored.
 */
export function loadVerificationRetryHistory(
  sessionsDir: string,
  sessionId: SessionId,
): VerificationRetryAttempt[] {
  try {
    const raw = readMetadataRaw(sessionsDir, sessionId);
    if (!raw) return [];
    const stored = raw["verification_retry_history"];
    if (!stored || typeof stored !== "string") return [];
    return JSON.parse(stored) as VerificationRetryAttempt[];
  } catch {
    return [];
  }
}

/**
 * Write verification failure context to the session's .omc/notepad.md.
 *
 * Appends a "Verification Retry Context" section to Working Memory
 * so the next agent session sees what went wrong. Non-fatal: silently
 * skips if worktree or notepad is unavailable.
 */
export function writeRetryContextToNotepad(
  worktreePath: string | undefined,
  result: VerificationResult,
  attemptNumber: number,
): void {
  if (!worktreePath) return;

  try {
    const omcDir = join(worktreePath, ".omc");
    const notepadPath = join(omcDir, "notepad.md");

    const failedChecks = result.checks.filter((c) => !c.passed);
    const passingChecks = result.checks.filter((c) => c.passed);

    const lines: string[] = [
      "",
      "## Verification Retry Context (Attempt " + attemptNumber + ")",
      "",
      "The previous verification run failed. Fix these issues:",
      "",
      "### Failed Checks:",
    ];

    for (const check of failedChecks) {
      lines.push("- **" + check.type + "** (`" + check.command + "`): exit code " + check.exitCode);
      if (check.stderr) {
        lines.push("  stderr: " + truncate(check.stderr, MAX_NOTEPAD_STDERR));
      }
    }

    if (passingChecks.length > 0) {
      lines.push("");
      lines.push("### Passing Checks:");
      for (const check of passingChecks) {
        lines.push("- **" + check.type + "** (`" + check.command + "`): passed");
      }
    }

    lines.push("");
    lines.push("Focus on fixing the failed checks above.");
    lines.push("");

    const content = lines.join("\n");

    // Ensure .omc directory exists
    if (!existsSync(omcDir)) {
      mkdirSync(omcDir, { recursive: true });
    }

    // Create notepad with Working Memory header if it doesn't exist
    if (!existsSync(notepadPath)) {
      const header = "# Session Notepad\n\n## Working Memory\n";
      writeFileSync(notepadPath, header, "utf-8");
    }

    appendFileSync(notepadPath, content, "utf-8");
  } catch {
    // Notepad write failure must never block retry scheduling
  }
}

/**
 * Determine whether a verification retry should be scheduled.
 *
 * Checks retry config, current retry count, and onFailure mode.
 * Returns `{ shouldRetry: true, backoffMs }` if a retry should be
 * scheduled, or `{ shouldRetry: false, backoffMs }` otherwise.
 *
 * Accepts optional `preloadedRetryCount` to avoid redundant metadata reads
 * when the caller has already loaded the session metadata.
 */
export function scheduleVerificationRetry(
  sessionsDir: string,
  sessionId: SessionId,
  config: VerificationConfig,
  preloadedRetryCount?: number,
): { shouldRetry: boolean; backoffMs: number } {
  const backoffMs = config.retry?.backoffMs ?? 5000;

  // Never retry when onFailure is "block" — human review required
  if (config.onFailure === "block") {
    return { shouldRetry: false, backoffMs };
  }

  // Check retry config
  const retryConfig = config.retry;
  const retryEnabled = retryConfig?.enabled !== false; // default: true
  if (!retryEnabled) {
    return { shouldRetry: false, backoffMs };
  }

  const maxAttempts = retryConfig?.maxAttempts ?? 2;
  const currentCount = preloadedRetryCount ?? getVerificationRetryCount(sessionsDir, sessionId);

  if (currentCount >= maxAttempts) {
    // Retries exhausted
    return { shouldRetry: false, backoffMs };
  }

  // Eligible for retry
  return { shouldRetry: true, backoffMs };
}
