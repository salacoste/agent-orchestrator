/**
 * GET /api/conflicts/policies/[resourceType]
 * Get the effective conflict resolution policy for a specific resource type.
 *
 * Query params (optional):
 * - projectId: resolve project-level overrides for a specific project
 *
 * PUT /api/conflicts/policies/[resourceType]
 * Validate and apply a policy update for a specific resource type.
 * Persists the change to the in-memory config (YAML write-back requires config
 * persistence infrastructure — tracked as follow-up task).
 * Body: { resolutionMode, priorityOrder?, isolationConfig?, projectId? }
 *
 * Returns: { policy: ResourceConflictPolicy }
 */

import { NextResponse } from "next/server";
import { getServices } from "@/lib/services";
import {
  resolvePolicyForResource,
  type ResourceConflictType,
  type ResourceConflictPolicy,
  type OrchestratorConfig,
} from "@composio/ao-core";

const VALID_RESOURCE_TYPES: ReadonlySet<string> = new Set<string>([
  "repository",
  "file-path",
  "agent",
  "external-service",
]);

interface RouteContext {
  params: Promise<{ resourceType: string }>;
}

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { resourceType } = await context.params;

    if (!VALID_RESOURCE_TYPES.has(resourceType)) {
      return NextResponse.json(
        { error: `Invalid resource type: ${resourceType}` },
        { status: 400 },
      );
    }

    const { config } = await getServices();

    const url = new URL(_request.url);
    const projectId = url.searchParams.get("projectId") ?? undefined;

    const policy = resolvePolicyForResource(
      resourceType as ResourceConflictType,
      config,
      projectId,
    );

    return NextResponse.json({ policy });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to resolve policy" },
      { status: 500 },
    );
  }
}

export async function PUT(request: Request, context: RouteContext) {
  try {
    const { resourceType } = await context.params;

    if (!VALID_RESOURCE_TYPES.has(resourceType)) {
      return NextResponse.json(
        { error: `Invalid resource type: ${resourceType}` },
        { status: 400 },
      );
    }

    const body = (await request.json()) as {
      resolutionMode?: string;
      priorityOrder?: string[];
      isolationConfig?: { strategy: string };
      projectId?: string;
    };

    const { resolutionMode, priorityOrder, isolationConfig, projectId } = body;

    if (!resolutionMode || !["priority-based", "manual", "isolation"].includes(resolutionMode)) {
      return NextResponse.json(
        { error: "resolutionMode must be 'priority-based', 'manual', or 'isolation'" },
        { status: 400 },
      );
    }

    // Build the requested policy from the request body
    const requestedPolicy: ResourceConflictPolicy = {
      resourceType: resourceType as ResourceConflictType,
      resolutionMode: resolutionMode as ResourceConflictPolicy["resolutionMode"],
      priorityOrder,
      isolationConfig,
    };

    // Return the current effective policy alongside the requested change
    const { config } = await getServices();

    // Apply the policy change to in-memory config (scoped by projectId if provided)
    if (projectId && config.projects[projectId]) {
      const project = config.projects[projectId] as unknown as Record<string, unknown>;
      const cr = (project.conflictResolution ?? {}) as Record<string, unknown>;
      const policies = (cr.policies ?? {}) as Record<string, unknown>;
      policies[resourceType] = requestedPolicy;
      cr.policies = policies;
      cr.default = (cr.default as string) ?? resolutionMode;
      project.conflictResolution = cr;
    } else {
      if (!config.conflictResolution) {
        config.conflictResolution = {} as OrchestratorConfig["conflictResolution"];
      }
      (config.conflictResolution as Record<string, unknown>).default = resolutionMode;
    }

    const effective = resolvePolicyForResource(
      resourceType as ResourceConflictType,
      config,
      projectId,
    );

    return NextResponse.json({
      policy: requestedPolicy,
      effective,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update policy" },
      { status: 500 },
    );
  }
}
