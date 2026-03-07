import { NextResponse } from "next/server";
import { getServices } from "@/lib/services";
import { generateStandup } from "@composio/ao-plugin-tracker-bmad";

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
        generatedAt: new Date().toISOString(),
        projectName: projectId,
        completedYesterday: [],
        inProgress: [],
        blocked: [],
        health: {
          pace: "no-data",
          remainingStories: 0,
          totalStories: 0,
          completedStories: 0,
          projectedCompletion: null,
        },
        reworkAlerts: [],
        markdown: "",
      });
    }

    const result = generateStandup(project, epicFilter);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 },
    );
  }
}
