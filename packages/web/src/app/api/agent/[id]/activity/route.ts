import { NextResponse, type NextRequest } from "next/server";

import { getServices } from "@/lib/services";
import { readAgentEvents } from "./read-events";

export const dynamic = "force-dynamic";

/**
 * GET /api/agent/[id]/activity — Get agent activity timeline (Story 38.2)
 *
 * Queries the JSONL event backup log for events matching this agent ID.
 * Falls back to empty array if no events found.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  try {
    const { id: agentId } = await params;
    const { sessionManager, config } = await getServices();

    // Verify agent exists
    const session = await sessionManager.get(agentId);
    if (!session) {
      return NextResponse.json({ error: `Agent ${agentId} not found` }, { status: 404 });
    }

    // Parse limit from query params (default 100)
    const url = new URL(request.url);
    const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "100", 10), 500);

    // Read events from JSONL backup log
    const events = await readAgentEvents(agentId, config.configPath, limit);

    return NextResponse.json({ events });
  } catch (err) {
    const error = err as Error;
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
