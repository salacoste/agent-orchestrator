import chalk from "chalk";
import type { Command } from "commander";
import { loadConfig, getSessionsDir, getAgentRegistry } from "@composio/ao-core";

interface PauseOptions {
  resume?: boolean;
}

/**
 * Pause or resume blocked detection for an agent
 *
 * Usage: ao pause <agent-id>        -- pause blocked detection
 *        ao pause <agent-id> --resume -- resume blocked detection
 */
async function pauseAgent(agentId: string, opts: PauseOptions): Promise<void> {
  // Load config
  const config = loadConfig();
  if (!config) {
    console.error(chalk.red("No agent-orchestrator.yaml found. Run 'ao init' first."));
    process.exit(1);
  }

  // Get project ID from current directory
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

  // Get agent registry
  const sessionsDir = getSessionsDir(config.configPath, projectId);
  const registry = getAgentRegistry(sessionsDir, config);

  // Check if agent exists
  await registry.reload();
  const assignment = registry.getByAgent(agentId);

  if (!assignment) {
    console.error(chalk.red(`Agent "${agentId}" not found.`));
    console.log();
    console.log(chalk.dim("Active agents:"));
    const activeAgents = registry.list();
    if (activeAgents.length === 0) {
      console.log(chalk.dim("  (none)"));
    } else {
      for (const agent of activeAgents) {
        console.log(
          `  ${chalk.green(agent.agentId)} ${chalk.dim(`(story: ${agent.storyId}, status: ${agent.status})`)}`,
        );
      }
    }
    process.exit(1);
  }

  if (opts.resume) {
    console.log(chalk.blue(`Resuming blocked detection for agent ${agentId}`));
    console.log();
    console.log(`  Agent:     ${chalk.green(agentId)}`);
    console.log(`  Story:     ${chalk.dim(assignment.storyId)}`);
    console.log(`  Status:    ${chalk.yellow(assignment.status)}`);
    console.log();
    console.log(chalk.green("✓ Blocked detection resumed"));
    console.log();
    console.log(chalk.dim("Note: The agent will now be monitored for inactivity."));
  } else {
    console.log(chalk.blue(`Pausing blocked detection for agent ${agentId}`));
    console.log();
    console.log(`  Agent:     ${chalk.green(agentId)}`);
    console.log(`  Story:     ${chalk.dim(assignment.storyId)}`);
    console.log(`  Status:    ${chalk.yellow(assignment.status)}`);
    console.log();
    console.log(chalk.yellow("⚠ Blocked detection paused"));
    console.log();
    console.log(chalk.dim("The agent will not be marked as blocked while inactive."));
    console.log(chalk.dim(`To resume: ${chalk.cyan(`ao pause ${agentId} --resume`)}`));
  }
}

export function registerPause(program: Command): void {
  program
    .command("pause <agentId>")
    .description("Pause blocked detection for an agent (prevents automatic blocking)")
    .option("--resume", "Resume blocked detection for the agent")
    .action(async (agentId: string, opts) => {
      await pauseAgent(agentId, opts as PauseOptions);
    });
}
