import { NextResponse } from "next/server";

/**
 * POST /api/conflicts/[conflictId]
 * Resolve a conflict with specified action
 *
 * Body:
 * - action: "keep-existing" | "replace-with-new" | "manual"
 * - reason?: string (optional, for manual resolutions)
 */
export async function POST(request: Request, { params }: { params: { conflictId: string } }) {
  try {
    const body = await request.json();
    const { action, reason } = body;

    if (!action || !["keep-existing", "replace-with-new", "manual"].includes(action)) {
      return NextResponse.json(
        { error: "Invalid action. Must be 'keep-existing', 'replace-with-new', or 'manual'" },
        { status: 400 },
      );
    }

    // For now, return mock response since we don't have real conflict resolution wired up
    // In a real implementation, this would call ConflictResolutionService.resolve()
    const resolution = {
      conflictId: params.conflictId,
      action,
      keptAgent:
        action === "keep-existing"
          ? "existing-agent"
          : action === "replace-with-new"
            ? "new-agent"
            : null,
      terminatedAgent:
        action === "keep-existing"
          ? "new-agent"
          : action === "replace-with-new"
            ? "existing-agent"
            : null,
      reason:
        reason ??
        `Conflict ${action === "manual" ? "manually resolved" : `auto-resolved with action: ${action}`}`,
      resolvedAt: new Date(),
    };

    return NextResponse.json({ success: true, resolution });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to resolve conflict" },
      { status: 500 },
    );
  }
}
