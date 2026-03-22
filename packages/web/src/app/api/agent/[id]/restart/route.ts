import { NextResponse, type NextRequest } from "next/server";

import { getServices } from "@/lib/services";

export const dynamic = "force-dynamic";

/**
 * POST /api/agent/[id]/restart — Kill and respawn agent with context (Story 38.5)
 *
 * Full restart workflow:
 * 1. Get session metadata (story ID, branch, workspace)
 * 2. Kill the stuck session
 * 3. Respawn with same story context via sessionManager.restore()
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  try {
    const { id: agentId } = await params;
    const { sessionManager } = await getServices();
    const session = await sessionManager.get(agentId);

    if (!session) {
      return NextResponse.json(
        { success: false, error: `Agent ${agentId} not found` },
        { status: 404 },
      );
    }

    // Capture session context before killing
    const previousStatus = session.status;
    const storyId = session.issueId;
    const branch = session.branch;

    // Kill the stuck session
    await sessionManager.kill(agentId);

    // Attempt to respawn with same context via restore
    // restore() reads archived metadata and re-spawns with accumulated context
    let newSession = null;
    let respawnError: string | null = null;

    try {
      newSession = await sessionManager.restore(agentId);
    } catch (err) {
      // Respawn may fail if workspace is missing or other issues
      respawnError = err instanceof Error ? err.message : String(err);
    }

    if (newSession) {
      return NextResponse.json({
        success: true,
        agentId: newSession.id,
        previousAgentId: agentId,
        previousStatus,
        newStatus: newSession.status,
        storyId,
        branch,
        message: `Agent ${agentId} restarted as ${newSession.id}`,
      });
    }

    // Kill succeeded but respawn failed — report partial success
    return NextResponse.json({
      success: true,
      agentId,
      previousStatus,
      action: "killed",
      respawnFailed: true,
      respawnError,
      storyId,
      branch,
      message: `Agent ${agentId} terminated. Respawn failed: ${respawnError}. Use CLI: ao spawn --story ${storyId ?? "<storyId>"}`,
    });
  } catch (err) {
    const error = err as Error;
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
