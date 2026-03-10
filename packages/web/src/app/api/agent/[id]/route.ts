import { NextResponse, type NextRequest } from "next/server";

export const dynamic = "force-dynamic";

/**
 * GET /api/agent/[id] — Get agent session data
 *
 * Returns agent information including status, assigned story, duration, and last activity.
 *
 * NOTE: This is a stub implementation. The actual implementation should:
 * - Query the agent registry for the agent by ID
 * - Return real agent data from the state manager
 * - Handle cases where agent doesn't exist (404)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  try {
    const { id: agentId } = await params;

    // TODO: Implement actual agent data fetching
    // - Query agent registry for agent by ID
    // - Get story assignment from state manager
    // - Calculate duration and last activity from metadata

    // Stub response for development
    return NextResponse.json({
      id: agentId,
      issueLabel: null,
      issueTitle: null,
      status: "unknown",
      activity: "unknown",
      blockReason: undefined,
      createdAt: new Date().toISOString(),
      lastActivityAt: new Date().toISOString(),
    });
  } catch (err) {
    const error = err as Error;
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
