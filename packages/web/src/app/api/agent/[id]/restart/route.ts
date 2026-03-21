import { NextResponse, type NextRequest } from "next/server";

import { getServices } from "@/lib/services";

export const dynamic = "force-dynamic";

/**
 * POST /api/agent/[id]/restart — Kill and respawn agent with context (Story 25a.1)
 *
 * Terminates the current session and spawns a new one, preserving the
 * story context and accumulated work. Used by recovery action buttons.
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

    // Kill the stuck session
    await sessionManager.kill(agentId);

    // Respawn with same config (story context preserved via metadata)
    // Full respawn implementation requires reading session metadata
    // and passing it to spawn() — deferred to full SessionManager integration

    return NextResponse.json({
      success: true,
      agentId,
      message: `Agent ${agentId} killed. Respawn with context pending full SessionManager integration.`,
      previousStatus: session.status,
    });
  } catch (err) {
    const error = err as Error;
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
