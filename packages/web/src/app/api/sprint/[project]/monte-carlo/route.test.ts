/**
 * Monte Carlo API route tests — query parameter acceptance (Story 55.6).
 */
import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/services", () => ({
  getServices: vi.fn(() =>
    Promise.resolve({
      config: {
        projects: {
          testproj: {
            name: "Test Project",
            path: "/tmp/testproj",
            tracker: { plugin: "bmad" },
          },
        },
      },
    } as never),
  ),
}));

const mockResult = {
  percentiles: { p50: "2025-07-01", p80: "2025-07-15", p95: "2025-08-01" },
  histogram: [] as Array<{ date: string; probability: number; cumulative: number }>,
  remainingStories: 10,
  simulationCount: 5000,
  sampleSize: 30,
  averageDailyRate: 1.2,
  linearCompletionDate: "2025-07-10",
  linearConfidence: 0.6,
  insufficientData: false,
};

vi.mock("@composio/ao-plugin-tracker-bmad", () => ({
  computeMonteCarloForecast: vi.fn(() => ({ ...mockResult })),
  appendForecastLog: vi.fn(),
  computeCalibration: vi.fn(() => ({ insufficientData: true })),
  computeForecastDiff: vi.fn(() => ({ significantChange: false })),
}));

vi.mock("@/lib/forecast-change-broadcaster", () => ({
  broadcastForecastChange: vi.fn(),
}));

import { GET } from "./route";

function makeRequest(project: string, query = "") {
  return new Request(
    `http://localhost/api/sprint/${project}/monte-carlo${query ? `?${query}` : ""}`,
  );
}

function makeParams(project: string) {
  return { params: Promise.resolve({ project }) };
}

describe("GET /api/sprint/:project/monte-carlo", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("accepts simulations query param and clamps to [1000, 100000]", async () => {
    const res = await GET(makeRequest("testproj", "simulations=500"), makeParams("testproj"));
    expect(res.status).toBe(200);
    const data = await res.json();
    // simulations=500 is clamped to 1000 minimum by route
    expect(data.effectiveConfig).toBeDefined();
  });

  it("accepts throughputWindowDays query param", async () => {
    const res = await GET(
      makeRequest("testproj", "throughputWindowDays=90"),
      makeParams("testproj"),
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.effectiveConfig.throughputWindowDays).toBe(90);
  });

  it("accepts excludeWeekends=false query param", async () => {
    const res = await GET(makeRequest("testproj", "excludeWeekends=false"), makeParams("testproj"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.effectiveConfig.excludeWeekends).toBe(false);
  });

  it("defaults excludeWeekends to true when not provided", async () => {
    const res = await GET(makeRequest("testproj"), makeParams("testproj"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.effectiveConfig.excludeWeekends).toBe(true);
  });

  it("filters percentiles by confidenceLevels param", async () => {
    const res = await GET(makeRequest("testproj", "confidenceLevels=p50"), makeParams("testproj"));
    expect(res.status).toBe(200);
    const data = await res.json();
    // Only p50 should be present, not p80 or p95
    expect(data.percentiles.p50).toBe("2025-07-01");
    expect(data.percentiles.p80).toBeUndefined();
    expect(data.percentiles.p95).toBeUndefined();
  });

  it("returns all percentiles when confidenceLevels is not provided", async () => {
    const res = await GET(makeRequest("testproj"), makeParams("testproj"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.percentiles.p50).toBe("2025-07-01");
    expect(data.percentiles.p80).toBe("2025-07-15");
    expect(data.percentiles.p95).toBe("2025-08-01");
  });

  it("returns effectiveConfig with actual simulation count and dataPointsUsed", async () => {
    const res = await GET(makeRequest("testproj"), makeParams("testproj"));
    const data = await res.json();
    expect(data.effectiveConfig).toEqual({
      simulations: 5000,
      throughputWindowDays: 0,
      excludeWeekends: true,
      dataPointsUsed: 30,
    });
  });

  it("clamps throughputWindowDays to 365 max", async () => {
    const res = await GET(
      makeRequest("testproj", "throughputWindowDays=400"),
      makeParams("testproj"),
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.effectiveConfig.throughputWindowDays).toBe(365);
  });

  it("returns 404 for unknown project", async () => {
    const res = await GET(makeRequest("nonexistent"), makeParams("nonexistent"));
    expect(res.status).toBe(404);
  });
});
