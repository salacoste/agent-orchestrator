/**
 * GET /api/conflicts/history
 * List conflict resolution history with filtering.
 *
 * Query params: dateFrom, dateTo, resourceType, projectId, outcome
 * Returns: { entries, patterns, filter }
 */

import { type NextRequest, NextResponse } from "next/server";
import { getServices } from "@/lib/services";
import {
  readConflictHistory,
  filterConflictHistory,
  computeConflictPatterns,
} from "@composio/ao-core";
import { parseHistoryFilter } from "./filter-utils";

export async function GET(request: NextRequest) {
  try {
    const { config } = await getServices();

    // Read all history entries from JSONL
    const allEntries = readConflictHistory(config.configPath);

    // Parse query params into filter
    const url = new URL(request.url);
    const filter = parseHistoryFilter(url.searchParams);

    // Apply filters
    const entries = filterConflictHistory(allEntries, filter);

    // Compute patterns on the filtered dataset
    const patterns = computeConflictPatterns(entries);

    return NextResponse.json({ entries, patterns, filter });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load conflict history" },
      { status: 500 },
    );
  }
}
