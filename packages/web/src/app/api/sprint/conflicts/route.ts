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

    // Merge all learnings per agent into a single AgentFileChange with deduplicated files
    const agentFiles = new Map<string, Set<string>>();
    const activeAgentIds = new Set(sessions.map((s) => s.id));

    if (store) {
      const learnings = store.list();
      for (const learning of learnings) {
        if (activeAgentIds.has(learning.agentId) && learning.filesModified.length > 0) {
          const existing = agentFiles.get(learning.agentId) ?? new Set<string>();
          for (const f of learning.filesModified) existing.add(f);
          agentFiles.set(learning.agentId, existing);
        }
      }
    }

    // Also include files from session metadata if available
    for (const session of sessions) {
      // Skip if already have learning data for this agent
      if (agentFiles.has(session.id)) continue;

      // Check session metadata for files (some agents track this)
      const filesRaw = session.metadata["filesModified"];
      if (filesRaw) {
        try {
          const files = JSON.parse(filesRaw) as string[];
          if (Array.isArray(files) && files.length > 0) {
            agentFiles.set(session.id, new Set(files));
          }
        } catch {
          // Malformed JSON in metadata — skip
        }
      }
    }

    // Build changes array from merged per-agent file sets
    for (const [agentId, files] of agentFiles) {
      changes.push({ agentId, modifiedFiles: [...files] });
    }

    const conflicts: FileConflict[] = detectFileConflicts(changes);

    // Checkpoint timeline deferred — requires execFile("git", ["log"]) on worktrees.
    // Return null until implemented to avoid misleading "0 checkpoints" UI.
    const timeline: CheckpointTimeline | null = null;

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
