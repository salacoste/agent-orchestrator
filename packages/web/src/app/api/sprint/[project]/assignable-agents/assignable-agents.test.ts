import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/services", () => ({
  getServices: vi.fn(),
}));

vi.mock("@composio/ao-core", () => ({
  getAgentRegistry: vi.fn(() => ({})),
  getSessionsDir: vi.fn(() => "/tmp/sessions"),
  getAssignableAgents: vi.fn(),
  checkCapacity: vi.fn(),
}));

import { GET } from "./route";
import { getServices } from "@/lib/services";
import { getAssignableAgents, checkCapacity } from "@composio/ao-core";

describe("GET /api/sprint/[project]/assignable-agents", () => {
  beforeEach(() => {
    vi.mocked(getServices).mockReset();
    vi.mocked(getAssignableAgents).mockReset();
    vi.mocked(checkCapacity).mockReset();
  });

  it("returns 404 for unknown project", async () => {
    vi.mocked(getServices).mockResolvedValueOnce({
      config: { projects: {}, configPath: "/tmp/test.yaml" },
      sessionManager: { list: vi.fn(async () => []) },
    } as never);
    const request = new Request("http://localhost/api/sprint/unknown/assignable-agents");
    const res = await GET(request, { params: Promise.resolve({ project: "unknown" }) });
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe("Project not found");
  });

  it("returns agents with capacityStatus field", async () => {
    vi.mocked(getServices).mockResolvedValueOnce({
      config: {
        projects: {
          "test-project": { name: "Test", path: "/tmp/test" },
        },
        configPath: "/tmp/test.yaml",
      },
      sessionManager: { list: vi.fn(async () => []) },
    } as never);

    vi.mocked(getAssignableAgents).mockResolvedValueOnce([
      {
        agentId: "local-agent",
        projectId: "test-project",
        sourceProjectId: undefined,
        isPoolAgent: false,
        currentWorkload: 1,
      },
      {
        agentId: "pool-agent",
        projectId: "pool-src",
        sourceProjectId: "pool-src",
        isPoolAgent: true,
        currentWorkload: 3,
      },
    ]);

    vi.mocked(checkCapacity)
      .mockReturnValueOnce({
        agentId: "local-agent",
        currentWorkload: 1,
        maxCapacity: 5,
        utilizationPercent: 20,
        availableSlots: 4,
        isAtCapacity: false,
        isNearCapacity: false,
      })
      .mockReturnValueOnce({
        agentId: "pool-agent",
        currentWorkload: 3,
        maxCapacity: 3,
        utilizationPercent: 100,
        availableSlots: 0,
        isAtCapacity: true,
        isNearCapacity: false,
      });

    const request = new Request("http://localhost/api/sprint/test-project/assignable-agents");
    const res = await GET(request, { params: Promise.resolve({ project: "test-project" }) });
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.agents).toHaveLength(2);
    // Local agent
    expect(body.agents[0].agentId).toBe("local-agent");
    expect(body.agents[0].isPoolAgent).toBe(false);
    expect(body.agents[0].capacityStatus).toEqual({
      maxCapacity: 5,
      availableSlots: 4,
      isAtCapacity: false,
      isNearCapacity: false,
      utilizationPercent: 20,
    });
    // Pool agent at capacity
    expect(body.agents[1].agentId).toBe("pool-agent");
    expect(body.agents[1].isPoolAgent).toBe(true);
    expect(body.agents[1].capacityStatus.isAtCapacity).toBe(true);
    expect(body.agents[1].capacityStatus.availableSlots).toBe(0);
    expect(body.agents[1].capacityStatus.utilizationPercent).toBe(100);

    expect(body.summary).toEqual({ total: 2, local: 1, pool: 1 });
  });

  it("returns 500 on unexpected error", async () => {
    vi.mocked(getServices).mockRejectedValueOnce(new Error("Service init failed"));
    const request = new Request("http://localhost/api/sprint/x/assignable-agents");
    const res = await GET(request, { params: Promise.resolve({ project: "x" }) });
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe("Failed to fetch assignable agents");
  });

  it("returns near-capacity status for agents approaching limit", async () => {
    vi.mocked(getServices).mockResolvedValueOnce({
      config: {
        projects: { "test-project": { name: "Test", path: "/tmp/test" } },
        configPath: "/tmp/test.yaml",
      },
      sessionManager: { list: vi.fn(async () => []) },
    } as never);

    vi.mocked(getAssignableAgents).mockResolvedValueOnce([
      {
        agentId: "busy-agent",
        projectId: "test-project",
        sourceProjectId: undefined,
        isPoolAgent: false,
        currentWorkload: 4,
      },
    ]);

    vi.mocked(checkCapacity).mockReturnValueOnce({
      agentId: "busy-agent",
      currentWorkload: 4,
      maxCapacity: 5,
      utilizationPercent: 80,
      availableSlots: 1,
      isAtCapacity: false,
      isNearCapacity: true,
    });

    const request = new Request("http://localhost/api/sprint/test-project/assignable-agents");
    const res = await GET(request, { params: Promise.resolve({ project: "test-project" }) });
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.agents).toHaveLength(1);
    expect(body.agents[0].capacityStatus.isNearCapacity).toBe(true);
    expect(body.agents[0].capacityStatus.isAtCapacity).toBe(false);
    expect(body.agents[0].capacityStatus.utilizationPercent).toBe(80);
  });

  it("returns empty agents list when no assignable agents found", async () => {
    vi.mocked(getServices).mockResolvedValueOnce({
      config: {
        projects: { "test-project": { name: "Test", path: "/tmp/test" } },
        configPath: "/tmp/test.yaml",
      },
      sessionManager: { list: vi.fn(async () => []) },
    } as never);

    vi.mocked(getAssignableAgents).mockResolvedValueOnce([]);

    const request = new Request("http://localhost/api/sprint/test-project/assignable-agents");
    const res = await GET(request, { params: Promise.resolve({ project: "test-project" }) });
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.agents).toEqual([]);
    expect(body.summary).toEqual({ total: 0, local: 0, pool: 0 });
  });
});
