import { NextResponse } from "next/server";

import { getServices } from "@/lib/services";
import { getLearningStore } from "@composio/ao-core";
import { detectCrossSprintPatterns, analyzeFailures } from "@/lib/workflow/compound-learning";

export const dynamic = "force-dynamic";

/**
 * GET /api/learning — Learning insights summary (Story 39.4)
 *
 * Returns aggregated learning data from the core LearningStore,
 * wired through compound-learning analysis functions.
 * Always HTTP 200 (WD-FR31 pattern) — falls back to empty data.
 */
export async function GET(): Promise<Response> {
  try {
    // Ensure services are initialized (registers the learning store)
    await getServices();

    const store = getLearningStore();
    if (!store) {
      return emptyResponse("Learning store not initialized");
    }

    const allLearnings = store.list();
    if (allLearnings.length === 0) {
      return emptyResponse();
    }

    // Compute session stats
    const totalSessions = allLearnings.length;
    const completed = allLearnings.filter((l) => l.outcome === "completed").length;
    const failed = allLearnings.filter((l) => l.outcome === "failed").length;
    const successRate = Math.round((completed / totalSessions) * 100);
    const failureRate = Math.round((failed / totalSessions) * 100);

    // Run compound learning analysis with real data
    const errorCategories = allLearnings.flatMap((l) => l.errorCategories);
    const topPatterns = detectCrossSprintPatterns(errorCategories);

    const errors = allLearnings
      .filter((l) => l.errorCategories.length > 0)
      .flatMap((l) =>
        l.errorCategories.map((category) => ({
          category,
          // First modified file as example — undefined when no files recorded
          file: l.filesModified.length > 0 ? l.filesModified[0] : undefined,
        })),
      );
    const failureBreakdown = analyzeFailures(errors);

    // Recent learnings (newest first, limit 10)
    const recentLearnings = [...allLearnings]
      .sort((a, b) => b.capturedAt.localeCompare(a.capturedAt))
      .slice(0, 10)
      .map((l) => ({
        sessionId: l.sessionId,
        storyId: l.storyId,
        outcome: l.outcome,
        capturedAt: l.capturedAt,
        errorCategories: l.errorCategories,
      }));

    return NextResponse.json(
      {
        totalSessions,
        successRate,
        failureRate,
        topPatterns,
        failureBreakdown,
        recentLearnings,
        timestamp: new Date().toISOString(),
      },
      {
        status: 200,
        headers: { "Cache-Control": "no-cache, no-store, must-revalidate" },
      },
    );
  } catch {
    return emptyResponse("Learning data unavailable");
  }
}

/** Return empty learning response (graceful fallback). */
function emptyResponse(error?: string): Response {
  return NextResponse.json(
    {
      totalSessions: 0,
      successRate: 0,
      failureRate: 0,
      topPatterns: [],
      failureBreakdown: [],
      recentLearnings: [],
      timestamp: new Date().toISOString(),
      ...(error ? { error } : {}),
    },
    {
      status: 200,
      headers: { "Cache-Control": "no-cache, no-store, must-revalidate" },
    },
  );
}
