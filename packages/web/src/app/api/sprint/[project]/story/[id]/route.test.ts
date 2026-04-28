/**
 * Story PATCH Route Tests — Auto-unblock (Story 51.3)
 *
 * Tests for PATCH /api/sprint/[project]/story/[id]
 * Focus: cross-project auto-unblock when story is marked "done"
 */

import { describe, expect, it, vi, beforeEach } from "vitest";

// ── Mocks (must be before route imports) ──────────────────────────────────────
// Use vi.hoisted() to create shared mock objects accessible in both vi.mock
// factories (which are hoisted above const declarations) and test bodies.

const {
  mockStore,
  mockAutoUnblock,
  mockCreateStore,
  mockReadSprintStatus,
  mockWriteStoryStatus,
  mockAppendHistory,
} = vi.hoisted(() => ({
  mockStore: {
    add: vi.fn(),
    remove: vi.fn(),
    getForStory: vi.fn(),
    list: vi.fn(() => []),
  },
  mockAutoUnblock: vi.fn(() => []),
  mockCreateStore: vi.fn(() => mockStore),
  mockReadSprintStatus: vi.fn(() => ({
    development_status: {
      "test-story": { status: "in-progress" },
    },
  })),
  mockWriteStoryStatus: vi.fn(),
  mockAppendHistory: vi.fn(),
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
    buildSprintDataMap: vi.fn(async () => ({
      "project-a": {
        development_status: { "test-story": "in-progress" },
      },
      "project-b": {
        development_status: { "blocked-story": "blocked" },
      },
    })),
  };
});

vi.mock("@composio/ao-core", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...(actual as Record<string, unknown>),
    createCrossProjectDepStore: mockCreateStore,
    resolveAllDependencyStatuses: vi.fn((deps: unknown[]) =>
      Array.isArray(deps)
        ? deps.map((d) => ({
            ...(d as Record<string, unknown>),
            targetStatus: "done",
            isResolved: true,
          }))
        : [],
    ),
    autoUnblockCrossProjectDeps: mockAutoUnblock,
  };
});

vi.mock("@composio/ao-plugin-tracker-bmad", () => ({
  BMAD_COLUMNS: ["backlog", "ready-for-dev", "in-progress", "review", "done"],
  getStoryDetail: vi.fn(),
  writeStoryStatus: mockWriteStoryStatus,
  appendHistory: mockAppendHistory,
  readSprintStatus: mockReadSprintStatus,
  checkWipLimit: vi.fn(() => ({ allowed: true })),
  validateDependencies: vi.fn(() => ({
    blocked: false,
    blockers: [],
    warnings: [],
  })),
}));

// Import after mocks
import { PATCH } from "./route.js";

function makeRequest(body: Record<string, unknown>) {
  return new Request("http://localhost/api/sprint/project-a/story/test-story", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("PATCH /api/sprint/[project]/story/[id] — auto-unblock", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default: no deps, no auto-unblock candidates
    mockStore.list.mockReturnValue([]);
    mockAutoUnblock.mockReturnValue([]);
    mockReadSprintStatus.mockReturnValue({
      development_status: {
        "test-story": { status: "in-progress" },
      },
    });
  });

  it("returns unblockedStories array in PATCH response", async () => {
    const res = await PATCH(makeRequest({ status: "done" }), {
      params: Promise.resolve({ project: "project-a", id: "test-story" }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.changed).toBe(true);
    expect(body.storyId).toBe("test-story");
    expect(body.status).toBe("done");
    expect(Array.isArray(body.unblockedStories)).toBe(true);
  });

  it("auto-unblocks satisfied cross-project dependents when story is done", async () => {
    // Story in project-b depends on test-story in project-a
    mockStore.list.mockReturnValue([
      {
        id: "dep-1",
        sourceProjectId: "project-b",
        sourceStoryId: "blocked-story",
        targetProjectId: "project-a",
        targetStoryId: "test-story",
        createdAt: "2026-03-29T00:00:00.000Z",
      },
    ] as never[]);

    // Mock autoUnblockCrossProjectDeps to return the blocked story as eligible
    mockAutoUnblock.mockReturnValue([
      { projectId: "project-b", storyId: "blocked-story" },
    ] as never[]);

    // Mock sprint status: project-a has test-story in-progress, project-b has blocked-story as blocked
    mockReadSprintStatus.mockImplementation(((project: { name?: string }) => {
      if (project.name === "Project A") {
        return {
          development_status: { "test-story": { status: "in-progress" } },
        };
      }
      return {
        development_status: { "blocked-story": { status: "blocked" } },
      };
    }) as never);

    const res = await PATCH(makeRequest({ status: "done" }), {
      params: Promise.resolve({ project: "project-a", id: "test-story" }),
    });
    const body = await res.json();

    expect(body.changed).toBe(true);
    expect(body.unblockedStories).toHaveLength(1);
    expect(body.unblockedStories[0]).toEqual({
      projectId: "project-b",
      storyId: "blocked-story",
      previousStatus: "blocked",
      newStatus: "ready-for-dev",
    });

    // writeStoryStatus called twice: once for the original story, once for unblocked
    expect(mockWriteStoryStatus).toHaveBeenCalledTimes(2);
    expect(mockAppendHistory).toHaveBeenCalledTimes(2);

    // Verify store was created with config path
    expect(mockCreateStore).toHaveBeenCalledWith("/tmp/test-ao-config.yaml");
  });

  it("does not auto-unblock when deps are not all satisfied", async () => {
    mockStore.list.mockReturnValue([
      {
        id: "dep-1",
        sourceProjectId: "project-b",
        sourceStoryId: "blocked-story",
        targetProjectId: "project-a",
        targetStoryId: "test-story",
        createdAt: "2026-03-29T00:00:00.000Z",
      },
    ] as never[]);

    // autoUnblockCrossProjectDeps returns empty (deps not satisfied)
    mockAutoUnblock.mockReturnValue([]);

    const res = await PATCH(makeRequest({ status: "done" }), {
      params: Promise.resolve({ project: "project-a", id: "test-story" }),
    });
    const body = await res.json();

    expect(body.changed).toBe(true);
    expect(body.unblockedStories).toHaveLength(0);
    expect(mockWriteStoryStatus).toHaveBeenCalledTimes(1);
  });

  it("does not auto-unblock when status is not done", async () => {
    const res = await PATCH(makeRequest({ status: "review" }), {
      params: Promise.resolve({ project: "project-a", id: "test-story" }),
    });
    const body = await res.json();

    expect(body.changed).toBe(true);
    expect(body.unblockedStories).toHaveLength(0);
    expect(mockWriteStoryStatus).toHaveBeenCalledTimes(1);
  });

  it("does not fail request when auto-unblock encounters an error", async () => {
    mockStore.list.mockImplementation(() => {
      throw new Error("Deps file not found");
    });

    const res = await PATCH(makeRequest({ status: "done" }), {
      params: Promise.resolve({ project: "project-a", id: "test-story" }),
    });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.changed).toBe(true);
    expect(body.unblockedStories).toHaveLength(0);
  });

  it("skips unblock for source story not in blocked status", async () => {
    mockStore.list.mockReturnValue([
      {
        id: "dep-1",
        sourceProjectId: "project-b",
        sourceStoryId: "already-in-progress-story",
        targetProjectId: "project-a",
        targetStoryId: "test-story",
        createdAt: "2026-03-29T00:00:00.000Z",
      },
    ] as never[]);

    mockAutoUnblock.mockReturnValue([
      { projectId: "project-b", storyId: "already-in-progress-story" },
    ] as never[]);

    // Source story is "in-progress", not "blocked"
    mockReadSprintStatus.mockImplementation(((project: { name?: string }) => {
      if (project.name === "Project A") {
        return {
          development_status: { "test-story": { status: "in-progress" } },
        };
      }
      return {
        development_status: { "already-in-progress-story": { status: "in-progress" } },
      };
    }) as never);

    const res = await PATCH(makeRequest({ status: "done" }), {
      params: Promise.resolve({ project: "project-a", id: "test-story" }),
    });
    const body = await res.json();

    expect(body.changed).toBe(true);
    expect(body.unblockedStories).toHaveLength(0);
    // Only original writeStoryStatus — the source story wasn't blocked
    expect(mockWriteStoryStatus).toHaveBeenCalledTimes(1);
  });
});
