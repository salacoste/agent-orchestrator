/**
 * Scenario API route tests — GET and POST /api/scenarios (Story 54.1, Task 3).
 */
import { describe, expect, it, vi, beforeEach } from "vitest";
import type { WhatIfScenario, ScenarioStorySnapshot } from "@/lib/types";

vi.mock("@/lib/services", () => ({
  getServices: vi.fn(),
}));

vi.mock("@/lib/scenario-store", () => ({
  listScenarios: vi.fn(),
  addScenario: vi.fn(),
}));

vi.mock("@/lib/scenario-snapshot", () => ({
  captureScenarioSnapshot: vi.fn(),
  createScenario: vi.fn(),
}));

vi.mock("@composio/ao-plugin-tracker-bmad", () => ({
  readSprintStatus: vi.fn(),
}));

import { GET, POST } from "./route";
import { getServices } from "@/lib/services";
import { listScenarios, addScenario } from "@/lib/scenario-store";
import { captureScenarioSnapshot, createScenario } from "@/lib/scenario-snapshot";

const mockGetServices = vi.mocked(getServices);
const mockListScenarios = vi.mocked(listScenarios);
const mockAddScenario = vi.mocked(addScenario);
const mockCaptureSnapshot = vi.mocked(captureScenarioSnapshot);
const mockCreateScenario = vi.mocked(createScenario);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/scenarios", () => {
  it("returns empty array when no scenarios exist", async () => {
    mockListScenarios.mockResolvedValue([]);
    const response = await GET();
    const data = await response.json();
    expect(data).toEqual([]);
  });

  it("returns list of scenarios", async () => {
    const mockScenarios: WhatIfScenario[] = [
      {
        id: "abc-123",
        name: "Test Scenario",
        createdAt: new Date().toISOString(),
        projectIds: ["alpha"],
        stories: [],
        status: "draft",
      },
    ];
    mockListScenarios.mockResolvedValue(mockScenarios);
    const response = await GET();
    const data = await response.json();
    expect(data).toEqual(mockScenarios);
  });
});

describe("POST /api/scenarios", () => {
  const mockConfig = {
    projects: {
      alpha: { name: "Alpha" },
      beta: { name: "Beta" },
    },
  };

  const createdScenario: WhatIfScenario = {
    id: "test-uuid",
    name: "Test",
    createdAt: new Date().toISOString(),
    projectIds: ["alpha"],
    stories: [],
    status: "draft",
  };

  beforeEach(() => {
    mockGetServices.mockResolvedValue({ config: mockConfig } as unknown as Awaited<
      ReturnType<typeof getServices>
    >);
    mockCaptureSnapshot.mockReturnValue([]);
    mockCreateScenario.mockReturnValue(createdScenario);
  });

  it("creates scenario with valid input", async () => {
    const request = new Request("http://localhost/api/scenarios", {
      method: "POST",
      body: JSON.stringify({ name: "My Scenario", projectIds: ["alpha"] }),
    });

    const response = await POST(request);
    expect(response.status).toBe(201);
    expect(mockAddScenario).toHaveBeenCalledWith(createdScenario);
  });

  it("rejects empty name", async () => {
    const request = new Request("http://localhost/api/scenarios", {
      method: "POST",
      body: JSON.stringify({ name: "", projectIds: ["alpha"] }),
    });

    const response = await POST(request);
    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toContain("name");
  });

  it("rejects missing projectIds", async () => {
    const request = new Request("http://localhost/api/scenarios", {
      method: "POST",
      body: JSON.stringify({ name: "Test", projectIds: [] }),
    });

    const response = await POST(request);
    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toContain("project");
  });

  it("rejects unknown project IDs", async () => {
    const request = new Request("http://localhost/api/scenarios", {
      method: "POST",
      body: JSON.stringify({ name: "Test", projectIds: ["nonexistent"] }),
    });

    const response = await POST(request);
    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toContain("Unknown");
  });

  it("captures snapshot and creates scenario with stories", async () => {
    const mockStories: ScenarioStorySnapshot[] = [
      { id: "1-1-test", projectId: "alpha", status: "done", domainTags: [] },
    ];
    mockCaptureSnapshot.mockReturnValue(mockStories);

    const request = new Request("http://localhost/api/scenarios", {
      method: "POST",
      body: JSON.stringify({ name: "With Stories", projectIds: ["alpha"] }),
    });

    const response = await POST(request);
    expect(response.status).toBe(201);
    expect(mockCaptureSnapshot).toHaveBeenCalled();
    expect(mockCreateScenario).toHaveBeenCalledWith("With Stories", ["alpha"], mockStories);
  });
});
