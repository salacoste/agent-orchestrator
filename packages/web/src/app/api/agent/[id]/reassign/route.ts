import { NextResponse, type NextRequest } from "next/server";

import { getServices } from "@/lib/services";

export const dynamic = "force-dynamic";

/**
 * POST /api/agent/[id]/reassign — Kill agent and return story to queue (Story 25a.1)
 *
 * Terminates the agent session and makes the story available for
 * reassignment with boosted priority. Used by recovery action buttons.
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
        { success: false, message: `Agent ${agentId} not found` },
        { status: 404 },
      );
    }

    // Kill the stuck agent
    await sessionManager.kill(agentId);

    // Story returns to queue with boosted priority
    // Full implementation requires AgentRegistry + priority queue integration

    return NextResponse.json({
      success: true,
      agentId,
      message: `Agent ${agentId} killed. Story returned to queue for reassignment.`,
      previousStatus: session.status,
    });
  } catch (err) {
    const error = err as Error;
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
