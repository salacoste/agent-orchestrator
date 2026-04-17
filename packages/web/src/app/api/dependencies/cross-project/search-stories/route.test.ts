/**
 * Cross-Project Story Search API Route Tests (Story 51.1)
 *
 * Tests for GET /api/dependencies/cross-project/search-stories
 */

import { describe, expect, it, vi, beforeEach } from "vitest";

// ── Mocks (must be before route imports) ──────────────────────────────────────

vi.mock("@/lib/services", () => ({
  getServices: vi.fn(async () => ({
    config: {
      configPath: "/tmp/test-ao-config.yaml",
      projects: {
        "project-a": {},
        "project-b": {},
      },
    },
  })),
}));

vi.mock("@composio/ao-core", async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    searchCrossProjectStories: vi.fn(() => [
      {
        id: "51-1-some-story",
        title: "1 some story",
        status: "in-progress",
        projectId: "project-a",
      },
    ]),
  };
});

vi.mock("@composio/ao-plugin-tracker-bmad", () => ({
  readSprintStatus: vi.fn(() => ({
    development_status: {
      "51-1-some-story": "in-progress",
      "49-3-another": "done",
    },
  })),
}));

// ── Route import ──────────────────────────────────────────────────────────────

import { GET } from "./route";
import { searchCrossProjectStories } from "@composio/ao-core";

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeRequest(url: string): Request {
  return new Request(url);
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("GET /api/dependencies/cross-project/search-stories", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns search results for a query", async () => {
    const req = makeRequest(
      "http://localhost/api/dependencies/cross-project/search-stories?q=some-story",
    );
    const res = await GET(req as never);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.stories).toHaveLength(1);
    expect(data.stories[0].id).toBe("51-1-some-story");
  });

  it("returns 400 when q param is missing", async () => {
    const req = makeRequest("http://localhost/api/dependencies/cross-project/search-stories");
    const res = await GET(req as never);
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toContain("q");
  });

  it("returns empty stories when no matches", async () => {
    vi.mocked(searchCrossProjectStories).mockReturnValueOnce([]);

    const req = makeRequest(
      "http://localhost/api/dependencies/cross-project/search-stories?q=zzz-nonexistent",
    );
    const res = await GET(req as never);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.stories).toHaveLength(0);
  });
});
