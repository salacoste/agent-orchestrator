/**
 * POST /api/scenarios/[id]/simulate — run Monte Carlo simulation on a scenario.
 * Story 54.3.
 */
import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/scenario-store", () => ({
  getScenario: vi.fn(),
  updateScenario: vi.fn(),
}));

vi.mock("@/lib/services", () => ({
  getServices: vi.fn(),
}));

vi.mock("@/lib/scenario-simulation", () => ({
  buildSimulationInput: vi.fn(),
  applyParallelismScaling: vi.fn(),
}));

vi.mock("@composio/ao-core", () => ({
  simulateSprint: vi.fn(),
  getSimulationColor: vi.fn(),
}));

import { POST } from "./route.js";
import { getScenario, updateScenario } from "@/lib/scenario-store";
import { getServices } from "@/lib/services";
import { buildSimulationInput, applyParallelismScaling } from "@/lib/scenario-simulation";
import { simulateSprint, getSimulationColor } from "@composio/ao-core";

const mockGetScenario = vi.mocked(getScenario);
const mockUpdateScenario = vi.mocked(updateScenario);
const mockGetServices = vi.mocked(getServices);
const mockBuildInput = vi.mocked(buildSimulationInput);
const mockApplyScaling = vi.mocked(applyParallelismScaling);
const mockSimulate = vi.mocked(simulateSprint);
const mockGetColor = vi.mocked(getSimulationColor);

const baseScenario = {
  id: "scen-1",
  name: "Test Scenario",
  createdAt: new Date().toISOString(),
  projectIds: ["alpha"],
  stories: [
    { id: "s1", projectId: "alpha", status: "ready-for-dev", domainTags: ["backend"] },
    { id: "s2", projectId: "alpha", status: "ready-for-dev", domainTags: ["frontend"] },
  ],
  status: "draft" as const,
  parameters: { agentCount: 3, capacityLimit: 2, storyPriorities: [] },
};

const simulatedResult = {
  p50Days: 5,
  p80Days: 7,
  p95Days: 10,
  onTimeProbability: 0.85,
  confidence: 0.75,
  iterationsRun: 1000,
};

beforeEach(() => {
  vi.clearAllMocks();
});

function makeContext(id: string) {
  return { params: Promise.resolve({ id }) };
}

describe("POST /api/scenarios/[id]/simulate", () => {
  it("runs simulation and returns updated scenario", async () => {
    mockGetScenario.mockResolvedValue(baseScenario);
    mockGetServices.mockResolvedValue({
      config: {} as Awaited<ReturnType<typeof getServices>>["config"],
      registry: {} as Awaited<ReturnType<typeof getServices>>["registry"],
      sessionManager: {} as Awaited<ReturnType<typeof getServices>>["sessionManager"],
      learningStore: { list: () => [], query: () => [] },
    });
    mockBuildInput.mockReturnValue({
      stories: [],
      learnings: [],
      iterations: 1000,
    });
    mockSimulate.mockReturnValue(simulatedResult);
    mockApplyScaling.mockReturnValue(simulatedResult);
    mockGetColor.mockReturnValue("green");
    mockUpdateScenario.mockResolvedValue({
      ...baseScenario,
      result: simulatedResult,
      status: "simulated",
    });

    const res = await POST(
      new Request("http://localhost", { method: "POST" }),
      makeContext("scen-1"),
    );
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.status).toBe("simulated");
    expect(data.result).toEqual(simulatedResult);
    expect(mockUpdateScenario).toHaveBeenCalledWith("scen-1", {
      result: simulatedResult,
      status: "simulated",
    });
  });

  it("returns 404 for unknown scenario", async () => {
    mockGetScenario.mockResolvedValue(undefined);

    const res = await POST(
      new Request("http://localhost", { method: "POST" }),
      makeContext("nope"),
    );
    expect(res.status).toBe(404);

    const data = await res.json();
    expect(data.error).toContain("not found");
  });

  it("returns 409 for non-draft scenario", async () => {
    mockGetScenario.mockResolvedValue({ ...baseScenario, status: "simulated" });

    const res = await POST(
      new Request("http://localhost", { method: "POST" }),
      makeContext("scen-1"),
    );
    expect(res.status).toBe(409);

    const data = await res.json();
    expect(data.error).toContain("already been simulated");
  });

  it("returns 409 for applied scenario", async () => {
    mockGetScenario.mockResolvedValue({ ...baseScenario, status: "applied" });

    const res = await POST(
      new Request("http://localhost", { method: "POST" }),
      makeContext("scen-1"),
    );
    expect(res.status).toBe(409);
  });

  it("returns 400 when parameters are missing", async () => {
    mockGetScenario.mockResolvedValue({ ...baseScenario, parameters: undefined });

    const res = await POST(
      new Request("http://localhost", { method: "POST" }),
      makeContext("scen-1"),
    );
    expect(res.status).toBe(400);

    const data = await res.json();
    expect(data.error).toContain("parameters");
  });

  it("returns 500 when simulateSprint throws", async () => {
    mockGetScenario.mockResolvedValue(baseScenario);
    mockGetServices.mockResolvedValue({
      config: {} as Awaited<ReturnType<typeof getServices>>["config"],
      registry: {} as Awaited<ReturnType<typeof getServices>>["registry"],
      sessionManager: {} as Awaited<ReturnType<typeof getServices>>["sessionManager"],
      learningStore: { list: () => [], query: () => [] },
    });
    mockBuildInput.mockReturnValue({
      stories: [],
      learnings: [],
      iterations: 1000,
    });
    mockSimulate.mockImplementation(() => {
      throw new Error("Simulation engine failure");
    });

    const res = await POST(
      new Request("http://localhost", { method: "POST" }),
      makeContext("scen-1"),
    );
    expect(res.status).toBe(500);

    const data = await res.json();
    expect(data.error).toContain("Simulation engine failure");
  });

  it("calls getSimulationColor with onTimeProbability", async () => {
    mockGetScenario.mockResolvedValue(baseScenario);
    mockGetServices.mockResolvedValue({
      config: {} as Awaited<ReturnType<typeof getServices>>["config"],
      registry: {} as Awaited<ReturnType<typeof getServices>>["registry"],
      sessionManager: {} as Awaited<ReturnType<typeof getServices>>["sessionManager"],
      learningStore: { list: () => [], query: () => [] },
    });
    mockBuildInput.mockReturnValue({ stories: [], learnings: [], iterations: 1000 });
    mockSimulate.mockReturnValue(simulatedResult);
    mockApplyScaling.mockReturnValue(simulatedResult);
    mockGetColor.mockReturnValue("green");
    mockUpdateScenario.mockResolvedValue({
      ...baseScenario,
      result: simulatedResult,
      status: "simulated",
    });

    const res = await POST(
      new Request("http://localhost", { method: "POST" }),
      makeContext("scen-1"),
    );
    expect(res.status).toBe(200);
    expect(mockGetColor).toHaveBeenCalledWith(0.85);
  });

  it("returns 400 when agentCount is zero", async () => {
    mockGetScenario.mockResolvedValue({
      ...baseScenario,
      parameters: { agentCount: 0, capacityLimit: 2, storyPriorities: [] },
    });

    const res = await POST(
      new Request("http://localhost", { method: "POST" }),
      makeContext("scen-1"),
    );
    expect(res.status).toBe(400);

    const data = await res.json();
    expect(data.error).toContain("at least 1");
  });

  it("returns 500 when updateScenario returns undefined", async () => {
    mockGetScenario.mockResolvedValue(baseScenario);
    mockGetServices.mockResolvedValue({
      config: {} as Awaited<ReturnType<typeof getServices>>["config"],
      registry: {} as Awaited<ReturnType<typeof getServices>>["registry"],
      sessionManager: {} as Awaited<ReturnType<typeof getServices>>["sessionManager"],
      learningStore: { list: () => [], query: () => [] },
    });
    mockBuildInput.mockReturnValue({ stories: [], learnings: [], iterations: 1000 });
    mockSimulate.mockReturnValue(simulatedResult);
    mockApplyScaling.mockReturnValue(simulatedResult);
    mockUpdateScenario.mockResolvedValue(undefined);

    const res = await POST(
      new Request("http://localhost", { method: "POST" }),
      makeContext("scen-1"),
    );
    expect(res.status).toBe(500);
  });
});
