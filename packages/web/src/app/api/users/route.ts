/**
 * Users API route (Story 46b.1).
 *
 * GET /api/users — returns configured user list.
 */
import { NextResponse } from "next/server";
import { getServices } from "@/lib/services";

export async function GET() {
  try {
    const { config } = await getServices();
    const users = config.users ?? [];
    return NextResponse.json({ users });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to load users" },
      { status: 500 },
    );
  }
}
