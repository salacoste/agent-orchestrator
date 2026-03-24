/**
 * Reject action API route (Story 46b.2).
 *
 * POST /api/approvals/{id}/reject — reject a pending action.
 */
import { NextResponse } from "next/server";
import { approvalService } from "../../route";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const rejectedBy = request.headers.get("X-AO-User") ?? "anonymous";

    const result = approvalService.reject(id, rejectedBy);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json(result.approval);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to reject" },
      { status: 500 },
    );
  }
}
