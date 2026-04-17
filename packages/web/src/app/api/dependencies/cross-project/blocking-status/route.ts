/**
 * GET /api/dependencies/cross-project/blocking-status — Blocking status for cross-project deps.
 *
 * Returns blocking alerts for deps that have been blocking beyond threshold.
 * Query params: ?threshold=3600000 (optional override in milliseconds)
 *
 * Story 51.5: Dependency Blocking Notifications
 */

import { type NextRequest, NextResponse } from "next/server";
import { getServices } from "@/lib/services";
import {
  createCrossProjectDepStore,
  createBlockingTimesStore,
  DEFAULT_BLOCKING_THRESHOLD_MS,
} from "@composio/ao-core";
import { buildSprintDataMap } from "@/lib/sprint-data-map";

export async function GET(request: NextRequest) {
  try {
    const { config } = await getServices();
    const depStore = createCrossProjectDepStore(config.configPath);
    const blockingStore = createBlockingTimesStore(config.configPath);

    // Optional threshold override
    const { searchParams } = new URL(request.url);
    const thresholdParam = searchParams.get("threshold");
    const thresholdMs = thresholdParam
      ? parseInt(thresholdParam, 10)
      : DEFAULT_BLOCKING_THRESHOLD_MS;

    if (isNaN(thresholdMs) || thresholdMs < 1) {
      return NextResponse.json(
        { error: "Invalid threshold parameter — must be a positive integer (ms), minimum 1" },
        { status: 400 },
      );
    }

    // Fetch all deps
    const deps = depStore.list();
    if (deps.length === 0) {
      return NextResponse.json({
        alerts: [],
        blockingThresholdMs: thresholdMs,
        totalBlocked: 0,
      });
    }

    // Build sprint data and compute blocking status
    const sprintDataMap = await buildSprintDataMap(config);
    const { alerts } = blockingStore.refresh(deps, sprintDataMap, thresholdMs);

    return NextResponse.json({
      alerts,
      blockingThresholdMs: thresholdMs,
      totalBlocked: alerts.filter((a) => a.thresholdExceeded).length,
    });
  } catch {
    return NextResponse.json({ error: "Failed to retrieve blocking status" }, { status: 500 });
  }
}
