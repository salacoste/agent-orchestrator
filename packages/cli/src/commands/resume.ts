import chalk from "chalk";
import ora from "ora";
import type { Command } from "commander";
import { execFile } from "node:child_process";
import { existsSync, readFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { promisify } from "node:util";
import { parse } from "yaml";
import {
  loadConfig,
  type OrchestratorConfig,
  getAgentRegistry,
  getSessionsDir,
  updateSprintStatus,
  logAuditEvent,
  readMetadata,
} from "@composio/ao-core";

import { getSessionManager } from "../lib/create-session-manager.js";
import { header, formatTimeAgo } from "../lib/format.js";
import { formatResumeContext, validateUserMessage } from "../lib/resume-context.js";

const execFileAsync = promisify(execFile);

interface SprintStatus {
  project: string;
  project_key: string;
  tracking_system: string;
  story_location: string;
  development_status: Record<string, string>;
  dependencies?: Record<string, string[]>;
  priorities?: Record<string, number>;
}

interface StoryContext {
  id: string;
  title: string;
  status: string;
  description: string;
  acceptanceCriteria: string;
  dependencies?: string[];
  priority?: number;
  epic?: string;
}

interface ResumeOptions {
  message?: string;
  agent?: string;
}

/**
 * Check if tmux is installed with timeout (NFR-S9: 30s timeout, NFR-S7: use execFile)
 */
async function checkTmuxWithTimeout(): Promise<boolean> {
  try {
    const { stdout } = await execFileAsync("tmux", ["-V"], {
      timeout: 30000,
    });
    return stdout.includes("tmux");
  } catch {
    return false;
  }
}

/**
 * Read and parse sprint-status.yaml
 */
function readSprintStatus(cwd: string): SprintStatus | null {
  const sprintStatusFile = join(cwd, "sprint-status.yaml");

  if (!existsSync(sprintStatusFile)) {
    return null;
  }

  try {
    const content = readFileSync(sprintStatusFile, "utf-8");
    const parsed = parse(content) as unknown;

    if (!parsed || typeof parsed !== "object") {
      return null;
    }

    return parsed as SprintStatus;
  } catch {
    return null;
  }
}

/**
 * Extract epic ID from story ID (e.g., "1-2-cli-spawn-agent" -> "1")
 */
function extractEpicId(storyId: string): string | null {
  const match = storyId.match(/^(\d+)-/);
  return match ? `epic-${match[1]}` : null;
}

/**
 * Find the story file by ID
 */
function findStoryFile(storyId: string, storyLocation: string): string | null {
  const directPath = join(storyLocation, `${storyId}.md`);
  if (existsSync(directPath)) {
    return directPath;
  }

  const withPrefix = join(storyLocation, `story-${storyId}.md`);
  if (existsSync(withPrefix)) {
    return withPrefix;
  }

  return null;
}

/**
 * Parse story file to extract context
 */
function parseStoryFile(filePath: string, storyId: string): StoryContext | null {
  try {
    const content = readFileSync(filePath, "utf-8");
    const lines = content.split("\n");

    let title = "";
    let status = "";
    const descriptionLines: string[] = [];
    const acLines: string[] = [];
    let currentSection = "";

    for (const line of lines) {
      const statusMatch = line.match(/^Status:\s*(.+)$/);
      if (statusMatch) {
        status = statusMatch[1].trim();
        continue;
      }

      const titleMatch = line.match(/^# (.+)$/);
      if (titleMatch && !title) {
        title = titleMatch[1].replace(/^Story\s+/, "").trim();
        continue;
      }

      if (line.startsWith("## ")) {
        currentSection = line.replace("## ", "").toLowerCase().trim();
        continue;
      }

      if (currentSection === "story" && line.trim() && !line.startsWith("#")) {
        descriptionLines.push(line);
      }

      if (currentSection === "acceptance criteria" && line.trim()) {
        acLines.push(line);
      }
    }

    const description = descriptionLines.join("\n").trim();
    const acceptanceCriteria = acLines.join("\n").trim();

    if (!title || !description) {
      return null;
    }

    return {
      id: storyId,
      title,
      status,
      description,
      acceptanceCriteria,
      epic: extractEpicId(storyId) ?? undefined,
    };
  } catch {
    return null;
  }
}

/**
 * Poll for agent readiness with timeout (NFR-P4: 10s target)
 */
async function waitForAgentReady(
  checkReady: () => Promise<boolean>,
  timeoutMs: number = 10000,
): Promise<boolean> {
  const startTime = Date.now();
  const intervalMs = 200;

  while (Date.now() - startTime < timeoutMs) {
    if (await checkReady()) {
      return true;
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  return false;
}

/**
 * Get project ID from current directory
 */
function getProjectId(config: OrchestratorConfig): string | null {
  const cwd = process.cwd();

  for (const [id, project] of Object.entries(config.projects)) {
    if (cwd.startsWith(project.path)) {
      return id;
    }
  }

  return null;
}

/**
 * Get audit directory for JSONL logging
 */
function getAuditDir(config: OrchestratorConfig, projectId: string): string {
  const sessionsDir = getSessionsDir(config.configPath, projectId);
  const auditDir = join(sessionsDir, "audit");

  // Ensure audit directory exists
  if (!existsSync(auditDir)) {
    mkdirSync(auditDir, { recursive: true });
  }

  return auditDir;
}

/**
 * Sleep for specified milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Retry function with exponential backoff
 */
async function retryWithBackoff<T>(
  fn: () => T,
  maxAttempts: number = 3,
  baseDelayMs: number = 1000,
): Promise<{ success: boolean; result?: T; error?: Error }> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const result = await fn();
      return { success: true, result };
    } catch (err) {
      if (attempt === maxAttempts) {
        return { success: false, error: err as Error };
      }
      // Exponential backoff: wait 2^attempt * baseDelay
      const delay = baseDelayMs * Math.pow(2, attempt - 1);
      await sleep(delay);
    }
  }
  return { success: false };
}

/**
 * Log resume event to audit trail
 */
function logResumeEvent(
  auditDir: string,
  params: {
    storyId: string;
    previousAgentId: string;
    newAgentId: string;
    retryCount: number;
    userMessage?: string;
    previousExitReason: string;
  },
): void {
  // Truncate user message for audit trail (max 200 chars for brevity)
  const truncatedMessage = params.userMessage
    ? params.userMessage.length > 200
      ? params.userMessage.slice(0, 197) + "..."
      : params.userMessage
    : "";

  logAuditEvent(auditDir, {
    timestamp: new Date().toISOString(),
    event_type: "story_resumed",
    agent_id: params.newAgentId,
    story_id: params.storyId,
    previous_agent_id: params.previousAgentId,
    retry_count: params.retryCount.toString(),
    user_message: truncatedMessage,
    previous_exit_reason: params.previousExitReason,
  });
}

/**
 * Main resume story implementation
 */
async function resumeStory(
  storyId: string,
  opts: ResumeOptions,
  config: OrchestratorConfig,
): Promise<void> {
  const startTime = Date.now();

  // Load sprint status
  const spinner = ora("Loading sprint status").start();
  const sprintStatus = readSprintStatus(process.cwd());

  if (!sprintStatus) {
    spinner.fail("Failed to load sprint status");
    console.error(
      chalk.red("No sprint-status.yaml found in current directory.\nRun from project root."),
    );
    process.exit(1);
  }

  // Check if story exists
  const storyStatus = sprintStatus.development_status[storyId];
  if (!storyStatus) {
    spinner.fail("Story not found");
    console.error(
      chalk.red(
        `Story "${storyId}" not found in sprint-status.yaml\n\n` +
          `Available stories:\n  ${Object.keys(sprintStatus.development_status)
            .filter((k) => k.match(/^\d+-\d+-/) && !k.startsWith("epic-"))
            .slice(0, 10)
            .join(
              "\n  ",
            )}${Object.keys(sprintStatus.development_status).length > 10 ? "\n  ..." : ""}`,
      ),
    );
    process.exit(1);
  }

  // Check if story is blocked
  if (storyStatus !== "blocked") {
    spinner.info("Story is not blocked");
    console.log(chalk.blue(`Story ${storyId} is not blocked (current status: ${storyStatus})`));
    console.log();
    console.log(chalk.dim("The story is already being worked on. Use:"));
    console.log(chalk.dim(`  ao status ${storyId}  -- to view current assignment`));
    console.log(chalk.dim(`  ao assign ${storyId} <agent>  -- to reassign`));
    return;
  }

  spinner.succeed(`Found story ${storyId} (status: ${storyStatus})`);

  // Get agent registry
  const projectId = getProjectId(config);
  if (!projectId) {
    console.error(chalk.red("Could not determine project ID. Run from a project directory."));
    process.exit(1);
  }

  const sessionsDir = getSessionsDir(config.configPath, projectId);
  const registry = getAgentRegistry(sessionsDir, config);

  // Reload registry to get latest state
  await registry.reload();

  // Get previous agent assignment
  const lookupSpinner = ora("Looking up previous agent").start();
  const previousAssignment = registry.getByStory(storyId);

  if (!previousAssignment) {
    lookupSpinner.fail("No previous agent found");
    console.error(chalk.yellow(`Story ${storyId} is blocked but has no previous agent to resume.`));
    console.log();
    console.log(chalk.dim("The story may have been manually marked as blocked."));
    console.log();
    console.log(chalk.dim("To start working on this story:"));
    console.log(chalk.cyan(`  ao spawn-story --story ${storyId}`));
    process.exit(1);
  }

  lookupSpinner.succeed(`Found previous agent: ${previousAssignment.agentId}`);

  // Load previous agent's metadata to get crash details and logs path
  const metadataSpinner = ora("Loading previous agent details").start();
  const previousMetadata = readMetadata(sessionsDir, previousAssignment.agentId);

  let previousLogsPath: string | undefined;
  let previousExitCode: number | undefined;
  let previousSignal: string | undefined;

  if (previousMetadata) {
    previousLogsPath = previousMetadata.previousLogsPath;
    previousExitCode = previousMetadata.exitCode;
    previousSignal = previousMetadata.signal;
  }

  metadataSpinner.succeed("Loaded previous agent details");

  // Get retry count
  const retrySpinner = ora("Checking retry history").start();
  const retryCount = registry.getRetryCount(storyId);
  const newRetryCount = retryCount + 1;

  retrySpinner.succeed(`Retry #${newRetryCount} for story ${storyId}`);

  // Get retry history for display
  const history = registry.getRetryHistory(storyId);
  if (history && history.attempts > 0) {
    console.log(
      chalk.gray(
        `  Previous attempts: ${history.attempts} (last: ${formatTimeAgo(history.lastRetryAt)})`,
      ),
    );
  }

  // Validate user message
  const userMessage = opts.message ? validateUserMessage(opts.message) : undefined;

  // Generate new agent session name
  const agentName = opts.agent || `ao-${storyId}-retry-${newRetryCount}`;

  // Load story context
  const storyLocation = join(process.cwd(), sprintStatus.story_location);
  const storyFilePath = findStoryFile(storyId, storyLocation);

  if (!storyFilePath) {
    console.error(chalk.red(`Story file for "${storyId}" not found in ${storyLocation}`));
    process.exit(1);
  }

  const storyContext = parseStoryFile(storyFilePath, storyId);
  if (!storyContext) {
    console.error(chalk.red(`Failed to parse story file: ${storyFilePath}`));
    process.exit(1);
  }

  // Format resume context
  const contextSpinner = ora("Preparing resume context").start();
  const resumeContext = formatResumeContext({
    story: storyContext,
    previousAssignment,
    retryCount: newRetryCount,
    userMessage,
    previousLogsPath,
    exitCode: previousExitCode,
    signal: previousSignal,
  });

  contextSpinner.succeed("Resume context prepared");

  // Check tmux availability
  const project = config.projects[projectId];
  const runtime = project.runtime ?? config.defaults.runtime;
  if (runtime === "tmux") {
    const tmuxSpinner = ora("Checking tmux availability").start();
    const tmuxAvailable = await checkTmuxWithTimeout();
    if (!tmuxAvailable) {
      tmuxSpinner.fail("tmux runtime not available");
      console.error(
        chalk.red(
          "tmux is not installed or not accessible.\n" +
            "Install: brew install tmux\n" +
            "Or configure alternative runtime in agent-orchestrator.yaml",
        ),
      );
      process.exit(1);
    }
    tmuxSpinner.succeed("tmux is available");
  }

  // Display what we're about to do
  console.log();
  console.log(header(`Resuming Story: ${storyId}`));
  console.log();
  console.log(`  ${chalk.dim("Story:")}   ${chalk.bold(storyContext.title)}`);
  console.log(`  ${chalk.dim("Retry:")}   ${chalk.yellow(`#${newRetryCount}`)}`);
  console.log(`  ${chalk.dim("Previous:")} ${chalk.dim(previousAssignment.agentId)}`);
  console.log(`  ${chalk.dim("New agent:")} ${chalk.green(agentName)}`);
  if (userMessage) {
    const snippet = userMessage.length > 50 ? userMessage.slice(0, 50) + "..." : userMessage;
    console.log(`  ${chalk.dim("Message:")} ${chalk.dim(snippet)}`);
  }
  console.log();

  // Spawn new agent
  const spawnSpinner = ora(`Spawning agent ${agentName}`).start();
  try {
    const sm = await getSessionManager(config);

    // Spawn session with resume context
    const session = await sm.spawn({
      projectId,
      prompt: resumeContext,
      agent: undefined, // Use default agent
    });

    spawnSpinner.succeed(`Session ${chalk.green(session.id)} created`);

    // Register new agent assignment
    const contextHash = previousAssignment.contextHash; // Reuse same context hash
    registry.register({
      agentId: session.id,
      storyId,
      assignedAt: new Date(),
      status: "active",
      contextHash,
    });

    // Increment retry count
    registry.incrementRetry(storyId, session.id);

    // Update story status to "in-progress" with retry logic
    const projectPath = project.path;
    const statusResult = await retryWithBackoff(
      () => updateSprintStatus(projectPath, storyId, "in-progress"),
      3,
      500,
    );

    if (!statusResult.success) {
      console.warn(chalk.yellow("Warning: Failed to update story status after retries"));
    }

    // Log resume event
    const auditDir = getAuditDir(config, projectId);
    logResumeEvent(auditDir, {
      storyId,
      previousAgentId: previousAssignment.agentId,
      newAgentId: session.id,
      retryCount: newRetryCount,
      userMessage,
      previousExitReason: previousAssignment.status,
    });

    console.log();
    console.log(`  Story:     ${chalk.dim(storyId)}`);
    console.log(`  Session:   ${chalk.green(session.id)}`);
    console.log(`  Worktree:  ${chalk.dim(session.workspacePath ?? "-")}`);
    if (session.branch) {
      console.log(`  Branch:    ${chalk.dim(session.branch)}`);
    }

    // Show tmux attach command
    const tmuxTarget = session.runtimeHandle?.id ?? session.id;
    console.log(`  Attach:    ${chalk.dim(`tmux attach -t ${tmuxTarget}`)}`);
    console.log();

    // Wait for agent readiness
    const readySpinner = ora("Waiting for agent to be ready").start();
    const isReady = await waitForAgentReady(async () => {
      if (!session.runtimeHandle) return false;
      const alive = await sm.get(session.id);
      return alive !== null;
    }, 10000);

    const elapsed = Date.now() - startTime;

    // Prepare resume message with crash details if available
    let resumeMessage = `Resumed ${storyId} with agent ${session.id}`;
    if (previousSignal) {
      resumeMessage += chalk.dim(` (previous crash: ${previousSignal}`);
      if (previousExitCode !== undefined) {
        resumeMessage += `, exit code ${previousExitCode}`;
      }
      resumeMessage += chalk.dim(")");
    }

    if (isReady) {
      readySpinner.succeed(`Agent ready in ${elapsed}ms`);
      console.log();
      console.log(chalk.green(resumeMessage));
      console.log(`Attach to session: ${chalk.dim(`tmux attach -t ${tmuxTarget}`)}`);
    } else {
      readySpinner.warn("Agent readiness check timed out (continuing anyway)");
      console.log();
      console.log(chalk.yellow(resumeMessage));
      console.log(chalk.dim("Note: Agent readiness check timed out after 10s"));
      console.log(`Attach to session: ${chalk.dim(`tmux attach -t ${tmuxTarget}`)}`);
    }

    console.log();
    console.log(chalk.dim("Next steps:"));
    console.log(chalk.dim(`  • Check agent status: ao status --agent ${session.id}`));
    console.log(chalk.dim(`  • View agent logs: ao logs ${session.id}`));
    console.log(chalk.dim(`  • Monitor progress: ao status ${storyId}`));
  } catch (err) {
    spawnSpinner.fail("Failed to spawn agent");
    console.error(chalk.red(`✗ ${err instanceof Error ? err.message : String(err)}`));
    console.log();
    console.log(chalk.dim("Troubleshooting:"));
    console.log(chalk.dim("  • Check if agent already running: ao status --agent " + agentName));
    console.log(chalk.dim(`  • Kill existing session: tmux kill-session -t ${agentName}`));
    console.log(chalk.dim(`  • Use different agent name: ao resume ${storyId} --agent <name>`));
    process.exit(1);
  }
}

export function registerResume(program: Command): void {
  program
    .command("resume <storyId>")
    .description("Resume a blocked story with a new agent")
    .option("--message <msg>", "Additional context for the resumed agent")
    .option("--agent <name>", "Custom agent session name")
    .action(async (storyId: string, opts) => {
      // Load config
      const config = loadConfig();
      if (!config) {
        console.error(chalk.red("No agent-orchestrator.yaml found. Run 'ao init' first."));
        process.exit(1);
      }

      await resumeStory(storyId, opts as ResumeOptions, config);
    });
}
