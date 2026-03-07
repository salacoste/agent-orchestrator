import { NextResponse } from "next/server";
import { getServices } from "@/lib/services";
import { computeThroughput } from "@composio/ao-plugin-tracker-bmad";

export async function GET(request: Request, { params }: { params: Promise<{ project: string }> }) {
  try {
    const { project: projectId } = await params;
    const url = new URL(request.url);
    const epicFilter = url.searchParams.get("epic") || undefined;
    const { config } = await getServices();

    const project = config.projects[projectId];
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    if (!project.tracker || project.tracker.plugin !== "bmad") {
      return NextResponse.json({
        dailyThroughput: [],
        weeklyThroughput: [],
        leadTimes: [],
        averageLeadTimeMs: 0,
        medianLeadTimeMs: 0,
        averageCycleTimeMs: 0,
        medianCycleTimeMs: 0,
        flowEfficiency: 0,
        columnTrends: [],
        bottleneckTrend: null,
      });
    }

    const result = computeThroughput(project, epicFilter);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 },
    );
  }
}
