import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/services", () => ({
  getServices: vi.fn(),
}));

vi.mock("@composio/ao-core", () => ({
  getPoolProjects: vi.fn(() => []),
  getCapacityStatus: vi.fn(),
}));

import { GET } from "./route";
import { getServices } from "@/lib/services";
import { getPoolProjects, getCapacityStatus } from "@composio/ao-core";

describe("GET /api/pool/capacity", () => {
  beforeEach(() => {
    vi.mocked(getServices).mockReset();
    vi.mocked(getPoolProjects).mockReset();
    vi.mocked(getCapacityStatus).mockReset();
  });

  it("returns 404 when no projects configured", async () => {
    vi.mocked(getPoolProjects).mockReturnValueOnce([]);
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
    vi.mocked(getPoolProjects).mockReturnValueOnce([]);
    vi.mocked(getServices).mockResolvedValueOnce({
      config: {
        projects: { p1: { name: "P1", path: "/tmp/p1" } },
        configPath: "/tmp/test.yaml",
      },
      sessionManager: { list: vi.fn(async () => []) },
    } as never);
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.enabled).toBe(false);
  });

  it("returns capacity status for pool agents", async () => {
    vi.mocked(getPoolProjects).mockReturnValueOnce(["pool-1"]);
    vi.mocked(getServices).mockResolvedValueOnce({
      config: {
        projects: {
          "pool-1": {
            name: "Pool1",
            path: "/tmp/pool1",
            sharedPool: { enabled: true, eligibleProjects: ["p2"] },
          },
        },
        configPath: "/tmp/test.yaml",
      },
      sessionManager: {
        list: vi.fn(async () => [
          { id: "agent-a", projectId: "pool-1" },
          { id: "agent-b", projectId: "pool-1" },
          { id: "agent-a", projectId: "pool-1" },
        ]),
      },
    } as never);

    const mockStatus = new Map([
      [
        "agent-a",
        {
          agentId: "agent-a",
          currentWorkload: 2,
          maxCapacity: 3,
          utilizationPercent: 67,
          availableSlots: 1,
          isAtCapacity: false,
          isNearCapacity: false,
        },
      ],
      [
        "agent-b",
        {
          agentId: "agent-b",
          currentWorkload: 3,
          maxCapacity: 3,
          utilizationPercent: 100,
          availableSlots: 0,
          isAtCapacity: true,
          isNearCapacity: false,
        },
      ],
    ]);
    vi.mocked(getCapacityStatus).mockReturnValueOnce(mockStatus);

    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.agents).toHaveLength(2);
    expect(body.agents[0].agentId).toBe("agent-a");
    expect(body.agents[1].isAtCapacity).toBe(true);
    expect(body.summary).toEqual({
      total: 2,
      atCapacity: 1,
      nearCapacity: 0,
      available: 1,
    });
  });

  it("returns empty agents array when sessions empty", async () => {
    vi.mocked(getPoolProjects).mockReturnValueOnce(["pool-1"]);
    vi.mocked(getServices).mockResolvedValueOnce({
      config: {
        projects: {
          "pool-1": {
            name: "Pool1",
            path: "/tmp/pool1",
            sharedPool: { enabled: true },
          },
        },
        configPath: "/tmp/test.yaml",
      },
      sessionManager: { list: vi.fn(async () => []) },
    } as never);

    vi.mocked(getCapacityStatus).mockReturnValueOnce(new Map());

    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.agents).toEqual([]);
    expect(body.summary).toEqual({
      total: 0,
      atCapacity: 0,
      nearCapacity: 0,
      available: 0,
    });
  });

  it("returns 500 on unexpected error", async () => {
    vi.mocked(getPoolProjects).mockReturnValueOnce(["pool-1"]);
    vi.mocked(getServices).mockRejectedValueOnce(new Error("Config load failed"));
    const res = await GET();
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe("Failed to compute pool capacity");
  });
});
