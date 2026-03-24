/**
 * Agent reasoning trail API route (Story 45.7).
 *
 * GET /api/agent/{id}/reasoning — returns extracted decision logic.
 */
import { NextResponse } from "next/server";
import { extractReasoning, type ReasoningInput } from "@composio/ao-core";
import { getServices } from "@/lib/services";

const VALID_ID = /^[a-zA-Z0-9_-]+$/;

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    if (!VALID_ID.test(id)) {
      return NextResponse.json({ error: "Invalid agent ID" }, { status: 400 });
    }

    const { sessionManager, learningStore } = await getServices();

    // Get session summary
    let summary: string | null = null;
    try {
      const session = await sessionManager.get(id);
      summary = session?.agentInfo?.summary ?? null;
    } catch {
      // Non-fatal
    }

    // Get learning data (newest entry)
    let domainTags: string[] = [];
    let errorCategories: string[] = [];
    let filesModified: string[] = [];
    let retryCount = 0;

    try {
      const learnings = (learningStore?.query({ agentId: id }) ?? []) as Array<{
        domainTags: string[];
        errorCategories: string[];
        filesModified: string[];
        retryCount: number;
      }>;
      if (learnings.length > 0) {
        const latest = learnings[learnings.length - 1];
        domainTags = latest.domainTags;
        errorCategories = latest.errorCategories;
        filesModified = latest.filesModified;
        retryCount = latest.retryCount;
      }
    } catch {
      // Non-fatal
    }

    const input: ReasoningInput = {
      agentId: id,
      summary,
      domainTags,
      errorCategories,
      filesModified,
      retryCount,
    };

    const trail = extractReasoning(input);

    return NextResponse.json(trail);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to extract reasoning" },
      { status: 500 },
    );
  }
}
