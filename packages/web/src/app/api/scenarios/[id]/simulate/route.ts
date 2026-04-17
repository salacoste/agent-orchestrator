/**
 * POST /api/scenarios/[id]/simulate — run Monte Carlo simulation on a scenario (Story 54.3).
 *
 * Validates scenario exists, is "draft", and has parameters.
 * Calls buildSimulationInput() → simulateSprint() → applyParallelismScaling().
 * Stores result and transitions status to "simulated".
 */

import { NextResponse } from "next/server";
import { simulateSprint, getSimulationColor } from "@composio/ao-core";
import { getScenario, updateScenario } from "@/lib/scenario-store";
import { getServices } from "@/lib/services";
import { buildSimulationInput, applyParallelismScaling } from "@/lib/scenario-simulation";

export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ id: string }>;
}

/** POST /api/scenarios/:id/simulate */
export async function POST(_request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const scenario = await getScenario(id);

    if (!scenario) {
      return NextResponse.json({ error: "Scenario not found" }, { status: 404 });
    }

    if (scenario.status !== "draft") {
      return NextResponse.json(
        { error: "Scenario has already been simulated or applied" },
        { status: 409 },
      );
    }

    if (!scenario.parameters) {
      return NextResponse.json(
        { error: "Scenario parameters must be configured before simulation" },
        { status: 400 },
      );
    }

    if (scenario.parameters.agentCount < 1 || scenario.parameters.capacityLimit < 1) {
      return NextResponse.json(
        { error: "Agent count and capacity limit must be at least 1" },
        { status: 400 },
      );
    }

    // Fetch learnings from learning store
    const { learningStore } = await getServices();
    const learnings = (learningStore?.list?.() ?? []) as Parameters<typeof buildSimulationInput>[1];

    // Build input and run simulation
    const input = buildSimulationInput(scenario, learnings);
    const rawResult = simulateSprint(input);

    // Apply parallelism scaling (pre-scale before storing)
    const result = applyParallelismScaling(
      rawResult,
      scenario.parameters.agentCount,
      scenario.parameters.capacityLimit,
    );

    // Store result and transition status
    const updated = await updateScenario(id, {
      result,
      status: "simulated",
    });

    if (!updated) {
      return NextResponse.json({ error: "Failed to update scenario" }, { status: 500 });
    }

    const color = getSimulationColor(result.onTimeProbability);
    return NextResponse.json({ ...updated, color });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Simulation failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
