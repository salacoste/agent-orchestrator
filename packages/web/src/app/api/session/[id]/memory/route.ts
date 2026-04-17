/**
 * REST API for project memory — GET and PUT handlers.
 * Story 60-9, AC #4, #5.
 */
import { NextResponse, type NextRequest } from "next/server";
import { getServices } from "@/lib/services";
import {
  readProjectMemory,
  writeProjectMemory,
  emptyProjectMemory,
} from "@composio/ao-core/project-memory";
import type { ProjectMemoryEntry } from "@composio/ao-core";

export const dynamic = "force-dynamic";

const NO_CACHE_HEADERS = {
  "Cache-Control": "no-cache, no-store, must-revalidate",
} as const;

// ---------------------------------------------------------------------------
// GET /api/session/[id]/memory
// ---------------------------------------------------------------------------

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { sessionManager } = await getServices();
    const session = await sessionManager.get(id);

    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    if (!session.workspacePath) {
      return NextResponse.json(
        { sessionId: id, memory: emptyProjectMemory(), exists: false },
        { headers: NO_CACHE_HEADERS },
      );
    }

    try {
      const memory = await readProjectMemory(session.workspacePath);
      return NextResponse.json(
        { sessionId: id, memory, exists: true },
        { headers: NO_CACHE_HEADERS },
      );
    } catch {
      return NextResponse.json(
        {
          sessionId: id,
          memory: emptyProjectMemory(),
          exists: false,
          readError: true,
        },
        { headers: NO_CACHE_HEADERS },
      );
    }
  } catch (error) {
    console.error("Failed to read project memory:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// PUT /api/session/[id]/memory
// ---------------------------------------------------------------------------

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    if (
      !body ||
      typeof body !== "object" ||
      !("entries" in body) ||
      !Array.isArray((body as { entries: unknown }).entries)
    ) {
      return NextResponse.json({ error: "Invalid: entries array required" }, { status: 400 });
    }

    const entries = (body as { entries: unknown[] }).entries;
    for (const entry of entries) {
      if (
        !entry ||
        typeof entry !== "object" ||
        !("type" in entry) ||
        !("content" in entry) ||
        typeof (entry as { type: unknown }).type !== "string" ||
        typeof (entry as { content: unknown }).content !== "string" ||
        !(entry as { type: string }).type ||
        !(entry as { content: string }).content
      ) {
        return NextResponse.json(
          { error: "Invalid: each entry needs type and content" },
          { status: 400 },
        );
      }
    }

    const { sessionManager } = await getServices();
    const session = await sessionManager.get(id);

    if (!session || !session.workspacePath) {
      return NextResponse.json({ error: "Session not found or no workspace" }, { status: 404 });
    }

    await writeProjectMemory(session.workspacePath, {
      entries: entries as ProjectMemoryEntry[],
    });

    const memory = await readProjectMemory(session.workspacePath);
    return NextResponse.json(
      { sessionId: id, memory, exists: true },
      { headers: NO_CACHE_HEADERS },
    );
  } catch (error) {
    console.error("Failed to write project memory:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
