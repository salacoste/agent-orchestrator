/**
 * CLI Test Helpers
 *
 * Test infrastructure for running CLI commands in integration tests.
 * Provides utilities for executing the ao CLI and capturing output.
 *
 * Usage:
 * ```ts
 * import { runCli, runCliCommand } from './helpers/cli-test.js';
 *
 * // Run CLI with built package
 * const result = await runCli(['status'], { cwd: '/tmp/test' });
 *
 * // Run CLI command with custom node args
 * const result = await runCliCommand(['plan', '--help']);
 * ```
 */

import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { join } from "node:path";
import { readFile } from "node:fs/promises";

const execFileAsync = promisify(execFile);

/**
 * Result of running a CLI command in tests.
 */
export interface CliTestResult {
  /** Exit code from the CLI process (0 = success, non-zero = error) */
  exitCode: number;
  /** Standard output from the CLI */
  stdout: string;
  /** Standard error output from the CLI */
  stderr: string;
  /** Whether the command succeeded (exit code 0) */
  success: boolean;
}

/**
 * Options for running CLI commands in tests.
 */
export interface CliTestOptions {
  /**
   * Working directory for the CLI command.
   * Defaults to current process cwd.
   */
  cwd?: string;
  /**
   * Environment variables to pass to the CLI process.
   * Merges with process.env.
   */
  env?: Record<string, string>;
  /**
   * Timeout in milliseconds.
   * Defaults to 30000 (30 seconds).
   */
  timeout?: number;
  /**
   * Whether to reject on non-zero exit codes.
   * When false, returns result with exitCode set.
   * Defaults to false for test flexibility.
   */
  reject?: boolean;
}

/**
 * Get the path to the built CLI entry point.
 * Assumes packages have been built with `pnpm build`.
 */
function getCliPath(): string {
  // Use import.meta.url to get the directory of this file
  // This is always an absolute file:// URL
  const helperDir = new URL(".", import.meta.url).pathname;

  // Navigate from __tests__/integration/helpers/ to dist/
  const cliDistPath = join(helperDir, "../../../dist/index.js");

  return cliDistPath;
}

/**
 * Get the path to tsx CLI for running TypeScript files directly.
 * Uses npx to ensure tsx is available.
 */
function getTsxBinArgs(): string[] {
  // Use npx to run tsx, which handles the shell script wrapper correctly
  return ["npx", "tsx"];
}

/**
 * Run a CLI command using the built package.
 *
 * This runs the actual CLI binary as a subprocess, capturing output.
 * Use this for end-to-end CLI testing.
 *
 * @example
 * ```ts
 * const result = await runCli(['status'], { cwd: testDir });
 * expect(result.exitCode).toBe(0);
 * expect(result.stdout).toContain('AGENT ORCHESTRATOR STATUS');
 * ```
 *
 * @param args - CLI arguments (e.g., ['status', '--json'])
 * @param options - Test options
 * @returns Promise resolving to test result
 */
export async function runCli(args: string[], options: CliTestOptions = {}): Promise<CliTestResult> {
  const cliPath = getCliPath();
  const timeout = options.timeout ?? 30000;

  try {
    const { stdout, stderr } = await execFileAsync("node", [cliPath, ...args], {
      cwd: options.cwd ?? process.cwd(),
      env: { ...process.env, ...options.env },
      timeout,
    });

    return {
      exitCode: 0,
      stdout: stdout.toString(),
      stderr: stderr.toString(),
      success: true,
    };
  } catch (error) {
    const err = error as {
      code?: number | string;
      stdout?: string | Buffer;
      stderr?: string | Buffer;
      message?: string;
    };

    return {
      exitCode: typeof err.code === "number" ? err.code : 1,
      stdout: err.stdout?.toString() ?? "",
      stderr: err.stderr?.toString() ?? err.message ?? "",
      success: false,
    };
  }
}

/**
 * Run a CLI command using tsx for development.
 *
 * This runs the CLI TypeScript source directly using tsx.
 * Useful for testing during development without building.
 *
 * @example
 * ```ts
 * const result = await runCliWithTsx(['status'], { cwd: testDir });
 * expect(result.exitCode).toBe(0);
 * ```
 *
 * @param args - CLI arguments
 * @param options - Test options
 * @returns Promise resolving to test result
 */
export async function runCliWithTsx(
  args: string[],
  options: CliTestOptions = {},
): Promise<CliTestResult> {
  const tsxArgs = getTsxBinArgs();

  // Use import.meta.url to get the directory of this file
  // This is always an absolute file:// URL
  const helperDir = new URL(".", import.meta.url).pathname;

  // Navigate from __tests__/integration/helpers/ to src/
  const cliPath = join(helperDir, "../../../src/index.ts");

  const timeout = options.timeout ?? 30000;

  try {
    const { stdout, stderr } = await execFileAsync(
      tsxArgs[0],
      [...tsxArgs.slice(1), cliPath, ...args],
      {
        cwd: options.cwd ?? process.cwd(),
        env: { ...process.env, ...options.env },
        timeout,
      },
    );

    return {
      exitCode: 0,
      stdout: stdout.toString(),
      stderr: stderr.toString(),
      success: true,
    };
  } catch (error) {
    const err = error as {
      code?: number | string;
      stdout?: string | Buffer;
      stderr?: string | Buffer;
      message?: string;
    };

    return {
      exitCode: typeof err.code === "number" ? err.code : 1,
      stdout: err.stdout?.toString() ?? "",
      stderr: err.stderr?.toString() ?? err.message ?? "",
      success: false,
    };
  }
}

/**
 * Parse JSON output from CLI commands.
 *
 * Use this for commands that support `--json` flag.
 *
 * @example
 * ```ts
 * const result = await runCli(['status', '--json'], { cwd });
 * const data = parseCliJson(result);
 * expect(data).toHaveLength(5);
 * ```
 *
 * @param result - CLI test result containing JSON in stdout
 * @returns Parsed JSON data
 */
export function parseCliJson<T = unknown>(result: CliTestResult): T {
  try {
    return JSON.parse(result.stdout) as T;
  } catch {
    throw new Error(`Failed to parse CLI JSON output: ${result.stdout}\nstderr: ${result.stderr}`);
  }
}

/**
 * Create a minimal agent-orchestrator.yaml config for testing.
 *
 * @example
 * ```ts
 * const configYaml = createTestConfig({
 *   projects: {
 *     'test-project': {
 *       name: 'Test Project',
 *       repo: 'test/repo',
 *       path: '/tmp/test',
 *     }
 *   }
 * });
 * ```
 */
export function createTestConfig(
  overrides?: Partial<{
    port: number;
    readyThresholdMs: number;
    defaults: {
      runtime: string;
      agent: string;
      workspace: string;
      notifiers: string[];
    };
    projects: Record<string, Record<string, unknown>>;
  }>,
): string {
  const projects = overrides?.projects ?? {};

  // Build YAML manually to ensure correct format
  const lines: string[] = [];

  // Port
  lines.push(`port: ${overrides?.port ?? 5000}`);

  // Ready threshold
  lines.push(`readyThresholdMs: ${overrides?.readyThresholdMs ?? 300000}`);

  // Defaults
  const defaults = overrides?.defaults ?? {
    runtime: "tmux",
    agent: "claude-code",
    workspace: "worktree",
    notifiers: ["desktop"],
  };
  lines.push("defaults:");
  lines.push(`  runtime: "${defaults.runtime}"`);
  lines.push(`  agent: "${defaults.agent}"`);
  lines.push(`  workspace: "${defaults.workspace}"`);
  lines.push("  notifiers:");
  for (const n of defaults.notifiers) {
    lines.push(`    - "${n}"`);
  }

  // Projects
  lines.push("projects:");
  for (const [projectId, project] of Object.entries(projects)) {
    lines.push(`  ${projectId}:`);
    const p = project as Record<string, unknown>;
    if (p.name) lines.push(`    name: "${p.name}"`);
    if (p.repo) lines.push(`    repo: "${p.repo}"`);
    if (p.path) lines.push(`    path: "${p.path}"`);
    if (p.defaultBranch) lines.push(`    defaultBranch: "${p.defaultBranch}"`);
    if (p.sessionPrefix) lines.push(`    sessionPrefix: "${p.sessionPrefix}"`);
  }

  return lines.join("\n");
}

/**
 * Read and parse a YAML file.
 *
 * Simple YAML parser for test configs.
 * For production use, import from `yaml` package.
 */
export async function readYaml<T = Record<string, unknown>>(path: string): Promise<T> {
  const content = await readFile(path, "utf-8");
  return parseYaml<T>(content);
}

/**
 * Parse YAML string to object.
 *
 * Simple YAML parser for test use only.
 * Handles basic key-value pairs and nested objects.
 */
export function parseYaml<T = Record<string, unknown>>(yaml: string): T {
  const result: Record<string, unknown> = {};
  const lines = yaml.split("\n");
  const stack: Array<{ obj: Record<string, unknown>; indent: number }> = [
    { obj: result, indent: -1 },
  ];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const indent = line.search(/\S|$/);
    const colonIndex = trimmed.indexOf(":");

    if (colonIndex === -1) continue;

    const key = trimmed.slice(0, colonIndex).trim();
    const valueStr = trimmed.slice(colonIndex + 1).trim();

    // Pop stack to correct level
    while (stack.length > 1 && stack[stack.length - 1].indent >= indent) {
      stack.pop();
    }
    const current = stack[stack.length - 1].obj;

    if (!valueStr) {
      // Nested object
      const newObj: Record<string, unknown> = {};
      current[key] = newObj;
      stack.push({ obj: newObj, indent });
    } else {
      // Parse value
      if (valueStr === "null") {
        current[key] = null;
      } else if (valueStr === "true") {
        current[key] = true;
      } else if (valueStr === "false") {
        current[key] = false;
      } else if (valueStr.startsWith('"') || valueStr.startsWith("'")) {
        current[key] = valueStr.slice(1, -1);
      } else if (!Number.isNaN(Number.parseFloat(valueStr))) {
        current[key] = Number.parseFloat(valueStr);
      } else {
        current[key] = valueStr;
      }
    }
  }

  return result as T;
}
