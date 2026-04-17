import { NextResponse } from "next/server";

import { getServices } from "@/lib/services";
import { checkCapacity } from "@composio/ao-core";

/**
 * GET /api/agent/[id]/capacity — Capacity status for a single agent (Story 50.6, Task 4.2)
 *
 * Returns the agent's current workload vs configured max capacity,
 * including utilization percentage and at/near-capacity flags.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  try {
    const { id: agentId } = await params;
    const { config, sessionManager } = await getServices();

    const sessions = await sessionManager.list();

    // Count sessions belonging to this agent
    const agentSessions = sessions.filter((s) => s.id === agentId);
    if (agentSessions.length === 0) {
      // Check if agent exists at all
      const session = await sessionManager.get(agentId);
      if (!session) {
        return NextResponse.json({ error: `Agent ${agentId} not found` }, { status: 404 });
      }
      // Agent exists but has 0 active sessions in the list — use its project for config
      const capacity = checkCapacity(agentId, 0, config, session.projectId);
      return NextResponse.json(capacity);
    }

    const currentWorkload = agentSessions.length;
    const projectId = agentSessions[0].projectId;
    const capacity = checkCapacity(agentId, currentWorkload, config, projectId);

    return NextResponse.json(capacity);
  } catch {
    return NextResponse.json({ error: "Failed to fetch agent capacity" }, { status: 500 });
  }
}
