import { NextResponse } from "next/server";

import { getServices } from "@/lib/services";
import {
  computeSprintCost,
  computeSprintClock,
  type TokenUsage,
} from "@/lib/workflow/cost-tracker";

export const dynamic = "force-dynamic";

/** Default sprint duration: 14 days from generated date. */
const SPRINT_DURATION_MS = 14 * 24 * 60 * 60 * 1000;

/** Default average story duration for clock computation (2 hours). */
const DEFAULT_AVG_STORY_DURATION_MS = 2 * 60 * 60 * 1000;

/**
 * GET /api/sprint/cost — Sprint cost and clock data (Story 40.2)
 *
 * Queries active sessions for token usage, computes cost summary
 * and sprint clock from real data.
 */
export async function GET(): Promise<NextResponse> {
  try {
    const { sessionManager } = await getServices();
    const sessions = await sessionManager.list();

    // Map sessions with cost data to TokenUsage records
    const usages: TokenUsage[] = [];
    let storiesDone = 0;
    let storiesTotal = 0;

    for (const session of sessions) {
      const cost = session.agentInfo?.cost;
      if (cost) {
        const rawDuration = session.lastActivityAt.getTime() - session.createdAt.getTime();
        usages.push({
          agentId: session.id,
          storyId: session.issueId ?? undefined,
          tokensUsed: cost.inputTokens + cost.outputTokens,
          durationMs: Number.isFinite(rawDuration) ? Math.max(1, rawDuration) : 1,
          timestamp: session.lastActivityAt.toISOString(),
        });
      }

      // Count story progress for clock
      storiesTotal++;
      if (session.status === "merged" || session.status === "cleanup") {
        storiesDone++;
      }
    }

    // Compute cost summary
    const costSummary = computeSprintCost(usages);

    // Compute sprint clock — null when no sessions (no sprint to track)
    let clock = null;
    if (sessions.length > 0) {
      const earliestSession = sessions.reduce(
        (earliest, s) => (s.createdAt < earliest ? s.createdAt : earliest),
        new Date(),
      );
      const sprintEndDate = new Date(earliestSession.getTime() + SPRINT_DURATION_MS);
      clock = computeSprintClock(
        sprintEndDate,
        storiesDone,
        Math.max(storiesTotal, 1),
        DEFAULT_AVG_STORY_DURATION_MS,
      );
    }

    return NextResponse.json(
      { cost: costSummary, clock, timestamp: new Date().toISOString() },
      {
        status: 200,
        headers: { "Cache-Control": "no-cache, no-store, must-revalidate" },
      },
    );
  } catch {
    // Graceful fallback — panel shows "No data available"
    return NextResponse.json(
      { cost: null, clock: null, timestamp: new Date().toISOString() },
      { status: 200 },
    );
  }
}
