import { NextResponse, type NextRequest } from "next/server";

export const dynamic = "force-dynamic";

/**
 * GET /api/agent/[id]/activity — Get agent activity timeline
 *
 * Returns the last 100 activity events for the agent session.
 *
 * NOTE: This is a stub implementation. The actual implementation should:
 * - Query the event log for events related to this agent
 * - Filter by agent ID and sort by timestamp (newest first)
 * - Return structured activity events with type, timestamp, and description
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } },
): Promise<NextResponse> {
  try {
    const { id: agentId } = params;

    // TODO: Implement actual activity data fetching
    // - Query event audit log (events.jsonl) for this agent
    // - Filter events where metadata.agentId === agentId
    // - Sort by timestamp descending (newest first)
    // - Transform to ActivityEvent format

    // Stub response for development
    return NextResponse.json({
      events: [
        {
          timestamp: new Date().toISOString(),
          type: "status",
          description: `Agent ${agentId} session started`,
        },
      ],
    });
  } catch (err) {
    const error = err as Error;
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
