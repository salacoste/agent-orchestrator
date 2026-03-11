import { NextResponse, type NextRequest } from "next/server";
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { filterEvents, sortEventsByTimestamp } from "@/lib/event-filters";

export const dynamic = "force-dynamic";

/**
 * GET /api/audit/events — Query event audit trail with pagination and filters
 *
 * Query parameters:
 * - page: Page number (default: 1)
 * - limit: Events per page (default: 100, max: 1000)
 * - type: Filter by event type (e.g., "story.completed")
 * - storyId: Filter by story ID
 * - agentId: Filter by agent ID
 * - search: Full-text search in event data
 * - since: Filter events after this timestamp (ISO 8601)
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const searchParams = request.nextUrl.searchParams;

    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(1000, Math.max(1, parseInt(searchParams.get("limit") || "100", 10)));
    const type = searchParams.get("type");
    const storyId = searchParams.get("storyId");
    const agentId = searchParams.get("agentId");
    const search = searchParams.get("search");
    const since = searchParams.get("since");

    // Default events.jsonl path - could be made configurable via env var
    const eventsPath = process.env.AO_AUDIT_LOG_PATH || "events.jsonl";

    // Check if file exists
    if (!existsSync(eventsPath)) {
      return NextResponse.json(
        { events: [], total: 0, error: "Audit log not found" },
        { status: 404 },
      );
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

    // Calculate pagination
    const total = filteredEvents.length;
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedEvents = filteredEvents.slice(startIndex, endIndex);

    // Transform events to match the EventsPage interface
    const transformedEvents = paginatedEvents.map((evt: unknown) => {
      const event = evt as Record<string, unknown>;
      const metadata = event.metadata as Record<string, unknown> | undefined;

      return {
        id: event.eventId as string,
        type: event.eventType as string,
        timestamp: event.timestamp as string,
        data: {
          storyId: metadata?.storyId as string | undefined,
          agentId: metadata?.agentId as string | undefined,
          reason: metadata?.reason as string | undefined,
          status: metadata?.status as string | undefined,
          ...metadata,
        },
        hash: event.hash as string,
      };
    });

    return NextResponse.json(
      {
        events: transformedEvents,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
      {
        headers: {
          "Cache-Control": "public, max-age=5, stale-while-revalidate=30",
        },
      },
    );
  } catch (err) {
    const error = err as Error;
    return NextResponse.json({ events: [], total: 0, error: error.message }, { status: 500 });
  }
}
