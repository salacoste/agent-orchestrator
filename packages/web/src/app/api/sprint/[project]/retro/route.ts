import { NextResponse } from "next/server";
import { getServices } from "@/lib/services";
import { computeRetrospective, type RetrospectiveResult } from "@composio/ao-plugin-tracker-bmad";

const EMPTY_RETRO: RetrospectiveResult = {
  periods: [],
  velocityTrend: [],
  averageVelocity: 0,
  velocityChange: 0,
  totalCompleted: 0,
  overallAverageCycleTimeMs: 0,
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
      return NextResponse.json(EMPTY_RETRO);
    }

    const result = computeRetrospective(project);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 },
    );
  }
}
