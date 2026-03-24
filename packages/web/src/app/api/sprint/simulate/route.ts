/**
 * Sprint simulation API route (Story 48.2).
 *
 * GET /api/sprint/simulate?iterations=N — run Monte Carlo simulation.
 */
import { NextResponse } from "next/server";
import {
  simulateSprint,
  getSimulationColor,
  type SimStory,
  type SessionLearning,
} from "@composio/ao-core";
import { readSprintStatus } from "@composio/ao-plugin-tracker-bmad";
import { getServices } from "@/lib/services";

export async function GET(request: Request) {
  try {
    const { config, learningStore } = await getServices();
    const url = new URL(request.url);
    const iterations = Math.min(
      10000,
      Math.max(1, parseInt(url.searchParams.get("iterations") ?? "1000", 10)) || 1000,
    );

    // Gather learnings first — used for domain inference
    const learnings = (learningStore?.list?.() ?? []) as SessionLearning[];

    // Build domain lookup from historical learnings (storyId → domainTags)
    const domainByStory = new Map<string, string[]>();
    for (const l of learnings) {
      if (l.storyId && l.domainTags.length > 0) {
        domainByStory.set(l.storyId, l.domainTags);
      }
    }

    // Gather stories from sprint status with inferred domains
    const stories: SimStory[] = [];
    for (const [, project] of Object.entries(config.projects)) {
      try {
        const sprint = readSprintStatus(project);
        for (const [id, entry] of Object.entries(sprint.development_status)) {
          if (id.startsWith("epic-")) continue;
          const status = typeof entry.status === "string" ? entry.status : "backlog";
          if (status === "backlog" || status === "ready-for-dev" || status === "in-progress") {
            stories.push({ id, domainTags: domainByStory.get(id) ?? ["general"] });
          }
        }
      } catch {
        // Non-fatal
      }
    }

    const result = simulateSprint({ stories, learnings, iterations });
    const color = getSimulationColor(result.onTimeProbability);

    return NextResponse.json({ ...result, color });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Simulation failed" },
      { status: 500 },
    );
  }
}
