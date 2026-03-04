import { NextResponse } from "next/server";
import { getServices } from "@/lib/services";
import { computeForecast, type SprintForecast } from "@composio/ao-plugin-tracker-bmad";

const EMPTY_FORECAST: SprintForecast = {
  projectedCompletionDate: null,
  daysRemaining: null,
  pace: "no-data",
  confidence: 0,
  currentVelocity: 0,
  requiredVelocity: 0,
  remainingStories: 0,
  totalStories: 0,
  completedStories: 0,
};

export async function GET(_request: Request, { params }: { params: Promise<{ project: string }> }) {
  try {
    const { project: projectId } = await params;
    const { config } = await getServices();

    const project = config.projects[projectId];
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    if (!project.tracker || project.tracker.plugin !== "bmad") {
      return NextResponse.json(EMPTY_FORECAST);
    }

    const result = computeForecast(project);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 },
    );
  }
}
