/**
 * Post-mortem API route (Story 45.3).
 *
 * GET /api/sprint/postmortem — returns auto-generated failure analysis report.
 */
import { NextResponse } from "next/server";
import { generatePostMortem, type SessionLearning } from "@composio/ao-core";
import { getServices } from "@/lib/services";

export async function GET() {
  try {
    const { learningStore } = await getServices();

    // Query all non-successful sessions
    const failures: SessionLearning[] = [];
    try {
      const failed = (learningStore?.query({ outcome: "failed" }) ?? []) as SessionLearning[];
      const blocked = (learningStore?.query({ outcome: "blocked" }) ?? []) as SessionLearning[];
      const abandoned = (learningStore?.query({ outcome: "abandoned" }) ?? []) as SessionLearning[];
      failures.push(...failed, ...blocked, ...abandoned);
    } catch {
      // Learning store may not be available — non-fatal
    }

    const report = generatePostMortem(failures);

    return NextResponse.json(report);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to generate post-mortem" },
      { status: 500 },
    );
  }
}
