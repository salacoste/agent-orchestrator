import { NextResponse } from "next/server";
import { getServices } from "@/lib/services";
import { computeMonteCarloForecast } from "@composio/ao-plugin-tracker-bmad";

export async function GET(request: Request, { params }: { params: Promise<{ project: string }> }) {
  try {
    const { project: projectId } = await params;
    const url = new URL(request.url);
    const epicFilter = url.searchParams.get("epic") || undefined;
    const simulationsParam = url.searchParams.get("simulations");
    const simulations = simulationsParam ? parseInt(simulationsParam, 10) : undefined;
    const { config } = await getServices();

    const project = config.projects[projectId];
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    if (!project.tracker || project.tracker.plugin !== "bmad") {
      return NextResponse.json({
        percentiles: { p50: "", p85: "", p95: "" },
        histogram: [],
        remainingStories: 0,
        simulationCount: 0,
        sampleSize: 0,
        averageDailyRate: 0,
        linearCompletionDate: null,
        linearConfidence: 0,
      });
    }

    const result = computeMonteCarloForecast(project, epicFilter, {
      simulations: simulations && !isNaN(simulations) ? simulations : undefined,
    });
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 },
    );
  }
}
