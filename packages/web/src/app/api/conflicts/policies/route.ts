/**
 * GET /api/conflicts/policies
 * List effective conflict resolution policies for all resource types.
 *
 * Query params (optional):
 * - projectId: resolve project-level overrides for a specific project
 *
 * Returns: { policies: Record<ResourceConflictType, ResourceConflictPolicy> }
 */

import { NextResponse } from "next/server";
import { getServices } from "@/lib/services";
import {
  resolvePolicyForResource,
  type ResourceConflictType,
  type ResourceConflictPolicy,
} from "@composio/ao-core";

const ALL_RESOURCE_TYPES: ResourceConflictType[] = [
  "repository",
  "file-path",
  "agent",
  "external-service",
];

export async function GET(request: Request) {
  try {
    const { config } = await getServices();

    const url = new URL(request.url);
    const projectId = url.searchParams.get("projectId") ?? undefined;

    const policies: Record<string, ResourceConflictPolicy> = {};
    for (const resourceType of ALL_RESOURCE_TYPES) {
      policies[resourceType] = resolvePolicyForResource(resourceType, config, projectId);
    }

    return NextResponse.json({ policies });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to resolve conflict policies" },
      { status: 500 },
    );
  }
}
