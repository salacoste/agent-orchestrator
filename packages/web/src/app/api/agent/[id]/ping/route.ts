import { NextResponse, type NextRequest } from "next/server";

import { getServices } from "@/lib/services";

export const dynamic = "force-dynamic";

/**
 * POST /api/agent/[id]/ping — Check if an agent is alive (Story 25a.1)
 *
 * Checks agent session liveness and returns current status.
 * Used by the recovery action buttons in AgentSessionCard.
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

    return NextResponse.json({
      success: true,
      agentId,
      status: session.status,
      lastActivityAt: session.lastActivityAt ?? null,
      message: `Agent ${agentId} is ${session.status}`,
    });
  } catch (err) {
    const error = err as Error;
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
