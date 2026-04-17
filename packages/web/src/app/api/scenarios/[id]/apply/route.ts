/**
 * POST /api/scenarios/[id]/apply — apply a verified scenario to production (Story 54.6).
 *
 * Validates scenario exists, is "simulated", and has parameters.
 * Transitions status to "applied" with revision tracking.
 */

import { NextResponse } from "next/server";
import { getScenario, updateScenario } from "@/lib/scenario-store";

export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ id: string }>;
}

/** POST /api/scenarios/:id/apply */
export async function POST(_request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const scenario = await getScenario(id);

    if (!scenario) {
      return NextResponse.json({ error: "Scenario not found" }, { status: 404 });
    }

    if (scenario.status !== "simulated") {
      return NextResponse.json(
        { error: `Scenario must be simulated before applying. Current status: ${scenario.status}` },
        { status: 409 },
      );
    }

    if (!scenario.parameters) {
      return NextResponse.json(
        { error: "Scenario parameters are required before applying" },
        { status: 400 },
      );
    }

    const updated = await updateScenario(id, { status: "applied" });

    if (!updated) {
      return NextResponse.json({ error: "Failed to update scenario" }, { status: 500 });
    }

    return NextResponse.json(updated);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Apply failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
