import chalk from "chalk";
import ora from "ora";
import { join } from "node:path";
import type { Command } from "commander";
import {
  loadConfig,
  getAgentRegistry,
  getSessionsDir,
  selectNextStory,
  getAssignableStories,
  computeStoryContextHash,
  getEventPublisher,
  type AgentStatus,
  type StoryCandidate,
} from "@composio/ao-core";

import { header } from "../lib/format.js";
import { getSessionManager } from "../lib/create-session-manager.js";
import {
  readSprintStatus,
  findStoryFile,
  parseStoryFile,
  formatStoryPrompt,
  promptConfirmation,
  logAuditEvent,
} from "../lib/story-context.js";

/**
 * Format the priority queue as a table for --dry-run display.
 */
function displayQueue(candidates: StoryCandidate[]): void {
  if (candidates.length === 0) {
    console.log(chalk.yellow("  No assignable stories found."));
    return;
  }

  // Header
  console.log(
    `  ${chalk.dim("Story ID".padEnd(40))} ${chalk.dim("Priority".padEnd(10))} ${chalk.dim("Epic".padEnd(10))}`,
  );
  console.log(`  ${"─".repeat(40)} ${"─".repeat(10)} ${"─".repeat(10)}`);

  for (const candidate of candidates) {
    const priorityColor = candidate.priority > 0 ? chalk.green : chalk.dim;
    console.log(
      `  ${candidate.storyId.padEnd(40)} ${priorityColor(String(candidate.priority).padEnd(10))} ${chalk.cyan(candidate.epicId.padEnd(10))}`,
    );
  }
}

export function registerAssignNext(program: Command): void {
  program
    .command("assign-next")
    .description("Auto-assign the highest-priority story to an agent")
    .argument("<agent-id>", "Agent session ID to assign story to")
    .option("--dry-run", "Show priority queue without assigning")
    .option("--force", "Skip confirmation prompts")
    .action(async (agentId: string, opts: { dryRun?: boolean; force?: boolean }) => {
      const startTime = Date.now();

      // Load config
      const config = loadConfig();
      if (!config) {
        console.error(chalk.red("No agent-orchestrator.yaml found. Run 'ao init' first."));
        process.exit(1);
      }

      // Determine project ID from cwd
      const cwd = process.cwd();
      let projectId: string | null = null;
      for (const [id, project] of Object.entries(config.projects)) {
        if (cwd.startsWith(project.path)) {
          projectId = id;
          break;
        }
      }

      if (!projectId) {
        console.error(chalk.red("Could not determine project ID. Run from a project directory."));
        process.exit(1);
      }

      const project = config.projects[projectId];
      if (!project) {
        console.error(chalk.red(`Unknown project: ${projectId}`));
        process.exit(1);
      }

      const sessionsDir = getSessionsDir(config.configPath, project.path);
      const registry = getAgentRegistry(sessionsDir, config);

      // Reload registry from disk to get latest state
      await registry.reload();

      const projectPath = project.path;

      // --dry-run: show queue only
      if (opts.dryRun) {
        console.log(header("Assignment Queue (Dry Run)"));
        console.log();

        const candidates = getAssignableStories(projectPath, registry);
        displayQueue(candidates);

        console.log();
        console.log(chalk.dim(`${candidates.length} assignable stories found.`));
        return;
      }

      // Select next story
      const spinner = ora("Selecting highest-priority story").start();
      const candidate = selectNextStory(projectPath, registry);

      if (!candidate) {
        spinner.info("No assignable stories");
        console.log();
        console.log(
          chalk.yellow("All stories are either assigned, blocked by dependencies, or not ready."),
        );
        console.log(chalk.dim("Run 'ao assign-next <agent-id> --dry-run' to see the full queue."));
        process.exit(0);
      }

      spinner.succeed(
        `Selected: ${chalk.green(candidate.storyId)} (priority: ${candidate.priority})`,
      );

      // Verify agent exists
      const agentSpinner = ora("Verifying agent session").start();
      const sm = await getSessionManager(config);
      const session = await sm.get(agentId);

      if (!session) {
        agentSpinner.fail("Agent not found");
        console.error(
          chalk.red(
            `Agent session '${agentId}' not found.\n\n` +
              "Available agents can be listed with: ao status",
          ),
        );
        process.exit(1);
      }

      agentSpinner.succeed(`Agent ${chalk.green(agentId)} found`);

      // Check for existing assignment on this agent
      const existingAssignment = registry.getByAgent(agentId);
      if (existingAssignment) {
        console.log();
        console.log(chalk.yellow(`⚠️  Agent '${agentId}' is already assigned to story:`));
        console.log(`  ${chalk.dim("Story:")}   ${existingAssignment.storyId}`);
        console.log();

        const shouldReassign =
          opts.force || (await promptConfirmation("Reassign this agent to a new story?"));
        if (!shouldReassign) {
          console.log(chalk.dim("Assignment cancelled."));
          process.exit(0);
        }
      }

      // Load story context
      const sprintStatus = readSprintStatus(projectPath);
      const storyLocation = sprintStatus?.story_location
        ? join(projectPath, sprintStatus.story_location)
        : projectPath;

      const storyFilePath = findStoryFile(candidate.storyId, storyLocation);

      let storyTitle = candidate.storyId;
      let storyPrompt: string | undefined;
      let acceptanceCriteria = "";

      if (storyFilePath) {
        const storyContext = parseStoryFile(storyFilePath, candidate.storyId);
        if (storyContext) {
          storyTitle = storyContext.title;
          storyPrompt = formatStoryPrompt(storyContext);
          acceptanceCriteria = storyContext.acceptanceCriteria;
        }
      }

      // Confirm assignment
      console.log(header(`Auto-Assign: ${candidate.storyId}`));
      console.log();
      console.log(`  ${chalk.dim("Story:")}    ${chalk.bold(storyTitle)}`);
      console.log(`  ${chalk.dim("Story ID:")} ${chalk.green(candidate.storyId)}`);
      console.log(`  ${chalk.dim("Epic:")}     ${candidate.epicId}`);
      console.log(`  ${chalk.dim("Priority:")} ${candidate.priority}`);
      console.log(`  ${chalk.dim("Agent:")}    ${chalk.green(agentId)}`);
      console.log();

      if (!opts.force) {
        const shouldProceed = await promptConfirmation("Assign this story?");
        if (!shouldProceed) {
          console.log(chalk.dim("Assignment cancelled."));
          process.exit(0);
        }
      }

      // Register assignment
      const contextHash = computeStoryContextHash(
        storyTitle,
        candidate.storyId,
        acceptanceCriteria,
      );

      registry.register({
        agentId,
        storyId: candidate.storyId,
        assignedAt: new Date(),
        status: "active" as AgentStatus,
        contextHash,
        priority: candidate.priority,
      });

      // Publish story lifecycle event (non-fatal)
      try {
        const ep = getEventPublisher();
        if (ep) {
          await ep.publishStoryAssigned({ storyId: candidate.storyId, agentId, reason: "auto" });
        }
      } catch {
        // Non-fatal: event publishing is an enhancement
      }

      // Log to audit trail
      const auditDir = join(sessionsDir, "audit");
      logAuditEvent(auditDir, {
        timestamp: new Date().toISOString(),
        event_type: "auto-assign",
        agent_id: agentId,
        story_id: candidate.storyId,
        priority: candidate.priority,
        source: "assign-next",
      });

      // Send story context to agent if available
      if (storyPrompt) {
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
          console.warn(chalk.dim("Assignment has been recorded in the agent registry."));
        }
      }

      const elapsed = Date.now() - startTime;

      console.log();
      console.log(
        chalk.green(`✓ Assigned ${candidate.storyId} to agent ${agentId} in ${elapsed}ms`),
      );
      console.log();
      console.log(chalk.dim(`Agent session: ${agentId}`));
      const tmuxTarget = session.runtimeHandle?.id ?? agentId;
      console.log(chalk.dim(`Attach: tmux attach -t ${tmuxTarget}`));
      console.log();
    });
}
