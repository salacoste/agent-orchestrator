/**
 * REST API for cross-session memory — GET, PUT, DELETE handlers.
 * Story 61-2, AC #1, #4, #5, #8, #9.
 */
import { NextResponse, type NextRequest } from "next/server";
import { getServices } from "@/lib/services";
import { loadAccumulatedMemory, removeEntry, updateEntry } from "@composio/ao-core/memory-bridge";

export const dynamic = "force-dynamic";

const NO_CACHE_HEADERS = {
  "Cache-Control": "no-cache, no-store, must-revalidate",
} as const;

// ---------------------------------------------------------------------------
// GET /api/cross-session-memory/[project]
// ---------------------------------------------------------------------------

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ project: string }> },
) {
  try {
    const { project } = await params;
    const { config } = await getServices();

    const projectConfig = config.projects[project];
    if (!projectConfig) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const enabled = projectConfig.learning?.crossSessionMemory === true;

    if (!enabled) {
      return NextResponse.json(
        { entries: [], project, enabled: false },
        { headers: NO_CACHE_HEADERS },
      );
    }

    const entries = await loadAccumulatedMemory(projectConfig.path);
    return NextResponse.json({ entries, project, enabled: true }, { headers: NO_CACHE_HEADERS });
  } catch (error) {
    console.error("Failed to load cross-session memory:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// DELETE /api/cross-session-memory/[project]
// ---------------------------------------------------------------------------

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ project: string }> },
) {
  try {
    const { project } = await params;
    const { config } = await getServices();

    const projectConfig = config.projects[project];
    if (!projectConfig) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    if (!projectConfig.learning?.crossSessionMemory) {
      return NextResponse.json({ error: "Feature not enabled" }, { status: 403 });
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    if (
      !body ||
      typeof body !== "object" ||
      !("contentHash" in body) ||
      typeof (body as { contentHash: unknown }).contentHash !== "string"
    ) {
      return NextResponse.json({ error: "Invalid: contentHash string required" }, { status: 400 });
    }

    const { contentHash } = body as { contentHash: string };
    await removeEntry(projectConfig.path, contentHash);

    const entries = await loadAccumulatedMemory(projectConfig.path);
    return NextResponse.json({ entries, project, enabled: true }, { headers: NO_CACHE_HEADERS });
  } catch (error) {
    console.error("Failed to delete cross-session memory entry:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// PUT /api/cross-session-memory/[project]
// ---------------------------------------------------------------------------

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ project: string }> },
) {
  try {
    const { project } = await params;
    const { config } = await getServices();

    const projectConfig = config.projects[project];
    if (!projectConfig) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    if (!projectConfig.learning?.crossSessionMemory) {
      return NextResponse.json({ error: "Feature not enabled" }, { status: 403 });
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    if (
      !body ||
      typeof body !== "object" ||
      !("contentHash" in body) ||
      typeof (body as { contentHash: unknown }).contentHash !== "string" ||
      !("content" in body) ||
      typeof (body as { content: unknown }).content !== "string" ||
      !(body as { content: string }).content
    ) {
      return NextResponse.json(
        { error: "Invalid: contentHash and non-empty content string required" },
        { status: 400 },
      );
    }

    const { contentHash, content } = body as { contentHash: string; content: string };
    await updateEntry(projectConfig.path, contentHash, content);

    const entries = await loadAccumulatedMemory(projectConfig.path);
    return NextResponse.json({ entries, project, enabled: true }, { headers: NO_CACHE_HEADERS });
  } catch (error) {
    console.error("Failed to update cross-session memory entry:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
