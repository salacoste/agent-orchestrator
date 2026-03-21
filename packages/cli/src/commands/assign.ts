import chalk from "chalk";
import ora from "ora";
import type { Command } from "commander";
import { createInterface } from "node:readline";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parse } from "yaml";
import {
  loadConfig,
  getAgentRegistry,
  computeStoryContextHash,
  getSessionsDir,
  getEventPublisher,
  type AgentStatus,
  type OrchestratorConfig,
} from "@composio/ao-core";

import { header } from "../lib/format.js";
import { getSessionManager } from "../lib/create-session-manager.js";
import { logAuditEvent } from "../lib/story-context.js";

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
  // Try direct match first
  const directPath = join(storyLocation, `${storyId}.md`);
  if (existsSync(directPath)) {
    return directPath;
  }

  // Try with story- prefix
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

/**
 * Validate story dependencies
 */
function validateDependencies(
  storyId: string,
  sprintStatus: SprintStatus,
): { valid: boolean; warnings: string[] } {
  const warnings: string[] = [];
  const dependencies = sprintStatus.dependencies?.[storyId] ?? [];

  for (const depId of dependencies) {
    const depStatus = sprintStatus.development_status[depId];
    if (!depStatus) {
      warnings.push(`Dependency '${depId}' not found in sprint status`);
    } else if (depStatus !== "done") {
      warnings.push(`Dependency '${depId}' is not complete (status: ${depStatus})`);
    }
  }

  return {
    valid: warnings.length === 0,
    warnings,
  };
}

/**
 * Log assignment to audit trail (JSONL)
 */

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

export function registerAssign(program: Command): void {
  program
    .command("assign")
    .description("Manually assign a story to an agent")
    .argument("<story-id>", "Story ID from sprint-status.yaml")
    .argument("<agent-id>", "Agent session ID (e.g., test-1)")
    .option("--force", "Skip confirmation prompts")
    .option("--unassign", "Remove current story assignment from agent")
    .action(async (storyId: string, agentId: string, opts) => {
      const startTime = Date.now();

      // Load config
      const config = loadConfig();
      if (!config) {
        console.error(chalk.red("No agent-orchestrator.yaml found. Run 'ao init' first."));
        process.exit(1);
      }

      // Determine project ID
      const projectId = getProjectId(config);
      if (!projectId) {
        console.error(chalk.red("Could not determine project ID. Run from a project directory."));
        process.exit(1);
      }

      if (!config.projects[projectId]) {
        console.error(chalk.red(`Unknown project: ${projectId}`));
        process.exit(1);
      }

      const project = config.projects[projectId];

      // Read sprint-status.yaml
      const cwd = process.cwd();
      const sprintStatus = readSprintStatus(cwd);

      if (!sprintStatus) {
        console.error(
          chalk.red(
            "No sprint-status.yaml found in current directory.\n" + "Run from project root.",
          ),
        );
        process.exit(1);
      }

      // Normalize story ID
      let normalizedStoryId = storyId;
      if (storyId.startsWith("story-")) {
        normalizedStoryId = storyId.slice(6);
      }

      // Check if story exists in sprint-status.yaml
      const storyStatus = sprintStatus.development_status[normalizedStoryId];
      if (!storyStatus) {
        console.error(
          chalk.red(
            `Story "${normalizedStoryId}" not found in sprint-status.yaml\n\n` +
              `Available stories:\n  ${Object.keys(sprintStatus.development_status)
                .filter((k) => k.match(/^\d+-\d+-/) && !k.startsWith("epic-"))
                .slice(0, 10)
                .join("\n  ")}${
                Object.keys(sprintStatus.development_status).length > 10 ? "\n  ..." : ""
              }`,
          ),
        );
        process.exit(1);
      }

      // Get agent registry
      const sessionsDir = getSessionsDir(config.configPath, project.path);
      const registry = getAgentRegistry(sessionsDir, config);

      // Handle --unassign flag
      if (opts.unassign) {
        const existing = registry.getByAgent(agentId);
        if (!existing) {
          console.log(chalk.yellow(`Agent '${agentId}' has no story assignment.`));
          process.exit(0);
        }

        console.log(header(`Unassigning Story from Agent: ${agentId}`));
        console.log();
        console.log(`  ${chalk.dim("Story:")}   ${existing.storyId}`);
        console.log(`  ${chalk.dim("Assigned:")}  ${formatDuration(existing.assignedAt)}`);
        console.log();

        const shouldContinue = opts.force || (await promptConfirmation("Unassign this story?"));
        if (!shouldContinue) {
          console.log(chalk.dim("Unassign cancelled."));
          process.exit(0);
        }

        registry.remove(agentId);

        // Log to audit trail
        const auditDir = join(sessionsDir, "audit");
        logAuditEvent(auditDir, {
          timestamp: new Date().toISOString(),
          event_type: "unassign",
          agent_id: agentId,
          story_id: existing.storyId,
          forced: opts.force,
        });

        console.log(chalk.green(`✓ Unassigned story from agent ${agentId}`));
        return;
      }

      // Get session manager
      const sm = await getSessionManager(config);

      // Verify agent exists
      const spinner = ora("Verifying agent session").start();
      const session = await sm.get(agentId);

      if (!session) {
        spinner.fail("Agent not found");
        console.error(
          chalk.red(
            `Agent session '${agentId}' not found.\n\n` +
              `Available agents can be listed with: ao status`,
          ),
        );
        process.exit(1);
      }

      spinner.succeed(`Agent ${chalk.green(agentId)} found`);

      // Check for existing assignment on this agent
      const existingAssignment = registry.getByAgent(agentId);
      if (existingAssignment) {
        console.log();
        console.log(chalk.yellow(`⚠️  Agent '${agentId}' is already assigned to story:`));
        console.log(`  ${chalk.dim("Story:")}   ${existingAssignment.storyId}`);
        console.log(
          `  ${chalk.dim("Assigned:")}  ${formatDuration(existingAssignment.assignedAt)}`,
        );
        console.log();

        const shouldReassign =
          opts.force || (await promptConfirmation("Reassign this agent to a new story?"));
        if (!shouldReassign) {
          console.log(chalk.dim("Assignment cancelled."));
          process.exit(0);
        }
      }

      // Check for duplicate assignment (story already assigned to another agent)
      if (!opts.force) {
        const duplicateForStory = registry.findActiveByStory(normalizedStoryId);
        if (duplicateForStory && duplicateForStory.agentId !== agentId) {
          console.log();
          console.log(
            chalk.yellow(
              `⚠️  Story '${normalizedStoryId}' is already assigned to agent ${duplicateForStory.agentId}`,
            ),
          );
          console.log(`  Assigned: ${formatDuration(duplicateForStory.assignedAt)}`);
          console.log();

          const shouldContinue = await promptConfirmation("Assign to this agent anyway?");
          if (!shouldContinue) {
            console.log(chalk.dim("Assignment cancelled."));
            process.exit(0);
          }
        }
      }

      // Validate dependencies
      const depValidation = validateDependencies(normalizedStoryId, sprintStatus);
      if (!depValidation.valid) {
        console.log();
        console.log(chalk.yellow("⚠️  Dependency warnings:"));
        for (const warning of depValidation.warnings) {
          console.log(`  - ${warning}`);
        }
        console.log();

        const shouldContinue = opts.force || (await promptConfirmation("Proceed anyway?"));
        if (!shouldContinue) {
          console.log(chalk.dim("Assignment cancelled."));
          process.exit(0);
        }
      }

      // Get story location from sprint-status.yaml
      const storyLocation = join(cwd, sprintStatus.story_location);

      // Find and parse story file
      const storySpinner = ora("Loading story context").start();
      const storyFilePath = findStoryFile(normalizedStoryId, storyLocation);

      if (!storyFilePath) {
        storySpinner.fail("Story file not found");
        console.error(
          chalk.red(`Story file for "${normalizedStoryId}" not found in ${storyLocation}`),
        );
        process.exit(1);
      }

      const storyContext = parseStoryFile(storyFilePath, normalizedStoryId);
      if (!storyContext) {
        storySpinner.fail("Failed to parse story file");
        console.error(chalk.red(`Failed to extract context from: ${storyFilePath}`));
        process.exit(1);
      }

      // Add dependencies from sprint-status.yaml if available
      if (sprintStatus.dependencies?.[normalizedStoryId]) {
        storyContext.dependencies = sprintStatus.dependencies[normalizedStoryId];
      }

      // Add priority from sprint-status.yaml if available
      if (sprintStatus.priorities?.[normalizedStoryId]) {
        storyContext.priority = sprintStatus.priorities[normalizedStoryId];
      }

      storySpinner.succeed(`Loaded story: ${storyContext.title}`);

      // Format story prompt
      const storyPrompt = formatStoryPrompt(storyContext);

      // Display assignment details
      console.log(header(`Assigning Story to Agent: ${agentId}`));
      console.log();
      console.log(`  ${chalk.dim("Story:")}   ${chalk.bold(storyContext.title)}`);
      console.log(`  ${chalk.dim("Story ID:")} ${chalk.green(normalizedStoryId)}`);
      console.log(`  ${chalk.dim("Epic:")}    ${storyContext.epic ?? "N/A"}`);
      console.log(`  ${chalk.dim("Status:")}  ${storyStatus}`);
      console.log(
        `  ${chalk.dim("Priority:")} ${sprintStatus.priorities?.[normalizedStoryId] ?? 0}`,
      );
      if (storyContext.dependencies?.length) {
        console.log(`  ${chalk.dim("Deps:")}    ${storyContext.dependencies.join(", ")}`);
      }
      console.log();

      // Register assignment
      const contextHash = computeStoryContextHash(
        storyContext.title,
        storyContext.description,
        storyContext.acceptanceCriteria,
      );

      const priority = sprintStatus.priorities?.[normalizedStoryId] ?? 0;

      registry.register({
        agentId,
        storyId: normalizedStoryId,
        assignedAt: new Date(),
        status: "active" as AgentStatus,
        contextHash,
        priority,
      });

      // Publish story lifecycle event (non-fatal)
      try {
        const ep = getEventPublisher();
        if (ep) {
          await ep.publishStoryAssigned({ storyId: normalizedStoryId, agentId, reason: "manual" });
        }
      } catch {
        // Non-fatal: event publishing is an enhancement
      }

      // Log to audit trail
      const auditDir = join(sessionsDir, "audit");
      logAuditEvent(auditDir, {
        timestamp: new Date().toISOString(),
        event_type: "assign",
        agent_id: agentId,
        story_id: normalizedStoryId,
        previous_story_id: existingAssignment?.storyId,
        forced: opts.force,
      });

      // Send story context to agent
      const sendSpinner = ora("Delivering story context to agent").start();
      try {
        await sm.send(agentId, storyPrompt);
        sendSpinner.succeed("Story context delivered");
      } catch (err) {
        sendSpinner.warn("Failed to deliver story context");
        console.warn(
          chalk.yellow(
            `Agent is running but story delivery failed: ${err instanceof Error ? err.message : String(err)}`,
          ),
        );
        console.warn(chalk.dim("You can deliver the story manually using: ao send"));
        console.warn(chalk.dim("Assignment has been recorded in the agent registry."));
      }

      const elapsed = Date.now() - startTime;

      console.log();
      console.log(
        chalk.green(`✓ Assigned ${normalizedStoryId} to agent ${agentId} in ${elapsed}ms`),
      );
      console.log();
      console.log(chalk.dim(`Agent session: ${agentId}`));
      console.log(chalk.dim(`Attach: tmux attach -t ${session.runtimeHandle?.id ?? agentId}`));
      console.log();
    });
}
