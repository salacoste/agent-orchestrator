/**
 * Verification Retries API Route Tests — Story 61-4, AC #6
 *
 * GET /api/sprint/[project]/story/[id]/verification/retries
 */

import { describe, expect, it, vi, beforeEach } from "vitest";

// ── Mocks (must be before route imports) ──────────────────────────────────────

const { mockLoadRetryHistory, mockGetSessionsDir, mockGetAgentRegistry, mockGetByStory } =
  vi.hoisted(() => ({
    mockLoadRetryHistory: vi.fn(),
    mockGetSessionsDir: vi.fn(() => "/tmp/sessions"),
    mockGetAgentRegistry: vi.fn(() => ({ getByStory: mockGetByStory })),
    mockGetByStory: vi.fn(),
  }));

vi.mock("@/lib/services", () => ({
  getServices: vi.fn(async () => ({
    config: {
      configPath: "/tmp/test-ao-config.yaml",
      projects: {
        "project-a": {
          name: "Project A",
          path: "/tmp/project-a",
          tracker: { plugin: "bmad" },
        },
      },
    },
  })),
}));

vi.mock("@composio/ao-core", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...(actual as Record<string, unknown>),
    loadVerificationRetryHistory: mockLoadRetryHistory,
    getSessionsDir: mockGetSessionsDir,
    getAgentRegistry: mockGetAgentRegistry,
  };
});

// Import after mocks
import { GET } from "./route.js";

beforeEach(() => {
  vi.clearAllMocks();
  mockGetSessionsDir.mockReturnValue("/tmp/sessions");
});

describe("GET /api/sprint/[project]/story/[id]/verification/retries", () => {
  it("returns 404 for unknown project", async () => {
    const res = await GET(
      new Request("http://localhost/api/sprint/unknown/story/s1/verification/retries"),
      {
        params: Promise.resolve({ project: "unknown", id: "s1" }),
      },
    );

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe("Project not found");
  });

  it("returns empty retries when story has no active assignment", async () => {
    mockGetByStory.mockReturnValue(null);

    const res = await GET(
      new Request("http://localhost/api/sprint/project-a/story/missing/verification/retries"),
      {
        params: Promise.resolve({ project: "project-a", id: "missing" }),
      },
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.retries).toEqual([]);
    expect(body.retryCount).toBe(0);
    expect(body.maxAttempts).toBe(2);
    expect(body.storyId).toBe("missing");
  });

  it("returns retry history when present", async () => {
    const retries = [
      {
        attempt: 1,
        ranAt: "2026-04-18T12:00:00Z",
        result: {
          passed: false,
          checks: [
            {
              type: "test",
              command: "pnpm test",
              passed: false,
              exitCode: 1,
              stdout: "",
              stderr: "FAIL src/foo.test.ts",
              duration: 200,
              required: true,
            },
          ],
          ranAt: "2026-04-18T12:00:00Z",
          duration: 200,
        },
      },
      {
        attempt: 2,
        ranAt: "2026-04-18T12:05:00Z",
        result: {
          passed: false,
          checks: [
            {
              type: "test",
              command: "pnpm test",
              passed: false,
              exitCode: 1,
              stdout: "",
              stderr: "FAIL src/bar.test.ts",
              duration: 180,
              required: true,
            },
          ],
          ranAt: "2026-04-18T12:05:00Z",
          duration: 180,
        },
      },
    ];
    mockGetByStory.mockReturnValue({ agentId: "agent-1", storyId: "s1" });
    mockLoadRetryHistory.mockReturnValue(retries);

    const res = await GET(
      new Request("http://localhost/api/sprint/project-a/story/s1/verification/retries"),
      {
        params: Promise.resolve({ project: "project-a", id: "s1" }),
      },
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.retries).toEqual(retries);
    expect(body.retryCount).toBe(2);
    expect(body.maxAttempts).toBe(2);
    expect(body.storyId).toBe("s1");
    expect(body.project).toBe("project-a");
  });

  it("returns empty retries when no history stored", async () => {
    mockGetByStory.mockReturnValue({ agentId: "agent-1", storyId: "s1" });
    mockLoadRetryHistory.mockReturnValue([]);

    const res = await GET(
      new Request("http://localhost/api/sprint/project-a/story/s1/verification/retries"),
      {
        params: Promise.resolve({ project: "project-a", id: "s1" }),
      },
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.retries).toEqual([]);
    expect(body.retryCount).toBe(0);
  });

  it("sets no-cache headers", async () => {
    mockGetByStory.mockReturnValue({ agentId: "agent-1", storyId: "s1" });
    mockLoadRetryHistory.mockReturnValue([]);

    const res = await GET(
      new Request("http://localhost/api/sprint/project-a/story/s1/verification/retries"),
      {
        params: Promise.resolve({ project: "project-a", id: "s1" }),
      },
    );

    expect(res.headers.get("Cache-Control")).toBe("no-cache, no-store, must-revalidate");
  });

  it("returns 500 on unexpected error", async () => {
    mockGetAgentRegistry.mockImplementation(() => {
      throw new Error("Registry corrupted");
    });

    const res = await GET(
      new Request("http://localhost/api/sprint/project-a/story/s1/verification/retries"),
      {
        params: Promise.resolve({ project: "project-a", id: "s1" }),
      },
    );

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe("Registry corrupted");
  });
});
