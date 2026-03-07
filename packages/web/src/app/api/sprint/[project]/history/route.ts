import { NextResponse } from "next/server";
import { getServices } from "@/lib/services";
import { queryHistory } from "@composio/ao-plugin-tracker-bmad";

export async function GET(request: Request, { params }: { params: Promise<{ project: string }> }) {
  try {
    const { project: projectId } = await params;
    const url = new URL(request.url);
    const { config } = await getServices();

    const project = config.projects[projectId];
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    if (!project.tracker || project.tracker.plugin !== "bmad") {
      return NextResponse.json({ entries: [], total: 0 });
    }

    const storyId = url.searchParams.get("story") || undefined;
    const epic = url.searchParams.get("epic") || undefined;
    const fromDate = url.searchParams.get("from") || undefined;
    const toDate = url.searchParams.get("to") || undefined;
    const toStatus = url.searchParams.get("status") || undefined;
    const search = url.searchParams.get("search") || undefined;
    const limitParam = url.searchParams.get("limit");
    const limit = limitParam ? Math.max(1, parseInt(limitParam, 10) || 100) : 100;

    const result = queryHistory(project, {
      storyId,
      epic,
      fromDate,
      toDate,
      toStatus,
      search,
      limit,
    });

    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 },
    );
  }
}
