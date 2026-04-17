/**
 * GET /api/costs/breakdown — Model cost breakdown API tests (Story 60.5).
 */
import { describe, expect, it, vi, beforeEach } from "vitest";

const mockGetSummary = vi.fn();
const mockGetBySession = vi.fn();
const mockGetByStory = vi.fn();
const mockGetByProject = vi.fn();
const mockGetBySprint = vi.fn();

const mockAggregator = {
  getSummary: (...args: unknown[]) => mockGetSummary(...args),
  getBySession: (...args: unknown[]) => mockGetBySession(...args),
  getByStory: (...args: unknown[]) => mockGetByStory(...args),
  getByProject: (...args: unknown[]) => mockGetByProject(...args),
  getBySprint: (...args: unknown[]) => mockGetBySprint(...args),
  recordUsage: vi.fn(),
};

const mockGetModelUsageAggregator = vi.fn();

vi.mock("@composio/ao-core", () => ({
  getModelUsageAggregator: (...args: unknown[]) => mockGetModelUsageAggregator(...args),
  modelUsageAggregator: mockAggregator,
}));

const { GET } = await import("./route");

const EMPTY_AGGREGATE = {
  totalInputTokens: 0,
  totalOutputTokens: 0,
  totalCostUsd: 0,
  sessionCount: 0,
};

const SAMPLE_SUMMARY = {
  totalTokens: 150000,
  totalCost: 0.45,
  byTier: {
    low: { tokens: 10000, cost: 0.01, sessions: 2 },
    medium: { tokens: 100000, cost: 0.3, sessions: 5 },
    high: { tokens: 40000, cost: 0.14, sessions: 1 },
  },
};

const SAMPLE_USAGE = {
  totalInputTokens: 50000,
  totalOutputTokens: 10000,
  totalCostUsd: 0.15,
  sessionCount: 1,
};

beforeEach(() => {
  vi.clearAllMocks();
  // Default: registry returns undefined → falls back to singleton mock
  mockGetModelUsageAggregator.mockReturnValue(undefined);
});

function makeRequest(params: string): Request {
  return new Request(`http://localhost/api/costs/breakdown${params}`);
}

describe("GET /api/costs/breakdown", () => {
  // Summary dimension (default)
  it("returns summary when no dimension specified", async () => {
    mockGetSummary.mockReturnValueOnce(SAMPLE_SUMMARY);

    const res = await GET(makeRequest(""));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.dimension).toBe("summary");
    expect(data.totalTokens).toBe(150000);
    expect(data.totalCost).toBe(0.45);
    expect(data.byTier.low.tokens).toBe(10000);
    expect(data.byTier.medium.sessions).toBe(5);
    expect(data.byTier.high.cost).toBe(0.14);
  });

  it("returns summary when dimension=summary explicitly", async () => {
    mockGetSummary.mockReturnValueOnce({
      totalTokens: 0,
      totalCost: 0,
      byTier: {
        low: { tokens: 0, cost: 0, sessions: 0 },
        medium: { tokens: 0, cost: 0, sessions: 0 },
        high: { tokens: 0, cost: 0, sessions: 0 },
      },
    });

    const res = await GET(makeRequest("?dimension=summary"));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.dimension).toBe("summary");
    expect(data.totalTokens).toBe(0);
  });

  // Session dimension
  it("returns usage for known session", async () => {
    mockGetBySession.mockReturnValueOnce(SAMPLE_USAGE);

    const res = await GET(makeRequest("?dimension=session&sessionId=abc-123"));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.dimension).toBe("session");
    expect(data.sessionId).toBe("abc-123");
    expect(data.usage.totalInputTokens).toBe(50000);
    expect(data.usage.totalCostUsd).toBe(0.15);
    expect(mockGetBySession).toHaveBeenCalledWith("abc-123");
  });

  it("returns empty aggregate for unknown session", async () => {
    mockGetBySession.mockReturnValueOnce(EMPTY_AGGREGATE);

    const res = await GET(makeRequest("?dimension=session&sessionId=unknown"));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.usage.totalInputTokens).toBe(0);
    expect(data.usage.sessionCount).toBe(0);
  });

  // Story dimension
  it("returns usage for known story", async () => {
    mockGetByStory.mockReturnValueOnce(SAMPLE_USAGE);

    const res = await GET(makeRequest("?dimension=story&storyId=60-5-model-cost-api-route"));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.dimension).toBe("story");
    expect(data.storyId).toBe("60-5-model-cost-api-route");
    expect(data.usage.totalInputTokens).toBe(50000);
    expect(mockGetByStory).toHaveBeenCalledWith("60-5-model-cost-api-route");
  });

  it("returns empty aggregate for unknown story", async () => {
    mockGetByStory.mockReturnValueOnce(EMPTY_AGGREGATE);

    const res = await GET(makeRequest("?dimension=story&storyId=nonexistent"));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.usage.totalInputTokens).toBe(0);
    expect(data.usage.sessionCount).toBe(0);
  });

  // Project dimension
  it("returns usage for known project", async () => {
    mockGetByProject.mockReturnValueOnce(SAMPLE_USAGE);

    const res = await GET(makeRequest("?dimension=project&projectId=my-project"));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.dimension).toBe("project");
    expect(data.projectId).toBe("my-project");
    expect(data.usage.totalCostUsd).toBe(0.15);
    expect(mockGetByProject).toHaveBeenCalledWith("my-project");
  });

  it("returns empty aggregate for unknown project", async () => {
    mockGetByProject.mockReturnValueOnce(EMPTY_AGGREGATE);

    const res = await GET(makeRequest("?dimension=project&projectId=nonexistent"));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.usage.totalInputTokens).toBe(0);
    expect(data.usage.sessionCount).toBe(0);
  });

  // Sprint dimension
  it("returns usage for known sprint", async () => {
    mockGetBySprint.mockResolvedValueOnce(SAMPLE_USAGE);

    const res = await GET(makeRequest("?dimension=sprint&projectPath=/path/to/project"));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.dimension).toBe("sprint");
    expect(data.projectPath).toBe("/path/to/project");
    expect(data.usage.totalInputTokens).toBe(50000);
    expect(data.usage.totalOutputTokens).toBe(10000);
    expect(mockGetBySprint).toHaveBeenCalledWith("/path/to/project");
  });

  it("returns empty aggregate for sprint with no data", async () => {
    mockGetBySprint.mockResolvedValueOnce(EMPTY_AGGREGATE);

    const res = await GET(makeRequest("?dimension=sprint&projectPath=/empty/project"));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.usage.totalInputTokens).toBe(0);
    expect(data.usage.sessionCount).toBe(0);
  });

  // Missing required parameters → 400
  it("returns 400 when dimension=session without sessionId", async () => {
    const res = await GET(makeRequest("?dimension=session"));
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toContain("sessionId");
  });

  it("returns 400 when dimension=story without storyId", async () => {
    const res = await GET(makeRequest("?dimension=story"));
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toContain("storyId");
  });

  it("returns 400 when dimension=project without projectId", async () => {
    const res = await GET(makeRequest("?dimension=project"));
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toContain("projectId");
  });

  it("returns 400 when dimension=sprint without projectPath", async () => {
    const res = await GET(makeRequest("?dimension=sprint"));
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toContain("projectPath");
  });

  // Invalid dimension → 400
  it("returns 400 for invalid dimension", async () => {
    const res = await GET(makeRequest("?dimension=invalid"));
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toContain("Invalid dimension");
  });

  // Internal error → 500
  it("returns 500 on internal error", async () => {
    mockGetSummary.mockImplementationOnce(() => {
      throw new Error("Aggregator exploded");
    });

    const res = await GET(makeRequest(""));
    const data = await res.json();

    expect(res.status).toBe(500);
    expect(data.error).toBe("Internal server error");
  });

  it("returns 500 when aggregator resolution throws", async () => {
    mockGetModelUsageAggregator.mockImplementationOnce(() => {
      throw new Error("Registry corrupted");
    });

    const res = await GET(makeRequest(""));
    const data = await res.json();

    expect(res.status).toBe(500);
    expect(data.error).toBe("Internal server error");
  });

  // Registry fallback
  it("uses registry aggregator when available", async () => {
    const registryAggregator = {
      ...mockAggregator,
      getSummary: vi.fn(),
    };
    mockGetModelUsageAggregator.mockReturnValueOnce(registryAggregator);
    registryAggregator.getSummary.mockReturnValueOnce(SAMPLE_SUMMARY);

    const res = await GET(makeRequest(""));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.totalTokens).toBe(150000);
    expect(mockGetModelUsageAggregator).toHaveBeenCalled();
  });
});
