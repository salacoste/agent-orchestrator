import { NextResponse } from "next/server";

import { getSharedCascadeDetector } from "@/lib/workflow/cascade-detector-shared";

export const dynamic = "force-dynamic";

/**
 * POST /api/agent/cascade/resume — Resume from cascade pause (Story 40.1)
 *
 * Clears the shared cascade detector state so agents can be restarted.
 * NOTE: No authentication yet — gate this endpoint when auth is implemented,
 * as resume affects all agents simultaneously.
 */
export async function POST(): Promise<NextResponse> {
  try {
    const detector = getSharedCascadeDetector();
    const previousStatus = detector.getStatus();

    detector.resume();

    return NextResponse.json({
      success: true,
      previousFailureCount: previousStatus.failureCount,
      wasPaused: previousStatus.paused,
      message: "Cascade state cleared. Agents can be resumed.",
    });
  } catch (err) {
    const error = err as Error;
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
