import { describe, expect, it, vi, beforeEach } from "vitest";

const mockList = vi.fn();
const mockGet = vi.fn();

vi.mock("@/lib/services", () => ({
  getServices: vi.fn().mockResolvedValue({
    config: { projects: {}, maxConcurrentAgents: 5 },
    sessionManager: {
      list: (...args: unknown[]) => mockList(...args),
      get: (...args: unknown[]) => mockGet(...args),
    },
  }),
}));

vi.mock("@composio/ao-core", () => ({
  checkCapacity: vi.fn(),
}));

import { GET } from "./route";
import { getServices } from "@/lib/services";
import { checkCapacity } from "@composio/ao-core";

beforeEach(() => {
  vi.clearAllMocks();
});

function makeParams(id: string) {
  return { params: Promise.resolve({ id }) };
}

describe("GET /api/agent/[id]/capacity", () => {
  it("returns capacity for an agent with active sessions", async () => {
    mockList.mockResolvedValueOnce([
      { id: "agent-1", projectId: "proj-a" },
      { id: "agent-1", projectId: "proj-a" },
      { id: "agent-2", projectId: "proj-b" },
    ]);

    vi.mocked(checkCapacity).mockReturnValueOnce({
      agentId: "agent-1",
      currentWorkload: 2,
      maxCapacity: 5,
      utilizationPercent: 40,
      availableSlots: 3,
      isAtCapacity: false,
      isNearCapacity: false,
    });

    const res = await GET(new Request("http://localhost") as never, makeParams("agent-1"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.agentId).toBe("agent-1");
    expect(body.currentWorkload).toBe(2);
    expect(body.maxCapacity).toBe(5);
    expect(body.isAtCapacity).toBe(false);
    expect(vi.mocked(checkCapacity)).toHaveBeenCalledWith(
      "agent-1",
      2,
      expect.anything(),
      "proj-a",
    );
  });

  it("returns capacity with zero workload when agent exists but has no sessions in list", async () => {
    mockList.mockResolvedValueOnce([]);
    mockGet.mockResolvedValueOnce({
      id: "agent-1",
      projectId: "proj-a",
    });

    vi.mocked(checkCapacity).mockReturnValueOnce({
      agentId: "agent-1",
      currentWorkload: 0,
      maxCapacity: 5,
      utilizationPercent: 0,
      availableSlots: 5,
      isAtCapacity: false,
      isNearCapacity: false,
    });

    const res = await GET(new Request("http://localhost") as never, makeParams("agent-1"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.currentWorkload).toBe(0);
    expect(vi.mocked(checkCapacity)).toHaveBeenCalledWith(
      "agent-1",
      0,
      expect.anything(),
      "proj-a",
    );
  });

  it("returns 404 for unknown agent", async () => {
    mockList.mockResolvedValueOnce([]);
    mockGet.mockResolvedValueOnce(null);

    const res = await GET(new Request("http://localhost") as never, makeParams("ghost"));
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toContain("ghost");
  });

  it("returns at-capacity status for maxed agent", async () => {
    mockList.mockResolvedValueOnce([
      { id: "agent-full", projectId: "proj-a" },
      { id: "agent-full", projectId: "proj-a" },
      { id: "agent-full", projectId: "proj-a" },
    ]);

    vi.mocked(checkCapacity).mockReturnValueOnce({
      agentId: "agent-full",
      currentWorkload: 3,
      maxCapacity: 3,
      utilizationPercent: 100,
      availableSlots: 0,
      isAtCapacity: true,
      isNearCapacity: false,
    });

    const res = await GET(new Request("http://localhost") as never, makeParams("agent-full"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.isAtCapacity).toBe(true);
    expect(body.utilizationPercent).toBe(100);
    expect(body.availableSlots).toBe(0);
  });

  it("returns 500 when services throw", async () => {
    vi.mocked(getServices).mockRejectedValueOnce(new Error("DB connection failed"));

    const res = await GET(new Request("http://localhost") as never, makeParams("agent-1"));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe("Failed to fetch agent capacity");
  });
});
