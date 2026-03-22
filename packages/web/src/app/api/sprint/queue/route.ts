import { NextResponse } from "next/server";

import { getSpawnQueue } from "@composio/ao-core";

export const dynamic = "force-dynamic";

/**
 * GET /api/sprint/queue — Spawn queue state (Story 43.3)
 *
 * Returns current WIP limit, running count, and queued items.
 */
export async function GET(): Promise<NextResponse> {
  try {
    const queue = getSpawnQueue();
    if (!queue) {
      return NextResponse.json({
        pending: 0,
        running: 0,
        limit: null,
        entries: [],
        message: "Spawn queue not initialized",
      });
    }

    const state = await queue.getState();
    return NextResponse.json(state);
  } catch (err) {
    const error = err as Error;
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
