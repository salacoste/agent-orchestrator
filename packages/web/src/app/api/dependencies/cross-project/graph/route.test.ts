/**
 * GET /api/dependencies/cross-project/graph — Route tests (Story 51.4)
 */

import { describe, expect, it, vi, beforeEach } from "vitest";

const { mockStore, mockBuildSprintDataMap } = vi.hoisted(() => ({
  mockStore: {
    add: vi.fn(),
    remove: vi.fn(),
    getForStory: vi.fn(),
    list: vi.fn(() => []),
  },
  mockBuildSprintDataMap: vi.fn(async () => ({})),
}));

vi.mock("@/lib/services", () => ({
  getServices: vi.fn(async () => ({
    config: {
      configPath: "/tmp/test-ao-config.yaml",
      projects: {
        "project-a": {
          name: "Project A",
          tracker: { plugin: "bmad" },
        },
        "project-b": {
          name: "Project B",
          tracker: { plugin: "bmad" },
        },
      },
    },
  })),
}));

vi.mock("@/lib/sprint-data-map", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...(actual as Record<string, unknown>),
    buildSprintDataMap: mockBuildSprintDataMap,
  };
});

vi.mock("@composio/ao-core", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...(actual as Record<string, unknown>),
    createCrossProjectDepStore: vi.fn(() => mockStore),
    // Use real resolveAllDependencyStatuses and buildCrossProjectGraph for integration testing
  };
});

import { GET } from "./route.js";

describe("GET /api/dependencies/cross-project/graph", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStore.list.mockReturnValue([]);
    mockBuildSprintDataMap.mockResolvedValue({});
  });

  it("returns empty graph when no dependencies exist", async () => {
    const res = await GET();
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.graph.nodes).toHaveLength(0);
    expect(body.graph.edges).toHaveLength(0);
    expect(body.graph.projectGroups).toEqual({});
  });

  it("returns graph with nodes and edges when deps exist", async () => {
    mockStore.list.mockReturnValue([
      {
        id: "dep-1",
        sourceProjectId: "project-a",
        sourceStoryId: "story-1",
        targetProjectId: "project-b",
        targetStoryId: "story-2",
        createdAt: "2026-03-29T00:00:00.000Z",
      },
    ]);

    mockBuildSprintDataMap.mockResolvedValue({
      "project-a": { development_status: { "story-1": "blocked" } },
      "project-b": { development_status: { "story-2": "done" } },
    });

    const res = await GET();
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.graph.nodes.length).toBeGreaterThan(0);
    expect(body.graph.edges.length).toBeGreaterThan(0);
    expect(body.graph.projectGroups).toBeDefined();

    // Verify nodes have correct fields from real buildCrossProjectGraph
    expect(body.graph.nodes[0]).toHaveProperty("id");
    expect(body.graph.nodes[0]).toHaveProperty("storyId");
    expect(body.graph.nodes[0]).toHaveProperty("projectId");
    expect(body.graph.edges[0]).toHaveProperty("sourceNodeId");
    expect(body.graph.edges[0]).toHaveProperty("targetNodeId");

    // Verify integration: target story-2 is "done" → edge should be resolved
    expect(body.graph.edges[0].isResolved).toBe(true);
    // Verify integration: source story-1 is "blocked" → source node should be blocked
    const sourceNode = body.graph.nodes.find(
      (n: { projectId: string; storyId: string }) =>
        n.projectId === "project-a" && n.storyId === "story-1",
    );
    expect(sourceNode).toBeDefined();
    expect(sourceNode.isBlocked).toBe(true);
    expect(sourceNode.status).toBe("blocked");
    // Target node should have status "done"
    const targetNode = body.graph.nodes.find(
      (n: { projectId: string; storyId: string }) =>
        n.projectId === "project-b" && n.storyId === "story-2",
    );
    expect(targetNode).toBeDefined();
    expect(targetNode.status).toBe("done");
  });

  it("returns 500 when store throws", async () => {
    mockStore.list.mockImplementation(() => {
      throw new Error("File not found");
    });

    const res = await GET();
    expect(res.status).toBe(500);
  });
});
