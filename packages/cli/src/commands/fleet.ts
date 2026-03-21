/**
 * Fleet Command — htop-style table showing all agents and their stories
 */

import chalk from "chalk";
import type { Command } from "commander";
import {
  getAgentStatusEmoji,
  formatTimeAgo,
  formatDuration,
  truncate,
  padCol,
} from "../lib/format.js";
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

/** Idle threshold in minutes — agent is considered idle after this period of inactivity */
const IDLE_THRESHOLD_MINUTES = 10;

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

  if (idleTime !== null && idleTime > IDLE_THRESHOLD_MINUTES) {
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

/**
 * Register the fleet command
 */
export function registerFleet(program: Command): void {
  program
    .command("fleet")
    .description("View fleet status (htop-style agent monitoring)")
    .option("--watch", "Continuous refresh every 5s", false)
    .option("--sort-by <field>", "Sort by field (agent, story, status, activity)", "status")
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
      const watch = opts.watch === true;
      const sortBy = opts.sortBy;
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

      // Empty fleet check
      if (filteredAgents.length === 0) {
        if (format === "json") {
          outputFleetJSON(filteredAgents);
        } else {
          console.log(chalk.yellow("\nNo active agents. Use `ao spawn` to start one.\n"));
        }
        return;
      }

      // Output
      if (format === "json") {
        outputFleetJSON(filteredAgents);
        return;
      }

      outputFleetTable(filteredAgents, watch);

      // Watch mode: refresh every 5 seconds
      if (watch) {
        const intervalId = setInterval(async () => {
          const freshAgents = await gatherFleetData(config, sessionsDir, projectPath);
          let filtered = freshAgents;
          if (statusFilter) {
            filtered = freshAgents.filter((a) => a.agentStatus === statusFilter);
          }
          filtered = sortAgents(filtered, sortBy, reverse);

          console.clear();
          if (filtered.length === 0) {
            console.log(chalk.yellow("\nNo active agents. Use `ao spawn` to start one.\n"));
            console.log(chalk.dim("Watching fleet... (Ctrl+C to stop)"));
          } else {
            outputFleetTable(filtered, true);
          }
        }, 5000);

        // Clean exit on SIGINT/SIGTERM
        const cleanup = () => {
          clearInterval(intervalId);
          console.log(chalk.dim("\nFleet monitoring stopped."));
          process.exit(0);
        };
        process.once("SIGINT", cleanup);
        process.once("SIGTERM", cleanup);

        // Keep process alive
        await new Promise<never>(() => {});
      }
    });
}

/** Status priority: blocked first, then idle, active, disconnected */
const STATUS_PRIORITY: Record<string, number> = {
  blocked: 0,
  idle: 1,
  active: 2,
  disconnected: 3,
};

/**
 * Sort agents by specified field.
 * Default "status" sort: blocked first, then by duration descending (longest-running first).
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
      case "status": {
        // Primary: status priority (blocked first)
        const aPri = STATUS_PRIORITY[a.agentStatus] ?? 99;
        const bPri = STATUS_PRIORITY[b.agentStatus] ?? 99;
        comparison = aPri - bPri;
        // Secondary: duration descending (longest-running first)
        if (comparison === 0) {
          const aTime = a.lastActivity?.getTime() || 0;
          const bTime = b.lastActivity?.getTime() || 0;
          comparison = aTime - bTime; // earlier assignedAt = longer running = first
        }
        break;
      }
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
 * Output fleet data as table with responsive column widths
 */
function outputFleetTable(agents: FleetAgent[], watch: boolean): void {
  const termWidth = process.stdout.columns || 120;

  // Column widths: Agent(18) + Status(12) + Duration(10) + Activity(16) = 56 fixed
  // Story gets remaining space (min 20)
  const fixedCols = 18 + 12 + 10 + 16 + 7; // 7 for borders/padding
  const storyWidth = Math.max(20, termWidth - fixedCols);
  console.log(
    chalk.bold(
      `╔${"═".repeat(18)}╤${"═".repeat(storyWidth)}╤${"═".repeat(12)}╤${"═".repeat(10)}╤${"═".repeat(16)}╗`,
    ),
  );
  console.log(
    chalk.bold(
      `║${padCol(" Agent", 18)}│${padCol(" Story", storyWidth)}│${padCol(" Status", 12)}│${padCol(" Duration", 10)}│${padCol(" Last Activity", 16)}║`,
    ),
  );
  console.log(
    chalk.bold(
      `╠${"═".repeat(18)}╪${"═".repeat(storyWidth)}╪${"═".repeat(12)}╪${"═".repeat(10)}╪${"═".repeat(16)}╣`,
    ),
  );

  // Rows
  for (const agent of agents) {
    const statusEmoji = getAgentStatusEmoji(agent.agentStatus);
    const agentId = padCol(` ${truncate(agent.agentId, 16)}`, 18);
    const story = agent.storyId
      ? padCol(
          ` ${truncate(`${agent.storyId}${agent.storyTitle ? ` ${agent.storyTitle}` : ""}`, storyWidth - 2)}`,
          storyWidth,
        )
      : padCol(" —", storyWidth);
    const status = padCol(` ${formatStatus(agent.agentStatus, statusEmoji)}`, 12);
    const duration = agent.lastActivity
      ? padCol(` ${formatDuration(agent.lastActivity)}`, 10)
      : padCol(" —", 10);
    const activity = padCol(` ${formatActivity(agent)}`, 16);

    console.log(`║${agentId}│${story}│${status}│${duration}│${activity}║`);
  }

  // Footer
  console.log(
    chalk.bold(
      `╚${"═".repeat(18)}╧${"═".repeat(storyWidth)}╧${"═".repeat(12)}╧${"═".repeat(10)}╧${"═".repeat(16)}╝`,
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

  if (watch) {
    console.log(chalk.dim("\nWatching fleet... (Ctrl+C to stop)"));
  }
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
    return "—".padEnd(14);
  }

  const timeAgo = formatTimeAgo(agent.lastActivity);

  if (agent.agentStatus === "active" && agent.idleTime !== null && agent.idleTime < 2) {
    return chalk.green("working now".padEnd(14));
  }

  if (agent.idleTime !== null && agent.idleTime > IDLE_THRESHOLD_MINUTES) {
    return chalk.yellow(timeAgo.padEnd(14));
  }

  return timeAgo.padEnd(14);
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
