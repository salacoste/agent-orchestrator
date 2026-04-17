/**
 * POST /api/scenarios/[id]/apply — apply a verified scenario to production.
 * Story 54.6.
 */
import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/scenario-store", () => ({
  getScenario: vi.fn(),
  updateScenario: vi.fn(),
}));

import { POST } from "./route.js";
import { getScenario, updateScenario } from "@/lib/scenario-store";

const mockGetScenario = vi.mocked(getScenario);
const mockUpdateScenario = vi.mocked(updateScenario);

function makeContext(id: string) {
  return {
    params: Promise.resolve({ id }),
  };
}

const baseScenario = {
  id: "scen-1",
  name: "Test Scenario",
  createdAt: new Date().toISOString(),
  projectIds: ["alpha"],
  stories: [{ id: "s1", projectId: "alpha", status: "ready-for-dev", domainTags: ["backend"] }],
  status: "simulated" as const,
  parameters: { agentCount: 3, capacityLimit: 2, storyPriorities: [] },
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("POST /api/scenarios/[id]/apply", () => {
  it("returns 404 when scenario not found", async () => {
    mockGetScenario.mockResolvedValue(undefined);

    const res = await POST(
      new Request("http://localhost", { method: "POST" }),
      makeContext("nonexistent"),
    );
    expect(res.status).toBe(404);
    const data = (await res.json()) as { error?: string };
    expect(data.error).toBe("Scenario not found");
  });

  it("returns 409 when scenario is not simulated (draft)", async () => {
    mockGetScenario.mockResolvedValue({ ...baseScenario, status: "draft" });

    const res = await POST(
      new Request("http://localhost", { method: "POST" }),
      makeContext("scen-1"),
    );
    expect(res.status).toBe(409);
    const data = (await res.json()) as { error?: string };
    expect(data.error).toContain("simulated before applying");
    expect(data.error).toContain("draft");
  });

  it("returns 409 when scenario is already applied", async () => {
    mockGetScenario.mockResolvedValue({ ...baseScenario, status: "applied" });

    const res = await POST(
      new Request("http://localhost", { method: "POST" }),
      makeContext("scen-1"),
    );
    expect(res.status).toBe(409);
    const data = (await res.json()) as { error?: string };
    expect(data.error).toContain("simulated before applying");
    expect(data.error).toContain("applied");
  });

  it("returns 400 when scenario has no parameters", async () => {
    mockGetScenario.mockResolvedValue({
      ...baseScenario,
      status: "simulated",
      parameters: undefined,
    });

    const res = await POST(
      new Request("http://localhost", { method: "POST" }),
      makeContext("scen-1"),
    );
    expect(res.status).toBe(400);
    const data = (await res.json()) as { error?: string };
    expect(data.error).toContain("parameters are required");
  });

  it("returns 200 with updated scenario on success", async () => {
    const appliedScenario = { ...baseScenario, status: "applied" as const };
    mockGetScenario.mockResolvedValue(baseScenario);
    mockUpdateScenario.mockResolvedValue(appliedScenario);

    const res = await POST(
      new Request("http://localhost", { method: "POST" }),
      makeContext("scen-1"),
    );
    expect(res.status).toBe(200);
    const data = (await res.json()) as { status: string };
    expect(data.status).toBe("applied");
    expect(mockUpdateScenario).toHaveBeenCalledWith("scen-1", { status: "applied" });
  });

  it("returns 500 when updateScenario returns undefined", async () => {
    mockGetScenario.mockResolvedValue(baseScenario);
    mockUpdateScenario.mockResolvedValue(undefined);

    const res = await POST(
      new Request("http://localhost", { method: "POST" }),
      makeContext("scen-1"),
    );
    expect(res.status).toBe(500);
    const data = (await res.json()) as { error?: string };
    expect(data.error).toBe("Failed to update scenario");
  });

  it("returns 500 on unexpected error", async () => {
    mockGetScenario.mockRejectedValue(new Error("Disk full"));

    const res = await POST(
      new Request("http://localhost", { method: "POST" }),
      makeContext("scen-1"),
    );
    expect(res.status).toBe(500);
    const data = (await res.json()) as { error?: string };
    expect(data.error).toBe("Disk full");
  });
});
