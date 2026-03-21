import chalk from "chalk";
import type { Command } from "commander";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { parse as parseYaml } from "yaml";
import {
  loadConfig,
  type StoryStatus,
  type SprintPlanView,
  type SprintSummary,
  type ActionableStory,
} from "@composio/ao-core";
import { computeSprintPlan, acceptPlan } from "@composio/ao-plugin-tracker-bmad";
import { header, getStoryStatusEmoji, getStoryStatusColor, padCol } from "../lib/format.js";
import { resolveProject } from "../lib/resolve-project.js";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const COLUMN_WIDTH = 48;

const VALID_STORY_STATUSES = new Set<string>([
  "backlog",
  "ready-for-dev",
  "in-progress",
  "review",
  "done",
  "blocked",
]);

// ---------------------------------------------------------------------------
// Helpers: story key parsing and epic grouping
// ---------------------------------------------------------------------------

const STORY_KEY_PATTERN = /^(\d+)-(\d+)-[\w-]+$/;
const EPIC_KEY_PATTERN = /^epic-\d+(-retrospective)?$/;

function isStoryKey(key: string): boolean {
  return STORY_KEY_PATTERN.test(key) && !EPIC_KEY_PATTERN.test(key);
}

/** Extract epic number from story ID prefix (e.g., "1-2-foo" → "1") */
function getEpicPrefix(storyId: string): string {
  const match = STORY_KEY_PATTERN.exec(storyId);
  return match ? match[1] : "0";
}

/** Extract story number within epic (e.g., "1-2-foo" → 2) */
function getStoryNumber(storyId: string): number {
  const match = STORY_KEY_PATTERN.exec(storyId);
  return match ? parseInt(match[2], 10) : 0;
}

/** Convert story key to display title (e.g., "1-2-user-auth" → "User Auth") */
function storyKeyToTitle(key: string): string {
  const parts = key.split("-").slice(2); // Remove epic-num and story-num
  if (parts.length === 0) return key;
  return parts.map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join(" ");
}

// ---------------------------------------------------------------------------
// YAML fallback: parse sprint-status.yaml into SprintPlanView
// ---------------------------------------------------------------------------

function parseSprintStatusYaml(filePath: string, projectName: string): SprintPlanView {
  const content = readFileSync(filePath, "utf-8");
  const parsed: unknown = parseYaml(content);

  if (!parsed || typeof parsed !== "object") {
    throw new Error("Invalid sprint-status.yaml: not a valid YAML object");
  }

  const record = parsed as Record<string, unknown>;
  const devStatus = record["development_status"];

  if (!devStatus) {
    throw new Error("Invalid sprint-status.yaml: missing development_status section");
  }

  if (typeof devStatus !== "object" || Array.isArray(devStatus)) {
    throw new Error("Invalid sprint-status.yaml: development_status must be a mapping");
  }

  const statusEntries = devStatus as Record<string, unknown>;

  // Build story list from flat development_status
  const allStories: ActionableStory[] = [];
  for (const [key, rawStatus] of Object.entries(statusEntries)) {
    if (!isStoryKey(key)) continue;

    const statusStr = typeof rawStatus === "string" ? rawStatus : String(rawStatus);

    // Validate status value
    if (!VALID_STORY_STATUSES.has(statusStr)) {
      console.warn(
        chalk.yellow(
          `  Warning: unknown status "${statusStr}" for story ${key}, treating as backlog`,
        ),
      );
    }
    const storyStatus: StoryStatus = VALID_STORY_STATUSES.has(statusStr)
      ? (statusStr as StoryStatus)
      : "backlog";

    allStories.push({
      id: key,
      title: storyKeyToTitle(key),
      status: storyStatus,
      dependencies: [],
      isBlocked: false,
    });
  }

  // Sort by epic prefix, then story number
  allStories.sort((a, b) => {
    const epicA = parseInt(getEpicPrefix(a.id), 10);
    const epicB = parseInt(getEpicPrefix(b.id), 10);
    if (epicA !== epicB) return epicA - epicB;
    return getStoryNumber(a.id) - getStoryNumber(b.id);
  });

  // Categorize
  const actionable = allStories.filter(
    (s) => s.status === "backlog" || s.status === "ready-for-dev",
  );
  const inProgress = allStories.filter((s) => s.status === "in-progress");
  const review = allStories.filter((s) => s.status === "review");
  const done = allStories.filter((s) => s.status === "done");
  const blocked = allStories.filter((s) => s.status === "blocked");

  // Group by epic
  const epicGroups: Record<string, ActionableStory[]> = {};
  for (const story of allStories) {
    const epic = getEpicPrefix(story.id);
    const groupKey = `Epic ${epic}`;
    if (!epicGroups[groupKey]) {
      epicGroups[groupKey] = [];
    }
    epicGroups[groupKey].push(story);
  }

  // Build summary
  const byStatus: Record<StoryStatus, number> = {
    backlog: 0,
    "ready-for-dev": 0,
    "in-progress": 0,
    review: 0,
    done: 0,
    blocked: 0,
  };
  for (const story of allStories) {
    if (story.status in byStatus) {
      byStatus[story.status]++;
    }
  }

  const totalStories = allStories.length;
  const completionPercentage =
    totalStories > 0 ? Math.round((byStatus.done / totalStories) * 100) : 0;

  const summary: SprintSummary = {
    totalStories,
    byStatus,
    completionPercentage,
  };

  return {
    projectName: (record["project"] as string | undefined) ?? projectName,
    summary,
    actionable,
    blocked,
    inProgress,
    review,
    done,
    epicGroups,
  };
}

// ---------------------------------------------------------------------------
// Display: progressive disclosure output
// ---------------------------------------------------------------------------

function displayDefaultPlan(plan: SprintPlanView): void {
  console.log(header(`Sprint Plan: ${plan.projectName}`));
  console.log();

  // Summary line
  const s = plan.summary;
  const parts = [
    `${chalk.cyan(String(s.totalStories))} stories`,
    `Done: ${chalk.green(String(s.byStatus.done))}`,
    `In Progress: ${chalk.blue(String(s.byStatus["in-progress"]))}`,
    `Review: ${chalk.magenta(String(s.byStatus.review))}`,
    `Ready: ${chalk.yellow(String(s.byStatus["ready-for-dev"]))}`,
    `Backlog: ${chalk.gray(String(s.byStatus.backlog))}`,
  ];
  console.log(`  Summary: ${parts.join(chalk.dim(" | "))}`);
  if (s.completionPercentage > 0) {
    console.log(`  Progress: ${chalk.green(`${s.completionPercentage}%`)} complete`);
  }
  console.log();

  // Ready to start
  if (plan.actionable.length > 0) {
    console.log(`  ${chalk.green("READY TO START")}:`);
    console.log(`    ${chalk.dim(padCol("Story", COLUMN_WIDTH))}${chalk.dim("Status")}`);
    for (const story of plan.actionable) {
      const emoji = getStoryStatusEmoji(story.status);
      const coloredStatus = getStoryStatusColor(story.status);
      console.log(`    ${padCol(story.id, COLUMN_WIDTH)}${emoji} ${coloredStatus}`);
    }
    console.log();
  }

  // In progress
  if (plan.inProgress.length > 0) {
    console.log(`  ${chalk.blue("IN PROGRESS")}:`);
    for (const story of plan.inProgress) {
      const emoji = getStoryStatusEmoji(story.status);
      const coloredStatus = getStoryStatusColor(story.status);
      console.log(`    ${padCol(story.id, COLUMN_WIDTH)}${emoji} ${coloredStatus}`);
    }
    console.log();
  } else {
    console.log(`  ${chalk.blue("IN PROGRESS")}: ${chalk.dim("None")}`);
    console.log();
  }

  // In review
  if (plan.review.length > 0) {
    console.log(`  ${chalk.magenta("IN REVIEW")}:`);
    for (const story of plan.review) {
      const emoji = getStoryStatusEmoji(story.status);
      const coloredStatus = getStoryStatusColor(story.status);
      console.log(`    ${padCol(story.id, COLUMN_WIDTH)}${emoji} ${coloredStatus}`);
    }
    console.log();
  }

  // Blocked
  if (plan.blocked.length > 0) {
    console.log(`  ${chalk.red("BLOCKED")}:`);
    for (const story of plan.blocked) {
      const emoji = getStoryStatusEmoji(story.status);
      const coloredStatus = getStoryStatusColor(story.status);
      console.log(`    ${padCol(story.id, COLUMN_WIDTH)}${emoji} ${coloredStatus}`);
    }
    console.log();
  }

  // Footer
  console.log(chalk.dim("  Run 'ao plan --full' for all stories grouped by epic"));
  console.log(chalk.dim("  Run 'ao spawn --story <id>' to start an agent"));
  console.log();
}

function displayFullPlan(plan: SprintPlanView): void {
  console.log(header(`Sprint Plan: ${plan.projectName} (Full)`));
  console.log();

  // Summary line (same as default)
  const s = plan.summary;
  const parts = [
    `${chalk.cyan(String(s.totalStories))} stories`,
    `Done: ${chalk.green(String(s.byStatus.done))}`,
    `In Progress: ${chalk.blue(String(s.byStatus["in-progress"]))}`,
    `Review: ${chalk.magenta(String(s.byStatus.review))}`,
    `Ready: ${chalk.yellow(String(s.byStatus["ready-for-dev"]))}`,
    `Backlog: ${chalk.gray(String(s.byStatus.backlog))}`,
  ];
  console.log(`  Summary: ${parts.join(chalk.dim(" | "))}`);
  if (s.completionPercentage > 0) {
    console.log(`  Progress: ${chalk.green(`${s.completionPercentage}%`)} complete`);
  }
  console.log();

  // All stories grouped by epic
  const epicKeys = Object.keys(plan.epicGroups).sort((a, b) => {
    const numA = parseInt(a.replace("Epic ", ""), 10);
    const numB = parseInt(b.replace("Epic ", ""), 10);
    return numA - numB;
  });

  for (const epicKey of epicKeys) {
    const stories = plan.epicGroups[epicKey];
    console.log(`  ${chalk.bold(epicKey)} (${stories.length} stories):`);
    console.log(`    ${chalk.dim(padCol("Story", COLUMN_WIDTH))}${chalk.dim("Status")}`);
    for (const story of stories) {
      const emoji = getStoryStatusEmoji(story.status);
      const coloredStatus = getStoryStatusColor(story.status);
      console.log(`    ${padCol(story.id, COLUMN_WIDTH)}${emoji} ${coloredStatus}`);
    }
    console.log();
  }
}

// ---------------------------------------------------------------------------
// Opts
// ---------------------------------------------------------------------------

interface PlanOpts {
  json?: boolean;
  accept?: boolean;
  full?: boolean;
}

// ---------------------------------------------------------------------------
// Command registration
// ---------------------------------------------------------------------------

export function registerPlan(program: Command): void {
  program
    .command("plan [project]")
    .description("Show sprint planning — recommended stories, capacity, and blockers")
    .option("--json", "Output as JSON")
    .option("--accept", "Accept plan: move recommended stories to ready-for-dev")
    .option("--full", "Show all stories grouped by epic")
    .action(async (projectArg: string | undefined, opts: PlanOpts) => {
      let config: ReturnType<typeof loadConfig>;
      try {
        config = loadConfig();
      } catch {
        console.error(chalk.red("No config found. Run `ao init` first."));
        process.exit(1);
      }

      const projectId = resolveProject(config, projectArg);
      const project = config.projects[projectId];
      if (!project) {
        console.error(chalk.red(`Project config not found: ${projectId}`));
        process.exit(1);
      }

      // Path 1: Tracker plugin configured → use computeSprintPlan (existing behavior)
      if (project.tracker && project.tracker.plugin === "bmad") {
        let result: ReturnType<typeof computeSprintPlan>;
        try {
          result = computeSprintPlan(project);
        } catch (err) {
          console.error(
            chalk.red(
              `Failed to compute plan: ${err instanceof Error ? err.message : String(err)}`,
            ),
          );
          process.exit(1);
        }

        // --accept: move recommended stories to ready-for-dev
        if (opts.accept) {
          const acceptResult = acceptPlan(project);
          if (opts.json) {
            console.log(JSON.stringify(acceptResult, null, 2));
            return;
          }
          if (acceptResult.count === 0) {
            console.log(chalk.yellow("No recommended stories to accept."));
            return;
          }
          console.log(header("Plan Accepted"));
          console.log();
          for (const id of acceptResult.moved) {
            console.log(`  ${chalk.green("\u2713")} ${id}: backlog \u2192 ready-for-dev`);
          }
          console.log();
          console.log(chalk.dim(`  ${acceptResult.count} stories moved to ready-for-dev.`));
          console.log();
          return;
        }

        if (opts.json) {
          console.log(JSON.stringify(result, null, 2));
          return;
        }

        console.log(header(`Sprint Planning: ${project.name || projectId}`));
        console.log();

        // Sprint config
        if (result.sprintConfig.goal) {
          console.log(`  Goal: ${chalk.cyan(result.sprintConfig.goal)}`);
        }
        if (result.sprintConfig.startDate || result.sprintConfig.endDate) {
          const start = result.sprintConfig.startDate ?? "?";
          const end = result.sprintConfig.endDate ?? "?";
          console.log(`  Sprint: ${chalk.dim(start)} → ${chalk.dim(end)}`);
        }

        // Capacity
        const cap = result.capacity;
        const targetLabel = cap.targetVelocity !== null ? `Target: ${cap.targetVelocity}` : "";
        const histLabel =
          cap.historicalVelocity > 0 ? `Historical: ${cap.historicalVelocity.toFixed(1)}/week` : "";
        const capParts = [targetLabel, histLabel].filter(Boolean);
        if (capParts.length > 0) {
          console.log(`  ${capParts.join(chalk.dim("  —  "))}`);
        }

        const loadColors: Record<string, (s: string) => string> = {
          under: chalk.green,
          "at-capacity": chalk.yellow,
          over: chalk.red,
          "no-data": chalk.dim,
        };
        const loadColor = loadColors[result.loadStatus] ?? chalk.dim;
        console.log(
          `  Load: ${cap.inProgressCount} in-progress, ${chalk.cyan(String(cap.remainingCapacity))} remaining capacity ${loadColor(`(${result.loadStatus})`)}`,
        );
        console.log();

        // Recommended stories
        const unblocked = result.backlogStories.filter((s) => !s.isBlocked);
        const blocked = result.backlogStories.filter((s) => s.isBlocked);

        if (result.recommended.length > 0) {
          console.log(
            `  ${chalk.green("Recommended")} (${result.recommended.length} ${result.recommended.length === 1 ? "story" : "stories"}):`,
          );
          for (const story of result.recommended) {
            const epicStr = story.epic ? chalk.dim(` ${story.epic}`) : "";
            console.log(`    ${chalk.dim(story.id.padEnd(16))}${story.title}${epicStr}`);
          }
          console.log();
        } else if (unblocked.length === 0 && blocked.length > 0) {
          console.log(chalk.yellow("  All backlog stories are blocked by dependencies."));
          console.log();
        } else if (result.backlogStories.length === 0) {
          console.log(chalk.dim("  No stories in backlog."));
          console.log();
        }

        // Blocked stories
        if (blocked.length > 0) {
          console.log(
            `  ${chalk.red("Blocked")} (${blocked.length} ${blocked.length === 1 ? "story" : "stories"}):`,
          );
          for (const story of blocked) {
            const blockerStr = chalk.red(`blocked by ${story.blockers.join(", ")}`);
            const epicStr = story.epic ? chalk.dim(` ${story.epic}`) : "";
            console.log(`    ${chalk.dim(story.id.padEnd(16))}⊘ ${blockerStr}${epicStr}`);
          }
          console.log();
        }
        return;
      }

      // Path 2: No tracker plugin → fall back to sprint-status.yaml
      const startTime = Date.now();

      if (opts.accept) {
        console.error(chalk.red("--accept is only supported with the bmad tracker plugin."));
        console.error(chalk.dim("  Configure tracker: { plugin: 'bmad' } in your project."));
        process.exit(1);
      }

      const storyDir =
        typeof project.tracker?.["storyDir"] === "string"
          ? project.tracker["storyDir"]
          : "_bmad-output/implementation-artifacts";
      const yamlPath = join(project.path, storyDir, "sprint-status.yaml");

      if (!existsSync(yamlPath)) {
        console.error(chalk.red(`sprint-status.yaml not found at: ${yamlPath}`));
        console.error(chalk.dim("  Run 'ao sprint-planning' to generate one."));
        process.exit(1);
      }

      let plan: SprintPlanView;
      try {
        plan = parseSprintStatusYaml(yamlPath, project.name || projectId);
      } catch (err) {
        console.error(
          chalk.red(
            `Failed to parse sprint-status.yaml: ${err instanceof Error ? err.message : String(err)}`,
          ),
        );
        process.exit(1);
      }

      if (opts.json) {
        console.log(JSON.stringify(plan, null, 2));
        return;
      }

      if (plan.summary.totalStories === 0) {
        console.log(header(`Sprint Plan: ${plan.projectName}`));
        console.log();
        console.log(chalk.dim("  No stories found in development_status."));
        console.log();
        return;
      }

      if (opts.full) {
        displayFullPlan(plan);
      } else {
        displayDefaultPlan(plan);
      }

      // Performance check for YAML-fallback path (AC #6)
      const elapsed = Date.now() - startTime;
      if (elapsed > 500) {
        console.warn(chalk.yellow(`⚠️  Warning: Command took ${elapsed}ms (target: <500ms)`));
      }
    });
}
