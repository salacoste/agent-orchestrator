/**
 * ROI API route tests (Story 45.4).
 */
import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/services", () => ({
  getServices: vi.fn(),
}));

vi.mock("@composio/ao-core", () => ({
  calculateROI: vi.fn((stories: number, tokens: number, config: Record<string, number> = {}) => {
    const rate = config.pricePerMillionTokens ?? 15;
    const cost = (tokens * rate) / 1_000_000;
    return {
      storiesCompleted: stories,
      totalTokens: tokens,
      totalCostUsd: Math.round(cost * 100) / 100,
      humanHoursSaved: stories * (config.hoursPerStory ?? 4),
      humanCostEquivalent: stories * (config.hoursPerStory ?? 4) * (config.hourlyRate ?? 75),
      costPerStory: stories > 0 ? Math.round((cost / stories) * 100) / 100 : 0,
      efficiencyRatio: 0,
      breakdown: `${stories} stories`,
    };
  }),
}));

import { GET } from "./route";
import { getServices } from "@/lib/services";

const mockGetServices = vi.mocked(getServices);

beforeEach(() => {
  vi.clearAllMocks();

  mockGetServices.mockResolvedValue({
    sessionManager: {
      list: () => [
        {
          status: "completed",
          agentInfo: { cost: { inputTokens: 100_000, outputTokens: 50_000 } },
        },
        {
          status: "completed",
          agentInfo: { cost: { inputTokens: 200_000, outputTokens: 100_000 } },
        },
        { status: "running", agentInfo: { cost: { inputTokens: 50_000, outputTokens: 25_000 } } },
      ],
    },
  } as never);
});

describe("GET /api/sprint/roi", () => {
  it("returns ROI report with correct structure", async () => {
    const response = await GET(new Request("http://localhost/api/sprint/roi"));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.storiesCompleted).toBe(2);
    // Only completed sessions: 100K+50K + 200K+100K = 450K (running session excluded)
    expect(data.totalTokens).toBe(450_000);
    expect(data.breakdown).toContain("2 stories");
  });

  it("passes query param overrides to calculator", async () => {
    const response = await GET(
      new Request("http://localhost/api/sprint/roi?hoursPerStory=8&hourlyRate=100"),
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    // 2 stories × 8h × $100 = $1600
    expect(data.humanCostEquivalent).toBe(1600);
  });

  it("handles empty session list", async () => {
    mockGetServices.mockResolvedValue({
      sessionManager: { list: () => [] },
    } as never);

    const response = await GET(new Request("http://localhost/api/sprint/roi"));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.storiesCompleted).toBe(0);
    expect(data.totalTokens).toBe(0);
  });

  it("returns 500 on service failure", async () => {
    mockGetServices.mockRejectedValue(new Error("Service unavailable"));

    const response = await GET(new Request("http://localhost/api/sprint/roi"));
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe("Service unavailable");
  });
});
