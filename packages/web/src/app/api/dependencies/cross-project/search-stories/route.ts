/**
 * GET /api/dependencies/cross-project/search-stories — Search stories across projects.
 * Query params: ?q=<query> (required)
 */
import { type NextRequest, NextResponse } from "next/server";
import { getServices } from "@/lib/services";
import { searchCrossProjectStories } from "@composio/ao-core";

export async function GET(request: NextRequest) {
  try {
    const { config } = await getServices();
    const { searchParams } = new URL(request.url);
    const query = searchParams.get("q") ?? "";

    if (!query) {
      return NextResponse.json({ error: "Missing required query parameter: q" }, { status: 400 });
    }

    // Build SprintDataMap by reading sprint status for all projects
    const tracker = await import("@composio/ao-plugin-tracker-bmad");
    const sprintData: Record<string, { development_status: Record<string, string> }> = {};
    for (const [projectId, project] of Object.entries(config.projects)) {
      try {
        const status = tracker.readSprintStatus(project);
        if (status?.development_status) {
          // Flatten SprintStatusEntry objects to simple string status values
          const flat: Record<string, string> = {};
          for (const [key, val] of Object.entries(status.development_status)) {
            flat[key] =
              typeof val === "string" ? val : ((val as { status?: string }).status ?? "unknown");
          }
          sprintData[projectId] = {
            development_status: flat,
          };
        }
      } catch {
        // Individual project may not have sprint status
      }
    }

    const results = searchCrossProjectStories(config, sprintData, query);
    return NextResponse.json({ stories: results });
  } catch {
    return NextResponse.json({ error: "Failed to search cross-project stories" }, { status: 500 });
  }
}
