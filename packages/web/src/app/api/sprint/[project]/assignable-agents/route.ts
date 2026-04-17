import { NextResponse } from "next/server";
import { getServices } from "@/lib/services";
import {
  getAgentRegistry,
  getSessionsDir,
  getAssignableAgents,
  checkCapacity,
} from "@composio/ao-core";

export async function GET(request: Request, { params }: { params: Promise<{ project: string }> }) {
  try {
    const { project: projectId } = await params;
    const { config, sessionManager } = await getServices();

    const project = config.projects[projectId];
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    // Build agent registry for this project
    const sessionsDir = getSessionsDir(config.configPath, project.path);
    const registry = getAgentRegistry(sessionsDir, config);

    // Get assignable agents (local + pool)
    const agents = await getAssignableAgents(projectId, config, sessionManager, registry);

    return NextResponse.json({
      agents: agents.map((a) => {
        const capacity = checkCapacity(a.agentId, a.currentWorkload, config, a.projectId);
        return {
          agentId: a.agentId,
          projectId: a.projectId,
          sourceProjectId: a.sourceProjectId ?? null,
          isPoolAgent: a.isPoolAgent,
          currentWorkload: a.currentWorkload,
          capacityStatus: {
            maxCapacity: capacity.maxCapacity,
            availableSlots: capacity.availableSlots,
            isAtCapacity: capacity.isAtCapacity,
            isNearCapacity: capacity.isNearCapacity,
            utilizationPercent: capacity.utilizationPercent,
          },
        };
      }),
      summary: {
        total: agents.length,
        local: agents.filter((a) => !a.isPoolAgent).length,
        pool: agents.filter((a) => a.isPoolAgent).length,
      },
    });
  } catch {
    return NextResponse.json({ error: "Failed to fetch assignable agents" }, { status: 500 });
  }
}
