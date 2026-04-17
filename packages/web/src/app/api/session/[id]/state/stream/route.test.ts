/**
 * GET /api/session/[id]/state/stream — SSE Route Tests
 *
 * Epic 60, Story 60-7 (AC9 — SSE tests).
 *
 * Uses real timers because ReadableStream uses real async primitives
 * that fake timers cannot advance.
 */

import { describe, expect, it, vi, beforeEach } from "vitest";

// ── Mocks (must be before route imports) ──────────────────────────────────────

const { mockSessionManager, mockReadSessionState } = vi.hoisted(() => ({
  mockSessionManager: { get: vi.fn() },
  mockReadSessionState: vi.fn(),
}));

vi.mock("@/lib/services", () => ({
  getServices: vi.fn(async () => ({
    sessionManager: mockSessionManager,
  })),
}));

vi.mock("@composio/ao-core/session-state", () => ({
  readSessionState: mockReadSessionState,
  emptySessionState: () =>
    Object.freeze({
      executionMode: null,
      activeAgents: [],
      configured: false,
      activeModes: [],
      health: null,
    }),
}));

// Import after mocks
import { GET } from "./route";

function makeRequest(sessionId: string) {
  return new Request(`http://localhost/api/session/${sessionId}/state/stream`) as never;
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

const MOCK_STATE = {
  executionMode: "standard",
  activeAgents: ["omc"],
  configured: true,
  activeModes: [{ mode: "ralph", active: true }],
  health: null,
};

describe("GET /api/session/[id]/state/stream", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("sends initial state snapshot on connect", async () => {
    mockSessionManager.get.mockResolvedValue({
      id: "session-1",
      workspacePath: "/tmp/worktree-1",
    });
    mockReadSessionState.mockResolvedValue(MOCK_STATE);

    const response = await GET(makeRequest("session-1"), {
      params: Promise.resolve({ id: "session-1" }),
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("text/event-stream");
    expect(response.headers.get("Cache-Control")).toBe("no-cache");

    const chunk = await readChunk(response);
    expect(chunk).not.toBeNull();
    expect(chunk).toContain("event: state-update");
    expect(chunk).toContain("session-1");
    expect(chunk).toContain('"executionMode":"standard"');

    await response.body!.cancel();
  }, 10000);

  it("sends heartbeat after 15 seconds", async () => {
    mockSessionManager.get.mockResolvedValue({
      id: "session-2",
      workspacePath: "/tmp/worktree-2",
    });
    mockReadSessionState.mockResolvedValue(MOCK_STATE);

    const response = await GET(makeRequest("session-2"), {
      params: Promise.resolve({ id: "session-2" }),
    });

    // Read initial snapshot + heartbeat (wait up to 20s for heartbeat)
    const chunks = await readChunks(response, 2, 20000);

    expect(chunks.length).toBeGreaterThanOrEqual(2);
    expect(chunks[0]).toContain("event: state-update");
    expect(chunks[1]).toContain(": heartbeat");

    await response.body!.cancel();
  }, 25000);

  it("detects state changes via polling", async () => {
    mockSessionManager.get.mockResolvedValue({
      id: "session-3",
      workspacePath: "/tmp/worktree-3",
    });

    // Initial read
    mockReadSessionState.mockResolvedValueOnce({
      executionMode: "standard",
      activeAgents: ["omc"],
      configured: true,
      activeModes: [{ mode: "ralph", active: false }],
      health: null,
    });

    const response = await GET(makeRequest("session-3"), {
      params: Promise.resolve({ id: "session-3" }),
    });

    // Read initial snapshot
    const initialChunk = await readChunk(response);
    expect(initialChunk).toContain('"active":false');

    // Change state for subsequent reads
    mockReadSessionState.mockResolvedValue({
      executionMode: "autopilot",
      activeAgents: ["omc", "explore"],
      configured: true,
      activeModes: [{ mode: "ralph", active: true }],
      health: null,
    });

    // Wait for the 5s poll to detect change
    const updateChunk = await readChunk(response, 8000);
    expect(updateChunk).toContain('"active":true');

    await response.body!.cancel();
  }, 15000);

  it("cleans up on stream cancel", async () => {
    mockSessionManager.get.mockResolvedValue({
      id: "session-4",
      workspacePath: "/tmp/worktree-4",
    });
    mockReadSessionState.mockResolvedValue(MOCK_STATE);

    const response = await GET(makeRequest("session-4"), {
      params: Promise.resolve({ id: "session-4" }),
    });

    // Read initial snapshot to confirm stream works
    const chunk = await readChunk(response);
    expect(chunk).toContain("event: state-update");

    // Cancel the stream — triggers cancel() callback which clears intervals
    await response.body!.cancel();

    // Wait 2 seconds then verify no more data arrives (intervals cleaned up)
    const postCancelChunk = await readChunk(response, 2000);
    expect(postCancelChunk).toBeNull();
  }, 10000);

  it("sends empty state for session without workspace", async () => {
    mockSessionManager.get.mockResolvedValue({
      id: "session-5",
      workspacePath: null,
    });

    const response = await GET(makeRequest("session-5"), {
      params: Promise.resolve({ id: "session-5" }),
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("text/event-stream");

    const chunk = await readChunk(response);
    expect(chunk).not.toBeNull();
    expect(chunk).toContain("event: state-update");
    expect(chunk).toContain('"exists":false');
    expect(chunk).toContain('"activeAgents":[]');

    // readSessionState should NOT be called when workspacePath is null
    expect(mockReadSessionState).not.toHaveBeenCalled();

    await response.body!.cancel();
  }, 10000);
});
