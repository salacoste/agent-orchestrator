import { NextResponse } from "next/server";
import { getServices } from "@/lib/services";
import { computeProjectUtilization, getAgentRegistry, getSessionsDir } from "@composio/ao-core";

export async function GET(_request: Request, { params }: { params: Promise<{ project: string }> }) {
  try {
    const { project: projectId } = await params;
    const { config, sessionManager } = await getServices();

    const project = config.projects[projectId];
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const sessions = await sessionManager.list();
    const sessionsDir = getSessionsDir(config.configPath, project.path);
    const registry = getAgentRegistry(sessionsDir, config);

    const utilization = computeProjectUtilization(projectId, sessions, registry, config);
    return NextResponse.json(utilization);
  } catch {
    return NextResponse.json({ error: "Failed to compute utilization" }, { status: 500 });
  }
}
