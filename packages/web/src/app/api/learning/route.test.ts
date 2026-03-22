/**
 * GET /api/learning — Learning insights API tests (Story 39.4).
 */
import { describe, expect, it, vi, beforeEach } from "vitest";
import type { SessionLearning } from "@composio/ao-core";

const mockGetLearningStore = vi.fn();

vi.mock("@composio/ao-core", () => ({
  getLearningStore: () => mockGetLearningStore(),
}));

vi.mock("@/lib/services", () => ({
  getServices: vi.fn().mockResolvedValue({}),
}));

const { GET } = await import("./route");

beforeEach(() => {
  vi.clearAllMocks();
});

function makeLearning(overrides: Partial<SessionLearning> = {}): SessionLearning {
  return {
    sessionId: "s-1",
    agentId: "agent-1",
    storyId: "1-1",
    projectId: "proj",
    outcome: "completed",
    durationMs: 60000,
    retryCount: 0,
    filesModified: ["src/index.ts"],
    testsAdded: 3,
    errorCategories: [],
    domainTags: ["typescript"],
    completedAt: "2026-03-22T00:00:00Z",
    capturedAt: "2026-03-22T00:00:00Z",
    ...overrides,
  };
}

describe("GET /api/learning", () => {
  it("returns empty data when store not initialized", async () => {
    mockGetLearningStore.mockReturnValue(undefined);

    const res = await GET();
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.totalSessions).toBe(0);
    expect(data.topPatterns).toEqual([]);
    expect(data.recentLearnings).toEqual([]);
  });

  it("returns empty data when store has no learnings", async () => {
    mockGetLearningStore.mockReturnValue({ list: () => [] });

    const res = await GET();
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.totalSessions).toBe(0);
  });

  it("computes correct success and failure rates", async () => {
    mockGetLearningStore.mockReturnValue({
      list: () => [
        makeLearning({ outcome: "completed" }),
        makeLearning({ outcome: "completed" }),
        makeLearning({ outcome: "failed", errorCategories: ["type-error"] }),
        makeLearning({ outcome: "blocked" }),
      ],
    });

    const res = await GET();
    const data = await res.json();

    expect(data.totalSessions).toBe(4);
    expect(data.successRate).toBe(50); // 2/4
    expect(data.failureRate).toBe(25); // 1/4
  });

  it("detects cross-sprint patterns from errorCategories", async () => {
    mockGetLearningStore.mockReturnValue({
      list: () => [
        makeLearning({ errorCategories: ["import-error"] }),
        makeLearning({ errorCategories: ["import-error"] }),
        makeLearning({ errorCategories: ["import-error"] }),
        makeLearning({ errorCategories: ["type-error"] }),
      ],
    });

    const res = await GET();
    const data = await res.json();

    // "import-error" appears 3 times → should be detected as pattern
    expect(data.topPatterns.length).toBeGreaterThanOrEqual(1);
    expect(data.topPatterns[0].frequency).toBe(3);
  });

  it("returns failure breakdown from analyzeFailures", async () => {
    mockGetLearningStore.mockReturnValue({
      list: () => [
        makeLearning({
          outcome: "failed",
          errorCategories: ["lint-error"],
          filesModified: ["a.ts"],
        }),
        makeLearning({
          outcome: "failed",
          errorCategories: ["lint-error"],
          filesModified: ["b.ts"],
        }),
      ],
    });

    const res = await GET();
    const data = await res.json();

    expect(data.failureBreakdown.length).toBeGreaterThanOrEqual(1);
    expect(data.failureBreakdown[0].category).toBe("lint-error");
    expect(data.failureBreakdown[0].count).toBe(2);
  });

  it("returns recent learnings sorted newest first, limited to 10", async () => {
    const learnings = Array.from({ length: 15 }, (_, i) =>
      makeLearning({
        sessionId: `s-${i}`,
        capturedAt: `2026-03-${String(i + 1).padStart(2, "0")}T00:00:00Z`,
      }),
    );
    mockGetLearningStore.mockReturnValue({ list: () => learnings });

    const res = await GET();
    const data = await res.json();

    expect(data.recentLearnings).toHaveLength(10);
    // Newest first
    expect(data.recentLearnings[0].sessionId).toBe("s-14");
    expect(data.recentLearnings[9].sessionId).toBe("s-5");
  });

  it("includes timestamp in response", async () => {
    mockGetLearningStore.mockReturnValue({ list: () => [] });

    const res = await GET();
    const data = await res.json();

    expect(data.timestamp).toBeDefined();
    expect(typeof data.timestamp).toBe("string");
  });
});
