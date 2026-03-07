import chalk from "chalk";
import type { Command } from "commander";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { parse } from "yaml";
import {
  loadConfig,
  getAgentRegistry,
  getSessionsDir,
  type AgentAssignment,
} from "@composio/ao-core";
import {
  header,
  formatTimeAgo,
  formatDuration,
  truncate,
  getAgentStatusEmoji,
  getStoryStatusEmoji,
  getAgentStatusColor,
  getStoryStatusColor,
} from "../lib/format.js";

interface SprintStatus {
  project: string;
  project_key: string;
  tracking_system: string;
  story_location: string;
  development_status: Record<string, string>;
  dependencies?: Record<string, string[]>;
  priorities?: Record<string, number>;
}

interface StoryDisplayInfo {
  id: string;
  title: string;
  status: string;
  agentId: string | null;
  agentStatus: string | null;
  lastActivity: string;
  dependencies?: string[];
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
 * Extract story title from story file
 */
function getStoryTitle(storyId: string, storyLocation: string): string {
  // Try direct match first
  const directPath = join(storyLocation, `${storyId}.md`);
  if (existsSync(directPath)) {
    const content = readFileSync(directPath, "utf-8");
    const match = content.match(/^# (.+)$/m);
    if (match) {
      return match[1].replace(/^Story\s+/, "").trim();
    }
  }

  // Try with story- prefix
  const withPrefix = join(storyLocation, `story-${storyId}.md`);
  if (existsSync(withPrefix)) {
    const content = readFileSync(withPrefix, "utf-8");
    const match = content.match(/^# (.+)$/m);
    if (match) {
      return match[1].replace(/^Story\s+/, "").trim();
    }
  }

  // Fallback to story ID
  return storyId
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

/**
 * Display status table for all stories
 */
function displayStatusTable(stories: StoryDisplayInfo[], opts: { format: string }): void {
  if (opts.format === "json") {
    const jsonOutput = {
      stories: stories.map((s) => ({
        storyId: s.id,
        title: s.title,
        agentId: s.agentId,
        agentStatus: s.agentStatus,
        storyStatus: s.status,
        lastActivity: s.lastActivity,
        dependencies: s.dependencies ?? null,
      })),
      summary: {
        total: stories.length,
        done: stories.filter((s) => s.status === "done").length,
        inProgress: stories.filter((s) => s.status === "in-progress").length,
        readyForDev: stories.filter((s) => s.status === "ready-for-dev").length,
        backlog: stories.filter((s) => s.status === "backlog").length,
        activeAgents: stories.filter((s) => s.agentStatus === "active").length,
        idleAgents: stories.filter((s) => s.agentStatus === "idle").length,
        blockedAgents: stories.filter((s) => s.agentStatus === "blocked").length,
      },
    };
    console.log(JSON.stringify(jsonOutput, null, 2));
    return;
  }

  // Table format
  console.log(header("STORY STATUS"));
  console.log();

  // Print table header
  const idCol = 12;
  const titleCol = 40;
  const agentCol = 15;
  const statusCol = 15;
  const activityCol = 18;

  const headerRow =
    padCol("Story ID", idCol) +
    padCol("Title", titleCol) +
    padCol("Agent", agentCol) +
    padCol("Agent Status", statusCol) +
    padCol("Last Activity", activityCol) +
    "Story Status";

  console.log(chalk.dim(`  ${headerRow}`));
  const totalWidth = idCol + titleCol + agentCol + statusCol + activityCol;
  console.log(chalk.dim(`  ${"─".repeat(totalWidth)}`));

  // Print stories
  for (const story of stories) {
    const agentEmoji = story.agentStatus ? getAgentStatusEmoji(story.agentStatus) : "—";
    const storyEmoji = getStoryStatusEmoji(story.status);
    const agentDisplay = story.agentId || "—";
    const agentStatusDisplay = story.agentStatus ? `${agentEmoji} ${story.agentStatus}` : "—";

    const row =
      padCol(chalk.green(story.id), idCol) +
      padCol(truncate(story.title, titleCol - 2), titleCol) +
      padCol(agentDisplay, agentCol) +
      padCol(agentStatusDisplay, statusCol) +
      padCol(story.lastActivity, activityCol) +
      `${storyEmoji} ${getStoryStatusColor(story.status)}`;

    console.log(`  ${row}`);
  }

  console.log();

  // Print summary
  const total = stories.length;
  const done = stories.filter((s) => s.status === "done").length;
  const inProgress = stories.filter((s) => s.status === "in-progress").length;
  const readyForDev = stories.filter((s) => s.status === "ready-for-dev").length;
  const backlog = stories.filter((s) => s.status === "backlog").length;
  const activeAgents = stories.filter((s) => s.agentStatus === "active").length;

  console.log(
    chalk.dim(
      `  Summary: ${total} stories | ${done} done | ${inProgress} in-progress | ${readyForDev} ready-for-dev | ${backlog} backlog`,
    ),
  );
  console.log(chalk.dim(`  Agents: ${activeAgents} active`));
  console.log();
}

/**
 * Display detailed story information
 */
function displayStoryDetail(
  storyId: string,
  story: StoryDisplayInfo,
  sprintStatus: SprintStatus,
  assignment: AgentAssignment | null,
  storyLocation: string,
  opts: { format: string },
): void {
  if (opts.format === "json") {
    const jsonOutput = {
      storyId: story.id,
      title: story.title,
      status: story.status,
      agentId: story.agentId,
      agentStatus: story.agentStatus,
      assignedAt: assignment?.assignedAt.toISOString() ?? null,
      contextHash: assignment?.contextHash ?? null,
      lastActivity: story.lastActivity,
      dependencies: story.dependencies ?? null,
    };
    console.log(JSON.stringify(jsonOutput, null, 2));
    return;
  }

  console.log(header(`Story: ${story.title}`));
  console.log();
  console.log(`  Story ID: ${chalk.green(story.id)}`);
  console.log(
    `  Status: ${getStoryStatusEmoji(story.status)} ${getStoryStatusColor(story.status)}`,
  );
  console.log();

  // Agent assignment
  console.log(`  ${chalk.bold("Agent Assignment:")}`);
  if (assignment) {
    console.log(`    Agent: ${chalk.green(assignment.agentId)}`);
    console.log(
      `    Status: ${getAgentStatusEmoji(assignment.status)} ${getAgentStatusColor(assignment.status)}`,
    );
    console.log(`    Assigned: ${assignment.assignedAt.toISOString()}`);
    console.log(`    Working for: ${formatDuration(assignment.assignedAt)}`);
  } else {
    console.log(`    Agent: ${chalk.dim("— (Unassigned)")}`);
    console.log(`    Status: ${chalk.dim("—")}`);
    console.log(`    ${chalk.yellow("This story is ready to be picked up.")}`);
  }
  console.log();

  // Dependencies
  if (story.dependencies && story.dependencies.length > 0) {
    console.log(`  ${chalk.bold("Dependencies:")}`);
    console.log(`    Prerequisites: ${story.dependencies.join(", ")}`);

    // Find dependents
    const dependents: string[] = [];
    for (const [id, deps] of Object.entries(sprintStatus.dependencies ?? {})) {
      if (deps.includes(storyId) && id.startsWith(storyId.split("-")[0])) {
        dependents.push(id);
      }
    }
    if (dependents.length > 0) {
      console.log(`    Dependents: ${dependents.join(", ")}`);
    }
    console.log();
  }

  // Story context hash if assigned
  if (assignment?.contextHash) {
    console.log(`  ${chalk.bold("Story Context:")}`);
    console.log(`    Hash: ${chalk.dim(assignment.contextHash.slice(0, 16))}...`);
    console.log(`    Status: ${getStoryStatusColor(story.status)}`);
    console.log();
  }
}

/**
 * Display agent-specific status
 */
function displayAgentStatus(
  agentId: string,
  assignment: AgentAssignment | null,
  storyTitle: string | null,
  sprintStatus: SprintStatus | null,
  opts: { format: string },
): void {
  if (opts.format === "json") {
    const jsonOutput = {
      agentId,
      status: assignment?.status ?? null,
      storyId: assignment?.storyId ?? null,
      storyTitle: storyTitle ?? null,
      assignedAt: assignment?.assignedAt.toISOString() ?? null,
      contextHash: assignment?.contextHash ?? null,
    };
    console.log(JSON.stringify(jsonOutput, null, 2));
    return;
  }

  console.log(header(`Agent: ${agentId}`));
  console.log();

  if (!assignment) {
    console.log(`  ${chalk.yellow("Agent not found in registry")}`);
    console.log();
    return;
  }

  console.log(
    `  Status: ${getAgentStatusEmoji(assignment.status)} ${getAgentStatusColor(assignment.status)}`,
  );
  console.log(`  Session: ${chalk.dim("tmux session")}`);
  console.log();

  console.log(`  ${chalk.bold("Assignment:")}`);
  if (assignment.storyId && sprintStatus) {
    const storyStatus = sprintStatus.development_status[assignment.storyId] ?? "unknown";
    const title = storyTitle ?? assignment.storyId;
    console.log(`    Story: ${chalk.cyan(title)}`);
    console.log(`    Assigned: ${assignment.assignedAt.toISOString()}`);
    console.log(`    Working for: ${formatDuration(assignment.assignedAt)}`);
    console.log();

    console.log(`  ${chalk.bold("Story Context:")}`);
    console.log(`    Hash: ${chalk.dim(assignment.contextHash.slice(0, 16))}...`);
    console.log(`    Status: ${getStoryStatusColor(storyStatus)}`);
  } else {
    console.log(`    Story: ${chalk.dim("None")}`);
  }
  console.log();
}

/**
 * Pad column for table formatting
 */
function padCol(str: string, width: number): string {
  // Strip ANSI codes to measure visible length
  /* eslint-disable-next-line no-control-regex -- ANSI escape sequence needed for terminal formatting */
  const ansiRe = /\u001b\[[0-9;]*m/g;
  const visible = str.replace(ansiRe, "");
  if (visible.length > width) {
    const plain = visible.slice(0, width - 1) + "\u2026";
    return plain.padEnd(width);
  }
  const padding = width - visible.length;
  return str + " ".repeat(Math.max(0, padding));
}

/**
 * Filter and sort stories based on options
 */
function filterAndSortStories(
  stories: StoryDisplayInfo[],
  opts: {
    status?: string;
    agentStatus?: string;
    sortBy?: string;
  },
): StoryDisplayInfo[] {
  let filtered = [...stories];

  // Filter by story status
  if (opts.status) {
    filtered = filtered.filter((s) => s.status === opts.status);
  }

  // Filter by agent status
  if (opts.agentStatus) {
    filtered = filtered.filter((s) => s.agentStatus === opts.agentStatus);
  }

  // Sort
  switch (opts.sortBy) {
    case "status":
      filtered.sort((a, b) => a.status.localeCompare(b.status));
      break;
    case "agent":
      filtered.sort((a, b) => (a.agentId ?? "").localeCompare(b.agentId ?? ""));
      break;
    case "activity":
      filtered.sort((a, b) => a.lastActivity.localeCompare(b.lastActivity));
      break;
    case "id":
    default:
      filtered.sort((a, b) => a.id.localeCompare(b.id));
      break;
  }

  return filtered;
}

export function registerStoryStatus(program: Command): void {
  program
    .command("status [storyId]")
    .description("View story and agent status")
    .option("--agent <id>", "Show status for specific agent")
    .option("--format <format>", "Output format (table, json)", "table")
    .option("--status <status>", "Filter by story status")
    .option("--agent-status <status>", "Filter by agent status")
    .option("--sort-by <field>", "Sort by field (id, status, agent, activity)", "id")
    .action(async (storyId: string | undefined, opts) => {
      const startTime = Date.now();

      // Load config
      const config = loadConfig();
      if (!config) {
        console.error(chalk.red("No agent-orchestrator.yaml found. Run 'ao init' first."));
        process.exit(1);
      }

      // Read sprint-status.yaml
      const cwd = process.cwd();
      const sprintStatus = readSprintStatus(cwd);

      if (!sprintStatus) {
        console.error(
          chalk.red(
            "No sprint-status.yaml found in current directory.\n" +
              "Run 'ao plan' to generate sprint status.",
          ),
        );
        process.exit(1);
      }


      // Find the current project by checking which project path contains cwd
      let projectPath: string | null = null;
      for (const [id, project] of Object.entries(config.projects)) {
        if (cwd.startsWith(project.path) || cwd === project.path) {
          projectPath = project.path;
          break;
        }
      }

      if (!projectPath) {
        // Use the first project as fallback
        const firstProject = Object.values(config.projects)[0];
        projectPath = firstProject?.path ?? cwd;
      }

      // Get agent registry
      const sessionsDir = getSessionsDir(config.configPath, projectPath);
      const registry = getAgentRegistry(sessionsDir, config);

      // Agent-specific status query
      if (opts.agent) {
        const assignment = registry.getByAgent(opts.agent);
        let storyTitle: string | null = null;

        if (assignment?.storyId) {
          const storyLocation = join(cwd, sprintStatus.story_location);
          storyTitle = getStoryTitle(assignment.storyId, storyLocation);
        }

        displayAgentStatus(opts.agent, assignment, storyTitle, sprintStatus, opts);
        const elapsed = Date.now() - startTime;
        if (elapsed > 1000) {
          console.warn(chalk.yellow(`Warning: Status query took ${elapsed}ms (>1000ms target)`));
        }
        return;
      }

      // Story detail view
      if (storyId) {
        // Normalize story ID
        let normalizedStoryId = storyId;
        if (storyId.startsWith("story-")) {
          normalizedStoryId = storyId.slice(6);
        }

        // Check if story exists
        const storyStatus = sprintStatus.development_status[normalizedStoryId];
        if (!storyStatus) {
          console.error(
            chalk.red(`Story "${normalizedStoryId}" not found in sprint-status.yaml\n`),
          );

          // Show available stories
          const availableStories = Object.keys(sprintStatus.development_status)
            .filter((k) => k.match(/^\d+-\d+-/) && !k.startsWith("epic-"))
            .slice(0, 10);
          console.error(chalk.dim("Available stories:"));
          for (const id of availableStories) {
            console.error(chalk.dim(`  ${id}`));
          }
          console.error(chalk.dim("\nRun 'ao status' to see all stories."));
          process.exit(1);
        }

        // Get agent assignment
        const assignment = await registry.getByStory(normalizedStoryId);
        const storyLocation = join(cwd, sprintStatus.story_location);
        const title = getStoryTitle(normalizedStoryId, storyLocation);
        const dependencies = sprintStatus.dependencies?.[normalizedStoryId];

        const storyInfo: StoryDisplayInfo = {
          id: normalizedStoryId,
          title,
          status: storyStatus,
          agentId: assignment?.agentId ?? null,
          agentStatus: assignment?.status ?? null,
          lastActivity: assignment ? formatTimeAgo(assignment.assignedAt) : "—",
          dependencies,
        };

        displayStoryDetail(
          normalizedStoryId,
          storyInfo,
          sprintStatus,
          assignment,
          storyLocation,
          opts,
        );

        const elapsed = Date.now() - startTime;
        if (elapsed > 1000) {
          console.warn(chalk.yellow(`Warning: Status query took ${elapsed}ms (>1000ms target)`));
        }
        return;
      }

      // Table view - gather all stories
      const storyLocation = join(cwd, sprintStatus.story_location);
      const allAssignments = registry.list();
      const assignmentMap = new Map<string, AgentAssignment>(
        allAssignments.map((a) => [a.storyId, a]),
      );

      const stories: StoryDisplayInfo[] = [];

      for (const [id, status] of Object.entries(sprintStatus.development_status)) {
        // Skip epic entries
        if (id.startsWith("epic-") || !id.match(/^\d+-\d+-/)) {
          continue;
        }

        const assignment = assignmentMap.get(id);
        const title = getStoryTitle(id, storyLocation);
        const dependencies = sprintStatus.dependencies?.[id];

        stories.push({
          id,
          title,
          status,
          agentId: assignment?.agentId ?? null,
          agentStatus: assignment?.status ?? null,
          lastActivity: assignment ? formatTimeAgo(assignment.assignedAt) : "—",
          dependencies,
        });
      }

      // Filter and sort
      const filtered = filterAndSortStories(stories, opts);

      // Display
      displayStatusTable(filtered, opts);

      const elapsed = Date.now() - startTime;
      if (elapsed > 1000) {
        console.warn(chalk.yellow(`Warning: Status display took ${elapsed}ms (>1000ms target)`));
      }
    });
}
