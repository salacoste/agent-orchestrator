/**
 * GET/PATCH/DELETE /api/scenarios/[id] — retrieve, update, or delete a single scenario by ID.
 * Story 54.1: GET, DELETE. Story 54.2: PATCH (parameter updates).
 */

import { NextResponse } from "next/server";
import { getScenario, updateScenario, deleteScenario } from "@/lib/scenario-store";
import { validateParameters } from "@/lib/scenario-params";
import type { ScenarioParameters } from "@/lib/types";

export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ id: string }>;
}

/** GET /api/scenarios/:id — return a single scenario or 404. */
export async function GET(_request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const scenario = await getScenario(id);

    if (!scenario) {
      return NextResponse.json({ error: "Scenario not found" }, { status: 404 });
    }

    return NextResponse.json(scenario);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/** PATCH /api/scenarios/:id — update scenario parameters. */
export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const scenario = await getScenario(id);

    if (!scenario) {
      return NextResponse.json({ error: "Scenario not found" }, { status: 404 });
    }

    if (scenario.status !== "draft") {
      return NextResponse.json(
        { error: "Cannot modify parameters of a scenario that has been simulated or applied" },
        { status: 409 },
      );
    }

    const body = await request.json();
    const { parameters } = body as { parameters?: ScenarioParameters };

    if (!parameters) {
      return NextResponse.json({ error: "Parameters are required" }, { status: 400 });
    }

    const storyIds = scenario.stories.map((s) => s.id);
    const errors = validateParameters(parameters, storyIds);
    if (errors.length > 0) {
      return NextResponse.json({ error: errors.join("; ") }, { status: 400 });
    }

    const updated = await updateScenario(id, { parameters });
    return NextResponse.json(updated);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/** DELETE /api/scenarios/:id — delete a scenario. */
export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const deleted = await deleteScenario(id);

    if (!deleted) {
      return NextResponse.json({ error: "Scenario not found" }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
