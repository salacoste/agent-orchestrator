import { type NextRequest, NextResponse } from "next/server";
import { getServices } from "@/lib/services";
import {
  createCrossProjectDepStore,
  validateDependencyReferences,
  resolveAllDependencyStatuses,
  getBlockedCrossProjectDeps,
  CircularDependencyError,
} from "@composio/ao-core";
import { buildSprintDataMap } from "@/lib/sprint-data-map";
import { notifyCrossProjectDepChange } from "@/lib/cross-project-dep-events";

/**
 * GET /api/dependencies/cross-project — List cross-project dependencies.
 * Query params: ?projectId=X&storyId=Y&status=blocked (optional filters)
 * Dependencies are enriched with target story status.
 */
export async function GET(request: NextRequest) {
  try {
    const { config } = await getServices();
    const store = createCrossProjectDepStore(config.configPath);
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get("projectId");
    const storyId = searchParams.get("storyId");
    const statusFilter = searchParams.get("status");

    // Get raw deps based on filters
    let deps;
    if (projectId && storyId) {
      deps = store.getForStory(projectId, storyId);
    } else if (projectId) {
      deps = store.list({ projectId });
    } else {
      deps = store.list();
    }

    // Build sprint data map for status enrichment
    const sprintDataMap = await buildSprintDataMap(config);

    // Apply status filter if requested
    if (statusFilter === "blocked") {
      const blocked = getBlockedCrossProjectDeps(deps, sprintDataMap);
      return NextResponse.json({ dependencies: blocked });
    }

    // Enrich all deps with status
    const enriched = resolveAllDependencyStatuses(deps, sprintDataMap);
    return NextResponse.json({ dependencies: enriched });
  } catch {
    return NextResponse.json(
      { error: "Failed to list cross-project dependencies" },
      { status: 500 },
    );
  }
}

/**
 * POST /api/dependencies/cross-project — Create a cross-project dependency.
 * Body: { sourceProjectId, sourceStoryId, targetProjectId, targetStoryId }
 */
export async function POST(request: NextRequest) {
  try {
    const { config } = await getServices();
    const body = await request.json();

    const { sourceProjectId, sourceStoryId, targetProjectId, targetStoryId } = body;
    if (!sourceProjectId || !sourceStoryId || !targetProjectId || !targetStoryId) {
      return NextResponse.json(
        {
          error:
            "Missing required fields: sourceProjectId, sourceStoryId, targetProjectId, targetStoryId",
        },
        { status: 400 },
      );
    }

    // Build sprint data for story-level validation
    const sprintData = await buildSprintDataMap(config);

    // Validate references (both project existence and story existence)
    const validation = validateDependencyReferences(
      config,
      sourceProjectId,
      sourceStoryId,
      targetProjectId,
      targetStoryId,
      sprintData,
    );
    if (!validation.valid) {
      return NextResponse.json(
        { error: "Validation failed", details: validation.errors },
        { status: 400 },
      );
    }

    const store = createCrossProjectDepStore(config.configPath);
    const dep = store.add({ sourceProjectId, sourceStoryId, targetProjectId, targetStoryId });

    // Notify SSE subscribers of cross-project dep change
    notifyCrossProjectDepChange({
      action: "created",
      depId: dep.id,
      timestamp: new Date().toISOString(),
    });

    return NextResponse.json({ dependency: dep }, { status: 201 });
  } catch (err) {
    if (err instanceof CircularDependencyError) {
      return NextResponse.json({ error: err.message, cyclePath: err.cyclePath }, { status: 422 });
    }
    const message = err instanceof Error ? err.message : "Failed to create dependency";
    if (message.includes("Duplicate")) {
      return NextResponse.json({ error: message }, { status: 409 });
    }
    return NextResponse.json({ error: "Failed to create dependency" }, { status: 500 });
  }
}

/**
 * DELETE /api/dependencies/cross-project — Remove a cross-project dependency.
 * Body: { depId }
 */
export async function DELETE(request: NextRequest) {
  try {
    const { config } = await getServices();
    const body = await request.json();
    const { depId } = body;

    if (!depId) {
      return NextResponse.json({ error: "Missing required field: depId" }, { status: 400 });
    }

    const store = createCrossProjectDepStore(config.configPath);
    const removed = store.remove(depId);
    if (!removed) {
      return NextResponse.json({ error: "Dependency not found" }, { status: 404 });
    }

    // Notify SSE subscribers of cross-project dep deletion
    notifyCrossProjectDepChange({
      action: "deleted",
      depId: removed.id,
      timestamp: new Date().toISOString(),
    });

    return NextResponse.json({ removed }, { status: 200 });
  } catch {
    return NextResponse.json({ error: "Failed to delete dependency" }, { status: 500 });
  }
}
