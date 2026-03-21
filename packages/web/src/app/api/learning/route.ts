import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * GET /api/learning — Learning insights summary
 *
 * Returns aggregated learning data for dashboard panel.
 * Always HTTP 200 (WD-FR31 pattern).
 */
export async function GET(): Promise<Response> {
  try {
    // Learning store not yet wired to web services — return empty insights
    return NextResponse.json(
      {
        totalSessions: 0,
        successRate: 0,
        failureRate: 0,
        topPatterns: [],
        recentLearnings: [],
        timestamp: new Date().toISOString(),
      },
      {
        status: 200,
        headers: { "Cache-Control": "no-cache, no-store, must-revalidate" },
      },
    );
  } catch {
    return NextResponse.json(
      {
        totalSessions: 0,
        successRate: 0,
        failureRate: 0,
        topPatterns: [],
        recentLearnings: [],
        timestamp: new Date().toISOString(),
        error: "Learning data unavailable",
      },
      { status: 200 },
    );
  }
}
