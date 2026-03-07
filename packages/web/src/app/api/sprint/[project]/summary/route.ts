import { NextResponse } from "next/server";
import { getServices } from "@/lib/services";
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

export async function GET(_request: Request, { params }: { params: Promise<{ project: string }> }) {
  try {
    const { project: projectId } = await params;
    const { config } = await getServices();

    const project = config.projects[projectId];
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    // Read sprint status
    let sprint;
    try {
      sprint = readSprintStatus(project);
    } catch {
      return NextResponse.json({ error: "Sprint status not found" }, { status: 404 });
    }

    const usePoints = hasPointsData(sprint);

    // Column counts and stats
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

    // Notifications
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

    // Days remaining
    let daysRemaining: number | null = forecastDaysRemaining;
    if (daysRemaining === null && typeof project.tracker?.["sprintEndDate"] === "string") {
      const endDate = new Date(project.tracker["sprintEndDate"]);
      const now = new Date();
      daysRemaining = Math.max(0, Math.ceil((endDate.getTime() - now.getTime()) / 86_400_000));
    }

    return NextResponse.json({
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
      progress: total > 0 ? Math.round((done / total) * 100) : 0,
      healthOverall,
      healthIndicators,
      velocity,
      velocityTrend,
      forecastPace,
      forecastDaysRemaining,
      stuckStories,
      wipAlerts,
      daysRemaining,
      sprintGoal:
        typeof project.tracker?.["sprintGoal"] === "string" ? project.tracker["sprintGoal"] : null,
      sprintNumber:
        typeof project.tracker?.["sprintNumber"] === "number"
          ? project.tracker["sprintNumber"]
          : null,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 },
    );
  }
}
