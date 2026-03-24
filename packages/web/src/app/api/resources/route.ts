/**
 * Resources API route (Story 46b.3).
 *
 * GET /api/resources — returns resource pool state.
 */
import { NextResponse } from "next/server";
import { createResourcePool, type ResourcePoolConfig } from "@composio/ao-core";
import { getServices } from "@/lib/services";

/** Module-level singleton — persists usage across requests. */
let poolSingleton: ReturnType<typeof createResourcePool> | null = null;
let poolConfigHash = "";

function getPool(config?: ResourcePoolConfig) {
  const hash = JSON.stringify(config ?? null);
  if (!poolSingleton || hash !== poolConfigHash) {
    poolSingleton = createResourcePool(config);
    poolConfigHash = hash;
  }
  return poolSingleton;
}

/** Exported for other routes that need to acquire/release. */
export { getPool };

export async function GET() {
  try {
    const { config } = await getServices();
    const pool = getPool(config.resourcePool as ResourcePoolConfig | undefined);

    return NextResponse.json(pool.getState());
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to load resources" },
      { status: 500 },
    );
  }
}
