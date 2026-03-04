import { NextResponse } from "next/server";
import { getServices } from "@/lib/services";
import { computeSprintPlan } from "@composio/ao-plugin-tracker-bmad";

export async function GET(_request: Request, { params }: { params: Promise<{ project: string }> }) {
  try {
    const { project: projectId } = await params;
    const { config } = await getServices();

    const project = config.projects[projectId];
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    if (!project.tracker || project.tracker.plugin !== "bmad") {
      return NextResponse.json({
        backlogStories: [],
        recommended: [],
        sprintConfig: { startDate: null, endDate: null, goal: null, targetVelocity: null },
        capacity: {
          historicalVelocity: 0,
          targetVelocity: null,
          effectiveTarget: 0,
          inProgressCount: 0,
          remainingCapacity: 0,
        },
        loadStatus: "no-data",
      });
    }

    const result = computeSprintPlan(project);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 },
    );
  }
}
