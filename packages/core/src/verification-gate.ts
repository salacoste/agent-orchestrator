/**
 * Verification Gate Service — runs quality checks before story completion.
 *
 * Architecture:
 * - Configured per-project via `verification` section in project config
 * - Runs commands (test, lint, typecheck, custom) via child_process
 * - Stores results in session metadata for API retrieval
 * - Gate is opt-in (disabled by default) and non-fatal (never blocks completion pipeline)
 * - Auto-retry on failure with configurable limits (Story 61-4)
 *
 * Story 61-3, AC #4, #7, #9. Story 61-4, AC #2-5, #7-8.
 */

import { appendFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { execFile } from "node:child_process";
import { join } from "node:path";
import { promisify } from "node:util";
import type {
  CheckResult,
  PersistentConfig,
  SessionId,
  VerificationCheck,
  VerificationConfig,
  VerificationResult,
  VerificationRetryAttempt,
} from "./types.js";
import { readMetadataRaw, updateMetadata } from "./metadata.js";

const execFileAsync = promisify(execFile);

const MAX_OUTPUT_CHARS = 500;
const MAX_NOTEPAD_STDERR = 300;

function truncate(str: string, max: number): string {
  if (str.length <= max) return str;
  return "...(truncated)\n" + str.slice(-(max - 16));
}

/**
 * Run a single verification check as a child process.
 */
async function runCheck(projectDir: string, check: VerificationCheck): Promise<CheckResult> {
  const start = Date.now();
  try {
    const { stdout, stderr } = await execFileAsync(check.command, [], {
      cwd: projectDir,
      timeout: 120_000,
      shell: true,
    });
    return {
      type: check.type,
      command: check.command,
      passed: true,
      exitCode: 0,
      stdout: truncate((stdout ?? "").trim(), MAX_OUTPUT_CHARS),
      stderr: truncate((stderr ?? "").trim(), MAX_OUTPUT_CHARS),
      duration: Date.now() - start,
      required: check.required ?? true,
    };
  } catch (err: unknown) {
    const execErr = err as {
      code?: string;
      stdout?: string;
      stderr?: string;
      killed?: boolean;
    };
    return {
      type: check.type,
      command: check.command,
      passed: false,
      exitCode: execErr.killed ? -1 : 1,
      stdout: truncate((execErr.stdout ?? "").trim(), MAX_OUTPUT_CHARS),
      stderr: truncate((execErr.stderr ?? "").trim(), MAX_OUTPUT_CHARS),
      duration: Date.now() - start,
      required: check.required ?? true,
    };
  }
}

/**
 * Run all configured verification checks for a project.
 *
 * Executes each check sequentially via child_process, captures results,
 * and computes overall pass/fail based on required checks.
 */
export async function runVerification(
  projectDir: string,
  config: VerificationConfig,
): Promise<VerificationResult> {
  const start = Date.now();
  const checks: CheckResult[] = [];

  for (const check of config.checks) {
    checks.push(await runCheck(projectDir, check));
  }

  // Overall passed = all required checks passed
  const passed = checks.every((c) => !c.required || c.passed);

  return {
    passed,
    checks,
    ranAt: new Date().toISOString(),
    duration: Date.now() - start,
  };
}

/**
 * Store verification result in session metadata.
 *
 * Uses the existing flat-file metadata system with a JSON-stringified
 * `verification_result` key. Non-fatal: silently skips if metadata unavailable.
 */
export async function storeVerificationResult(
  sessionsDir: string,
  sessionId: SessionId,
  result: VerificationResult,
): Promise<void> {
  try {
    const raw = readMetadataRaw(sessionsDir, sessionId);
    if (!raw) return;
    updateMetadata(sessionsDir, sessionId, {
      verification_result: JSON.stringify(result),
    });
  } catch {
    // Storage failure must never block completion
  }
}

/**
 * Load verification result from session metadata.
 *
 * Returns null if no result stored (story completed before verification was enabled).
 */
export function loadVerificationResult(
  sessionsDir: string,
  sessionId: SessionId,
): VerificationResult | null {
  try {
    const raw = readMetadataRaw(sessionsDir, sessionId);
    if (!raw) return null;
    const stored = raw["verification_result"];
    if (!stored || typeof stored !== "string") return null;
    return JSON.parse(stored) as VerificationResult;
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Auto-Retry Logic (Story 61-4)
// ─────────────────────────────────────────────────────────────────────────────

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

// ─────────────────────────────────────────────────────────────────────────────
// Persistent Execution Mode (Story 61-5)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get the execution mode from session metadata.
 * Returns null if not set (defaults to "standard" at spawn time).
 */
export function getExecutionMode(sessionsDir: string, sessionId: SessionId): string | null {
  try {
    const raw = readMetadataRaw(sessionsDir, sessionId);
    if (!raw) return null;
    const mode = raw["ao:executionMode"];
    if (!mode || typeof mode !== "string") return null;
    return mode;
  } catch {
    return null;
  }
}

/**
 * Get current persistent re-queue count from session metadata.
 */
export function getPersistentRequeueCount(sessionsDir: string, sessionId: SessionId): number {
  try {
    const raw = readMetadataRaw(sessionsDir, sessionId);
    if (!raw) return 0;
    const count = raw["persistent_requeue_count"];
    if (!count || typeof count !== "string") return 0;
    return parseInt(count, 10) || 0;
  } catch {
    return 0;
  }
}

/**
 * Increment the persistent re-queue count in session metadata.
 */
export function storePersistentRequeueAttempt(sessionsDir: string, sessionId: SessionId): void {
  try {
    const current = getPersistentRequeueCount(sessionsDir, sessionId);
    updateMetadata(sessionsDir, sessionId, {
      persistent_requeue_count: String(current + 1),
    });
  } catch {
    // Storage failure must never block persistent re-queue
  }
}

/**
 * Determine whether a persistent session should be re-queued.
 *
 * Checks execution mode, current re-queue count against config limits,
 * and onFailure mode. Returns `{ shouldRequeue, requeueCount }`.
 *
 * Only activates when `ao:executionMode === "persistent"` AND
 * `onFailure !== "block"`.
 */
export function schedulePersistentRequeue(
  sessionsDir: string,
  sessionId: SessionId,
  config: VerificationConfig,
  preloadedRequeueCount?: number,
): { shouldRequeue: boolean; requeueCount: number } {
  // Only activate for persistent execution mode
  const executionMode = getExecutionMode(sessionsDir, sessionId);
  if (executionMode !== "persistent") {
    return { shouldRequeue: false, requeueCount: 0 };
  }

  // Respect "block" mode — human review required
  if (config.onFailure === "block") {
    return { shouldRequeue: false, requeueCount: 0 };
  }

  const persistentConfig: PersistentConfig = config.persistent ?? {};
  const maxRetries = persistentConfig.persistentMaxRetries ?? 5;
  const currentCount = preloadedRequeueCount ?? getPersistentRequeueCount(sessionsDir, sessionId);

  if (currentCount >= maxRetries) {
    // Retries exhausted
    return { shouldRequeue: false, requeueCount: currentCount };
  }

  return { shouldRequeue: true, requeueCount: currentCount };
}
