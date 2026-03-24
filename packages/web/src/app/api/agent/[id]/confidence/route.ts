/**
 * Agent confidence API route (Story 45.6).
 *
 * GET /api/agent/{id}/confidence — returns per-file confidence indicators.
 */
import { NextResponse } from "next/server";
import { calculateConfidence, type ConfidenceInput } from "@composio/ao-core";
import { getServices } from "@/lib/services";

const VALID_ID = /^[a-zA-Z0-9_-]+$/;

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    if (!VALID_ID.test(id)) {
      return NextResponse.json({ error: "Invalid agent ID" }, { status: 400 });
    }

    const { learningStore } = await getServices();

    // Find most recent session learning for this agent
    // Store returns oldest-first, so fetch all and take last entry
    let input: ConfidenceInput = {
      retryCount: 0,
      errorCategories: [],
      filesModified: [],
    };

    try {
      const learnings = (learningStore?.query({ agentId: id }) ?? []) as Array<{
        retryCount: number;
        errorCategories: string[];
        filesModified: string[];
      }>;
      if (learnings.length > 0) {
        const latest = learnings[learnings.length - 1];
        input = {
          retryCount: latest.retryCount,
          errorCategories: latest.errorCategories,
          filesModified: latest.filesModified,
        };
      }
    } catch {
      // Non-fatal
    }

    const files = calculateConfidence(input);

    return NextResponse.json({ agentId: id, files });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to calculate confidence" },
      { status: 500 },
    );
  }
}
