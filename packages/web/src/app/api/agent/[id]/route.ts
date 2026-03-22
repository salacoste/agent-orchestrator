import { NextResponse, type NextRequest } from "next/server";

import { getServices } from "@/lib/services";

export const dynamic = "force-dynamic";

/**
 * GET /api/agent/[id] — Get agent session data (Story 38.1)
 *
 * Queries SessionManager.get() for real session data including
 * status, assigned story, timestamps, and metadata.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  try {
    const { id: agentId } = await params;
    const { sessionManager } = await getServices();
    const session = await sessionManager.get(agentId);

    if (!session) {
      return NextResponse.json({ error: `Agent ${agentId} not found` }, { status: 404 });
    }

    return NextResponse.json({
      id: session.id,
      projectId: session.projectId,
      status: session.status,
      activity: session.activity,
      branch: session.branch,
      issueId: session.issueId,
      pr: session.pr
        ? { number: session.pr.number, url: session.pr.url, title: session.pr.title }
        : null,
      workspacePath: session.workspacePath,
      agentInfo: session.agentInfo,
      createdAt: session.createdAt.toISOString(),
      lastActivityAt: session.lastActivityAt.toISOString(),
      restoredAt: session.restoredAt?.toISOString() ?? null,
      metadata: {
        agent: session.metadata["agent"] ?? null,
        summary: session.metadata["summary"] ?? null,
        exitCode: session.metadata["exitCode"] ?? null,
        signal: session.metadata["signal"] ?? null,
        failureReason: session.metadata["failureReason"] ?? null,
      },
    });
  } catch (err) {
    const error = err as Error;
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
