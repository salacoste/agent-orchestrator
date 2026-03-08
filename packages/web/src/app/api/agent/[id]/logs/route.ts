import { NextResponse, type NextRequest } from "next/server";

export const dynamic = "force-dynamic";

/**
 * GET /api/agent/[id]/logs — Get agent session logs
 *
 * Returns the last 100 log lines from the agent session.
 *
 * NOTE: This is a stub implementation. The actual implementation should:
 * - Read the agent's log file from the logs directory
 * - Return the last 100 lines (tail -100)
 * - Handle cases where log file doesn't exist
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } },
): Promise<NextResponse> {
  try {
    const { id: agentId } = params;

    // TODO: Implement actual log fetching
    // - Construct log file path from agent ID and logs directory
    // - Read last 100 lines from the log file
    // - Return as array of log strings
    // - Handle missing log files gracefully

    // Stub response for development
    return NextResponse.json({
      logs: [
        `[INFO] ${new Date().toISOString()}: Agent ${agentId} log file not yet implemented`,
        `[DEBUG] This endpoint requires integration with the agent runtime log capture`,
      ],
    });
  } catch (err) {
    const error = err as Error;
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
