import { NextResponse } from "next/server";
import { getServices } from "@/lib/services";
import type { Tracker } from "@composio/ao-core";
import {
  readHistory,
  getBmadStatus,
  categorizeStatus,
  readSprintStatus,
  getEpicStoryIds,
  hasPointsData,
  getPoints,
} from "@composio/ao-plugin-tracker-bmad";

export async function GET(request: Request, { params }: { params: Promise<{ project: string }> }) {
  try {
    const { project: projectId } = await params;
    const url = new URL(request.url);
    const epicFilter = url.searchParams.get("epic") || undefined;
    const { config, registry } = await getServices();

    const project = config.projects[projectId];
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    if (!project.tracker || project.tracker.plugin !== "bmad") {
      return NextResponse.json({
        entries: [],
        dailyCompletions: [],
        totalStories: 0,
        doneCount: 0,
        hasPoints: false,
        totalPoints: 0,
        donePoints: 0,
      });
    }

    let entries = readHistory(project);

    // Filter by epic if requested
    let epicStoryIds: Set<string> | null = null;
    if (epicFilter) {
      try {
        const sprint = readSprintStatus(project);
        epicStoryIds = getEpicStoryIds(sprint, epicFilter);
        entries = entries.filter((e) => epicStoryIds?.has(e.storyId));
      } catch {
        // Sprint status unavailable — skip filtering
      }
    }

    if (entries.length === 0) {
      return NextResponse.json({
        entries: [],
        dailyCompletions: [],
        totalStories: 0,
        doneCount: 0,
        hasPoints: false,
        totalPoints: 0,
        donePoints: 0,
      });
    }

    // Read sprint status for points data
    let pointsAvailable = false;
    const storyPointsMap = new Map<string, number>();
    try {
      const sprint = readSprintStatus(project);
      pointsAvailable = hasPointsData(sprint);
      if (pointsAvailable) {
        for (const [id, entry] of Object.entries(sprint.development_status)) {
          storyPointsMap.set(id, getPoints(entry));
        }
      }
    } catch {
      // Non-fatal — points data unavailable
    }

    // Compute daily completions (stories moving to "done"), deduplicated by storyId
    // A story moving done→in-progress→done should only count once per day
    const dailyMap = new Map<string, Set<string>>();
    for (const entry of entries) {
      if (entry.toStatus === "done") {
        const day = entry.timestamp.slice(0, 10); // YYYY-MM-DD
        const ids = dailyMap.get(day) ?? new Set<string>();
        ids.add(entry.storyId);
        dailyMap.set(day, ids);
      }
    }

    const dailyCompletions = Array.from(dailyMap.entries())
      .map(([date, ids]) => {
        let points = 0;
        if (pointsAvailable) {
          for (const id of ids) {
            points += storyPointsMap.get(id) ?? 1;
          }
        }
        return { date, count: ids.size, points };
      })
      .sort((a, b) => a.date.localeCompare(b.date));

    // Get total stories and current done count from tracker (ground truth)
    const tracker = registry.get<Tracker>("tracker", project.tracker.plugin);
    let totalStories = 0;
    let doneCount = 0;
    let totalPoints = 0;
    let donePoints = 0;
    if (tracker?.listIssues) {
      let issues = await tracker.listIssues({ state: "all", limit: 200 }, project);
      if (epicStoryIds) {
        issues = issues.filter((i) => epicStoryIds?.has(i.id));
      }
      totalStories = issues.length;
      for (const issue of issues) {
        const isDone = categorizeStatus(getBmadStatus(issue.labels)) === "done";
        if (isDone) doneCount++;
        if (pointsAvailable) {
          const pts = storyPointsMap.get(issue.id) ?? 1;
          totalPoints += pts;
          if (isDone) donePoints += pts;
        }
      }
    }

    return NextResponse.json({
      entries: entries.slice(-100), // Last 100 entries
      dailyCompletions,
      totalStories,
      doneCount,
      hasPoints: pointsAvailable,
      totalPoints,
      donePoints,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 },
    );
  }
}
