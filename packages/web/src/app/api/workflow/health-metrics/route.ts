import { NextResponse, type NextRequest } from "next/server";
import { getServices } from "@/lib/services";
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

export const dynamic = "force-dynamic";

interface BlockedStory {
  id: string;
  status: string;
}

interface WorkflowMetrics {
  stories: {
    total: number;
    completed: number;
    inProgress: number;
    blocked: number;
    blockedStories: BlockedStory[];
  };
  agents: {
    total: number;
    active: number;
    utilizationRate: number;
  };
  cycleTime: {
    average: number; // hours
    target: number;
    trend: "up" | "down" | "stable";
  };
  burndown: {
    remaining: number;
    total: number;
    progress: number; // percentage
  };
}

function getStatusCounts(status: string, developmentStatus: Record<string, string>): number {
  return Object.values(developmentStatus).filter((s) => s === status).length;
}

/**
 * GET /api/workflow/health-metrics — Get workflow health metrics
 *
 * Returns metrics for story counts, agent utilization, cycle time, and burndown progress.
 */
export async function GET(_request: NextRequest): Promise<NextResponse> {
  try {
    // Load sprint status for story counts
    // Try multiple possible paths relative to different working directories
    const possiblePaths = [
      resolve(process.cwd(), "../../_bmad-output/implementation-artifacts/sprint-status.yaml"),
      resolve(process.cwd(), "_bmad-output/implementation-artifacts/sprint-status.yaml"),
      resolve(process.cwd(), "../_bmad-output/implementation-artifacts/sprint-status.yaml"),
    ];
    const sprintStatusPath = possiblePaths.find((p) => existsSync(p));
    if (!sprintStatusPath) {
      return NextResponse.json({ error: "Sprint status not found" }, { status: 404 });
    }

    const sprintStatusContent = await readFile(sprintStatusPath, "utf-8");
    const developmentStatus: Record<string, string> = {};

    // Parse development_status from YAML (simplified parsing)
    const lines = sprintStatusContent.split("\n");
    let inDevStatus = false;
    for (const line of lines) {
      if (line.trim() === "development_status:") {
        inDevStatus = true;
        continue;
      }
      if (inDevStatus && line.startsWith("  ")) {
        const match = line.match(/^ {2}([\w-]+):\s*(.+)$/);
        if (match) {
          const [, key, value] = match;
          developmentStatus[key] = value.trim();
        }
      } else if (inDevStatus && !line.startsWith("  ")) {
        break;
      }
    }

    // Calculate story counts
    const allEntries = Object.keys(developmentStatus);
    const storyEntries = allEntries.filter(
      (key) => /^\d+-\d+-/.test(key) && !key.endsWith("-retrospective"),
    );

    const total = storyEntries.length;
    const completed = getStatusCounts("done", developmentStatus);
    const inProgress = getStatusCounts("in-progress", developmentStatus);
    const blocked =
      getStatusCounts("blocked", developmentStatus) + getStatusCounts("review", developmentStatus);

    // Get list of blocked stories for drill-down
    const blockedStories: BlockedStory[] = storyEntries
      .filter((key) => {
        const status = developmentStatus[key];
        return status === "blocked" || status === "review";
      })
      .map((key) => ({
        id: key,
        status: developmentStatus[key],
      }));

    // Get agent utilization from sessions
    const { sessionManager } = await getServices();
    const sessions = await sessionManager.list();
    const totalAgents = sessions.length;
    const activeAgents = sessions.filter((s) => s.status === "working").length;
    const utilizationRate = totalAgents > 0 ? activeAgents / totalAgents : 0;

    // Calculate cycle time (placeholder - needs actual cycle time calculation)
    const cycleTimeAverage = 4.5; // hours
    const cycleTimeTarget = 5;
    const cycleTimeTrend = "down";

    // Calculate burndown progress
    const burndownProgress = total > 0 ? Math.round((completed / total) * 100) : 0;

    const metrics: WorkflowMetrics = {
      stories: { total, completed, inProgress, blocked, blockedStories },
      agents: { total: totalAgents, active: activeAgents, utilizationRate },
      cycleTime: { average: cycleTimeAverage, target: cycleTimeTarget, trend: cycleTimeTrend },
      burndown: { remaining: total - completed, total, progress: burndownProgress },
    };

    return NextResponse.json(metrics, {
      headers: {
        "Cache-Control": "public, max-age=5, stale-while-revalidate=30",
      },
    });
  } catch (err) {
    const error = err as Error;
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
