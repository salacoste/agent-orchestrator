/**
 * Scenario [id] API route tests — GET, PATCH, DELETE /api/scenarios/[id]
 * Story 54.1: GET, DELETE. Story 54.2: PATCH.
 */
import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/scenario-store", () => ({
  getScenario: vi.fn(),
  deleteScenario: vi.fn(),
  updateScenario: vi.fn(),
}));

import { GET, PATCH, DELETE } from "./route";
import { getScenario, deleteScenario, updateScenario } from "@/lib/scenario-store";

const mockGetScenario = vi.mocked(getScenario);
const mockDeleteScenario = vi.mocked(deleteScenario);
const mockUpdateScenario = vi.mocked(updateScenario);

// Store functions are now async (54.5 persistence) — use mockResolvedValue

const mockScenario = {
  id: "test-uuid-1",
  name: "Test Scenario",
  createdAt: new Date().toISOString(),
  projectIds: ["alpha"],
  stories: [],
  status: "draft" as const,
};

beforeEach(() => {
  vi.clearAllMocks();
});

function makeContext(id: string) {
  return { params: Promise.resolve({ id }) };
}

describe("GET /api/scenarios/[id]", () => {
  it("returns scenario when found", async () => {
    mockGetScenario.mockResolvedValue(mockScenario);

    const response = await GET(new Request("http://localhost"), makeContext("test-uuid-1"));
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.id).toBe("test-uuid-1");
  });

  it("returns 404 when scenario not found", async () => {
    mockGetScenario.mockResolvedValue(undefined);

    const response = await GET(new Request("http://localhost"), makeContext("nonexistent"));
    expect(response.status).toBe(404);

    const data = await response.json();
    expect(data.error).toContain("not found");
  });
});

describe("PATCH /api/scenarios/[id]", () => {
  const validParams = { agentCount: 3, capacityLimit: 2, storyPriorities: [] };

  it("updates parameters and returns updated scenario", async () => {
    const updated = { ...mockScenario, parameters: validParams };
    mockGetScenario.mockResolvedValue(mockScenario);
    mockUpdateScenario.mockResolvedValue(updated);

    const request = new Request("http://localhost", {
      method: "PATCH",
      body: JSON.stringify({ parameters: validParams }),
      headers: { "Content-Type": "application/json" },
    });
    const response = await PATCH(request, makeContext("test-uuid-1"));
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.parameters).toEqual(validParams);
    expect(mockUpdateScenario).toHaveBeenCalledWith("test-uuid-1", {
      parameters: validParams,
    });
  });

  it("returns 404 for unknown scenario", async () => {
    mockGetScenario.mockResolvedValue(undefined);

    const request = new Request("http://localhost", {
      method: "PATCH",
      body: JSON.stringify({ parameters: validParams }),
      headers: { "Content-Type": "application/json" },
    });
    const response = await PATCH(request, makeContext("nonexistent"));
    expect(response.status).toBe(404);
  });

  it("returns 400 for invalid parameters", async () => {
    mockGetScenario.mockResolvedValue(mockScenario);

    const badParams = { agentCount: 0, capacityLimit: -1, storyPriorities: [] };
    const request = new Request("http://localhost", {
      method: "PATCH",
      body: JSON.stringify({ parameters: badParams }),
      headers: { "Content-Type": "application/json" },
    });
    const response = await PATCH(request, makeContext("test-uuid-1"));
    expect(response.status).toBe(400);

    const data = await response.json();
    expect(data.error).toBeTruthy();
  });

  it("returns 409 if scenario status is not draft", async () => {
    mockGetScenario.mockResolvedValue({ ...mockScenario, status: "simulated" });

    const request = new Request("http://localhost", {
      method: "PATCH",
      body: JSON.stringify({ parameters: validParams }),
      headers: { "Content-Type": "application/json" },
    });
    const response = await PATCH(request, makeContext("test-uuid-1"));
    expect(response.status).toBe(409);

    const data = await response.json();
    expect(data.error).toContain("simulated or applied");
  });

  it("returns 400 for invalid story ID in priority overrides", async () => {
    const scenarioWithStories = {
      ...mockScenario,
      stories: [
        { id: "story-1", projectId: "alpha", status: "ready-for-dev", domainTags: ["backend"] },
        { id: "story-2", projectId: "alpha", status: "ready-for-dev", domainTags: ["frontend"] },
      ],
    };
    mockGetScenario.mockResolvedValue(scenarioWithStories);

    const paramsWithBadStory = {
      agentCount: 3,
      capacityLimit: 2,
      storyPriorities: [
        { storyId: "nonexistent-story", originalPriority: "medium", newPriority: "high" },
      ],
    };
    const request = new Request("http://localhost", {
      method: "PATCH",
      body: JSON.stringify({ parameters: paramsWithBadStory }),
      headers: { "Content-Type": "application/json" },
    });
    const response = await PATCH(request, makeContext("test-uuid-1"));
    expect(response.status).toBe(400);

    const data = await response.json();
    expect(data.error).toContain("not found in scenario");
  });
});

describe("DELETE /api/scenarios/[id]", () => {
  it("deletes scenario and returns ok", async () => {
    mockDeleteScenario.mockResolvedValue(true);

    const response = await DELETE(new Request("http://localhost"), makeContext("test-uuid-1"));
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.ok).toBe(true);
    expect(mockDeleteScenario).toHaveBeenCalledWith("test-uuid-1");
  });

  it("returns 404 when scenario not found", async () => {
    mockDeleteScenario.mockResolvedValue(false);

    const response = await DELETE(new Request("http://localhost"), makeContext("nonexistent"));
    expect(response.status).toBe(404);

    const data = await response.json();
    expect(data.error).toContain("not found");
  });
});
