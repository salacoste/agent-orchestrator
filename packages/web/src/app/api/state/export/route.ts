/**
 * State export API route (Story 46a.2).
 *
 * GET /api/state/export — returns full system state as JSON snapshot.
 */
import { NextResponse } from "next/server";
import { assembleSnapshot, type SessionExport } from "@composio/ao-core";
import { getServices } from "@/lib/services";

export async function GET() {
  try {
    const { sessionManager, learningStore, config } = await getServices();

    // Gather sessions
    const sessions: SessionExport[] = [];
    try {
      const allSessions = await sessionManager.list();
      for (const s of allSessions) {
        sessions.push({
          sessionId: s.id,
          status: s.status,
          projectId: s.projectId,
        });
      }
    } catch {
      // Non-fatal
    }

    // Gather learnings
    let learnings: Record<string, unknown>[] = [];
    try {
      learnings = (learningStore?.list() ?? []) as Record<string, unknown>[];
    } catch {
      // Non-fatal
    }

    // Gather sprint status from all projects
    let sprintStatus: Record<string, unknown> | null = null;
    try {
      const tracker = await import("@composio/ao-plugin-tracker-bmad");
      const allStatus: Record<string, unknown> = {};
      for (const [projectId, project] of Object.entries(config.projects)) {
        try {
          allStatus[projectId] = tracker.readSprintStatus(project);
        } catch {
          // Individual project may not have sprint status
        }
      }
      if (Object.keys(allStatus).length > 0) {
        sprintStatus = allStatus;
      }
    } catch {
      // Non-fatal
    }

    const snapshot = assembleSnapshot({
      sessions,
      learnings,
      sprintStatus,
      collaboration: null, // Collaboration JSONL not directly accessible from service layer
    });

    return NextResponse.json(snapshot);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to export state" },
      { status: 500 },
    );
  }
}
