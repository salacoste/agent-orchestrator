/**
 * Scenario API routes — GET (list) and POST (create) for what-if scenarios (Story 54.1, Task 3).
 *
 * GET  /api/scenarios          → WhatIfScenario[]
 * POST /api/scenarios          → WhatIfScenario   (body: { name, projectIds })
 */

import { NextResponse } from "next/server";
import { getServices } from "@/lib/services";
import { listScenarios, addScenario } from "@/lib/scenario-store";
import { captureScenarioSnapshot, createScenario } from "@/lib/scenario-snapshot";

export const dynamic = "force-dynamic";

/** GET /api/scenarios — list all stored scenarios. */
export async function GET() {
  try {
    const scenarios = await listScenarios();
    return NextResponse.json(scenarios);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/** POST /api/scenarios — create a new scenario with a snapshot of current state. */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, projectIds } = body as { name?: string; projectIds?: string[] };

    // Validate name
    if (!name || typeof name !== "string" || !name.trim()) {
      return NextResponse.json({ error: "Scenario name is required" }, { status: 400 });
    }

    // Validate projectIds
    if (!Array.isArray(projectIds) || projectIds.length === 0) {
      return NextResponse.json({ error: "At least one project must be selected" }, { status: 400 });
    }

    // Validate all projectIds exist in config
    const { config } = await getServices();
    const configuredIds = Object.keys(config.projects);
    const unknownIds = projectIds.filter((id: string) => !configuredIds.includes(id));
    if (unknownIds.length > 0) {
      return NextResponse.json(
        { error: `Unknown project IDs: ${unknownIds.join(", ")}` },
        { status: 400 },
      );
    }

    // Capture snapshot of current state for selected projects
    const projectData: Record<string, Record<string, unknown>> = {};
    const tracker = await import("@composio/ao-plugin-tracker-bmad");
    for (const projectId of projectIds) {
      const project = config.projects[projectId];
      if (!project) continue;
      try {
        const status = tracker.readSprintStatus(project);
        if (status?.development_status) {
          projectData[projectId] = status.development_status as Record<string, unknown>;
        }
      } catch {
        // Skip projects that fail to read — still create scenario with empty data
        projectData[projectId] = {};
      }
    }

    const stories = captureScenarioSnapshot(projectData, projectIds);
    const scenario = createScenario(name, projectIds, stories);

    await addScenario(scenario);

    return NextResponse.json(scenario, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
