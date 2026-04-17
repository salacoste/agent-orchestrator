/**
 * GET /api/costs/breakdown — Model cost breakdown API (Story 60.5).
 *
 * Provides cost aggregation by dimension: summary, session, story, project, sprint.
 * Uses ModelUsageAggregator from @composio/ao-core.
 */

import { NextResponse } from "next/server";

import {
  getModelUsageAggregator,
  modelUsageAggregator,
  type ModelUsageAggregator,
} from "@composio/ao-core";

export const dynamic = "force-dynamic";

type Dimension = "session" | "story" | "project" | "sprint" | "summary";
const VALID_DIMENSIONS = new Set<string>(["session", "story", "project", "sprint", "summary"]);

const NO_CACHE_HEADERS = { "Cache-Control": "no-cache, no-store, must-revalidate" } as const;

function resolveAggregator(): ModelUsageAggregator {
  return getModelUsageAggregator() ?? modelUsageAggregator;
}

export async function GET(request: Request): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);
    const rawDimension = searchParams.get("dimension") ?? "summary";

    if (!VALID_DIMENSIONS.has(rawDimension)) {
      const validList = [...VALID_DIMENSIONS].join(", ");
      return NextResponse.json(
        {
          error: `Invalid dimension. Must be one of: ${validList}`,
        },
        { status: 400 },
      );
    }

    const dimension = rawDimension as Dimension;
    const aggregator = resolveAggregator();

    switch (dimension) {
      case "summary": {
        const summary = aggregator.getSummary();
        return NextResponse.json(
          { dimension: "summary", ...summary },
          { headers: NO_CACHE_HEADERS },
        );
      }

      case "session": {
        const sessionId = searchParams.get("sessionId");
        if (!sessionId) {
          return NextResponse.json(
            { error: "Missing required parameter: sessionId" },
            { status: 400 },
          );
        }
        const usage = aggregator.getBySession(sessionId);
        return NextResponse.json(
          { dimension: "session", sessionId, usage },
          { headers: NO_CACHE_HEADERS },
        );
      }

      case "story": {
        const storyId = searchParams.get("storyId");
        if (!storyId) {
          return NextResponse.json(
            { error: "Missing required parameter: storyId" },
            { status: 400 },
          );
        }
        const usage = aggregator.getByStory(storyId);
        return NextResponse.json(
          { dimension: "story", storyId, usage },
          { headers: NO_CACHE_HEADERS },
        );
      }

      case "project": {
        const projectId = searchParams.get("projectId");
        if (!projectId) {
          return NextResponse.json(
            { error: "Missing required parameter: projectId" },
            { status: 400 },
          );
        }
        const usage = aggregator.getByProject(projectId);
        return NextResponse.json(
          { dimension: "project", projectId, usage },
          { headers: NO_CACHE_HEADERS },
        );
      }

      case "sprint": {
        const projectPath = searchParams.get("projectPath");
        if (!projectPath) {
          return NextResponse.json(
            { error: "Missing required parameter: projectPath" },
            { status: 400 },
          );
        }
        const usage = await aggregator.getBySprint(projectPath);
        return NextResponse.json(
          { dimension: "sprint", projectPath, usage },
          { headers: NO_CACHE_HEADERS },
        );
      }
    }

    // Exhaustiveness guard — should never reach here
    return NextResponse.json({ error: "Unhandled dimension" }, { status: 500 });
  } catch (error) {
    console.error("Failed to compute cost breakdown:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
