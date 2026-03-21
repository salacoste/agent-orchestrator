import { NextResponse } from "next/server";
import { createHealthCheckService, type HealthCheckConfig } from "@composio/ao-core";
import { getServices } from "@/lib/services";

export const dynamic = "force-dynamic";

/**
 * GET /api/health — System health check endpoint
 *
 * Returns JSON health status for all monitored components.
 * Always returns HTTP 200 (follows WD-FR31 pattern — never error for expected states).
 * Loads available services from the app's service singleton.
 */
export async function GET(): Promise<Response> {
  try {
    const healthConfig: HealthCheckConfig = {};

    // Load available services — graceful if services unavailable
    try {
      const { config } = await getServices();
      if (config.health) {
        healthConfig.checkIntervalMs = config.health.checkIntervalMs;
        healthConfig.alertOnTransition = config.health.alertOnTransition;
        if (config.health.thresholds) {
          healthConfig.thresholds = {
            maxLatencyMs: config.health.thresholds.maxLatencyMs,
            maxQueueDepth: config.health.thresholds.maxQueueDepth,
          };
        }
      }
    } catch {
      // Services unavailable — health check will report minimal status
    }

    const service = createHealthCheckService(healthConfig);
    const result = await service.check();

    return NextResponse.json(
      {
        overall: result.overall,
        components: result.components.map((c) => ({
          component: c.component,
          status: c.status,
          message: c.message,
          latencyMs: c.latencyMs,
          details: c.details,
        })),
        timestamp: result.timestamp.toISOString(),
        exitCode: result.exitCode,
      },
      {
        status: 200,
        headers: { "Cache-Control": "no-cache, no-store, must-revalidate" },
      },
    );
  } catch {
    // Even on error, return 200 with degraded status
    return NextResponse.json(
      {
        overall: "unhealthy",
        components: [],
        timestamp: new Date().toISOString(),
        exitCode: 1,
        error: "Health check service initialization failed",
      },
      {
        status: 200,
        headers: { "Cache-Control": "no-cache, no-store, must-revalidate" },
      },
    );
  }
}
