import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/services", () => ({
  getServices: vi.fn(),
}));

vi.mock("@composio/ao-core", () => ({
  computeProjectUtilization: vi.fn(),
  getAgentRegistry: vi.fn(() => ({ getByAgent: () => null })),
  getSessionsDir: vi.fn(() => "/tmp/sessions"),
}));

import { GET } from "./route";
import { getServices } from "@/lib/services";
import { computeProjectUtilization } from "@composio/ao-core";

describe("GET /api/sprint/[project]/utilization", () => {
  beforeEach(() => {
    vi.mocked(getServices).mockReset();
    vi.mocked(computeProjectUtilization).mockReset();
  });

  it("returns 404 for unknown project", async () => {
    vi.mocked(getServices).mockResolvedValueOnce({
      config: { projects: {} },
      sessionManager: { list: vi.fn(async () => []) },
    } as never);
    const request = new Request("http://localhost/api/sprint/unknown/utilization");
    const res = await GET(request, { params: Promise.resolve({ project: "unknown" }) });
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe("Project not found");
  });

  it("returns utilization data for valid project", async () => {
    vi.mocked(getServices).mockResolvedValueOnce({
      config: {
        projects: {
          "test-project": { name: "Test", path: "/tmp/test" },
        },
        configPath: "/tmp/test.yaml",
      },
      sessionManager: { list: vi.fn(async () => []) },
    } as never);
    vi.mocked(computeProjectUtilization).mockReturnValueOnce({
      projectId: "test-project",
      totalAgents: 3,
      activeAgents: 2,
      utilizationPercent: 67,
      agentDetails: [],
      poolAgentsTotal: 0,
      poolAgentsActive: 0,
    });
    const request = new Request("http://localhost/api/sprint/test-project/utilization");
    const res = await GET(request, { params: Promise.resolve({ project: "test-project" }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.projectId).toBe("test-project");
    expect(body.totalAgents).toBe(3);
    expect(body.activeAgents).toBe(2);
    expect(body.utilizationPercent).toBe(67);
  });
});
