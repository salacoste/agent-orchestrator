/**
 * Fleet Command — htop-style table showing all agents and their stories
 */

import chalk from "chalk";
import type { Command } from "commander";
import { getAgentStatusEmoji, formatTimeAgo, truncate } from "../lib/format.js";
import { loadConfig, type AgentAssignment } from "@composio/ao-core";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { parse } from "yaml";

/**
 * Fleet agent data structure
 */
interface FleetAgent {
  agentId: string;
  storyId: string | null;
  storyTitle: string | null;
  agentStatus: "active" | "idle" | "blocked" | "disconnected";
  storyStatus: "backlog" | "ready-for-dev" | "in-progress" | "review" | "done";
  lastActivity: Date | null;
  idleTime: number | null; // minutes
  notes: string;
  retryCount?: number;
}

/**
 * Sprint status data structure
 */
interface SprintStatus {
  development_status: Record<string, string>;
  story_location: string;
}

/**
 * Story metadata from story file
 */
interface StoryMetadata {
  title?: string;
  status?: string;
}

/**
 * Read sprint-status.yaml to get story development status
 */
export function readSprintStatus(projectPath: string): SprintStatus | null {
  const statusPath = join(projectPath, "sprint-status.yaml");

  if (!existsSync(statusPath)) {
    return null;
  }

  try {
    const content = readFileSync(statusPath, "utf-8");
    const parsed = parse(content) as SprintStatus;

    if (!parsed || !parsed.development_status) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

/**
 * Find and read story file to extract title
 */
export function readStoryMetadata(storyId: string, storyLocation: string): StoryMetadata | null {
  // Try direct file path
  const directPath = join(storyLocation, `${storyId}.md`);
  if (existsSync(directPath)) {
    return extractStoryMetadata(readFileSync(directPath, "utf-8"));
  }

  // Try with story- prefix
  const withPrefix = join(storyLocation, `story-${storyId}.md`);
  if (existsSync(withPrefix)) {
    return extractStoryMetadata(readFileSync(withPrefix, "utf-8"));
  }

  return null;
}

/**
 * Extract title and status from story file content
 */
export function extractStoryMetadata(content: string): StoryMetadata | null {
  const lines = content.split("\n");
  let title = "";
  let status = "";

  for (const line of lines) {
    const titleMatch = line.match(/^#\s+(.+?)\s*$/);
    if (titleMatch && !title) {
      title = titleMatch[1].trim();
      // Remove "Story " prefix if present (case-insensitive)
      if (title.toLowerCase().startsWith("story ")) {
        title = title.substring(6).trim();
      }
      // Remove story ID prefix like "1-1: " or "1-2 "
      title = title.replace(/^\d+-\d+:\s*/, "").replace(/^\d+-\d+\s+/, "");
      continue;
    }

    const statusMatch = line.match(/^Status:\s*(.+)$/);
    if (statusMatch) {
      status = statusMatch[1].trim();
      break; // Found what we need
    }
  }

  return { title, status };
}

/**
 * Gather fleet data from agent registry
 */
export async function gatherFleetData(
  config: ReturnType<typeof loadConfig>,
  dataDir: string,
  projectPath: string,
): Promise<FleetAgent[]> {
  const { getAgentRegistry } = await import("@composio/ao-core");
  const registry = getAgentRegistry(dataDir, config);

  // Reload registry to get latest state
  await registry.reload();

  // Load sprint status for story status lookup
  const sprintStatus = readSprintStatus(projectPath);

  const assignments = registry.list();
  const agents: FleetAgent[] = [];

  for (const assignment of assignments) {
    const idleTime = calculateIdleTime(assignment);
    const agentStatus = mapAgentStatus(assignment, idleTime);

    // Get story status from sprint-status.yaml
    let storyStatus: "backlog" | "ready-for-dev" | "in-progress" | "review" | "done" = "backlog";
    let storyTitle: string | null = null;

    if (assignment.storyId && sprintStatus) {
      const devStatus = sprintStatus.development_status[assignment.storyId];
      if (devStatus) {
        storyStatus = devStatus as typeof storyStatus;
      }

      // Load story title from story file
      const storyLocation = sprintStatus.story_location || "implementation-artifacts";
      const storyMetadata = readStoryMetadata(assignment.storyId, join(projectPath, storyLocation));
      if (storyMetadata?.title) {
        storyTitle = storyMetadata.title;
      }
    }

    agents.push({
      agentId: assignment.agentId,
      storyId: assignment.storyId,
      storyTitle,
      agentStatus,
      storyStatus,
      lastActivity: assignment.assignedAt,
      idleTime,
      notes: getAgentNotes(assignment),
      retryCount: registry.getRetryCount(assignment.storyId),
    });
  }

  return agents;
}

/**
 * Calculate idle time in minutes
 */
function calculateIdleTime(assignment: AgentAssignment): number | null {
  if (!assignment.assignedAt) {
    return null;
  }

  const now = Date.now();
  const lastActivity = assignment.assignedAt.getTime();
  return Math.floor((now - lastActivity) / 60000); // minutes
}

/**
 * Map assignment status to fleet agent status
 */
function mapAgentStatus(
  assignment: AgentAssignment,
  idleTime: number | null,
): "active" | "idle" | "blocked" | "disconnected" {
  if (assignment.status === "disconnected") {
    return "disconnected";
  }

  if (assignment.status === "blocked") {
    return "blocked";
  }

  if (idleTime !== null && idleTime > 10) {
    return "idle";
  }

  return "active";
}

/**
 * Get agent notes (failure reason, retry count, etc.)
 */
function getAgentNotes(assignment: AgentAssignment): string {
  if (assignment.status === "blocked") {
    return "Blocked";
  }

  return "—";
}

// IDLE_THRESHOLD_MINUTES defines when an agent is considered idle
const IDLE_THRESHOLD_MINUTES = 10;

/**
 * Register the fleet command
 */
export function registerFleet(program: Command): void {
  program
    .command("fleet")
    .description("View fleet status (htop-style agent monitoring)")
    .option("--watch <bool>", "Continuous refresh (default: true)", "true")
    .option("--sort-by <field>", "Sort by field (agent, story, status, activity)", "agent")
    .option("--status <filter>", "Filter by status (active, idle, blocked, offline)")
    .option("--reverse", "Reverse sort order")
    .option("--format <format>", "Output format (table, json)", "table")
    .action(async (opts) => {
      let config: ReturnType<typeof loadConfig>;
      try {
        config = loadConfig();
      } catch {
        console.error(chalk.red("No config found. Run `ao init` first."));
        process.exit(1);
      }

      // Parse options
      const watch = opts.watch !== "false";
      const sortBy = opts.sortBy || "agent";
      const statusFilter = opts.status;
      const reverse = opts.reverse || false;
      const format = opts.format || "table";

      // Get project ID from current directory
      const cwd = process.cwd();
      const projectId = Object.keys(config.projects).find((id) =>
        cwd.startsWith(config.projects[id].path),
      );

      if (!projectId) {
        console.error(chalk.red("Not in a project directory."));
        process.exit(1);
      }

      const project = config.projects[projectId];
      const projectPath = project.path;

      // Get sessions directory using getSessionsDir from core
      const { getSessionsDir } = await import("@composio/ao-core");
      const sessionsDir = getSessionsDir(config.configPath, projectId);

      // Gather fleet data
      const agents = await gatherFleetData(config, sessionsDir, projectPath);

      // Filter by status
      let filteredAgents = agents;
      if (statusFilter) {
        filteredAgents = agents.filter((a) => a.agentStatus === statusFilter);
      }

      // Sort agents
      filteredAgents = sortAgents(filteredAgents, sortBy, reverse);

      // Output
      if (format === "json") {
        outputFleetJSON(filteredAgents);
      } else {
        outputFleetTable(filteredAgents, watch);
      }
    });
}

/**
 * Sort agents by specified field
 */
function sortAgents(agents: FleetAgent[], sortBy: string, reverse: boolean): FleetAgent[] {
  const multiplier = reverse ? -1 : 1;

  return [...agents].sort((a, b) => {
    let comparison: number;

    switch (sortBy) {
      case "agent":
        comparison = a.agentId.localeCompare(b.agentId);
        break;
      case "story":
        comparison = (a.storyId || "").localeCompare(b.storyId || "");
        break;
      case "status":
        comparison = a.agentStatus.localeCompare(b.agentStatus);
        break;
      case "activity": {
        const aTime = a.lastActivity?.getTime() || 0;
        const bTime = b.lastActivity?.getTime() || 0;
        comparison = aTime - bTime;
        break;
      }
      default:
        comparison = a.agentId.localeCompare(b.agentId);
    }

    return comparison * multiplier;
  });
}

/**
 * Output fleet data as JSON
 */
function outputFleetJSON(agents: FleetAgent[]): void {
  const output = {
    timestamp: new Date().toISOString(),
    agents: agents.map((a) => ({
      agentId: a.agentId,
      storyId: a.storyId,
      storyTitle: a.storyTitle,
      agentStatus: a.agentStatus,
      storyStatus: a.storyStatus,
      lastActivity: a.lastActivity?.toISOString() || null,
      idleMinutes: a.idleTime,
      notes: a.notes,
      retryCount: a.retryCount,
    })),
    summary: {
      total: agents.length,
      active: agents.filter((a) => a.agentStatus === "active").length,
      idle: agents.filter((a) => a.agentStatus === "idle").length,
      blocked: agents.filter((a) => a.agentStatus === "blocked").length,
      disconnected: agents.filter((a) => a.agentStatus === "disconnected").length,
    },
  };

  console.log(JSON.stringify(output, null, 2));
}

/**
 * Output fleet data as table
 */
function outputFleetTable(agents: FleetAgent[], _watch: boolean): void {
  // Header
  console.log(
    chalk.bold(
      "╔═══════════════════╤════════════════════════╤════════════╤══════════════════╤═════════════════╤══════════════════╗",
    ),
  );
  console.log(
    chalk.bold(
      "║ Agent            │ Story                  │ Status    │ Last Activity    │ Story Status  │ Notes           ║",
    ),
  );
  console.log(
    chalk.bold(
      "╠═══════════════════╪════════════════════════╪════════════╪══════════════════╪═════════════════╪══════════════════╣",
    ),
  );

  // Rows
  for (const agent of agents) {
    const statusEmoji = getAgentStatusEmoji(agent.agentStatus);
    const agentId = truncate(agent.agentId, 17);
    const story = agent.storyId
      ? truncate(`${agent.storyId}${agent.storyTitle ? ` ${agent.storyTitle}` : ""}`, 24)
      : "—";
    const status = formatStatus(agent.agentStatus, statusEmoji);
    const activity = formatActivity(agent);
    const storyStatus = agent.storyStatus;
    const notes = truncate(agent.notes, 15);

    console.log(
      `║ ${agentId} │ ${story} │ ${status} │ ${activity} │ ${storyStatus.padEnd(14)} │ ${notes.padEnd(15)} ║`,
    );
  }

  // Footer
  console.log(
    chalk.bold(
      "╚═══════════════════╧════════════════════════╧════════════╧══════════════════╧═════════════════╧══════════════════╝",
    ),
  );

  // Summary line
  const summary = calculateSummary(agents);
  const now = new Date().toLocaleTimeString();

  console.log("");
  console.log(
    chalk.gray(`Last updated: ${now} | `) +
      chalk.gray(`Total: ${summary.total} | `) +
      chalk.green(`Active: ${summary.active} | `) +
      chalk.yellow(`Idle: ${summary.idle} | `) +
      chalk.red(`Blocked: ${summary.blocked} | `) +
      chalk.gray(`Offline: ${summary.disconnected}`),
  );

  // Note: Watch mode is deferred to future story (keyboard interaction)
  // Press Ctrl+C to exit
}

/**
 * Format status with emoji
 */
function formatStatus(status: string, emoji: string): string {
  switch (status) {
    case "active":
      return chalk.green(`${emoji} ${status}`);
    case "idle":
      return chalk.yellow(`${emoji} ${status}`);
    case "blocked":
      return chalk.red(`${emoji} ${status}`);
    case "disconnected":
      return chalk.gray(`${emoji} ${status}`);
    default:
      // Unknown status - return as-is with emoji
      return chalk.gray(`${emoji} ${status}`);
  }
}

/**
 * Format activity timestamp
 */
function formatActivity(agent: FleetAgent): string {
  if (!agent.lastActivity) {
    return "—".padEnd(18);
  }

  const timeAgo = formatTimeAgo(agent.lastActivity);

  if (agent.agentStatus === "active" && agent.idleTime !== null && agent.idleTime < 2) {
    return chalk.green("working now".padEnd(18));
  }

  if (agent.idleTime !== null && agent.idleTime > IDLE_THRESHOLD_MINUTES) {
    return chalk.yellow(timeAgo.padEnd(18));
  }

  return timeAgo.padEnd(18);
}

/**
 * Calculate summary statistics
 */
function calculateSummary(agents: FleetAgent[]): {
  total: number;
  active: number;
  idle: number;
  blocked: number;
  disconnected: number;
} {
  return {
    total: agents.length,
    active: agents.filter((a) => a.agentStatus === "active").length,
    idle: agents.filter((a) => a.agentStatus === "idle").length,
    blocked: agents.filter((a) => a.agentStatus === "blocked").length,
    disconnected: agents.filter((a) => a.agentStatus === "disconnected").length,
  };
}
