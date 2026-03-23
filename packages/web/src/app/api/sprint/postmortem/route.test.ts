/**
 * Post-mortem API route tests (Story 45.3).
 */
import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/services", () => ({
  getServices: vi.fn(),
}));

vi.mock("@composio/ao-core", () => ({
  generatePostMortem: vi.fn((sessions: Array<{ outcome: string; storyId: string }>) => {
    const failures = sessions.filter(
      (s) => s.outcome === "failed" || s.outcome === "blocked" || s.outcome === "abandoned",
    );
    return {
      title: failures.length > 0 ? `Post-Mortem — ${failures.length} issues` : "No Failures",
      generatedAt: new Date().toISOString(),
      hasFailures: failures.length > 0,
      summary: {
        totalFailures: failures.filter((s) => s.outcome === "failed").length,
        totalBlocked: failures.filter((s) => s.outcome === "blocked").length,
        totalAbandoned: 0,
        uniqueStories: new Set(failures.map((s) => s.storyId)).size,
        timeRange: null,
      },
      timeline: [],
      errorBreakdown: [],
      affectedFiles: [],
      recommendations: [],
      markdown: "# Post-Mortem Report",
    };
  }),
}));

import { GET } from "./route";
import { getServices } from "@/lib/services";

const mockGetServices = vi.mocked(getServices);

beforeEach(() => {
  vi.clearAllMocks();

  mockGetServices.mockResolvedValue({
    learningStore: {
      query: vi.fn((filter: { outcome: string }) => {
        if (filter.outcome === "failed") {
          return [
            { outcome: "failed", storyId: "1-1", agentId: "a-1", errorCategories: ["timeout"] },
            { outcome: "failed", storyId: "1-2", agentId: "a-2", errorCategories: ["exit_code_1"] },
          ];
        }
        if (filter.outcome === "blocked") {
          return [{ outcome: "blocked", storyId: "1-3", agentId: "a-3", errorCategories: [] }];
        }
        return [];
      }),
    },
  } as never);
});

describe("GET /api/sprint/postmortem", () => {
  it("returns post-mortem report with correct structure", async () => {
    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.hasFailures).toBe(true);
    expect(data.summary.totalFailures).toBe(2);
    expect(data.summary.totalBlocked).toBe(1);
    expect(data.markdown).toContain("Post-Mortem");
  });

  it("returns no-failures report when learning store is empty", async () => {
    mockGetServices.mockResolvedValue({
      learningStore: {
        query: vi.fn(() => []),
      },
    } as never);

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.hasFailures).toBe(false);
    expect(data.summary.totalFailures).toBe(0);
  });

  it("handles missing learning store gracefully", async () => {
    mockGetServices.mockResolvedValue({
      learningStore: null,
    } as never);

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.hasFailures).toBe(false);
  });

  it("returns 500 on service failure", async () => {
    mockGetServices.mockRejectedValue(new Error("Service unavailable"));

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe("Service unavailable");
  });
});
