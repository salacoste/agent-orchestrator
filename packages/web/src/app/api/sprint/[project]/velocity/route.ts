import { NextResponse } from "next/server";
import { getServices } from "@/lib/services";
import type { Tracker } from "@composio/ao-core";
import { readHistory, getBmadStatus, categorizeStatus } from "@composio/ao-plugin-tracker-bmad";

export async function GET(_request: Request, { params }: { params: Promise<{ project: string }> }) {
  try {
    const { project: projectId } = await params;
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
      });
    }

    const entries = readHistory(project);

    if (entries.length === 0) {
      return NextResponse.json({
        entries: [],
        dailyCompletions: [],
        totalStories: 0,
        doneCount: 0,
      });
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
      .map(([date, ids]) => ({ date, count: ids.size }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // Get total stories and current done count from tracker (ground truth)
    const tracker = registry.get<Tracker>("tracker", project.tracker.plugin);
    let totalStories = 0;
    let doneCount = 0;
    if (tracker?.listIssues) {
      const issues = await tracker.listIssues({ state: "all", limit: 200 }, project);
      totalStories = issues.length;
      doneCount = issues.filter((i) => categorizeStatus(getBmadStatus(i.labels)) === "done").length;
    }

    return NextResponse.json({
      entries: entries.slice(-100), // Last 100 entries
      dailyCompletions,
      totalStories,
      doneCount,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 },
    );
  }
}
