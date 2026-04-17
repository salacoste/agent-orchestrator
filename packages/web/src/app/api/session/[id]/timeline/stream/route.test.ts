/**
 * GET /api/session/[id]/timeline/stream — SSE Route Tests
 *
 * Epic 60, Story 60-3 (AC11 — SSE tests).
 *
 * Uses real timers because ReadableStream uses real async primitives
 * that fake timers cannot advance.
 */

import { describe, expect, it, vi, beforeEach } from "vitest";

// ── Mocks (must be before route imports) ──────────────────────────────────────

const { mockSessionManager, mockReadTimeline } = vi.hoisted(() => ({
  mockSessionManager: { get: vi.fn() },
  mockReadTimeline: vi.fn(),
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
    readTimeline: mockReadTimeline,
  };
});

// Import after mocks
import { GET } from "./route";

function makeRequest(sessionId: string) {
  return new Request(`http://localhost/api/session/${sessionId}/timeline/stream`) as never;
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

const SAMPLE_ENTRIES = [
  {
    agent: "planner",
    agentType: "planner",
    action: "Agent planner started",
    event: "agent_start",
    timestamp: 1.0,
    model: "claude-sonnet-4-6",
  },
];

describe("GET /api/session/[id]/timeline/stream", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // SSE sends initial snapshot
  it("sends initial timeline snapshot on connection", async () => {
    mockSessionManager.get.mockResolvedValue({
      id: "s1",
      workspacePath: "/tmp/worktree-1",
    });
    mockReadTimeline.mockResolvedValue(SAMPLE_ENTRIES);

    const response = await GET(makeRequest("s1"), {
      params: Promise.resolve({ id: "s1" }),
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("text/event-stream");
    expect(response.headers.get("Cache-Control")).toBe("no-cache");

    const chunk = await readChunk(response);
    expect(chunk).not.toBeNull();
    expect(chunk).toContain("timeline-update");
    expect(chunk).toContain("planner");
    expect(chunk).toContain('"totalEntries":1');

    await response.body!.cancel();
  }, 10000);

  // SSE sends empty snapshot for session without workspace
  it("sends empty snapshot for session without workspace", async () => {
    mockSessionManager.get.mockResolvedValue({
      id: "s2",
      workspacePath: null,
    });

    const response = await GET(makeRequest("s2"), {
      params: Promise.resolve({ id: "s2" }),
    });

    const chunk = await readChunk(response);
    expect(chunk).toContain("timeline-update");
    expect(chunk).toContain('"totalEntries":0');

    await response.body!.cancel();
  }, 10000);

  // SSE sends heartbeat after initial snapshot (verifies ordering)
  it("sends heartbeat after initial snapshot (verifies ordering)", async () => {
    mockSessionManager.get.mockResolvedValue({
      id: "s3",
      workspacePath: "/tmp/worktree-3",
    });
    mockReadTimeline.mockResolvedValue([]);

    const response = await GET(makeRequest("s3"), {
      params: Promise.resolve({ id: "s3" }),
    });

    // Read initial snapshot + heartbeat (wait up to 20s for heartbeat)
    const chunks = await readChunks(response, 2, 20000);

    // Verify ordering: snapshot arrives first (chunk 0), heartbeat second (chunk 1)
    expect(chunks.length).toBeGreaterThanOrEqual(2);
    expect(chunks[0]).toContain("timeline-update");
    expect(chunks[1]).toContain(": heartbeat");

    await response.body!.cancel();
  }, 25000);

  // SSE detects new timeline entries via polling
  it("detects new timeline entries via polling", async () => {
    mockSessionManager.get.mockResolvedValue({
      id: "s4",
      workspacePath: "/tmp/worktree-4",
    });

    // Initial: 1 entry
    mockReadTimeline.mockResolvedValueOnce(SAMPLE_ENTRIES);

    const response = await GET(makeRequest("s4"), {
      params: Promise.resolve({ id: "s4" }),
    });

    // Read initial snapshot
    const chunk0 = await readChunk(response);
    expect(chunk0).toContain('"totalEntries":1');

    // After poll (10s), return 2 entries
    mockReadTimeline.mockResolvedValue([
      ...SAMPLE_ENTRIES,
      {
        agent: "executor",
        agentType: "executor",
        action: "Agent executor started",
        event: "agent_start",
        timestamp: 10.0,
      },
    ]);

    // Read the poll update (wait up to 15s for 10s poll)
    const chunks = await readChunks(response, 1, 15000);
    const combined = chunks.join("");
    expect(combined).toContain("executor");
    expect(combined).toContain('"totalEntries":2');

    await response.body!.cancel();
  }, 30000);

  // SSE cleans up intervals on cancel — verifies cancel completes without error
  it("cleans up intervals on cancel", async () => {
    mockSessionManager.get.mockResolvedValue({
      id: "s5",
      workspacePath: "/tmp/worktree-5",
    });
    mockReadTimeline.mockResolvedValue([]);

    const response = await GET(makeRequest("s5"), {
      params: Promise.resolve({ id: "s5" }),
    });

    // Verify initial snapshot was received (real assertion)
    const chunk = await readChunk(response);
    expect(chunk).toContain("timeline-update");
    expect(chunk).toContain('"totalEntries":0');

    // Cancel the stream — if this throws, the test fails
    await response.body!.cancel();
  }, 10000);

  // SSE sets correct headers
  it("sets correct SSE headers", async () => {
    mockSessionManager.get.mockResolvedValue({
      id: "s6",
      workspacePath: "/tmp/worktree-6",
    });
    mockReadTimeline.mockResolvedValue([]);

    const response = await GET(makeRequest("s6"), {
      params: Promise.resolve({ id: "s6" }),
    });

    expect(response.headers.get("Content-Type")).toBe("text/event-stream");
    expect(response.headers.get("Cache-Control")).toBe("no-cache");
    expect(response.headers.get("X-Accel-Buffering")).toBe("no");

    await response.body!.cancel();
  }, 10000);
});
