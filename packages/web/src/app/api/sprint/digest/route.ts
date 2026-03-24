/**
 * Sprint digest API route (Story 44.7).
 *
 * GET /api/sprint/digest — returns on-demand digest content.
 */
import { NextResponse } from "next/server";
import { generateDigest, type DigestInput } from "@composio/ao-core";
import { readSprintStatus } from "@composio/ao-plugin-tracker-bmad";
import { getServices } from "@/lib/services";

export async function GET(request: Request) {
  try {
    const { config, sessionManager } = await getServices();
    const url = new URL(request.url);
    const since = url.searchParams.get("since"); // ISO 8601, for display

    // Gather sprint data from all projects
    let totalStories = 0;
    let doneStories = 0;
    const allDoneStories: string[] = [];
    const blockers: string[] = [];

    for (const [, project] of Object.entries(config.projects)) {
      try {
        const sprint = readSprintStatus(project);

        for (const [id, entry] of Object.entries(sprint.development_status)) {
          if (id.startsWith("epic-")) continue;
          const status = typeof entry.status === "string" ? entry.status : "backlog";
          totalStories++;
          if (status === "done") {
            doneStories++;
            allDoneStories.push(id);
          }
          if (status === "blocked") {
            blockers.push(id);
          }
        }
      } catch {
        // Project may not have sprint status — non-fatal
      }
    }

    // Without per-story transition timestamps, we report all done stories.
    // Callers can pass ?since= to indicate the time range for display purposes.
    // A future story can add event-log-based filtering for true "since last digest" behavior.
    const completedStories = allDoneStories;

    // Gather active agents from session manager
    const activeAgents: string[] = [];
    try {
      const sessions = await sessionManager.list();
      for (const s of sessions) {
        if (s.status === "working") {
          activeAgents.push(s.id);
        }
      }
    } catch {
      // Session manager may not be available — non-fatal
    }

    const input: DigestInput = {
      completedStories,
      activeAgents,
      blockers,
      totalStories,
      doneStories,
      ...(since ? { since } : {}),
    };

    const digest = generateDigest(input);

    return NextResponse.json(digest);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to generate digest" },
      { status: 500 },
    );
  }
}
