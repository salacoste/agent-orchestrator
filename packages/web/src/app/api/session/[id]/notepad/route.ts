/**
 * GET /api/session/[id]/notepad — Read notepad contents for a session.
 *
 * Returns structured notepad data (Priority, Working Memory, Manual sections)
 * from the session's worktree `.omc/notepad.md`. Returns `exists: false` when
 * the notepad hasn't been created yet or the session lacks a workspace path.
 *
 * Epic 60, Story 60-1 (FR-D1-1, FR-D1-3).
 */

import { NextResponse, type NextRequest } from "next/server";
import { getServices } from "@/lib/services";
import { readNotepad } from "@composio/ao-core";

export const dynamic = "force-dynamic";

const EMPTY_NOTEPAD = Object.freeze({ priority: "", working: "", manual: "" });

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { sessionManager } = await getServices();

    const session = await sessionManager.get(id);
    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    // No workspace path → no notepad possible
    if (!session.workspacePath) {
      return NextResponse.json({ sessionId: id, notepad: EMPTY_NOTEPAD, exists: false });
    }

    // Best-effort notepad read — failures return empty, not errors
    try {
      const notepad = await readNotepad(session.workspacePath);
      const exists =
        notepad.priority.trim() !== "" ||
        notepad.working.trim() !== "" ||
        notepad.manual.trim() !== "";
      return NextResponse.json({ sessionId: id, notepad, exists });
    } catch {
      return NextResponse.json({ sessionId: id, notepad: EMPTY_NOTEPAD, exists: false });
    }
  } catch (error) {
    console.error("Failed to read notepad:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
