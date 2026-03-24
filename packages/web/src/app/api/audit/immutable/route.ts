/**
 * Immutable audit log API route (Story 46a.1).
 *
 * GET /api/audit/immutable — query immutable audit entries.
 * Query params: ?since=ISO&limit=N&verify=true
 */
import { NextResponse } from "next/server";
import { createImmutableAuditLog } from "@composio/ao-core";

const AUDIT_PATH = process.env.AO_IMMUTABLE_AUDIT_PATH ?? "audit.jsonl";

/** Module-level singleton — avoids re-reading file on every request. */
const log = createImmutableAuditLog(AUDIT_PATH);

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const since = url.searchParams.get("since") ?? undefined;
    const limit = parseInt(url.searchParams.get("limit") ?? "100", 10) || 100;
    const verify = url.searchParams.get("verify") === "true";

    if (verify) {
      const result = await log.verify();
      return NextResponse.json(result);
    }

    const entries = await log.readEntries({
      since,
      limit: Math.min(limit, 1000),
    });

    return NextResponse.json({
      entries,
      total: entries.length,
      limit: Math.min(limit, 1000),
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to read audit log" },
      { status: 500 },
    );
  }
}
