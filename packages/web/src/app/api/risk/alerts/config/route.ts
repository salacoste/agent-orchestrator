/**
 * GET / PUT /api/risk/alerts/config — Manage risk alert configuration.
 *
 * GET returns the current configuration.
 * PUT accepts a partial or full RiskAlertConfig update.
 *
 * Story 56.5 Task 5.
 * NOTE: Configuration is in-memory only for this story.
 * Persistent YAML config integration is deferred to a future enhancement.
 */

import { NextResponse } from "next/server";
import { type RiskAlertConfig } from "@/lib/risk-alert-types";
import { getAlertConfig, updateAlertConfig } from "@/lib/risk-alert-config";

export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  return NextResponse.json(getAlertConfig());
}

export async function PUT(request: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Request body must be an object" }, { status: 400 });
  }

  const partial = body as Partial<RiskAlertConfig>;

  // Validate enabled flag if provided
  if (partial.enabled !== undefined && typeof partial.enabled !== "boolean") {
    return NextResponse.json({ error: "enabled must be a boolean" }, { status: 400 });
  }

  // Validate defaultThresholds if provided
  if (partial.defaultThresholds !== undefined) {
    if (!Array.isArray(partial.defaultThresholds)) {
      return NextResponse.json({ error: "defaultThresholds must be an array" }, { status: 400 });
    }
    for (const t of partial.defaultThresholds) {
      if (!t || typeof t !== "object") {
        return NextResponse.json({ error: "Each threshold must be an object" }, { status: 400 });
      }
      const threshold = t as unknown as Record<string, unknown>;
      if (
        typeof threshold.minScore !== "number" ||
        threshold.minScore < 0 ||
        threshold.minScore > 100
      ) {
        return NextResponse.json(
          { error: "threshold.minScore must be a number 0-100" },
          { status: 400 },
        );
      }
      if (typeof threshold.enabled !== "boolean") {
        return NextResponse.json({ error: "threshold.enabled must be a boolean" }, { status: 400 });
      }
    }
  }

  // Validate projectOverrides if provided
  if (partial.projectOverrides !== undefined) {
    if (typeof partial.projectOverrides !== "object" || partial.projectOverrides === null) {
      return NextResponse.json({ error: "projectOverrides must be an object" }, { status: 400 });
    }
  }

  // Apply updates
  return NextResponse.json(updateAlertConfig(partial));
}
