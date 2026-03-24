/**
 * Standup summary API route (Story 45.5).
 *
 * GET /api/sprint/standup — returns daily standup summary.
 * Optional query param: ?hours=N (default: 24)
 */
import { NextResponse } from "next/server";
import { generateStandup, type StandupInput } from "@composio/ao-core";
import { readSprintStatus } from "@composio/ao-plugin-tracker-bmad";
import { getServices } from "@/lib/services";

export async function GET(request: Request) {
  try {
    const { config, sessionManager, learningStore } = await getServices();
    const url = new URL(request.url);
    const hours = Math.max(1, parseInt(url.searchParams.get("hours") ?? "24", 10)) || 24;
    const sinceMs = hours * 60 * 60 * 1000;

    const inProgressStories: string[] = [];
    const blockers: string[] = [];
    const activeAgents: string[] = [];

    // Gather in-progress and blocked from sprint status
    for (const [, project] of Object.entries(config.projects)) {
      try {
        const sprint = readSprintStatus(project);

        for (const [id, entry] of Object.entries(sprint.development_status)) {
          if (id.startsWith("epic-")) continue;
          const status = typeof entry.status === "string" ? entry.status : "backlog";
          if (status === "in-progress") inProgressStories.push(id);
          else if (status === "blocked") blockers.push(id);
        }
      } catch {
        // Non-fatal
      }
    }

    // Recently completed stories from learning store (time-filtered)
    const completedStories: string[] = [];
    try {
      const recent = (learningStore?.query({ outcome: "completed", sinceMs }) ?? []) as Array<{
        storyId?: string;
      }>;
      for (const entry of recent) {
        if (entry.storyId && !completedStories.includes(entry.storyId)) {
          completedStories.push(entry.storyId);
        }
      }
    } catch {
      // Non-fatal — learning store may not be available
    }

    // Gather active agents from sessions
    try {
      const sessions = await sessionManager.list();
      for (const s of sessions) {
        if (s.status === "working") activeAgents.push(s.id);
      }
    } catch {
      // Non-fatal
    }

    const input: StandupInput = {
      completedStories,
      inProgressStories,
      blockers,
      activeAgents,
      timeWindowHours: hours,
    };

    const summary = generateStandup(input);

    return NextResponse.json(summary);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to generate standup" },
      { status: 500 },
    );
  }
}
