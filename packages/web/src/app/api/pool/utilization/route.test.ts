import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/services", () => ({
  getServices: vi.fn(),
}));

vi.mock("@composio/ao-core", () => ({
  computePoolUtilizationOverview: vi.fn(),
  getAgentRegistry: vi.fn(() => ({ getByAgent: () => null })),
  getPoolProjects: vi.fn(() => []),
  getSessionsDir: vi.fn(() => "/tmp/sessions"),
}));

import { GET } from "./route";
import { getServices } from "@/lib/services";
import { computePoolUtilizationOverview } from "@composio/ao-core";

describe("GET /api/pool/utilization", () => {
  beforeEach(() => {
    vi.mocked(getServices).mockReset();
    vi.mocked(computePoolUtilizationOverview).mockReset();
  });

  it("returns 404 when no projects configured", async () => {
    vi.mocked(getServices).mockResolvedValueOnce({
      config: { projects: {}, configPath: "/tmp/test.yaml" },
      sessionManager: { list: vi.fn(async () => []) },
    } as never);
    const res = await GET();
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe("No projects configured");
  });

  it("returns enabled:false when no pool projects", async () => {
    vi.mocked(getServices).mockResolvedValueOnce({
      config: {
        projects: { p1: { name: "P1", path: "/tmp/p1" } },
        configPath: "/tmp/test.yaml",
      },
      sessionManager: { list: vi.fn(async () => []) },
    } as never);
    vi.mocked(computePoolUtilizationOverview).mockReturnValueOnce(undefined);
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.enabled).toBe(false);
  });

  it("returns pool utilization overview for pool projects", async () => {
    vi.mocked(getServices).mockResolvedValueOnce({
      config: {
        projects: {
          p1: {
            name: "P1",
            path: "/tmp/p1",
            sharedPool: { enabled: true, eligibleProjects: ["p2"] },
          },
        },
        configPath: "/tmp/test.yaml",
      },
      sessionManager: { list: vi.fn(async () => []) },
    } as never);
    vi.mocked(computePoolUtilizationOverview).mockReturnValueOnce({
      totalPoolAgents: 4,
      activePoolAgents: 3,
      utilizationPercent: 75,
      reservedAgentCount: 1,
      poolProjectCount: 1,
      projectBreakdown: [],
    });
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.totalPoolAgents).toBe(4);
    expect(body.utilizationPercent).toBe(75);
  });
});
