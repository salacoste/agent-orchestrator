import { NextResponse } from "next/server";
import { getServices } from "@/lib/services";
import {
  computePoolUtilizationOverview,
  getAgentRegistry,
  getSessionsDir,
  getPoolProjects,
} from "@composio/ao-core";

export async function GET() {
  try {
    const { config, sessionManager } = await getServices();
    const sessions = await sessionManager.list();

    // Find a pool-enabled project for registry (pool config is shared)
    const poolProjectIds = getPoolProjects(config);
    const anyProject = Object.values(config.projects)[0];
    if (!anyProject) {
      return NextResponse.json({ error: "No projects configured" }, { status: 404 });
    }

    // Use a pool project if available, otherwise fallback to first project
    const registryProject =
      (poolProjectIds.length > 0 ? config.projects[poolProjectIds[0]] : null) ?? anyProject;

    const sessionsDir = getSessionsDir(config.configPath, registryProject.path);
    const registry = getAgentRegistry(sessionsDir, config);

    const overview = computePoolUtilizationOverview(config, sessions, registry);
    if (!overview) {
      return NextResponse.json({ enabled: false });
    }

    return NextResponse.json(overview);
  } catch {
    return NextResponse.json({ error: "Failed to compute pool utilization" }, { status: 500 });
  }
}
