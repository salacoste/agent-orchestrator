import { NextResponse } from "next/server";
import { join } from "node:path";
import { createDeadLetterQueue, replayEntry, getReplayHandler } from "@composio/ao-core";

// TODO: Load from agent-orchestrator.yaml config when config loading is available in web package
const AO_STATE_DIR = ".ao/state";
const DLQ_FILENAME = "dlq.jsonl";

function getDlqPath(): string {
  const cwd = process.cwd();
  return join(cwd, AO_STATE_DIR, DLQ_FILENAME);
}

// Response type is inline in the return statements

/**
 * POST /api/dlq/[errorId]/retry - Retry a specific DLQ entry
 *
 * Path params:
 * - errorId: The ID of the DLQ entry to retry
 */
export async function POST(request: Request, { params }: { params: Promise<{ errorId: string }> }) {
  try {
    const { errorId } = await params;

    if (!errorId) {
      return NextResponse.json({ success: false, error: "Missing errorId" }, { status: 400 });
    }

    const dlqPath = getDlqPath();
    const dlq = createDeadLetterQueue({ dlqPath, alertThreshold: 1000 });

    await dlq.start();
    const entry = await dlq.get(errorId);

    if (!entry) {
      await dlq.stop();
      return NextResponse.json({ success: false, error: "Entry not found" }, { status: 404 });
    }

    // Check if there's a registered replay handler for this operation type
    const handler = getReplayHandler(entry.operation);

    if (handler) {
      // Use the registered replay handler
      try {
        const result = await replayEntry(entry);

        if (result.success) {
          // Remove the entry from DLQ on successful replay
          await dlq.remove(errorId);
        }

        await dlq.stop();

        return NextResponse.json({
          success: result.success,
          entry,
          replayResult: {
            success: result.success,
            replayedAt: new Date().toISOString(),
            error: result.error,
          },
        });
      } catch (replayError) {
        await dlq.stop();
        return NextResponse.json({
          success: false,
          error: replayError instanceof Error ? replayError.message : "Replay failed",
          entry,
        });
      }
    } else {
      // No registered handler - return entry info for manual handling
      await dlq.stop();

      return NextResponse.json({
        success: false,
        error: `No replay handler registered for operation type: ${entry.operation}`,
        entry,
      });
    }
  } catch (err) {
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
