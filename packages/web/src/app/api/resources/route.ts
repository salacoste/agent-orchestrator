/**
 * Resources API route (Story 46b.3).
 *
 * GET /api/resources — returns resource pool state.
 */
import { NextResponse } from "next/server";
import { createResourcePool, type ResourcePoolConfig } from "@composio/ao-core";
import { getServices } from "@/lib/services";

export async function GET() {
  try {
    const { config } = await getServices();
    const poolConfig = config.resourcePool as ResourcePoolConfig | undefined;
    const pool = createResourcePool(poolConfig);

    return NextResponse.json(pool.getState());
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to load resources" },
      { status: 500 },
    );
  }
}
