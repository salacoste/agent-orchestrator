/**
 * GET /api/conflicts/[conflictId]/suggestions
 * Generate resolution suggestions for a specific resource conflict.
 *
 * Returns: { conflict, suggestions, generatedAt }
 */

import { NextResponse } from "next/server";
import { getServices } from "@/lib/services";
import {
  createResourceConflictStore,
  generateSuggestions,
  type ConflictResolutionResponse,
} from "@composio/ao-core";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ conflictId: string }> },
) {
  try {
    const { conflictId } = await params;
    const { config } = await getServices();

    // Look up the conflict from the store
    const store = createResourceConflictStore(config.configPath);
    const allConflicts = store.list();
    const conflict = allConflicts.find((c) => c.id === conflictId);

    if (!conflict) {
      return NextResponse.json({ error: `Conflict '${conflictId}' not found` }, { status: 404 });
    }

    // Generate suggestions using core engine
    const suggestions = generateSuggestions(conflict, config);

    const responseBody: ConflictResolutionResponse = {
      conflict,
      suggestions,
      generatedAt: new Date().toISOString(),
    };

    return NextResponse.json(responseBody);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to generate suggestions" },
      { status: 500 },
    );
  }
}
