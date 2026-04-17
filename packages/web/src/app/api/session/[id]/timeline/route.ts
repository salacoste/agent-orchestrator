/**
 * GET /api/session/[id]/timeline — Agent activity timeline for a session.
 *
 * Returns timeline entries parsed from OMC replay trace JSONL.
 * Supports query-param filtering: ?agent=, ?tool=, ?from=, ?to=.
 *
 * Epic 60, Story 60-3 (FR-D2-1, FR-D2-3).
 */

import { NextResponse, type NextRequest } from "next/server";
import { getServices } from "@/lib/services";
import { readTimeline, type TimelineEntry } from "@composio/ao-core";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { sessionManager } = await getServices();

    const session = await sessionManager.get(id);
    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    // No workspace path → no timeline possible
    if (!session.workspacePath) {
      return NextResponse.json({
        sessionId: id,
        timeline: [],
        totalEntries: 0,
      });
    }

    // Best-effort timeline read — failures return empty, not errors
    let entries: TimelineEntry[];
    try {
      entries = await readTimeline(session.workspacePath, id);
    } catch {
      return NextResponse.json({
        sessionId: id,
        timeline: [],
        totalEntries: 0,
      });
    }

    // Apply query-param filters (AND-combined)
    const sp = request.nextUrl.searchParams;
    const agent = sp.get("agent");
    const tool = sp.get("tool");
    const from = sp.get("from");
    const to = sp.get("to");

    if (agent) {
      const lower = agent.toLowerCase();
      entries = entries.filter((e) => e.agent.toLowerCase().includes(lower));
    }
    if (tool) {
      const lower = tool.toLowerCase();
      entries = entries.filter((e) => e.tool?.toLowerCase().includes(lower));
    }
    if (from) {
      const fromSec = Number(from);
      if (!Number.isNaN(fromSec)) {
        entries = entries.filter((e) => e.timestamp >= fromSec);
      }
    }
    if (to) {
      const toSec = Number(to);
      if (!Number.isNaN(toSec)) {
        entries = entries.filter((e) => e.timestamp <= toSec);
      }
    }

    return NextResponse.json({
      sessionId: id,
      timeline: entries,
      totalEntries: entries.length,
    });
  } catch (error) {
    console.error("Failed to read timeline:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
