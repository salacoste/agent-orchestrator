/**
 * Cross-Project Dependency API Route Tests (Story 51.1)
 *
 * Tests for GET/POST/DELETE /api/dependencies/cross-project
 * and GET /api/dependencies/cross-project/search-stories
 */

import { describe, expect, it, vi, beforeEach } from "vitest";

// ── Mocks (must be before route imports) ──────────────────────────────────────

const mockStore = {
  add: vi.fn(),
  remove: vi.fn(),
  getForStory: vi.fn(),
  list: vi.fn(),
};

vi.mock("@/lib/services", () => ({
  getServices: vi.fn(async () => ({
    config: {
      configPath: "/tmp/test-ao-config.yaml",
      projects: {
        "project-a": {
          sharedPool: { enabled: true, eligibleProjects: ["project-b"] },
        },
        "project-b": {},
      },
    },
  })),
}));

vi.mock("@composio/ao-core", async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    // Re-export class explicitly so instanceof works in the route handler
    CircularDependencyError: actual.CircularDependencyError,
    createCrossProjectDepStore: vi.fn(() => mockStore),
    validateDependencyReferences: vi.fn(() => ({ valid: true, errors: [] })),
    resolveAllDependencyStatuses: vi.fn((deps: unknown[]) =>
      Array.isArray(deps)
        ? deps.map((d: Record<string, unknown>) => ({
            ...d,
            targetStatus: "done",
            isResolved: true,
          }))
        : [],
    ),
    getBlockedCrossProjectDeps: vi.fn((deps: unknown[]) =>
      Array.isArray(deps) ? deps.filter(() => false) : [],
    ),
  };
});

vi.mock("@composio/ao-plugin-tracker-bmad", () => ({
  readSprintStatus: vi.fn(() => ({
    development_status: {
      "49-3-another-story": "done",
      "51-1-some-story": "in-progress",
    },
  })),
}));

// ── Route imports ─────────────────────────────────────────────────────────────

import { GET, POST, DELETE } from "./route";

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeRequest(url: string, options?: RequestInit): Request {
  return new Request(url, options);
}

const SAMPLE_DEP = {
  id: "dep-test0001-abc12345",
  sourceProjectId: "project-a",
  sourceStoryId: "51-1-some-story",
  targetProjectId: "project-b",
  targetStoryId: "49-3-another-story",
  createdAt: "2026-03-29T00:00:00.000Z",
};

// ── GET /api/dependencies/cross-project ──────────────────────────────────────

describe("GET /api/dependencies/cross-project", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStore.list.mockReturnValue([]);
    mockStore.getForStory.mockReturnValue([]);
  });

  it("returns all deps when no filter", async () => {
    mockStore.list.mockReturnValue([SAMPLE_DEP]);
    const req = makeRequest("http://localhost/api/dependencies/cross-project");
    const res = await GET(req as never);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.dependencies).toHaveLength(1);
    expect(data.dependencies[0].id).toBe(SAMPLE_DEP.id);
    expect(mockStore.list).toHaveBeenCalledWith();
  });

  it("filters by projectId", async () => {
    mockStore.list.mockReturnValue([SAMPLE_DEP]);
    const req = makeRequest("http://localhost/api/dependencies/cross-project?projectId=project-a");
    const res = await GET(req as never);

    expect(res.status).toBe(200);
    expect(mockStore.list).toHaveBeenCalledWith({ projectId: "project-a" });
  });

  it("filters by projectId and storyId", async () => {
    mockStore.getForStory.mockReturnValue([SAMPLE_DEP]);
    const req = makeRequest(
      "http://localhost/api/dependencies/cross-project?projectId=project-a&storyId=51-1-some-story",
    );
    const res = await GET(req as never);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.dependencies).toHaveLength(1);
    expect(mockStore.getForStory).toHaveBeenCalledWith("project-a", "51-1-some-story");
  });

  it("returns 500 on service failure", async () => {
    const { getServices } = await import("@/lib/services");
    vi.mocked(getServices).mockRejectedValueOnce(new Error("Config not found"));

    const req = makeRequest("http://localhost/api/dependencies/cross-project");
    const res = await GET(req as never);

    expect(res.status).toBe(500);
  });
});

// ── POST /api/dependencies/cross-project ─────────────────────────────────────

describe("POST /api/dependencies/cross-project", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStore.add.mockReturnValue(SAMPLE_DEP);
  });

  it("creates a dependency and returns 201", async () => {
    const req = makeRequest("http://localhost/api/dependencies/cross-project", {
      method: "POST",
      body: JSON.stringify({
        sourceProjectId: "project-a",
        sourceStoryId: "51-1-some-story",
        targetProjectId: "project-b",
        targetStoryId: "49-3-another-story",
      }),
      headers: { "Content-Type": "application/json" },
    });

    const res = await POST(req as never);
    const data = await res.json();

    expect(res.status).toBe(201);
    expect(data.dependency.id).toBe(SAMPLE_DEP.id);
    expect(mockStore.add).toHaveBeenCalledWith({
      sourceProjectId: "project-a",
      sourceStoryId: "51-1-some-story",
      targetProjectId: "project-b",
      targetStoryId: "49-3-another-story",
    });
  });

  it("returns 400 when fields are missing", async () => {
    const req = makeRequest("http://localhost/api/dependencies/cross-project", {
      method: "POST",
      body: JSON.stringify({ sourceProjectId: "project-a" }),
      headers: { "Content-Type": "application/json" },
    });

    const res = await POST(req as never);
    expect(res.status).toBe(400);
  });

  it("returns 400 when validation fails", async () => {
    const { validateDependencyReferences } = await import("@composio/ao-core");
    vi.mocked(validateDependencyReferences).mockReturnValueOnce({
      valid: false,
      errors: [{ field: "sourceProjectId" as const, message: "Not found" }],
    });

    const req = makeRequest("http://localhost/api/dependencies/cross-project", {
      method: "POST",
      body: JSON.stringify({
        sourceProjectId: "nonexistent",
        sourceStoryId: "s-1",
        targetProjectId: "project-b",
        targetStoryId: "s-2",
      }),
      headers: { "Content-Type": "application/json" },
    });

    const res = await POST(req as never);
    expect(res.status).toBe(400);
  });

  it("returns 409 on duplicate", async () => {
    mockStore.add.mockImplementation(() => {
      throw new Error("Duplicate dependency");
    });

    const req = makeRequest("http://localhost/api/dependencies/cross-project", {
      method: "POST",
      body: JSON.stringify({
        sourceProjectId: "project-a",
        sourceStoryId: "51-1-some-story",
        targetProjectId: "project-b",
        targetStoryId: "49-3-another-story",
      }),
      headers: { "Content-Type": "application/json" },
    });

    const res = await POST(req as never);
    expect(res.status).toBe(409);
  });

  it("returns 422 on circular dependency with cyclePath", async () => {
    // Import CircularDependencyError from the mocked module (spreads actual)
    const aoCore = await import("@composio/ao-core");
    const CircDepErr = aoCore.CircularDependencyError as typeof Error & {
      new (cyclePath: Array<{ projectId: string; storyId: string }>): InstanceType<typeof Error> & {
        cyclePath: Array<{ projectId: string; storyId: string }>;
      };
    };
    const cyclePath = [
      { projectId: "project-b", storyId: "s-2" },
      { projectId: "project-a", storyId: "s-1" },
      { projectId: "project-b", storyId: "s-2" },
    ];
    mockStore.add.mockImplementation(() => {
      throw new CircDepErr(cyclePath);
    });

    const req = makeRequest("http://localhost/api/dependencies/cross-project", {
      method: "POST",
      body: JSON.stringify({
        sourceProjectId: "project-b",
        sourceStoryId: "s-2",
        targetProjectId: "project-a",
        targetStoryId: "s-1",
      }),
      headers: { "Content-Type": "application/json" },
    });

    const res = await POST(req as never);
    const data = await res.json();

    expect(res.status).toBe(422);
    expect(data.error).toContain("Circular dependency");
    expect(data.cyclePath).toBeDefined();
    expect(data.cyclePath).toHaveLength(3);
    expect(data.cyclePath[0]).toEqual({ projectId: "project-b", storyId: "s-2" });
  });

  it("returns 422 on self-referential dependency with cyclePath", async () => {
    const aoCore = await import("@composio/ao-core");
    const CircDepErr = aoCore.CircularDependencyError as typeof Error & {
      new (cyclePath: Array<{ projectId: string; storyId: string }>): InstanceType<typeof Error> & {
        cyclePath: Array<{ projectId: string; storyId: string }>;
      };
    };
    const cyclePath = [
      { projectId: "project-a", storyId: "s-1" },
      { projectId: "project-a", storyId: "s-1" },
    ];
    mockStore.add.mockImplementation(() => {
      throw new CircDepErr(cyclePath);
    });

    const req = makeRequest("http://localhost/api/dependencies/cross-project", {
      method: "POST",
      body: JSON.stringify({
        sourceProjectId: "project-a",
        sourceStoryId: "s-1",
        targetProjectId: "project-a",
        targetStoryId: "s-1",
      }),
      headers: { "Content-Type": "application/json" },
    });

    const res = await POST(req as never);
    const data = await res.json();

    expect(res.status).toBe(422);
    expect(data.error).toContain("Circular dependency");
    expect(data.cyclePath).toBeDefined();
    expect(data.cyclePath).toHaveLength(2);
    expect(data.cyclePath[0]).toEqual({ projectId: "project-a", storyId: "s-1" });
    expect(data.cyclePath[1]).toEqual({ projectId: "project-a", storyId: "s-1" });
  });

  it("returns 201 for valid dep (regression after cycle check)", async () => {
    // Ensure valid deps still work after adding cycle detection
    const req = makeRequest("http://localhost/api/dependencies/cross-project", {
      method: "POST",
      body: JSON.stringify({
        sourceProjectId: "project-a",
        sourceStoryId: "51-1-some-story",
        targetProjectId: "project-b",
        targetStoryId: "49-3-another-story",
      }),
      headers: { "Content-Type": "application/json" },
    });

    const res = await POST(req as never);
    expect(res.status).toBe(201);
  });
});

// ── DELETE /api/dependencies/cross-project ────────────────────────────────────

describe("DELETE /api/dependencies/cross-project", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("removes a dependency and returns 200", async () => {
    mockStore.remove.mockReturnValue(SAMPLE_DEP);
    const req = makeRequest("http://localhost/api/dependencies/cross-project", {
      method: "DELETE",
      body: JSON.stringify({ depId: "dep-test0001-abc12345" }),
      headers: { "Content-Type": "application/json" },
    });

    const res = await DELETE(req as never);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.removed.id).toBe(SAMPLE_DEP.id);
    expect(mockStore.remove).toHaveBeenCalledWith("dep-test0001-abc12345");
  });

  it("returns 400 when depId is missing", async () => {
    const req = makeRequest("http://localhost/api/dependencies/cross-project", {
      method: "DELETE",
      body: JSON.stringify({}),
      headers: { "Content-Type": "application/json" },
    });

    const res = await DELETE(req as never);
    expect(res.status).toBe(400);
  });

  it("returns 404 when dep not found", async () => {
    mockStore.remove.mockReturnValue(null);
    const req = makeRequest("http://localhost/api/dependencies/cross-project", {
      method: "DELETE",
      body: JSON.stringify({ depId: "nonexistent" }),
      headers: { "Content-Type": "application/json" },
    });

    const res = await DELETE(req as never);
    expect(res.status).toBe(404);
  });
});
