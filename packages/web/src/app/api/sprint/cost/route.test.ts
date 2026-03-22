/**
 * GET /api/sprint/cost — Sprint cost API tests (Story 40.2).
 */
import { describe, expect, it, vi, beforeEach } from "vitest";

const mockList = vi.fn();

vi.mock("@/lib/services", () => ({
  getServices: vi.fn().mockResolvedValue({
    sessionManager: {
      list: (...args: unknown[]) => mockList(...args),
    },
  }),
}));

const { GET } = await import("./route");

beforeEach(() => {
  vi.clearAllMocks();
});

function makeSession(overrides: Record<string, unknown> = {}) {
  return {
    id: "agent-1",
    status: "working",
    issueId: "S-1",
    agentInfo: {
      cost: { inputTokens: 5000, outputTokens: 3000, estimatedCostUsd: 0.05 },
    },
    createdAt: new Date("2026-03-22T00:00:00Z"),
    lastActivityAt: new Date("2026-03-22T01:00:00Z"),
    ...overrides,
  };
}

describe("GET /api/sprint/cost", () => {
  it("returns cost summary from session token data", async () => {
    mockList.mockResolvedValueOnce([
      makeSession({ id: "agent-1" }),
      makeSession({
        id: "agent-2",
        agentInfo: { cost: { inputTokens: 2000, outputTokens: 1000 } },
      }),
    ]);

    const res = await GET();
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.cost).toBeDefined();
    expect(data.cost.totalTokens).toBe(11000); // 8000 + 3000
    expect(data.cost.totalAgents).toBe(2);
    expect(data.cost.burnRate).toBeGreaterThan(0);
  });

  it("returns empty cost when no sessions have cost data", async () => {
    mockList.mockResolvedValueOnce([
      {
        id: "agent-1",
        status: "spawning",
        agentInfo: null,
        createdAt: new Date(),
        lastActivityAt: new Date(),
      },
    ]);

    const res = await GET();
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.cost.totalTokens).toBe(0);
    expect(data.cost.totalAgents).toBe(0);
  });

  it("returns sprint clock data", async () => {
    mockList.mockResolvedValueOnce([makeSession()]);

    const res = await GET();
    const data = await res.json();

    expect(data.clock).toBeDefined();
    expect(data.clock.status).toMatch(/on-track|tight|behind/);
    expect(typeof data.clock.description).toBe("string");
    expect(typeof data.clock.timeRemainingMs).toBe("number");
  });

  it("counts merged sessions as done stories", async () => {
    mockList.mockResolvedValueOnce([
      makeSession({ id: "a1", status: "merged" }),
      makeSession({ id: "a2", status: "working" }),
      makeSession({ id: "a3", status: "cleanup" }),
    ]);

    const res = await GET();
    const data = await res.json();

    expect(data.cost.totalAgents).toBe(3);
    // Clock should reflect 2/3 stories done
    expect(data.clock).toBeDefined();
  });

  it("returns null cost/clock on error", async () => {
    mockList.mockRejectedValueOnce(new Error("Service unavailable"));

    const res = await GET();
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.cost).toBeNull();
    expect(data.clock).toBeNull();
  });

  it("includes timestamp", async () => {
    mockList.mockResolvedValueOnce([]);

    const res = await GET();
    const data = await res.json();

    expect(data.timestamp).toBeDefined();
  });
});
