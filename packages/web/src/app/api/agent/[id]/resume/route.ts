import { NextResponse, type NextRequest } from "next/server";

export const dynamic = "force-dynamic";

/**
 * POST /api/agent/[id]/resume — Resume a blocked agent
 *
 * Triggers the resume workflow for a blocked agent session.
 *
 * NOTE: This is a stub implementation. The actual implementation should:
 * - Call the ao CLI resume command for the agent's story
 * - Or send a resume event to the event bus
 * - Return success/failure status
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
): Promise<NextResponse> {
  try {
    const { id: agentId } = params;

    // TODO: Implement actual resume functionality
    // - Extract story ID from agent metadata
    // - Call `ao resume <storyId>` CLI command
    // - Or publish resume event to event bus
    // - Wait for agent status change confirmation
    // - Return success status

    // Stub response for development
    console.log(`Resume requested for agent: ${agentId}`);

    return NextResponse.json({
      success: true,
      message: `Resume command sent to agent ${agentId}`,
    });
  } catch (err) {
    const error = err as Error;
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
