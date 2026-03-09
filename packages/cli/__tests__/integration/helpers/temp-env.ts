/**
 * Temporary Environment Fixtures
 *
 * Test fixtures for creating temporary directories and configs for CLI testing.
 * Provides setup and teardown helpers for isolated test environments.
 *
 * Usage:
 * ```ts
 * import { createTempEnv } from './helpers/temp-env.js';
 *
 * test('my CLI test', async () => {
 *   const env = await createTempEnv();
 *   try {
 *     const result = await runCli(['status'], { cwd: env.cwd });
 *     expect(result.exitCode).toBe(0);
 *   } finally {
 *     await env.cleanup();
 *   }
 * });
 * ```
 */

import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createTestConfig } from "./cli-test.js";

/**
 * Temporary environment for CLI testing.
 *
 * Contains paths and cleanup function for test isolation.
 */
export interface TempEnv {
  /** Temporary directory path */
  cwd: string;
  /** Path to agent-orchestrator.yaml */
  configPath: string;
  /** Path to sessions directory */
  sessionsDir: string;
  /** Path to sprint-status.yaml */
  sprintStatusPath: string;
  /** Path to story location directory */
  storyLocationDir: string;
  /** Cleanup function to remove temp directory */
  cleanup: () => void;
}

/**
 * Default project configuration for tests.
 */
interface DefaultProjectConfig {
  name: string;
  repo: string;
  defaultBranch: string;
  sessionPrefix: string;
}

/**
 * Create a temporary environment for CLI testing.
 *
 * Creates a temp directory with:
 * - agent-orchestrator.yaml config file
 * - Empty sessions directory
 * - Empty story location directory
 *
 * @example
 * ```ts
 * const env = await createTempEnv({
 *   projectName: 'test-project',
 *   projectConfig: {
 *     name: 'Test Project',
 *     repo: 'test/repo',
 *   }
 * });
 * ```
 *
 * @param options - Configuration options
 * @returns Temp environment with cleanup function
 */
export function createTempEnv(
  options: {
    /** Project key for config (default: 'test-project') */
    projectName?: string;
    /** Custom project configuration */
    projectConfig?: Partial<DefaultProjectConfig>;
    /** Custom config YAML (overrides generated config) */
    configYaml?: string;
    /** Create sprint-status.yaml file */
    withSprintStatus?: boolean;
    /** Story location path (relative to cwd) */
    storyLocation?: string;
  } = {},
): TempEnv {
  const projectName = options.projectName ?? "test-project";
  const storyLocation = options.storyLocation ?? "implementation-artifacts";

  // Create temp directory
  const cwd = mkdtempSync(join(tmpdir(), "ao-cli-test-"));

  // Create subdirectories
  const sessionsDir = join(cwd, "sessions");
  const storyLocationDir = join(cwd, storyLocation);
  mkdirSync(sessionsDir, { recursive: true });
  mkdirSync(storyLocationDir, { recursive: true });

  // Config path
  const configPath = join(cwd, "agent-orchestrator.yaml");
  const sprintStatusPath = join(cwd, "sprint-status.yaml");

  // Default project config
  const defaultProject: DefaultProjectConfig = {
    name: "Test Project",
    repo: "test/repo",
    defaultBranch: "main",
    sessionPrefix: "test",
    ...options.projectConfig,
  };

  // Generate or use provided config
  const configYaml =
    options.configYaml ??
    createTestConfig({
      projects: {
        [projectName]: {
          name: defaultProject.name,
          repo: defaultProject.repo,
          path: cwd, // Use the actual temp directory path
          defaultBranch: defaultProject.defaultBranch,
          sessionPrefix: defaultProject.sessionPrefix,
        },
      },
    });

  writeFileSync(configPath, configYaml, "utf-8");

  // Create sprint-status.yaml by default (can be disabled with withSprintStatus: false)
  if (options.withSprintStatus !== false) {
    const sprintStatus = `generated: 2026-03-09
project: ${projectName}
project_key: TEST
tracking_system: file-system
story_location: ${storyLocation}

development_status:
  epic-1: in-progress
`;
    writeFileSync(sprintStatusPath, sprintStatus, "utf-8");
  }

  return {
    cwd,
    configPath,
    sessionsDir,
    sprintStatusPath,
    storyLocationDir,
    cleanup: () => {
      rmSync(cwd, { recursive: true, force: true });
    },
  };
}

/**
 * Create a temporary session metadata file.
 *
 * @example
 * ```ts
 * const sessionPath = createTempSession(env.sessionsDir, {
 *   sessionId: 'test-1',
 *   issueId: '1-1',
 *   status: 'working',
 * });
 * ```
 */
export function createTempSession(
  sessionsDir: string,
  options: {
    /** Session ID (filename) */
    sessionId: string;
    /** Issue/story ID */
    issueId?: string;
    /** Session status */
    status?: string;
    /** Worktree path */
    worktree?: string;
    /** Branch name */
    branch?: string;
    /** PR URL */
    pr?: string;
    /** Exit code (for crashed sessions) */
    exitCode?: string;
    /** Signal (for crashed sessions) */
    signal?: string;
  },
): string {
  const sessionPath = join(sessionsDir, options.sessionId);

  const metadata: string[] = [];
  if (options.worktree) metadata.push(`worktree=${options.worktree}`);
  if (options.branch) metadata.push(`branch=${options.branch}`);
  if (options.status) metadata.push(`status=${options.status}`);
  if (options.issueId) metadata.push(`issue=${options.issueId}`);
  if (options.pr) metadata.push(`pr=${options.pr}`);
  if (options.exitCode) metadata.push(`exitCode=${options.exitCode}`);
  if (options.signal) metadata.push(`signal=${options.signal}`);

  writeFileSync(sessionPath, metadata.join("\n"), "utf-8");
  return sessionPath;
}

/**
 * Create a temporary story file for testing.
 *
 * @example
 * ```ts
 * const storyPath = createTempStory(env.storyLocationDir, {
 *   storyId: '1-1-test-story',
 *   title: 'Test Story',
 *   status: 'ready-for-dev',
 * });
 * ```
 */
export function createTempStory(
  storyLocationDir: string,
  options: {
    /** Story ID (used for filename) */
    storyId: string;
    /** Story title */
    title?: string;
    /** Story status */
    status?: string;
    /** Story description */
    description?: string;
  },
): string {
  const filename = `${options.storyId}.md`;
  const storyPath = join(storyLocationDir, filename);

  const title = options.title ?? "Test Story";
  const status = options.status ?? "ready-for-dev";
  const description = options.description ?? "As a tester, I want to test CLI commands.";

  const storyContent = `# Story ${options.storyId}: ${title}

Status: ${status}

## Story

${description}

## Acceptance Criteria

1. **Given** test conditions
   **When** I run the test
   **Then** it should pass
`;

  writeFileSync(storyPath, storyContent, "utf-8");
  return storyPath;
}
