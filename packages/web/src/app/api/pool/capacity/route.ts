import { NextResponse } from "next/server";
import { getServices } from "@/lib/services";
import { getPoolProjects, getCapacityStatus } from "@composio/ao-core";

/**
 * GET /api/pool/capacity — Capacity status for all pool agents (Story 50.6, Task 4.1)
 *
 * Returns per-agent capacity results and an aggregate summary across all
 * pool-enabled projects. Agents not in pool-enabled projects are excluded.
 */
export async function GET() {
  try {
    const { config, sessionManager } = await getServices();
    const poolProjectIds = getPoolProjects(config);

    if (poolProjectIds.length === 0) {
      const anyProject = Object.values(config.projects)[0];
      if (!anyProject) {
        return NextResponse.json({ error: "No projects configured" }, { status: 404 });
      }
      return NextResponse.json({ enabled: false });
    }

    const sessions = await sessionManager.list();

    // Build agent workload map: agentId → count of active sessions
    const workloadMap = new Map<string, number>();
    const agentProjectMap = new Map<string, string>();

    for (const session of sessions) {
      const aid = session.id;
      const current = workloadMap.get(aid) ?? 0;
      workloadMap.set(aid, current + 1);
      // Map agent to its project for per-project capacity resolution
      if (!agentProjectMap.has(aid)) {
        agentProjectMap.set(aid, session.projectId);
      }
    }

    const statusMap = getCapacityStatus(workloadMap, config, agentProjectMap);
    const agents = Array.from(statusMap.values());

    const summary = {
      total: agents.length,
      atCapacity: agents.filter((a) => a.isAtCapacity).length,
      nearCapacity: agents.filter((a) => a.isNearCapacity).length,
      available: agents.filter((a) => !a.isAtCapacity).length,
    };

    return NextResponse.json({ agents, summary });
  } catch {
    return NextResponse.json({ error: "Failed to compute pool capacity" }, { status: 500 });
  }
}
