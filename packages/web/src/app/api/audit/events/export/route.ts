import { NextResponse, type NextRequest } from "next/server";
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { filterEvents, sortEventsByTimestamp } from "@/lib/event-filters";

export const dynamic = "force-dynamic";

/**
 * GET /api/audit/events/export — Export event audit trail as JSONL
 *
 * Query parameters:
 * - type: Filter by event type
 * - storyId: Filter by story ID
 * - agentId: Filter by agent ID
 * - search: Full-text search in event data
 * - since: Filter events after this timestamp (ISO 8601)
 * - limit: Maximum events to export (default: 10000, max: 10000)
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const searchParams = request.nextUrl.searchParams;

    const type = searchParams.get("type");
    const storyId = searchParams.get("storyId");
    const agentId = searchParams.get("agentId");
    const search = searchParams.get("search");
    const since = searchParams.get("since");
    const limit = Math.min(10000, Math.max(1, parseInt(searchParams.get("limit") || "10000", 10)));

    // Default events.jsonl path
    const eventsPath = process.env.AO_AUDIT_LOG_PATH || "events.jsonl";

    // Check if file exists
    if (!existsSync(eventsPath)) {
      return NextResponse.json({ error: "Audit log not found" }, { status: 404 });
    }

    // Read and parse events
    const content = await readFile(eventsPath, "utf-8");
    const lines = content.split("\n").filter((l) => l.trim());

    const allEvents: unknown[] = [];
    for (const line of lines) {
      try {
        allEvents.push(JSON.parse(line));
      } catch {
        // Skip invalid lines
      }
    }

    // Filter events using shared utility
    const filteredEvents = filterEvents(allEvents, {
      type,
      storyId,
      agentId,
      search,
      since,
    });

    // Sort by timestamp descending (newest first)
    sortEventsByTimestamp(filteredEvents);

    // Apply limit
    const limitedEvents = filteredEvents.slice(0, limit);

    // Generate filename with date range
    const newestEvent = limitedEvents[0] as Record<string, unknown> | undefined;
    const oldestEvent = limitedEvents[limitedEvents.length - 1] as
      | Record<string, unknown>
      | undefined;

    const dateFrom = oldestEvent?.timestamp
      ? new Date(oldestEvent.timestamp as string).toISOString().split("T")[0]
      : "unknown";
    const dateTo = newestEvent?.timestamp
      ? new Date(newestEvent.timestamp as string).toISOString().split("T")[0]
      : "now";

    const filename = `events-${dateFrom}-to-${dateTo}.jsonl`;

    // Convert to JSONL format
    const jsonlContent = limitedEvents.map((e) => JSON.stringify(e)).join("\n") + "\n";

    return new NextResponse(jsonlContent, {
      status: 200,
      headers: {
        "Content-Type": "application/jsonl",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-cache",
      },
    });
  } catch (err) {
    const error = err as Error;
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
