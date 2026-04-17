/**
 * GET /api/session/[id]/state — Read OMC execution state for a session.
 *
 * Returns structured state data (execution mode, active agents, active modes)
 * from the session's worktree `.omc/state/` directory and metadata keys.
 * Returns `exists: false` when the session lacks a workspace path.
 *
 * Epic 60, Story 60-7 (FR-D4-1, FR-D4-2).
 */

import { NextResponse, type NextRequest } from "next/server";
import { getServices } from "@/lib/services";
import { readSessionState, emptySessionState } from "@composio/ao-core/session-state";

export const dynamic = "force-dynamic";

const NO_CACHE_HEADERS = { "Cache-Control": "no-cache, no-store, must-revalidate" } as const;

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { sessionManager } = await getServices();

    const session = await sessionManager.get(id);
    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    // No workspace path → no state files possible
    if (!session.workspacePath) {
      return NextResponse.json(
        { sessionId: id, state: emptySessionState(), exists: false },
        { headers: NO_CACHE_HEADERS },
      );
    }

    // Best-effort state read — failures return empty state, not errors
    try {
      const state = await readSessionState(session.workspacePath, session.metadata);
      return NextResponse.json(
        { sessionId: id, state, exists: true },
        { headers: NO_CACHE_HEADERS },
      );
    } catch {
      return NextResponse.json(
        { sessionId: id, state: emptySessionState(), exists: false, readError: true },
        { headers: NO_CACHE_HEADERS },
      );
    }
  } catch (error) {
    console.error("Failed to read session state:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
