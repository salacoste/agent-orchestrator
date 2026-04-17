import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock dependencies — must come before route import
vi.mock("@/lib/services", () => ({
  getServices: vi.fn(),
}));

vi.mock("@composio/ao-plugin-tracker-bmad", () => ({
  computeSprintHealth: vi.fn(() => ({
    overall: "ok",
    indicators: [],
    stuckStories: [],
    wipColumns: [],
  })),
}));

vi.mock("@composio/ao-core", () => ({
  computeAgentUtilization: vi.fn(() => []),
  getCapacityStatus: vi.fn(() => new Map()),
}));

import { GET } from "./route.js";
import { getServices } from "@/lib/services";
import { computeSprintHealth } from "@composio/ao-plugin-tracker-bmad";

function makeRequest(url: string) {
  return new Request(new URL(url, "http://localhost:3000"));
}

const mockConfig = {
  projects: {
    "project-a": {
      name: "Project A",
      tracker: { plugin: "bmad" },
    },
    "project-b": {
      name: "Project B",
    },
  },
};

const mockSessionManager = {
  list: vi.fn(() => Promise.resolve([])),
};

const mockRegistry = {};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getServices).mockResolvedValue({
    config: mockConfig,
    registry: mockRegistry,
    sessionManager: mockSessionManager,
  } as never);
});

describe("GET /api/risk/dashboard", () => {
  it("returns 200 with risk factors for all projects", async () => {
    const res = await GET(makeRequest("/api/risk/dashboard"));
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data).toHaveProperty("riskFactors");
    expect(data).toHaveProperty("summary");
    expect(data).toHaveProperty("lastUpdated");
    expect(data.summary).toHaveProperty("total");
  });

  it("returns 404 for unknown project", async () => {
    const res = await GET(makeRequest("/api/risk/dashboard?project=nonexistent"));
    expect(res.status).toBe(404);

    const data = await res.json();
    expect(data.error).toBe("Project not found");
  });

  it("filters to single project when ?project= is provided", async () => {
    const res = await GET(makeRequest("/api/risk/dashboard?project=project-a"));
    expect(res.status).toBe(200);

    // Should call computeSprintHealth only once (for project-a)
    expect(computeSprintHealth).toHaveBeenCalledTimes(1);
  });

  it("aggregates across all projects when no project param", async () => {
    const res = await GET(makeRequest("/api/risk/dashboard"));
    expect(res.status).toBe(200);

    // Should call computeSprintHealth for each bmad project
    // project-a has tracker.plugin=bmad, project-b doesn't
    expect(computeSprintHealth).toHaveBeenCalledTimes(1);
  });

  it("returns empty response when no projects configured", async () => {
    vi.mocked(getServices).mockResolvedValue({
      config: { projects: {} },
      registry: mockRegistry,
      sessionManager: mockSessionManager,
    } as never);

    const res = await GET(makeRequest("/api/risk/dashboard"));
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.riskFactors).toEqual([]);
    expect(data.summary.total).toBe(0);
  });

  it("includes risk factors from sprint health indicators", async () => {
    vi.mocked(computeSprintHealth).mockReturnValue({
      overall: "warning",
      indicators: [
        {
          id: "stuck-stories",
          severity: "critical",
          message: "3 stories stuck",
          details: ["S-1 blocked 96h"],
        },
      ],
      stuckStories: ["S-1"],
      wipColumns: [],
    });

    const res = await GET(makeRequest("/api/risk/dashboard?project=project-a"));
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.riskFactors.length).toBeGreaterThan(0);
  });

  it("handles service errors gracefully", async () => {
    vi.mocked(getServices).mockRejectedValue(new Error("Config not found"));

    const res = await GET(makeRequest("/api/risk/dashboard"));
    expect(res.status).toBe(500);

    const data = await res.json();
    expect(data.error).toBe("Config not found");
  });

  it("handles project names with special characters", async () => {
    vi.mocked(getServices).mockResolvedValue({
      config: {
        projects: {
          "my project & co": {
            name: "My Project & Co",
          },
        },
      },
      registry: mockRegistry,
      sessionManager: mockSessionManager,
    } as never);

    const res = await GET(makeRequest("/api/risk/dashboard?project=my%20project%20%26%20co"));
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data).toHaveProperty("riskFactors");
  });
});
