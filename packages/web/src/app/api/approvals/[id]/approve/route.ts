/**
 * Approve action API route (Story 46b.2).
 *
 * POST /api/approvals/{id}/approve — approve a pending action.
 */
import { NextResponse } from "next/server";
import { approvalService } from "../../shared";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const approvedBy = request.headers.get("X-AO-User") ?? "anonymous";

    const result = approvalService.approve(id, approvedBy);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json(result.approval);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to approve" },
      { status: 500 },
    );
  }
}
