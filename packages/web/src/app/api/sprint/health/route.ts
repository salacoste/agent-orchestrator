import { NextResponse } from "next/server";

import { getServices } from "@/lib/services";
import { computeSprintHealth } from "@/lib/workflow/cost-tracker";

export const dynamic = "force-dynamic";

/**
 * GET /api/sprint/health — Sprint health score (Story 44.4)
 */
export async function GET(): Promise<NextResponse> {
  try {
    const { sessionManager } = await getServices();
    const sessions = await sessionManager.list();

    const total = sessions.length;
    const done = sessions.filter((s) => s.status === "merged" || s.status === "cleanup").length;
    const blocked = sessions.filter((s) => s.status === "blocked").length;
    const failed = sessions.filter(
      (s) => s.status === "ci_failed" || s.status === "changes_requested",
    ).length;
    const failureRate = total > 0 ? failed / total : 0;

    const health = computeSprintHealth(done, total, blocked, failureRate, 0, 0);

    return NextResponse.json(
      { health, timestamp: new Date().toISOString() },
      { status: 200, headers: { "Cache-Control": "no-cache, no-store, must-revalidate" } },
    );
  } catch {
    return NextResponse.json(
      { health: null, timestamp: new Date().toISOString() },
      { status: 200 },
    );
  }
}
