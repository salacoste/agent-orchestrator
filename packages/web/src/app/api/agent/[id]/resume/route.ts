import { NextResponse, type NextRequest } from "next/server";

import { getServices } from "@/lib/services";

export const dynamic = "force-dynamic";

/**
 * POST /api/agent/[id]/resume — Resume a blocked agent (Story 38.4)
 *
 * Full resume workflow:
 * 1. Verify agent exists and is in a blocked/resumable state
 * 2. Call sessionManager.restore() to restart the agent with context
 * 3. Return the new session info
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id: agentId } = await params;

  try {
    const { sessionManager } = await getServices();

    // Verify agent exists
    const session = await sessionManager.get(agentId);
    if (!session) {
      return NextResponse.json(
        { success: false, error: `Agent ${agentId} not found` },
        { status: 404 },
      );
    }

    // Check if agent is in a resumable state
    const resumableStatuses = new Set(["blocked", "ci_failed", "changes_requested"]);
    if (!resumableStatuses.has(session.status)) {
      return NextResponse.json(
        {
          success: false,
          error: `Agent ${agentId} is in status '${session.status}' which is not resumable`,
          currentStatus: session.status,
        },
        { status: 409 },
      );
    }

    // Parse optional user message from request body
    let userMessage: string | undefined;
    try {
      const body = (await request.json()) as { message?: string };
      userMessage = body.message;
    } catch {
      // No body or invalid JSON — proceed without message
    }

    // Restore the session (re-spawns with accumulated context)
    const restoredSession = await sessionManager.restore(agentId);

    // If a user message was provided, send it to the restored session
    if (userMessage && restoredSession) {
      try {
        await sessionManager.send(restoredSession.id, userMessage);
      } catch {
        // Message send failure is non-fatal — session was still restored
      }
    }

    return NextResponse.json({
      success: true,
      agentId: restoredSession.id,
      previousStatus: session.status,
      newStatus: restoredSession.status,
      message: `Agent ${agentId} resumed successfully`,
    });
  } catch (err) {
    const error = err as Error;

    // Handle specific error types from session manager
    if (error.message.includes("not restorable") || error.message.includes("Not restorable")) {
      return NextResponse.json({ success: false, error: error.message }, { status: 409 });
    }
    if (error.message.includes("Workspace missing") || error.message.includes("workspace")) {
      return NextResponse.json(
        { success: false, error: `Workspace missing for agent ${agentId}: ${error.message}` },
        { status: 422 },
      );
    }

    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
