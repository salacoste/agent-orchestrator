import chalk from "chalk";
import ora from "ora";
import type { Command } from "commander";
import {
  getAgentRegistry,
  getSessionsDir,
  type AgentStatus,
  loadConfig,
} from "@composio/ao-core";
import { header } from "../lib/format.js";

/**
 * Get status emoji for display
 */
function getStatusEmoji(status: AgentStatus): string {
  const emojis: Record<AgentStatus, string> = {
    spawning: "🟡",
    active: "🟢",
    idle: "🟠",
    completed: "✅",
    blocked: "🔴",
    disconnected: "⚫",
  };
  return emojis[status] ?? "❓";
}

/**
 * Get status color for display
 */
function getStatusColor(status: AgentStatus): (s: string) => string {
  const colors: Record<AgentStatus, (s: string) => string> = {
    spawning: chalk.yellow,
    active: chalk.green,
    idle: (s) => chalk.hex("#FFA500")(s), // orange
    completed: chalk.gray,
    blocked: chalk.red,
    disconnected: chalk.dim,
  };
  return colors[status] ?? ((s) => s);
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
 * Register agent status commands
 */
export function registerAgent(program: Command): void {
  program
    .command("agent")
    .description("Query agent assignments and status")
    .argument("[action]", "Action: status, story, or registry", "status")
    .argument("[id]", "Agent ID or story ID", "")
    .option("--format <type>", "Output format: table (default) or json")
    .option("--reload", "Reload registry from disk")
    .action(async (action, id, opts) => {
      const config = loadConfig();
      if (!config) {
        console.error(chalk.red("No agent-orchestrator.yaml found. Run 'ao init' first."));
        process.exit(1);
      }

      // Determine project ID (use first project or from config)
      const projectId = Object.keys(config.projects)[0];
      if (!projectId) {
        console.error(chalk.red("No projects configured."));
        process.exit(1);
      }

      const _project = config.projects[projectId];
      const sessionsDir = getSessionsDir(config.configPath, projectId);

      // Get agent registry
      const registry = getAgentRegistry(sessionsDir, config);

      // Reload if requested
      if (opts.reload) {
        const spinner = ora("Reloading agent registry").start();
        await registry.reload();
        spinner.succeed("Registry reloaded");
        console.log();
      }

      const actionLower = action.toLowerCase();

      if (actionLower === "status" || actionLower === "list") {
        // Query by agent ID or list all
        if (id) {
          await showAgentStatus(registry, id, opts.format);
        } else {
          await listAllAgents(registry, opts.format);
        }
      } else if (actionLower === "story") {
        // Query by story ID
        if (!id) {
          console.error(
            chalk.red("Error: Story ID required for 'story' action\n") +
              "Usage: ao agent story <story-id>",
          );
          process.exit(1);
        }
        await showAgentForStory(registry, id, opts.format);
      } else if (actionLower === "registry") {
        // Show registry info
        await showRegistryInfo(registry);
      } else {
        console.error(
          chalk.red(`Error: Unknown action '${action}'\n`) +
            "Available actions: status, story, registry",
        );
        process.exit(1);
      }
    });
}

/**
 * Show status for a specific agent
 */
async function showAgentStatus(
  registry: Awaited<ReturnType<typeof getAgentRegistry>>,
  agentId: string,
  format?: string,
): Promise<void> {
  const assignment = registry.getByAgent(agentId);

  if (!assignment) {
    console.error(
      chalk.red(`Error: Agent '${agentId}' not found in registry\n`) +
        "Hint: Use 'ao agent' to list all agents",
    );
    process.exit(1);
  }

  if (format === "json") {
    console.log(JSON.stringify(assignment, null, 2));
    return;
  }

  // Table format
  console.log(header(`Agent: ${agentId}`));
  console.log();
  console.log(`  Story:      ${chalk.bold(assignment.storyId)}`);
  console.log(
    `  Status:     ${getStatusEmoji(assignment.status)} ${getStatusColor(assignment.status)(assignment.status)}`,
  );
  console.log(`  Assigned:   ${formatDuration(assignment.assignedAt)}`);
  console.log(`  Hash:       ${chalk.dim(assignment.contextHash.substring(0, 16))}...`);
  console.log();
}

/**
 * Show agent for a specific story
 */
async function showAgentForStory(
  registry: Awaited<ReturnType<typeof getAgentRegistry>>,
  storyId: string,
  format?: string,
): Promise<void> {
  const assignment = registry.getByStory(storyId);

  if (!assignment) {
    console.log(chalk.dim(`No agent assigned to story '${storyId}'`));
    return;
  }

  if (format === "json") {
    console.log(JSON.stringify(assignment, null, 2));
    return;
  }

  console.log(header(`Story: ${storyId}`));
  console.log();
  console.log(`  Agent:      ${chalk.bold(assignment.agentId)}`);
  console.log(
    `  Status:     ${getStatusEmoji(assignment.status)} ${getStatusColor(assignment.status)(assignment.status)}`,
  );
  console.log(`  Assigned:   ${formatDuration(assignment.assignedAt)}`);
  console.log();
}

/**
 * List all agents
 */
async function listAllAgents(
  registry: Awaited<ReturnType<typeof getAgentRegistry>>,
  format?: string,
): Promise<void> {
  const assignments = registry.list();

  if (assignments.length === 0) {
    console.log(chalk.dim("No agents registered"));
    return;
  }

  if (format === "json") {
    console.log(JSON.stringify(assignments, null, 2));
    return;
  }

  // Table format
  console.log(header("Agent Registry"));
  console.log();

  // Sort by assignedAt (newest first)
  const sorted = [...assignments].sort((a, b) => b.assignedAt.getTime() - a.assignedAt.getTime());

  for (const assignment of sorted) {
    const emoji = getStatusEmoji(assignment.status);
    const statusColor = getStatusColor(assignment.status);
    const timeAgo = formatDuration(assignment.assignedAt);

    console.log(
      `  ${emoji} ${chalk.bold(assignment.agentId.padEnd(25))} ` +
        `${statusColor(assignment.status.padEnd(12))} ` +
        `${chalk.dim(assignment.storyId.padEnd(35))} ` +
        `${chalk.dim(timeAgo)}`,
    );
  }

  console.log();
  console.log(`  Total: ${chalk.bold(String(assignments.length))} agents`);
  console.log();

  // Show zombie count
  const zombies = registry.getZombies();
  if (zombies.length > 0) {
    console.log(
      chalk.yellow(`  ⚠️  ${zombies.length} disconnected agent(s) - run 'ao cleanup' to remove`),
    );
    console.log();
  }
}

/**
 * Show registry information
 */
async function showRegistryInfo(
  registry: Awaited<ReturnType<typeof getAgentRegistry>>,
): Promise<void> {
  const assignments = registry.list();
  const zombies = registry.getZombies();

  console.log(header("Agent Registry Info"));
  console.log();
  console.log(`  Total agents:   ${chalk.bold(String(assignments.length))}`);
  console.log(
    `  Active:         ${chalk.green(String(assignments.filter((a) => a.status === "active").length))}`,
  );
  console.log(
    `  Idle:           ${chalk.hex("#FFA500")(String(assignments.filter((a) => a.status === "idle").length))}`,
  );
  console.log(
    `  Completed:      ${chalk.gray(String(assignments.filter((a) => a.status === "completed").length))}`,
  );
  console.log(
    `  Blocked:        ${chalk.red(String(assignments.filter((a) => a.status === "blocked").length))}`,
  );
  console.log(`  Disconnected:   ${chalk.dim(String(zombies.length))}`);
  console.log();
}
