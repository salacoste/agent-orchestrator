/**
 * GET /api/sprint/[project]/story/[id]/verification/retries
 *
 * Returns the retry history and current retry count for a story's verification.
 * Includes persistent re-queue state for persistent execution mode (Story 61-5).
 * Story 61-4, AC #6.
 */

import { NextResponse } from "next/server";
import { getServices } from "@/lib/services";
import {
  getSessionsDir,
  loadVerificationRetryHistory,
  getPersistentRequeueCount,
  getExecutionMode,
  type VerificationRetryAttempt,
} from "@composio/ao-core";

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
    const assignment = registry.getByStory(storyId);
    const maxAttempts = project.verification?.retry?.maxAttempts ?? 2;
    if (!assignment) {
      return NextResponse.json(
        { retries: [], retryCount: 0, maxAttempts, storyId, project: projectId },
        {
          headers: {
            "Cache-Control": "no-cache, no-store, must-revalidate",
          },
        },
      );
    }

    // Load retry history from session metadata
    const sessionsDir = getSessionsDir(config.configPath, project.path);
    const retries: VerificationRetryAttempt[] = loadVerificationRetryHistory(
      sessionsDir,
      assignment.agentId,
    );

    // Persistent re-queue state (Story 61-5)
    const executionMode = getExecutionMode(sessionsDir, assignment.agentId);
    const persistentRequeueCount =
      executionMode === "persistent"
        ? getPersistentRequeueCount(sessionsDir, assignment.agentId)
        : undefined;
    const persistentMaxRetries = project.verification?.persistent?.persistentMaxRetries ?? 5;

    return NextResponse.json(
      {
        retries,
        retryCount: retries.length,
        maxAttempts,
        storyId,
        project: projectId,
        persistentRequeueCount,
        persistentMaxRetries: executionMode === "persistent" ? persistentMaxRetries : undefined,
      },
      {
        headers: {
          "Cache-Control": "no-cache, no-store, must-revalidate",
        },
      },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
