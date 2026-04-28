/**
 * Verification check execution — runs quality checks via child_process.
 *
 * Story 61-3, AC #4. Story 61-4, AC #2-5.
 */

import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type {
  CheckResult,
  VerificationCheck,
  VerificationConfig,
  VerificationResult,
} from "../types.js";

const execFileAsync = promisify(execFile);

const MAX_OUTPUT_CHARS = 500;

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
