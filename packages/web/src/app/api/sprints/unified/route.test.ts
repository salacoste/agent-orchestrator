/**
 * Unified Sprint API route tests (Story 53.1, Task 3.3).
 */
import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/services", () => ({
  getServices: vi.fn(),
}));

vi.mock("@/lib/unified-sprint-aggregation", () => ({
  aggregateUnifiedSprints: vi.fn(),
  computeSprintSummary: vi.fn(),
}));

import { GET } from "./route";
import { getServices } from "@/lib/services";
import { aggregateUnifiedSprints, computeSprintSummary } from "@/lib/unified-sprint-aggregation";

const mockGetServices = vi.mocked(getServices);
const mockAggregate = vi.mocked(aggregateUnifiedSprints);
const mockSummary = vi.mocked(computeSprintSummary);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/sprints/unified", () => {
  it("returns sprint data with summary", async () => {
    const mockSprints = [
      {
        projectId: "proj-a",
        projectName: "Project A",
        sprintName: "Sprint 1",
        startDate: null,
        endDate: null,
        stories: { total: 10, done: 5, inProgress: 3, blocked: 0, backlog: 2 },
        progressPercent: 50,
        status: "active" as const,
        health: "on-track" as const,
        healthReasons: [],
        velocity: 0,
        velocityTrend: "unknown" as const,
      },
    ];
    const mockSummaryData = {
      totalSprints: 1,
      activeSprints: 1,
      completedSprints: 0,
      planningSprints: 0,
      totalStories: 10,
      storiesDone: 5,
      avgProgress: 50,
      atRiskSprints: 0,
      avgVelocity: 0,
      maxVelocity: 0,
    };

    mockGetServices.mockResolvedValue({ config: { projects: { "proj-a": {} } } } as never);
    mockAggregate.mockResolvedValue(mockSprints);
    mockSummary.mockReturnValue(mockSummaryData);

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.sprints).toEqual(mockSprints);
    // Verify velocity fields are present on sprint entries
    expect(data.sprints[0]).toHaveProperty("velocity");
    expect(data.sprints[0]).toHaveProperty("velocityTrend");
    // Verify velocity fields are present on summary
    expect(data.summary).toHaveProperty("avgVelocity");
    expect(data.summary).toHaveProperty("maxVelocity");
    expect(data.summary).toEqual(mockSummaryData);
    expect(mockAggregate).toHaveBeenCalledWith({ projects: { "proj-a": {} } });
  });

  it("returns empty array when no projects configured", async () => {
    mockGetServices.mockResolvedValue({ config: { projects: {} } } as never);
    mockAggregate.mockResolvedValue([]);
    mockSummary.mockReturnValue({
      totalSprints: 0,
      activeSprints: 0,
      completedSprints: 0,
      planningSprints: 0,
      totalStories: 0,
      storiesDone: 0,
      avgProgress: 0,
      atRiskSprints: 0,
      avgVelocity: 0,
      maxVelocity: 0,
    });

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.sprints).toEqual([]);
    expect(data.summary.totalSprints).toBe(0);
  });

  it("returns 500 when getServices throws", async () => {
    mockGetServices.mockRejectedValue(new Error("config not found"));

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe("config not found");
  });

  it("returns 500 with generic message for non-Error throws", async () => {
    mockGetServices.mockRejectedValue("string error");

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe("Unknown error");
  });

  it("passes config to aggregateUnifiedSprints", async () => {
    const mockConfig = {
      projects: {
        "proj-a": { name: "A" },
        "proj-b": { name: "B" },
      },
    };

    mockGetServices.mockResolvedValue({ config: mockConfig } as never);
    mockAggregate.mockResolvedValue([]);
    mockSummary.mockReturnValue({
      totalSprints: 0,
      activeSprints: 0,
      completedSprints: 0,
      planningSprints: 0,
      totalStories: 0,
      storiesDone: 0,
      avgProgress: 0,
      atRiskSprints: 0,
      avgVelocity: 0,
      maxVelocity: 0,
    });

    await GET();

    expect(mockAggregate).toHaveBeenCalledWith(mockConfig);
  });
});
