/**
 * Sprint diff API route tests (Story 45.8).
 */
import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/services", () => ({
  getServices: vi.fn(),
}));

vi.mock("@composio/ao-core", () => ({
  computeSprintDiff: vi.fn((a: Array<{ outcome: string }>, b: Array<{ outcome: string }>) => ({
    storiesCompleted: {
      periodA: a.filter((s) => s.outcome === "completed").length,
      periodB: b.filter((s) => s.outcome === "completed").length,
      direction: "improved",
    },
    avgDurationMs: { periodA: 0, periodB: 0, direction: "unchanged" },
    failureRate: { periodA: 0, periodB: 0, direction: "unchanged" },
    totalTokens: { periodA: 0, periodB: 0, direction: "unchanged" },
    topErrorsA: [],
    topErrorsB: [],
  })),
}));

import { GET } from "./route";
import { getServices } from "@/lib/services";

const mockGetServices = vi.mocked(getServices);

beforeEach(() => {
  vi.clearAllMocks();

  mockGetServices.mockResolvedValue({
    learningStore: {
      query: vi.fn(() => [
        { outcome: "completed", completedAt: "2026-03-10T10:00:00Z" },
        { outcome: "failed", completedAt: "2026-03-12T10:00:00Z" },
        { outcome: "completed", completedAt: "2026-03-20T10:00:00Z" },
        { outcome: "completed", completedAt: "2026-03-22T10:00:00Z" },
      ]),
    },
  } as never);
});

describe("GET /api/sprint/diff", () => {
  it("returns diff comparing two periods", async () => {
    const response = await GET(
      new Request("http://localhost/api/sprint/diff?a=2026-03-01T00:00:00Z&b=2026-03-15T00:00:00Z"),
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.storiesCompleted).toBeDefined();
    expect(data.storiesCompleted.direction).toBe("improved");
  });

  it("returns 400 when params missing", async () => {
    const response = await GET(new Request("http://localhost/api/sprint/diff"));
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain("required");
  });

  it("returns 400 for invalid timestamps", async () => {
    const response = await GET(
      new Request("http://localhost/api/sprint/diff?a=invalid&b=also-invalid"),
    );

    expect(response.status).toBe(400);
  });

  it("returns 500 on service failure", async () => {
    mockGetServices.mockRejectedValue(new Error("Service unavailable"));

    const response = await GET(
      new Request("http://localhost/api/sprint/diff?a=2026-03-01T00:00:00Z&b=2026-03-15T00:00:00Z"),
    );

    expect(response.status).toBe(500);
  });
});
