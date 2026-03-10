import { NextResponse } from "next/server";
import { join } from "node:path";
import { createDeadLetterQueue, type DLQEntry, type DLQStats } from "@composio/ao-core";

// TODO: Load from agent-orchestrator.yaml config when config loading is available in web package
// For now, use the standard AO state directory location
const AO_STATE_DIR = ".ao/state";
const DLQ_FILENAME = "dlq.jsonl";

function getDlqPath(): string {
  // In production, this should load from the configured state directory
  // from the agent-orchestrator.yaml config file
  const cwd = process.cwd();
  return join(cwd, AO_STATE_DIR, DLQ_FILENAME);
}

/**
 * GET /api/dlq - Get DLQ status and entries
 *
 * Query params:
 * - format: "stats" | "entries" | "all" (default: "all")
 */
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const format = url.searchParams.get("format") || "all";

    const dlqPath = getDlqPath();
    const dlq = createDeadLetterQueue({ dlqPath, alertThreshold: 1000 });

    await dlq.start();

    const stats = await dlq.getStats();
    const entries = format !== "stats" ? await dlq.list() : [];

    await dlq.stop();

    const response: DLQResponse =
      format === "stats" ? { stats } : format === "entries" ? { entries } : { stats, entries };

    return NextResponse.json(response);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 },
    );
  }
}

/**
 * DELETE /api/dlq - Purge old DLQ entries
 *
 * Query params:
 * - olderThan: Duration string (e.g., "7d", "24h", "60m")
 */
export async function DELETE(request: Request) {
  try {
    const url = new URL(request.url);
    const olderThan = url.searchParams.get("olderThan") || "7d";

    // Parse duration string to milliseconds
    const match = olderThan.match(/^(\d+)([dhms])$/);
    if (!match) {
      return NextResponse.json(
        { error: "Invalid duration format. Use format like 7d, 24h, 60m" },
        { status: 400 },
      );
    }

    const value = Number.parseInt(match[1], 10);
    const unit = match[2];

    const multipliers: Record<string, number> = {
      d: 24 * 60 * 60 * 1000,
      h: 60 * 60 * 1000,
      m: 60 * 1000,
      s: 1000,
    };

    const olderThanMs = value * multipliers[unit];

    const dlqPath = getDlqPath();
    const dlq = createDeadLetterQueue({ dlqPath, alertThreshold: 1000 });

    await dlq.start();
    const purged = await dlq.purge(olderThanMs);
    await dlq.stop();

    return NextResponse.json({ purged });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 },
    );
  }
}

/**
 * POST /api/dlq/replay - Replay a specific DLQ entry
 *
 * Body: { errorId: string }
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { errorId } = body;

    if (!errorId) {
      return NextResponse.json({ error: "Missing errorId" }, { status: 400 });
    }

    const dlqPath = getDlqPath();
    const dlq = createDeadLetterQueue({ dlqPath, alertThreshold: 1000 });

    await dlq.start();
    const entry = await dlq.get(errorId);
    await dlq.stop();

    if (!entry) {
      return NextResponse.json({ error: "Entry not found" }, { status: 404 });
    }

    // For now, return the entry that would be replayed
    // TODO: Implement actual replay logic when service-specific handlers are available
    return NextResponse.json({
      entry,
      message: "Replay not fully implemented - use CLI for manual replay",
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 },
    );
  }
}

type DLQResponse =
  | { stats: DLQStats; entries?: never }
  | { entries: DLQEntry[]; stats?: never }
  | { stats: DLQStats; entries: DLQEntry[] };
