import { NextResponse } from "next/server";
import { getServices } from "@/lib/services";
import { computeCycleTime, type CycleTimeStats } from "@composio/ao-plugin-tracker-bmad";

const EMPTY_STATS: CycleTimeStats = {
  stories: [],
  averageCycleTimeMs: 0,
  medianCycleTimeMs: 0,
  averageColumnDwells: [],
  bottleneckColumn: null,
  throughputPerDay: 0,
  throughputPerWeek: 0,
  completedCount: 0,
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
      return NextResponse.json(EMPTY_STATS);
    }

    const stats = computeCycleTime(project);
    return NextResponse.json(stats);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 },
    );
  }
}
