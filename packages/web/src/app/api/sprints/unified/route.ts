/**
 * GET /api/sprints/unified
 * Aggregated sprint data across all configured projects (Story 53.1, Task 3).
 *
 * Response: { sprints: UnifiedSprintEntry[], summary: UnifiedSprintSummary }
 * Returns 200 with empty array when no projects configured.
 * Skips projects where tracker read fails (logs warning, continues).
 */

import { NextResponse } from "next/server";
import { getServices } from "@/lib/services";
import { aggregateUnifiedSprints, computeSprintSummary } from "@/lib/unified-sprint-aggregation";

export async function GET() {
  try {
    const { config } = await getServices();

    const sprints = await aggregateUnifiedSprints(config);
    const summary = computeSprintSummary(sprints);

    return NextResponse.json({ sprints, summary });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
