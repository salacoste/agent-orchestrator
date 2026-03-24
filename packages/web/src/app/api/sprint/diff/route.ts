/**
 * Sprint diff API route (Story 45.8).
 *
 * GET /api/sprint/diff?a=<ISO>&b=<ISO> — compare two sprint periods.
 * Period A = sessions from `a` to `b`, Period B = sessions from `b` to now.
 */
import { NextResponse } from "next/server";
import { computeSprintDiff, type SessionLearning } from "@composio/ao-core";
import { getServices } from "@/lib/services";

export async function GET(request: Request) {
  try {
    const { learningStore } = await getServices();
    const url = new URL(request.url);
    const a = url.searchParams.get("a");
    const b = url.searchParams.get("b");

    if (!a || !b) {
      return NextResponse.json(
        { error: "Both ?a= and ?b= ISO timestamps are required" },
        { status: 400 },
      );
    }

    const aMs = new Date(a).getTime();
    const bMs = new Date(b).getTime();

    if (isNaN(aMs) || isNaN(bMs)) {
      return NextResponse.json({ error: "Invalid timestamp format" }, { status: 400 });
    }

    if (aMs >= bMs) {
      return NextResponse.json({ error: "Parameter 'a' must be before 'b'" }, { status: 400 });
    }

    // Fetch all learnings and split by period in a single pass
    let allLearnings: SessionLearning[] = [];
    try {
      allLearnings = (learningStore?.query({}) ?? []) as SessionLearning[];
    } catch {
      // Non-fatal
    }

    const periodA: SessionLearning[] = [];
    const periodB: SessionLearning[] = [];
    for (const s of allLearnings) {
      const t = new Date(s.completedAt).getTime();
      if (t >= aMs && t < bMs) periodA.push(s);
      else if (t >= bMs) periodB.push(s);
    }

    const diff = computeSprintDiff(periodA, periodB);

    return NextResponse.json(diff);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to compute sprint diff" },
      { status: 500 },
    );
  }
}
