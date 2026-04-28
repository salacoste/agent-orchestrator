/**
 * Verification API Route Tests — Story 61-3, AC #6
 *
 * GET /api/sprint/[project]/story/[id]/verification
 */

import { describe, expect, it, vi, beforeEach } from "vitest";

// ── Mocks (must be before route imports) ──────────────────────────────────────

const { mockLoadVerificationResult, mockGetSessionsDir, mockGetAgentRegistry, mockGetByStory } =
  vi.hoisted(() => ({
    mockLoadVerificationResult: vi.fn(),
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
    loadVerificationResult: mockLoadVerificationResult,
    getSessionsDir: mockGetSessionsDir,
    getAgentRegistry: mockGetAgentRegistry,
  };
});

// Import after mocks
import { GET } from "./route.ts";

beforeEach(() => {
  vi.clearAllMocks();
  mockGetSessionsDir.mockReturnValue("/tmp/sessions");
});

describe("GET /api/sprint/[project]/story/[id]/verification", () => {
  it("returns 404 for unknown project", async () => {
    const res = await GET(
      new Request("http://localhost/api/sprint/unknown/story/s1/verification"),
      {
        params: Promise.resolve({ project: "unknown", id: "s1" }),
      },
    );

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe("Project not found");
  });

  it("returns null verification when story has no active assignment", async () => {
    mockGetByStory.mockReturnValue(null);

    const res = await GET(
      new Request("http://localhost/api/sprint/project-a/story/missing/verification"),
      {
        params: Promise.resolve({ project: "project-a", id: "missing" }),
      },
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.verification).toBeNull();
    expect(body.storyId).toBe("missing");
  });

  it("returns verification result when present", async () => {
    const verification = {
      passed: true,
      checks: [
        {
          type: "test",
          command: "pnpm test",
          passed: true,
          exitCode: 0,
          stdout: "",
          stderr: "",
          duration: 150,
          required: true,
        },
      ],
      ranAt: "2026-04-18T12:00:00Z",
      duration: 150,
    };
    mockGetByStory.mockReturnValue({ agentId: "agent-1", storyId: "s1" });
    mockLoadVerificationResult.mockReturnValue(verification);

    const res = await GET(
      new Request("http://localhost/api/sprint/project-a/story/s1/verification"),
      {
        params: Promise.resolve({ project: "project-a", id: "s1" }),
      },
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.verification).toEqual(verification);
    expect(body.storyId).toBe("s1");
    expect(body.project).toBe("project-a");
  });

  it("returns null verification when no result stored", async () => {
    mockGetByStory.mockReturnValue({ agentId: "agent-1", storyId: "s1" });
    mockLoadVerificationResult.mockReturnValue(null);

    const res = await GET(
      new Request("http://localhost/api/sprint/project-a/story/s1/verification"),
      {
        params: Promise.resolve({ project: "project-a", id: "s1" }),
      },
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.verification).toBeNull();
  });

  it("sets no-cache headers", async () => {
    mockGetByStory.mockReturnValue({ agentId: "agent-1", storyId: "s1" });
    mockLoadVerificationResult.mockReturnValue(null);

    const res = await GET(
      new Request("http://localhost/api/sprint/project-a/story/s1/verification"),
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
      new Request("http://localhost/api/sprint/project-a/story/s1/verification"),
      {
        params: Promise.resolve({ project: "project-a", id: "s1" }),
      },
    );

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe("Registry corrupted");
  });
});
