import chalk from "chalk";
import ora from "ora";
import type { Command } from "commander";
import { execFile } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { promisify } from "node:util";
import { createInterface } from "node:readline";
import { parse } from "yaml";
import {
  loadConfig,
  type OrchestratorConfig,
  getAgentRegistry,
  computeStoryContextHash,
  getSessionsDir,
  type AgentStatus,
  createConflictDetectionService,
  createConflictResolutionService,
} from "@composio/ao-core";

import { getSessionManager } from "../lib/create-session-manager.js";
import { header } from "../lib/format.js";

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

/**
 * Format duration since a timestamp
 */
function formatDuration(since: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - since.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${diffDays}d ago`;
}

/**
 * Check if tmux is installed with timeout (NFR-S9: 30s timeout, NFR-S7: use execFile)
 */
async function checkTmuxWithTimeout(): Promise<boolean> {
  try {
    // SECURITY: Use execFile, NOT exec (NFR-S7)
    // NFR-S9: 30s timeout for external commands
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
 * Searches for story files matching the ID pattern
 */
function findStoryFile(storyId: string, storyLocation: string): string | null {
  // Try direct match first
  const directPath = join(storyLocation, `${storyId}.md`);
  if (existsSync(directPath)) {
    return directPath;
  }

  // Try with story- prefix (e.g., story-1-2-cli-spawn-agent.md)
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
    let description = "";
    let acceptanceCriteria = "";
    let currentSection = "";
    const descriptionLines: string[] = [];
    const acLines: string[] = [];

    for (const line of lines) {
      // Extract status
      const statusMatch = line.match(/^Status:\s*(.+)$/);
      if (statusMatch) {
        status = statusMatch[1].trim();
        continue;
      }

      // Extract title from h1
      const titleMatch = line.match(/^# (.+)$/);
      if (titleMatch && !title) {
        title = titleMatch[1].replace(/^Story\s+/, "").trim();
        continue;
      }

      // Track sections
      if (line.startsWith("## ")) {
        currentSection = line.replace("## ", "").toLowerCase().trim();
        continue;
      }

      // Extract description
      if (currentSection === "story" && line.trim() && !line.startsWith("#")) {
        descriptionLines.push(line);
      }

      // Extract acceptance criteria
      if (currentSection === "acceptance criteria" && line.trim()) {
        acLines.push(line);
      }
    }

    description = descriptionLines.join("\n").trim();
    acceptanceCriteria = acLines.join("\n").trim();

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
 * Format story context as a prompt for the agent
 */
function formatStoryPrompt(story: StoryContext): string {
  const parts: string[] = [];

  parts.push(`# Story: ${story.title}`);
  parts.push(`**Story ID:** ${story.id}`);
  if (story.epic) {
    parts.push(`**Epic:** ${story.epic}`);
  }
  parts.push(`**Status:** ${story.status}`);
  parts.push("");

  parts.push("## Description");
  parts.push(story.description);
  parts.push("");

  if (story.acceptanceCriteria) {
    parts.push("## Acceptance Criteria");
    parts.push(story.acceptanceCriteria);
    parts.push("");
  }

  if (story.dependencies && story.dependencies.length > 0) {
    parts.push("## Dependencies");
    parts.push(`This story depends on: ${story.dependencies.join(", ")}`);
    parts.push("");
  }

  parts.push("---");
  parts.push("");
  parts.push("Please implement this story following the acceptance criteria.");
  parts.push(
    "Read the full story file from the implementation-artifacts directory for complete context.",
  );

  return parts.join("\n");
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
 * Prompt user for confirmation (y/N)
 */
function promptConfirmation(question: string): Promise<boolean> {
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(`${question} [y/N]: `, (answer: string) => {
      rl.close();
      resolve(answer.toLowerCase() === "y" || answer.toLowerCase() === "yes");
    });
  });
}

export function registerSpawnStory(program: Command): void {
  program
    .command("spawn-story")
    .description("Spawn an AI agent for a story with full context from sprint-status.yaml")
    .requiredOption("--story <id>", "Story ID from sprint-status.yaml (e.g., 1-2-cli-spawn-agent)")
    .option("--session <name>", "Custom session name (default: ao-{story-id})")
    .option("--agent <type>", "Override agent type (claude-code, codex, aider, glm)")
    .option("--project <id>", "Project ID from config (auto-detected if not specified)")
    .option("--open", "Open session in terminal tab after spawn")
    .option("--force", "Skip duplicate assignment check")
    .action(async (opts) => {
      const startTime = Date.now();

      // Load config
      const config = loadConfig();
      if (!config) {
        console.error(chalk.red("No agent-orchestrator.yaml found. Run 'ao init' first."));
        process.exit(1);
      }

      // Determine project ID
      const projectId = opts.project ?? getProjectId(config);
      if (!projectId) {
        console.error(
          chalk.red(
            "Could not determine project ID. Specify with --project or run from a project directory.",
          ),
        );
        process.exit(1);
      }

      if (!config.projects[projectId]) {
        console.error(
          chalk.red(
            `Unknown project: ${projectId}\nAvailable: ${Object.keys(config.projects).join(", ")}`,
          ),
        );
        process.exit(1);
      }

      const project = config.projects[projectId];

      // Check tmux availability
      const runtime = project.runtime ?? config.defaults.runtime;
      if (runtime === "tmux") {
        const spinner = ora("Checking tmux availability").start();
        const tmuxAvailable = await checkTmuxWithTimeout();
        if (!tmuxAvailable) {
          spinner.fail("tmux runtime not available");
          console.error(
            chalk.red(
              "tmux is not installed or not accessible.\n" +
                "Install: brew install tmux\n" +
                "Or configure alternative runtime in agent-orchestrator.yaml",
            ),
          );
          process.exit(1);
        }
        spinner.succeed("tmux is available");
      }

      // Read sprint-status.yaml
      const spinner = ora("Loading sprint status").start();
      const sprintStatus = readSprintStatus(process.cwd());

      if (!sprintStatus) {
        spinner.fail("Failed to load sprint status");
        console.error(
          chalk.red(
            "No sprint-status.yaml found in current directory.\n" + "Run from project root.",
          ),
        );
        process.exit(1);
      }

      // Normalize story ID (remove leading "story-" if present)
      let storyId = opts.story;
      if (storyId.startsWith("story-")) {
        storyId = storyId.slice(6);
      }

      // Check if story exists in sprint-status.yaml
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

      spinner.succeed(`Found story ${storyId} (status: ${storyStatus})`);

      // Get agent registry for conflict detection
      const sessionsDir = getSessionsDir(config.configPath, projectId);
      const registry = getAgentRegistry(sessionsDir, config);

      // Check for conflicts unless --force is specified
      if (!opts.force) {
        const conflictSpinner = ora("Checking for conflicts").start();

        // Create conflict detection service
        const conflictService = createConflictDetectionService(registry, {
          enabled: true,
        });

        // Check if spawning would create a conflict
        const wouldConflict = conflictService.canAssign(storyId);
        const existingConflict = conflictService.detectConflict(storyId, "temp-new-agent");

        if (wouldConflict && existingConflict) {
          conflictSpinner.warn("Conflict detected");

          console.log();
          console.log(chalk.red.bold(`⛔ Conflict Prevention: Cannot spawn agent for ${storyId}`));
          console.log();

          // Show existing assignments
          console.log(chalk.bold("Existing assignments:"));
          const existing = registry.findActiveByStory(storyId);
          if (existing) {
            console.log(`  ${chalk.yellow("•")} ${chalk.bold(existing.agentId)}`);
            console.log(`      ${chalk.dim(`Assigned ${formatDuration(existing.assignedAt)}`)}`);
            if (existing.contextHash) {
              console.log(
                `      ${chalk.dim(`Context: ${existing.contextHash.substring(0, 8)}...`)}`,
              );
            }
          }
          console.log();

          // Check if auto-resolve is enabled
          const conflictsConfig = config.defaults.conflicts ?? {};
          const autoResolve = conflictsConfig.autoResolve ?? false;

          if (autoResolve) {
            // Auto-resolve is enabled - show what would happen
            console.log(chalk.dim("Auto-resolution is enabled."));
            console.log(
              chalk.dim(`The existing agent will be terminated and replaced with the new agent.`),
            );
            console.log();

            const shouldContinue = await promptConfirmation("Continue with auto-resolution?");
            if (!shouldContinue) {
              console.log(chalk.dim("Spawn cancelled."));
              process.exit(0);
            }

            // Perform auto-resolution
            const resolveSpinner = ora("Resolving conflict").start();

            // Create a mock runtime for the resolution service
            // Note: In production, this should use the actual runtime plugin
            const mockRuntime = {
              name: "spawn-story-runtime",
              async create() {
                return { id: "spawn-session", runtimeName: "spawn-story-runtime", data: {} };
              },
              async destroy(_handle: { id: string }) {
                // Will be called after the new agent is spawned
              },
              async sendMessage(): Promise<void> {},
              async getOutput(): Promise<string> {
                return "";
              },
              async isAlive(): Promise<boolean> {
                return false;
              },
            };

            const resolutionService = createConflictResolutionService(registry, mockRuntime, {
              autoResolve: true,
              tieBreaker: conflictsConfig.tieBreaker ?? "recent",
              notifyOnResolution: true,
            });

            const result = await resolutionService.resolve(existingConflict);

            if (result.action === "manual") {
              resolveSpinner.warn("Auto-resolution failed");
              console.log(
                chalk.yellow("Could not auto-resolve conflict. Manual resolution required."),
              );
              console.log(chalk.dim(`Use ${chalk.bold("--force")} to spawn anyway.`));
              process.exit(1);
            }

            resolveSpinner.succeed(`Conflict resolved: ${result.reason}`);
            console.log();
            console.log(
              chalk.dim(`Existing agent ${chalk.red(result.terminatedAgent)} will be terminated.`),
            );
            console.log();
          } else {
            // Auto-resolve is disabled - block spawn
            console.log(chalk.bold("Options:"));
            console.log(
              `  ${chalk.green("[f]orce")}  ${chalk.dim("-- Spawn anyway (creates conflict)")}`,
            );
            console.log(`  ${chalk.green("[c]ancel")} ${chalk.dim("-- Abort spawn")}`);
            console.log();

            const rl = createInterface({
              input: process.stdin,
              output: process.stdout,
            });

            const answer = await new Promise<string>((resolve) => {
              rl.question("Choice [f/c]: ", (ans: string) => {
                rl.close();
                resolve(ans.trim().toLowerCase());
              });
            });

            if (answer === "f" || answer === "force") {
              console.log(chalk.dim("Spawning anyway..."));
            } else {
              console.log(chalk.dim("Spawn cancelled."));
              process.exit(0);
            }
          }
        } else {
          conflictSpinner.succeed("No conflicts detected");
        }
      } else {
        console.log(chalk.dim("Skipping conflict check (--force specified)"));
      }

      // Get story location from sprint-status.yaml
      const storyLocation = join(process.cwd(), sprintStatus.story_location);

      // Find and parse story file
      const storyFileSpinner = ora("Reading story context").start();
      const storyFilePath = findStoryFile(storyId, storyLocation);

      if (!storyFilePath) {
        storyFileSpinner.fail("Story file not found");
        console.error(
          chalk.red(
            `Story file for "${storyId}" not found in ${storyLocation}\n` +
              `Ensure story file exists with name: ${storyId}.md or story-${storyId}.md`,
          ),
        );
        process.exit(1);
      }

      const storyContext = parseStoryFile(storyFilePath, storyId);
      if (!storyContext) {
        storyFileSpinner.fail("Failed to parse story file");
        console.error(chalk.red(`Failed to extract context from story file: ${storyFilePath}`));
        process.exit(1);
      }

      // Add dependencies from sprint-status.yaml if available
      if (sprintStatus.dependencies?.[storyId]) {
        storyContext.dependencies = sprintStatus.dependencies[storyId];
      }

      // Add priority from sprint-status.yaml if available
      if (sprintStatus.priorities?.[storyId]) {
        storyContext.priority = sprintStatus.priorities[storyId];
      }

      storyFileSpinner.succeed(`Loaded story: ${storyContext.title}`);

      // Format story prompt
      const storyPrompt = formatStoryPrompt(storyContext);

      // Display what we're about to spawn
      console.log(header(`Spawning Agent for Story: ${storyId}`));
      console.log();
      console.log(`  ${chalk.dim("Story:")}   ${chalk.bold(storyContext.title)}`);
      console.log(`  ${chalk.dim("Epic:")}    ${storyContext.epic ?? "N/A"}`);
      console.log(`  ${chalk.dim("Status:")}  ${storyStatus}`);
      if (storyContext.dependencies?.length) {
        console.log(`  ${chalk.dim("Deps:")}    ${storyContext.dependencies.join(", ")}`);
      }
      console.log();

      // Note: Custom session name from --session option is stored for reference
      // The session manager generates its own session ID
      const customSessionName = opts.session;
      if (customSessionName) {
        console.log(`  ${chalk.dim("Session name:")}${chalk.dim(customSessionName)}`);
      }

      // Get session manager and spawn session
      const spawnSpinner = ora("Creating session").start();
      try {
        const sm = await getSessionManager(config);

        // Spawn session with story context as prompt
        const session = await sm.spawn({
          projectId,
          prompt: storyPrompt,
          agent: opts.agent,
        });

        spawnSpinner.succeed(`Session ${chalk.green(session.id)} created`);
        // Register agent assignment
        const contextHash = computeStoryContextHash(
          storyContext.title,
          storyContext.description,
          storyContext.acceptanceCriteria,
        );

        registry.register({
          agentId: session.id,
          storyId,
          assignedAt: new Date(),
          status: "active" as AgentStatus,
          contextHash,
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

        // Wait for agent readiness (NFR-P4: 10s target)
        const readySpinner = ora("Waiting for agent to be ready").start();
        const isReady = await waitForAgentReady(async () => {
          if (!session.runtimeHandle) return false;
          // Use session manager to check if alive
          const alive = await sm.get(session.id);
          return alive !== null;
        }, 10000);

        if (isReady) {
          const elapsed = Date.now() - startTime;
          readySpinner.succeed(`Agent ready in ${elapsed}ms`);
          console.log();
          console.log(chalk.green(`Agent spawned for ${storyId} in session ${session.id}`));
          console.log(`Attach to session: ${chalk.dim(`tmux attach -t ${tmuxTarget}`)}`);
        } else {
          readySpinner.warn("Agent readiness check timed out (continuing anyway)");
          console.log();
          console.log(chalk.yellow(`Agent spawned for ${storyId} in session ${session.id}`));
          console.log(chalk.dim("Note: Agent readiness check timed out after 10s"));
          console.log(`Attach to session: ${chalk.dim(`tmux attach -t ${tmuxTarget}`)}`);
        }

        console.log();
      } catch (err) {
        spawnSpinner.fail("Failed to spawn agent");
        console.error(chalk.red(`✗ ${err instanceof Error ? err.message : String(err)}`));
        process.exit(1);
      }
    });
}
