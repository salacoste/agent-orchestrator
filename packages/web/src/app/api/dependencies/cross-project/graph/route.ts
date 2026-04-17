import { NextResponse } from "next/server";
import { getServices } from "@/lib/services";
import {
  createCrossProjectDepStore,
  resolveAllDependencyStatuses,
  buildCrossProjectGraph,
} from "@composio/ao-core";
import { buildSprintDataMap } from "@/lib/sprint-data-map";

/**
 * GET /api/dependencies/cross-project/graph — Cross-project dependency graph.
 * Returns graph structure with nodes (stories), edges (dependencies), and project groups.
 */
export async function GET() {
  try {
    const { config } = await getServices();
    const store = createCrossProjectDepStore(config.configPath);
    const allDeps = store.list();

    if (allDeps.length === 0) {
      return NextResponse.json({
        graph: { nodes: [], edges: [], projectGroups: {} },
      });
    }

    const sprintDataMap = await buildSprintDataMap(config);
    const enriched = resolveAllDependencyStatuses(allDeps, sprintDataMap);

    // Build project name map from config
    const projectNames: Record<string, string> = {};
    for (const [id, project] of Object.entries(config.projects)) {
      projectNames[id] = project.name ?? id;
    }

    const graph = buildCrossProjectGraph(enriched, projectNames, sprintDataMap);
    return NextResponse.json({ graph });
  } catch {
    return NextResponse.json(
      { error: "Failed to build cross-project dependency graph" },
      { status: 500 },
    );
  }
}
