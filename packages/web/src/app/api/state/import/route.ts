/**
 * State import API route (Story 46a.2).
 *
 * POST /api/state/import — import state from a JSON snapshot.
 * Non-destructive: merges with existing state.
 */
import { NextResponse } from "next/server";
import { validateSnapshot, mergeLearnings } from "@composio/ao-core";
import { getServices } from "@/lib/services";

export async function POST(request: Request) {
  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    // Validate snapshot structure
    const validation = validateSnapshot(body);
    if (!validation.valid) {
      return NextResponse.json(
        { error: "Invalid snapshot", details: validation.errors },
        { status: 400 },
      );
    }

    const snapshot = body as {
      learnings: Record<string, unknown>[];
      sessions: unknown[];
    };

    const { learningStore } = await getServices();

    // Merge learnings (non-destructive — only add new records)
    let importedCount = 0;
    try {
      const existing = (learningStore?.list() ?? []) as Array<{ sessionId: string }>;
      const newLearnings = mergeLearnings(existing, snapshot.learnings);
      importedCount = newLearnings.length;

      // Append new learnings to store
      for (const entry of newLearnings) {
        try {
          learningStore?.append?.(entry);
        } catch {
          // Individual entry failure — continue with rest
        }
      }
    } catch {
      // Learning store unavailable — non-fatal
    }

    return NextResponse.json({
      success: true,
      imported: {
        learnings: importedCount,
        sessions: 0, // Sessions are runtime — not imported
      },
      message: `Imported ${importedCount} new learning records. Sessions are runtime state and were skipped.`,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to import state" },
      { status: 500 },
    );
  }
}
