import { NextResponse } from "next/server";
import { getServices } from "@/lib/services";
import { computeCfd } from "@composio/ao-plugin-tracker-bmad";

export async function GET(request: Request, { params }: { params: Promise<{ project: string }> }) {
  try {
    const { project: projectId } = await params;
    const url = new URL(request.url);
    const epicFilter = url.searchParams.get("epic") || undefined;
    const daysParam = url.searchParams.get("days");
    const days = daysParam ? parseInt(daysParam, 10) || 30 : undefined;
    const { config } = await getServices();

    const project = config.projects[projectId];
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    if (!project.tracker || project.tracker.plugin !== "bmad") {
      return NextResponse.json({ dataPoints: [], columns: [], dateRange: { from: "", to: "" } });
    }

    const result = computeCfd(project, { epicFilter, days });
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 },
    );
  }
}
