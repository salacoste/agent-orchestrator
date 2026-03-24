/**
 * Approvals list API route (Story 46b.2).
 *
 * GET /api/approvals — returns pending approval queue.
 */
import { NextResponse } from "next/server";
import { createApprovalService } from "@composio/ao-core";

/** Module-level singleton. */
const approvalService = createApprovalService();

export { approvalService };

export async function GET() {
  try {
    const pending = approvalService.getPending();
    return NextResponse.json({ approvals: pending });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to load approvals" },
      { status: 500 },
    );
  }
}
