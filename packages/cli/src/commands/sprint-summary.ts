import chalk from "chalk";
import type { Command } from "commander";
import { loadConfig } from "@composio/ao-core";
import {
  readSprintStatus,
  computeSprintHealth,
  computeForecast,
  computeVelocityComparison,
  checkSprintNotifications,
  getPoints,
  hasPointsData,
  categorizeStatus,
  BMAD_COLUMNS,
} from "@composio/ao-plugin-tracker-bmad";
import { getTracker } from "../lib/plugins.js";
import { header } from "../lib/format.js";
import { resolveProject } from "../lib/resolve-project.js";

interface SummaryOpts {
  json?: boolean;
}

interface SprintSummary {
  projectId: string;
  projectName: string;
  columns: Record<string, number>;
  stats: { total: number; done: number; inProgress: number; open: number };
  pointsStats?: { total: number; done: number; inProgress: number; open: number };
  healthOverall: string;
  healthIndicators: number;
  velocity: number;
  velocityTrend: string;
  forecastPace: string;
  forecastDaysRemaining: number | null;
  stuckStories: string[];
  wipAlerts: string[];
  sprintGoal: string | null;
  sprintNumber: number | null;
  daysRemaining: number | null;
}

export function registerSprintSummary(program: Command): void {
  program
    .command("sprint-summary [project]")
    .description("Show a single-screen sprint summary with key metrics")
    .option("--json", "Output as JSON")
    .action(async (projectArg: string | undefined, opts: SummaryOpts) => {
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

      const tracker = getTracker(config, projectId);
      if (!tracker || tracker.name !== "bmad") {
        console.error(chalk.red("Sprint summary requires the bmad tracker plugin."));
        process.exit(1);
      }

      // Build summary
      const summary = buildSummary(projectId, project);

      if (opts.json) {
        console.log(JSON.stringify(summary, null, 2));
        return;
      }

      printSummary(summary);
    });
}

function buildSummary(
  projectId: string,
  project: ReturnType<typeof loadConfig>["projects"][string],
): SprintSummary {
  const sprint = readSprintStatus(project);
  const usePoints = hasPointsData(sprint);

  // Column counts
  const columns: Record<string, number> = {};
  for (const col of BMAD_COLUMNS) columns[col] = 0;

  let total = 0;
  let done = 0;
  let inProgress = 0;
  let pTotal = 0;
  let pDone = 0;
  let pInProgress = 0;

  for (const [id, entry] of Object.entries(sprint.development_status)) {
    const status = typeof entry.status === "string" ? entry.status : "backlog";
    if (id.startsWith("epic-") || status.startsWith("epic-")) continue;

    total++;
    const cat = categorizeStatus(status);
    if (cat === "done") done++;
    else if (cat === "in-progress") inProgress++;

    const col = (BMAD_COLUMNS as readonly string[]).includes(status) ? status : "backlog";
    columns[col] = (columns[col] ?? 0) + 1;

    if (usePoints) {
      const pts = getPoints(entry);
      pTotal += pts;
      if (cat === "done") pDone += pts;
      else if (cat === "in-progress") pInProgress += pts;
    }
  }

  // Health
  let healthOverall = "ok";
  let healthIndicators = 0;
  try {
    const health = computeSprintHealth(project);
    healthOverall = health.overall;
    healthIndicators = health.indicators.length;
  } catch {
    // Non-fatal
  }

  // Velocity
  let velocity = 0;
  let velocityTrend = "stable";
  try {
    const vel = computeVelocityComparison(project);
    velocity = vel.averageVelocity;
    velocityTrend = vel.trend;
  } catch {
    // Non-fatal
  }

  // Forecast
  let forecastPace = "unknown";
  let forecastDaysRemaining: number | null = null;
  try {
    const forecast = computeForecast(project);
    forecastPace = forecast.pace;
    forecastDaysRemaining = forecast.daysRemaining;
  } catch {
    // Non-fatal
  }

  // Stuck stories + WIP alerts from notifications
  const stuckStories: string[] = [];
  const wipAlerts: string[] = [];
  try {
    const notifications = checkSprintNotifications(project, {});
    for (const n of notifications) {
      if (n.type === "sprint.story_stuck") {
        stuckStories.push(n.message);
      } else if (n.type === "sprint.wip_exceeded") {
        wipAlerts.push(n.message);
      }
    }
  } catch {
    // Non-fatal
  }

  // Sprint meta
  const sprintGoal =
    typeof project.tracker?.["sprintGoal"] === "string" ? project.tracker["sprintGoal"] : null;
  const sprintNumber =
    typeof project.tracker?.["sprintNumber"] === "number" ? project.tracker["sprintNumber"] : null;

  // Days remaining
  let daysRemaining: number | null = forecastDaysRemaining;
  if (daysRemaining === null && typeof project.tracker?.["sprintEndDate"] === "string") {
    const endDate = new Date(project.tracker["sprintEndDate"]);
    const now = new Date();
    daysRemaining = Math.max(0, Math.ceil((endDate.getTime() - now.getTime()) / 86_400_000));
  }

  return {
    projectId,
    projectName: project.name || projectId,
    columns,
    stats: { total, done, inProgress, open: total - done - inProgress },
    ...(usePoints
      ? {
          pointsStats: {
            total: pTotal,
            done: pDone,
            inProgress: pInProgress,
            open: pTotal - pDone - pInProgress,
          },
        }
      : {}),
    healthOverall,
    healthIndicators,
    velocity,
    velocityTrend,
    forecastPace,
    forecastDaysRemaining,
    stuckStories,
    wipAlerts,
    sprintGoal,
    sprintNumber,
    daysRemaining,
  };
}

function printSummary(s: SprintSummary): void {
  const title = s.sprintNumber
    ? `Sprint #${s.sprintNumber} Summary: ${s.projectName}`
    : `Sprint Summary: ${s.projectName}`;
  console.log(header(title));
  console.log();

  if (s.sprintGoal) {
    console.log(`  Goal: ${chalk.cyan(s.sprintGoal)}`);
  }

  // Progress bar
  const pct = s.stats.total > 0 ? Math.round((s.stats.done / s.stats.total) * 100) : 0;
  const barWidth = 30;
  const filled = Math.round((pct / 100) * barWidth);
  const bar = chalk.green("█".repeat(filled)) + chalk.dim("░".repeat(barWidth - filled));
  console.log(`  Progress: ${bar} ${pct}%`);
  console.log();

  // Column counts
  console.log("  Columns:");
  for (const col of BMAD_COLUMNS) {
    const count = s.columns[col] ?? 0;
    const label = col.padEnd(15);
    console.log(`    ${chalk.dim(label)} ${count}`);
  }
  console.log();

  // Stats row
  console.log(
    `  Stories: ${chalk.cyan(String(s.stats.total))} total, ${chalk.green(String(s.stats.done))} done, ${chalk.blue(String(s.stats.inProgress))} active, ${chalk.dim(String(s.stats.open))} open`,
  );

  if (s.pointsStats) {
    console.log(
      `  Points:  ${chalk.cyan(String(s.pointsStats.total))} total, ${chalk.green(String(s.pointsStats.done))} done, ${chalk.blue(String(s.pointsStats.inProgress))} active`,
    );
  }

  // Health
  const healthBadge =
    s.healthOverall === "critical"
      ? chalk.red("CRITICAL")
      : s.healthOverall === "warning"
        ? chalk.yellow("WARNING")
        : chalk.green("OK");
  console.log(
    `  Health: ${healthBadge}${s.healthIndicators > 0 ? ` (${s.healthIndicators} alerts)` : ""}`,
  );

  // Velocity & forecast
  console.log(`  Velocity: ${chalk.cyan(String(s.velocity))} stories/sprint (${s.velocityTrend})`);
  console.log(`  Pace: ${chalk.cyan(s.forecastPace)}`);

  if (s.daysRemaining !== null) {
    const daysColor =
      s.daysRemaining <= 2 ? chalk.red : s.daysRemaining <= 5 ? chalk.yellow : chalk.cyan;
    console.log(`  Days remaining: ${daysColor(String(s.daysRemaining))}`);
  }

  // Alerts
  if (s.stuckStories.length > 0) {
    console.log();
    console.log(chalk.yellow("  Stuck stories:"));
    for (const id of s.stuckStories) {
      console.log(`    - ${id}`);
    }
  }

  if (s.wipAlerts.length > 0) {
    console.log();
    console.log(chalk.yellow("  WIP alerts:"));
    for (const msg of s.wipAlerts) {
      console.log(`    - ${msg}`);
    }
  }

  console.log();
}
