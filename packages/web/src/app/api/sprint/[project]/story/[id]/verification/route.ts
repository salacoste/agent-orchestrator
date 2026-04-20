/**
 * GET /api/sprint/[project]/story/[id]/verification
 *
 * Returns the latest verification result for a story (if any).
 * Story 61-3, AC #6.
 */

import { NextResponse } from "next/server";
import { getServices } from "@/lib/services";
import { loadVerificationResult, getSessionsDir, type VerificationResult } from "@composio/ao-core";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ project: string; id: string }> },
) {
  try {
    const { project: projectId, id: storyId } = await params;
    const { config, registry } = await getServices();

    const project = config.projects[projectId];
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    // Find the session (agent) assigned to this story
    // Note: only active assignments are tracked; completed stories return null
    const assignment = registry.getByStory(storyId);
    if (!assignment) {
      // No active session for this story — return null verification (may be completed or non-existent)
      return NextResponse.json(
        { verification: null, storyId, project: projectId },
        {
          headers: {
            "Cache-Control": "no-cache, no-store, must-revalidate",
          },
        },
      );
    }

    // Load verification result from session metadata
    const sessionsDir = getSessionsDir(config.configPath, project.path);
    const verification: VerificationResult | null = loadVerificationResult(
      sessionsDir,
      assignment.agentId,
    );

    return NextResponse.json(
      { verification, storyId, project: projectId },
      {
        headers: {
          "Cache-Control": "no-cache, no-store, must-revalidate",
        },
      },
    );
  } catch (err) {
    // Non-fatal: return error response instead of crashing
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
