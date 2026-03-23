/**
 * ROI API route (Story 45.4).
 *
 * GET /api/sprint/roi — returns agent value / ROI calculation.
 * Optional query params: hoursPerStory, hourlyRate, pricePerMillionTokens
 */
import { NextResponse } from "next/server";
import { calculateROI } from "@composio/ao-core";
import { getServices } from "@/lib/services";

/** Parse a query param as a positive number, or return undefined. */
function parsePositive(value: string | null): number | undefined {
  if (!value) return undefined;
  const n = parseFloat(value);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

export async function GET(request: Request) {
  try {
    const { sessionManager } = await getServices();
    const url = new URL(request.url);

    // Optional rate overrides via query params (positive numbers only)
    const hoursPerStory = parsePositive(url.searchParams.get("hoursPerStory"));
    const hourlyRate = parsePositive(url.searchParams.get("hourlyRate"));
    const pricePerMillionTokens = parsePositive(url.searchParams.get("pricePerMillionTokens"));

    // Aggregate from completed sessions only — running session tokens
    // should not inflate cost-per-story or deflate ROI ratio
    let totalTokens = 0;
    let storiesCompleted = 0;

    try {
      const sessions = sessionManager.list();
      for (const s of sessions) {
        if (s.status === "completed") {
          storiesCompleted++;
          const cost = s.agentInfo?.cost;
          if (cost) {
            totalTokens += (cost.inputTokens ?? 0) + (cost.outputTokens ?? 0);
          }
        }
      }
    } catch {
      // Session manager may not be available — non-fatal
    }

    const report = calculateROI(storiesCompleted, totalTokens, {
      ...(hoursPerStory !== undefined ? { hoursPerStory } : {}),
      ...(hourlyRate !== undefined ? { hourlyRate } : {}),
      ...(pricePerMillionTokens !== undefined ? { pricePerMillionTokens } : {}),
    });

    return NextResponse.json(report);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to calculate ROI" },
      { status: 500 },
    );
  }
}
