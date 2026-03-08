import { NextResponse } from "next/server";
import { getServices } from "@/lib/services";
import { computeSprintHealth, type SprintHealthResult } from "@composio/ao-plugin-tracker-bmad";
import type { DegradedModeStatus } from "@composio/ao-core";

const EMPTY_HEALTH: SprintHealthResult = {
  overall: "ok",
  indicators: [],
  stuckStories: [],
  wipColumns: [],
};

type HealthResponse = SprintHealthResult & {
  degradedMode?: DegradedModeStatus;
};

export async function GET(request: Request, { params }: { params: Promise<{ project: string }> }) {
  try {
    const { project: projectId } = await params;
    const { config } = await getServices();

    const project = config.projects[projectId];
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    if (!project.tracker || project.tracker.plugin !== "bmad") {
      return NextResponse.json(EMPTY_HEALTH);
    }

    const url = new URL(request.url);
    const epicFilter = url.searchParams.get("epic") || undefined;
    const result = computeSprintHealth(project, epicFilter);

    // Try to get degraded mode status (optional)
    let degradedModeStatus: DegradedModeStatus | null = null;
    try {
      // Try to get degraded mode status from lifecycle manager if available
      // This is optional - if not available, the field will be omitted
      // Note: Using dynamic import to avoid hard dependency on CLI package
      // @ts-expect-error - Optional import, caught in catch block
      const lifecycleModule = await import("@composio/ao-cli/lib/lifecycle.js");
      const lifecycleManager = await lifecycleModule.getLifecycleManagerIfExists(config, projectId);
      if (lifecycleManager && lifecycleManager.getDegradedModeStatus) {
        degradedModeStatus = lifecycleManager.getDegradedModeStatus() as DegradedModeStatus;
      }
    } catch {
      // Degraded mode not available - continue without it
    }

    const response: HealthResponse = result;
    if (degradedModeStatus) {
      response.degradedMode = degradedModeStatus;
    }

    return NextResponse.json(response);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 },
    );
  }
}
