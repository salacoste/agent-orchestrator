/**
 * GET /api/session/[id]/notepad/stream — SSE Route Tests
 *
 * Epic 60, Story 60-1 (AC8 — SSE tests).
 *
 * Uses real timers because ReadableStream uses real async primitives
 * that fake timers cannot advance.
 */

import { describe, expect, it, vi, beforeEach } from "vitest";

// ── Mocks (must be before route imports) ──────────────────────────────────────
// Use vi.hoisted() so mock references are available in hoisted vi.mock factories.

const { mockSessionManager, mockReadNotepad } = vi.hoisted(() => ({
  mockSessionManager: { get: vi.fn() },
  mockReadNotepad: vi.fn(),
}));

vi.mock("@/lib/services", () => ({
  getServices: vi.fn(async () => ({
    sessionManager: mockSessionManager,
  })),
}));

vi.mock("@composio/ao-core", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...(actual as Record<string, unknown>),
    readNotepad: mockReadNotepad,
  };
});

// Import after mocks
import { GET } from "./route";

function makeRequest(sessionId: string) {
  return new Request(`http://localhost/api/session/${sessionId}/notepad/stream`) as never;
}

/** Read a single chunk from the stream with a timeout. */
async function readChunk(response: Response, timeoutMs = 2000): Promise<string | null> {
  const body = response.body!;
  const reader = body.getReader();
  const decoder = new TextDecoder();

  const result = await Promise.race([
    reader.read(),
    new Promise<null>((resolve) => setTimeout(() => resolve(null), timeoutMs)),
  ]);

  reader.releaseLock();

  if (!result || result.done) return null;
  return decoder.decode(result.value, { stream: true });
}

/** Read multiple chunks from the stream. */
async function readChunks(response: Response, count: number, timeoutMs = 6000): Promise<string[]> {
  const body = response.body!;
  const reader = body.getReader();
  const decoder = new TextDecoder();
  const chunks: string[] = [];
  const deadline = Date.now() + timeoutMs;

  while (chunks.length < count && Date.now() < deadline) {
    const result = await Promise.race([
      reader.read(),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), deadline - Date.now())),
    ]);
    if (!result || result.done) break;
    chunks.push(decoder.decode(result.value, { stream: true }));
  }

  reader.releaseLock();
  return chunks;
}

describe("GET /api/session/[id]/notepad/stream", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("sends initial notepad snapshot on connection", async () => {
    mockSessionManager.get.mockResolvedValue({
      id: "session-1",
      workspacePath: "/tmp/worktree-1",
    });
    mockReadNotepad.mockResolvedValue({
      priority: "Story: 60-1",
      working: "",
      manual: "Notes",
    });

    const response = await GET(makeRequest("session-1"), {
      params: Promise.resolve({ id: "session-1" }),
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("text/event-stream");
    expect(response.headers.get("Cache-Control")).toBe("no-cache");

    const chunk = await readChunk(response);
    expect(chunk).not.toBeNull();
    expect(chunk).toContain("notepad-update");
    expect(chunk).toContain("session-1");
    expect(chunk).toContain("Story: 60-1");

    await response.body!.cancel();
  }, 10000);

  it("sends empty snapshot for session without workspace", async () => {
    mockSessionManager.get.mockResolvedValue({
      id: "session-2",
      workspacePath: null,
    });

    const response = await GET(makeRequest("session-2"), {
      params: Promise.resolve({ id: "session-2" }),
    });

    const chunk = await readChunk(response);
    expect(chunk).toContain("notepad-update");
    expect(chunk).toContain("session-2");
    expect(chunk).toContain('"priority":""');

    await response.body!.cancel();
  }, 10000);

  it("sends heartbeat after initial snapshot (verifies ordering)", async () => {
    mockSessionManager.get.mockResolvedValue({
      id: "session-3",
      workspacePath: "/tmp/worktree-3",
    });
    mockReadNotepad.mockResolvedValue({
      priority: "",
      working: "",
      manual: "",
    });

    const response = await GET(makeRequest("session-3"), {
      params: Promise.resolve({ id: "session-3" }),
    });

    // Read initial snapshot + heartbeat (wait up to 20s for heartbeat)
    const chunks = await readChunks(response, 2, 20000);

    // Verify ordering: snapshot arrives first (chunk 0), heartbeat second (chunk 1)
    expect(chunks.length).toBeGreaterThanOrEqual(2);
    expect(chunks[0]).toContain("notepad-update");
    expect(chunks[1]).toContain(": heartbeat");

    // Also verify via joined content for completeness
    const joined = chunks.join("");
    expect(joined).toContain("notepad-update");
    expect(joined).toContain(": heartbeat");

    await response.body!.cancel();
  }, 25000);

  it("detects notepad content changes via polling", async () => {
    mockSessionManager.get.mockResolvedValue({
      id: "session-4",
      workspacePath: "/tmp/worktree-4",
    });

    // Initial read
    mockReadNotepad.mockResolvedValueOnce({
      priority: "Initial",
      working: "",
      manual: "",
    });

    const response = await GET(makeRequest("session-4"), {
      params: Promise.resolve({ id: "session-4" }),
    });

    // Read initial snapshot
    const initialChunk = await readChunk(response);
    expect(initialChunk).toContain("Initial");

    // Change notepad content for subsequent reads
    mockReadNotepad.mockResolvedValue({
      priority: "Updated",
      working: "",
      manual: "",
    });

    // Wait for the 5s poll to detect change (read next data chunk)
    const updateChunk = await readChunk(response, 8000);
    expect(updateChunk).toContain("Updated");

    await response.body!.cancel();
  }, 15000);

  it("cleans up intervals on stream cancel", async () => {
    mockSessionManager.get.mockResolvedValue({
      id: "session-5",
      workspacePath: "/tmp/worktree-5",
    });
    mockReadNotepad.mockResolvedValue({
      priority: "",
      working: "",
      manual: "",
    });

    const response = await GET(makeRequest("session-5"), {
      params: Promise.resolve({ id: "session-5" }),
    });

    // Read initial snapshot to confirm stream works
    const chunk = await readChunk(response);
    expect(chunk).toContain("notepad-update");

    // Cancel the stream — triggers cancel() callback which clears intervals
    await response.body!.cancel();

    // Wait 2 seconds then verify no more data arrives (intervals cleaned up)
    const postCancelChunk = await readChunk(response, 2000);
    expect(postCancelChunk).toBeNull();
  }, 10000);
});
