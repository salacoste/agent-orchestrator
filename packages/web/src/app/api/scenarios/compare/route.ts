/**
 * GET /api/scenarios/compare — side-by-side scenario comparison (Story 54.4).
 *
 * Accepts 2-4 scenario IDs as query param, returns ranked comparison.
 */

import { NextResponse } from "next/server";
import { compareScenarios, type RankedScenario } from "@composio/ao-core";
import { getScenario } from "@/lib/scenario-store";
import { mapToComparableScenarios } from "@/lib/scenario-comparison";
import type { WhatIfScenario, ScenarioParameters } from "@/lib/types";

export const dynamic = "force-dynamic";

/** GET /api/scenarios/compare?ids=id1,id2,... */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const idsParam = url.searchParams.get("ids");

  if (!idsParam) {
    return NextResponse.json({ error: "Missing required query parameter: ids" }, { status: 400 });
  }

  const uniqueIds = [
    ...new Set(
      idsParam
        .split(",")
        .map((id) => id.trim())
        .filter(Boolean),
    ),
  ];

  if (uniqueIds.length < 2) {
    return NextResponse.json(
      { error: "At least 2 scenario IDs required for comparison" },
      { status: 400 },
    );
  }

  if (uniqueIds.length > 4) {
    return NextResponse.json(
      { error: "Maximum 4 scenarios can be compared at once" },
      { status: 400 },
    );
  }

  // Fetch each scenario by deduplicated IDs
  const fetched: WhatIfScenario[] = [];
  const notFound: string[] = [];

  for (const id of uniqueIds) {
    const scenario = await getScenario(id);
    if (!scenario) {
      notFound.push(id);
    } else {
      fetched.push(scenario);
    }
  }

  if (notFound.length > 0) {
    return NextResponse.json(
      { error: `Scenarios not found: ${notFound.join(", ")}` },
      { status: 404 },
    );
  }

  // Map to core Scenario[] and run comparison
  const { scenarios: mapped, warnings: mappingWarnings } = mapToComparableScenarios(fetched);

  const allWarnings = [...mappingWarnings];

  if (mapped.length < 2) {
    return NextResponse.json(
      {
        error: "Fewer than 2 scenarios have valid simulation results for comparison",
        warnings: allWarnings,
      },
      { status: 400 },
    );
  }

  const comparison = compareScenarios(mapped);

  // Build lookup by name with collision detection for enrichment
  const fetchedByName = new Map<string, WhatIfScenario>();
  for (const s of fetched) {
    if (fetchedByName.has(s.name)) {
      return NextResponse.json(
        { error: `Duplicate scenario name "${s.name}" — rename one scenario before comparing` },
        { status: 400 },
      );
    }
    fetchedByName.set(s.name, s);
  }

  // Attach original scenario metadata to ranked results
  const enriched = {
    scenarios: comparison.scenarios.map((rs: RankedScenario) => {
      const original = fetchedByName.get(rs.name);
      return {
        ...rs,
        id: original?.id ?? "",
        status: original?.status,
        parameters: original?.parameters as ScenarioParameters | undefined,
      };
    }),
    recommendedIndex: comparison.recommendedIndex,
    warnings: allWarnings,
  };

  return NextResponse.json(enriched);
}
