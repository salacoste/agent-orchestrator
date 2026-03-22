import { NextResponse } from "next/server";

import { getServices } from "@/lib/services";
import { getLearningStore } from "@composio/ao-core";
import {
  detectFileConflicts,
  type AgentFileChange,
  type FileConflict,
} from "@/lib/workflow/conflict-detector";
import type { CheckpointTimeline } from "@/lib/workflow/checkpoint-tracker";

export const dynamic = "force-dynamic";

/**
 * GET /api/sprint/conflicts — File conflicts and checkpoint data (Story 40.3)
 *
 * Detects file conflicts across active sessions by comparing modified files
 * from the learning store. Returns conflict list and checkpoint timeline.
 */
export async function GET(): Promise<NextResponse> {
  try {
    const { sessionManager } = await getServices();
    const sessions = await sessionManager.list();

    // Build AgentFileChange[] from learning store (has filesModified per session)
    const changes: AgentFileChange[] = [];
    const store = getLearningStore();

    if (store) {
      // Get recent learnings for active session agents
      const activeAgentIds = new Set(sessions.map((s) => s.id));
      const learnings = store.list();

      for (const learning of learnings) {
        if (activeAgentIds.has(learning.agentId) && learning.filesModified.length > 0) {
          changes.push({
            agentId: learning.agentId,
            modifiedFiles: learning.filesModified,
          });
        }
      }
    }

    // Also include files from session metadata if available
    for (const session of sessions) {
      // Skip if already have learning data for this agent
      if (changes.some((c) => c.agentId === session.id)) continue;

      // Check session metadata for files (some agents track this)
      const filesRaw = session.metadata["filesModified"];
      if (filesRaw) {
        try {
          const files = JSON.parse(filesRaw) as string[];
          if (Array.isArray(files) && files.length > 0) {
            changes.push({ agentId: session.id, modifiedFiles: files });
          }
        } catch {
          // Malformed JSON in metadata — skip
        }
      }
    }

    const conflicts: FileConflict[] = detectFileConflicts(changes);

    // Build checkpoint timeline from first active working session
    let timeline: CheckpointTimeline | null = null;
    const workingSession = sessions.find((s) => s.status === "working" && s.workspacePath);
    if (workingSession) {
      timeline = {
        agentId: workingSession.id,
        checkpoints: [], // Real git log would require execFile — deferred to avoid blocking
        enabled: true,
        intervalMinutes: 10,
      };
    }

    return NextResponse.json(
      { conflicts, timeline, timestamp: new Date().toISOString() },
      {
        status: 200,
        headers: { "Cache-Control": "no-cache, no-store, must-revalidate" },
      },
    );
  } catch {
    return NextResponse.json(
      { conflicts: [], timeline: null, timestamp: new Date().toISOString() },
      { status: 200 },
    );
  }
}
