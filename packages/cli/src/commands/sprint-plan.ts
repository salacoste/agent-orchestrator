import chalk from "chalk";
import type { Command } from "commander";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { parse } from "yaml";
import { header } from "../lib/format.js";

interface SprintStatus {
  project: string;
  development_status: Record<string, string>;
  dependencies?: Record<string, string[]>; // story -> array of prerequisite story keys
  priorities?: Record<string, number>; // story -> priority number (higher = more important)
}

interface StoryGroup {
  backlog: string[];
  "ready-for-dev": string[];
  "in-progress": string[];
  review: string[];
  done: string[];
}

interface DependencyNode {
  id: string;
  status: string;
  dependencies: string[];
  blockers: string[];
}

const STORY_KEY_PATTERN = /^\d+-\d+-[\w-]+$/;
const EPIC_KEY_PATTERN = /^epic-\d+(-retrospective)?$/;

function isStoryKey(key: string): boolean {
  return STORY_KEY_PATTERN.test(key) && !EPIC_KEY_PATTERN.test(key);
}

function groupStoriesByStatus(developmentStatus: Record<string, string>): StoryGroup {
  const groups: StoryGroup = {
    backlog: [],
    "ready-for-dev": [],
    "in-progress": [],
    review: [],
    done: [],
  };

  for (const [key, status] of Object.entries(developmentStatus)) {
    if (!isStoryKey(key)) {
      continue;
    }
    if (status === "backlog") {
      groups.backlog.push(key);
    } else if (status === "ready-for-dev") {
      groups["ready-for-dev"].push(key);
    } else if (status === "in-progress") {
      groups["in-progress"].push(key);
    } else if (status === "review") {
      groups.review.push(key);
    } else if (status === "done") {
      groups.done.push(key);
    }
  }

  return groups;
}

function sortStoriesByPriority(
  stories: string[],
  priorities: Record<string, number> | undefined,
): string[] {
  if (!priorities) {
    return stories;
  }
  return [...stories].sort((a, b) => {
    const priorityA = priorities[a] ?? 0;
    const priorityB = priorities[b] ?? 0;
    return priorityB - priorityA; // Higher priority first
  });
}

function buildDependencyGraph(
  developmentStatus: Record<string, string>,
  dependencies: Record<string, string[]> | undefined,
): Map<string, DependencyNode> {
  const graph = new Map<string, DependencyNode>();

  for (const [key, status] of Object.entries(developmentStatus)) {
    if (!isStoryKey(key)) {
      continue;
    }

    const deps = dependencies?.[key] ?? [];
    graph.set(key, {
      id: key,
      status,
      dependencies: deps,
      blockers: [],
    });
  }

  // Calculate blockers (inverse of dependencies)
  for (const [key, node] of graph) {
    for (const dep of node.dependencies) {
      const depNode = graph.get(dep);
      if (depNode) {
        depNode.blockers.push(key);
      }
    }
  }

  return graph;
}

function detectCircularDependencies(graph: Map<string, DependencyNode>): string[][] {
  const cycles: string[][] = [];
  const visited = new Set<string>();
  const recStack = new Set<string>();

  function dfs(node: DependencyNode, path: string[]): void {
    visited.add(node.id);
    recStack.add(node.id);
    path.push(node.id);

    for (const depId of node.dependencies) {
      const depNode = graph.get(depId);
      if (!depNode) continue;

      if (recStack.has(depId)) {
        // Found a cycle
        const cycleStart = path.indexOf(depId);
        cycles.push([...path.slice(cycleStart), depId]);
      } else if (!visited.has(depId)) {
        dfs(depNode, path);
      }
    }

    path.pop();
    recStack.delete(node.id);
  }

  for (const node of graph.values()) {
    if (!visited.has(node.id)) {
      dfs(node, []);
    }
  }

  return cycles;
}

function displayDependencyGraph(graph: Map<string, DependencyNode>): void {
  const blockedStories: DependencyNode[] = [];

  for (const node of graph.values()) {
    const hasIncompleteDeps = node.dependencies.some((depId) => {
      const depNode = graph.get(depId);
      return depNode && depNode.status !== "done";
    });

    if (hasIncompleteDeps) {
      blockedStories.push(node);
    }
  }

  if (blockedStories.length === 0) {
    console.log(chalk.dim("  No blocked stories - all dependencies satisfied"));
    console.log();
    return;
  }

  console.log(chalk.yellow(`Blocked Stories (${blockedStories.length}):`));

  for (const node of blockedStories) {
    const incompleteDeps = node.dependencies.filter((depId) => {
      const depNode = graph.get(depId);
      return depNode && depNode.status !== "done";
    });

    const blockers = incompleteDeps.join(", ");
    console.log(`  ${chalk.dim("•")} ${node.id} ${chalk.red(`(blocked by: ${blockers})`)}`);
  }

  console.log();
}

function displayCircularDependencies(cycles: string[][]): void {
  if (cycles.length === 0) {
    return;
  }

  console.log(chalk.red.bold(`⚠️  Circular Dependencies Detected (${cycles.length}):`));

  for (const cycle of cycles) {
    const cycleStr = cycle.join(chalk.red(" ↔ "));
    console.log(`  ${cycleStr}`);
  }

  console.log();
}

function displaySprintPlan(sprintStatus: SprintStatus): void {
  console.log(header(`Sprint Execution Plan: ${sprintStatus.project}`));
  console.log();

  const groups = groupStoriesByStatus(sprintStatus.development_status);

  const totalCount = Object.values(groups).reduce((sum, stories) => sum + stories.length, 0);
  console.log(`  Total Stories: ${chalk.cyan(String(totalCount))}`);
  console.log();

  // Display circular dependency warnings first
  if (sprintStatus.dependencies) {
    const graph = buildDependencyGraph(sprintStatus.development_status, sprintStatus.dependencies);
    const cycles = detectCircularDependencies(graph);
    displayCircularDependencies(cycles);

    // Display dependency graph
    console.log(chalk.bold("Dependency Graph:"));
    console.log();
    displayDependencyGraph(graph);
  }

  // Display stories by status
  const statusColors: Record<string, (s: string) => string> = {
    backlog: chalk.gray,
    "ready-for-dev": chalk.green,
    "in-progress": chalk.yellow,
    review: chalk.blue,
    done: chalk.dim,
  };

  const statusLabels: Record<string, string> = {
    backlog: "Backlog",
    "ready-for-dev": "Ready for Dev",
    "in-progress": "In Progress",
    review: "In Review",
    done: "Done",
  };

  for (const [status, stories] of Object.entries(groups)) {
    const color = statusColors[status] ?? ((s: string) => s);
    const label = statusLabels[status] ?? status;
    const count = stories.length;

    if (count > 0) {
      // Sort by priority if available
      const sortedStories = sortStoriesByPriority(stories, sprintStatus.priorities);

      console.log(`  ${color(label)} (${count}):`);
      for (const story of sortedStories) {
        const priority = sprintStatus.priorities?.[story];
        const priorityStr = priority !== undefined ? chalk.dim(` [priority: ${priority}]`) : "";
        console.log(`    ${chalk.dim("•")} ${story}${priorityStr}`);
      }
      console.log();
    }
  }
}

export function registerSprintPlan(program: Command): void {
  program
    .command("sprint-plan")
    .description("Generate sprint execution plan from sprint-status.yaml")
    .action(async () => {
      const startTime = Date.now();

      const sprintStatusFile = join(process.cwd(), "sprint-status.yaml");

      if (!existsSync(sprintStatusFile)) {
        console.error(chalk.red("No sprint-status.yaml found in current directory"));
        process.exit(1);
      }

      let content: string;
      try {
        content = readFileSync(sprintStatusFile, "utf-8");
      } catch (err) {
        console.error(
          chalk.red(
            `Failed to read sprint-status.yaml: ${err instanceof Error ? err.message : String(err)}`,
          ),
        );
        process.exit(1);
      }

      let parsed: unknown;
      try {
        parsed = parse(content);
      } catch (err) {
        console.error(
          chalk.red(
            `Failed to parse sprint-status.yaml: ${err instanceof Error ? err.message : String(err)}`,
          ),
        );
        process.exit(1);
      }

      // Validate required fields with runtime type checking
      if (!parsed || typeof parsed !== "object") {
        console.error(chalk.red("Invalid sprint-status.yaml: not a valid YAML object"));
        process.exit(1);
      }

      const sprintStatus = parsed as SprintStatus;

      if (!sprintStatus.development_status) {
        console.error(chalk.red("Invalid sprint-status.yaml: missing development_status section"));
        process.exit(1);
      }

      displaySprintPlan(sprintStatus);

      // Performance check (warn if > 500ms but don't fail)
      const elapsed = Date.now() - startTime;
      if (elapsed > 500) {
        console.warn(chalk.yellow(`⚠️  Warning: Command took ${elapsed}ms (target: <500ms)`));
      }
    });
}
