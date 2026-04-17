/**
 * GET /api/conflicts/history/export
 * Export filtered conflict history as a downloadable JSON file.
 *
 * Query params: same as /api/conflicts/history (dateFrom, dateTo, resourceType, projectId, outcome)
 * Returns: JSON file download with Content-Disposition header
 */

import { type NextRequest, NextResponse } from "next/server";
import { getServices } from "@/lib/services";
import {
  readConflictHistory,
  filterConflictHistory,
  exportConflictHistory,
} from "@composio/ao-core";
import { parseHistoryFilter } from "../filter-utils";

export async function GET(request: NextRequest) {
  try {
    const { config } = await getServices();

    // Read all history entries
    const allEntries = readConflictHistory(config.configPath);

    // Parse query params into filter (shared with history route)
    const url = new URL(request.url);
    const filter = parseHistoryFilter(url.searchParams);

    // Apply filters and export
    const filtered = filterConflictHistory(allEntries, filter);
    const json = exportConflictHistory(filtered);

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");

    return new NextResponse(json, {
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="conflict-history-${timestamp}.json"`,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to export conflict history" },
      { status: 500 },
    );
  }
}
