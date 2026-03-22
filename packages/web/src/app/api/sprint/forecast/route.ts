import { NextResponse } from "next/server";

import { getServices } from "@/lib/services";
import { getLearningStore, computeForecast, type BacklogStory } from "@composio/ao-core";

export const dynamic = "force-dynamic";

/**
 * GET /api/sprint/forecast — Sprint completion forecast (Story 43.2)
 *
 * Returns P50/P80/P95 completion estimates from historical data.
 */
export async function GET(): Promise<NextResponse> {
  try {
    await getServices();

    const store = getLearningStore();
    const learnings = store?.list() ?? [];

    // Count backlog stories from sessions (simplified — production would read sprint-status.yaml)
    const backlogStories: BacklogStory[] = [];
    const { sessionManager } = await getServices();
    const sessions = await sessionManager.list();

    for (const session of sessions) {
      if (session.status === "spawning" || session.status === "working") {
        backlogStories.push({
          storyId: session.issueId ?? session.id,
          domainTags: [], // Domain tags would come from story metadata
        });
      }
    }

    const forecast = computeForecast(backlogStories, learnings);

    return NextResponse.json(
      { forecast, timestamp: new Date().toISOString() },
      { status: 200, headers: { "Cache-Control": "no-cache, no-store, must-revalidate" } },
    );
  } catch {
    return NextResponse.json(
      { forecast: null, timestamp: new Date().toISOString() },
      { status: 200 },
    );
  }
}
