import { NextResponse } from "next/server";
import { getServices } from "@/lib/services";
import { computeVelocityComparison } from "@composio/ao-plugin-tracker-bmad";

export async function GET(request: Request, { params }: { params: Promise<{ project: string }> }) {
  try {
    const { project: projectId } = await params;
    const { config } = await getServices();

    const project = config.projects[projectId];
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    if (!project.tracker || project.tracker.plugin !== "bmad") {
      return NextResponse.json({
        weeks: [],
        averageVelocity: 0,
        stdDeviation: 0,
        trend: "stable",
        trendSlope: 0,
        trendConfidence: 0,
        nextWeekEstimate: 0,
        currentWeekSoFar: 0,
        completionWeeks: null,
        remainingStories: 0,
      });
    }

    const url = new URL(request.url);
    const epicFilter = url.searchParams.get("epic") || undefined;
    const result = computeVelocityComparison(project, epicFilter);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 },
    );
  }
}
