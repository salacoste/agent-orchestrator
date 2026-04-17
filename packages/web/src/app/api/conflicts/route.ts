/**
 * GET /api/conflicts
 * List all resource conflicts detected across projects.
 *
 * Query params (optional):
 * - resourceType: filter by resource type (repository | file-path | agent | external-service)
 * - projectId: filter to conflicts involving a specific project
 *
 * Returns: { conflicts: ResourceConflict[], lastScanAt: string, scanDurationMs: number }
 */

import { NextResponse } from "next/server";
import { getServices } from "@/lib/services";
import {
  checkResourceConflicts,
  createResourceConflictStore,
  type ResourceConflictType,
} from "@composio/ao-core";

export async function GET(request: Request) {
  try {
    const { config } = await getServices();

    // Run detection, persist to store, append audit trail
    const store = createResourceConflictStore(config.configPath);
    const result = checkResourceConflicts(config, store);

    // Apply optional filters from query params
    const url = new URL(request.url);
    const resourceType = url.searchParams.get("resourceType") as string | null;
    const projectId = url.searchParams.get("projectId") as string | null;

    const filtered = store.list({
      resourceType: (resourceType as ResourceConflictType | undefined) ?? undefined,
      projectId: projectId ?? undefined,
    });

    return NextResponse.json({
      conflicts: filtered,
      lastScanAt: new Date().toISOString(),
      scanDurationMs: result.scanDurationMs,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to list resource conflicts" },
      { status: 500 },
    );
  }
}
