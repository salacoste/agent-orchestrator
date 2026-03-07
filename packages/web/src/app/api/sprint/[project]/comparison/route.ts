import { NextResponse } from "next/server";
import { getServices } from "@/lib/services";
import { computeSprintComparison } from "@composio/ao-plugin-tracker-bmad";

export async function GET(request: Request, { params }: { params: Promise<{ project: string }> }) {
  try {
    const { project: projectId } = await params;
    const url = new URL(request.url);
    const epicFilter = url.searchParams.get("epic") || undefined;
    const weeksParam = url.searchParams.get("weeks");
    const weeks = weeksParam ? parseInt(weeksParam, 10) || 4 : undefined;
    const { config } = await getServices();

    const project = config.projects[projectId];
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    if (!project.tracker || project.tracker.plugin !== "bmad") {
      return NextResponse.json({
        periods: [],
        trends: {
          velocity: "stable",
          cycleTime: "stable",
          flowEfficiency: "stable",
          wip: "stable",
        },
        hasPoints: false,
      });
    }

    const result = computeSprintComparison(project, { weeks, epicFilter });
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 },
    );
  }
}
