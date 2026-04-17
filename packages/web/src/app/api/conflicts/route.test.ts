/**
 * Resource Conflicts API Route Tests (Epic 52, Story 52.1)
 *
 * Tests for GET /api/conflicts
 * Query params: ?resourceType=agent&projectId=proj-a (optional filters)
 */

import { describe, expect, it, vi, beforeEach } from "vitest";

// ── Mocks (must be before route imports) ──────────────────────────────────────

const mockStore = {
  save: vi.fn(),
  list: vi.fn(() => []),
  getActive: vi.fn(() => []),
  clear: vi.fn(),
};

vi.mock("@/lib/services", () => ({
  getServices: vi.fn(async () => ({
    config: {
      configPath: "/tmp/test-ao-config.yaml",
      projects: {
        "project-a": { repo: "org/shared-repo", path: "/path/a" },
        "project-b": { repo: "org/shared-repo", path: "/path/b" },
      },
    },
  })),
}));

vi.mock("@composio/ao-core", async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    checkResourceConflicts: vi.fn(() => ({
      conflicts: [
        {
          id: "conflict-test-001",
          resourceType: "repository",
          resourceIdentifier: "org/shared-repo",
          competingProjects: ["project-a", "project-b"],
          severity: "high",
          detectedAt: "2026-03-31T12:00:00.000Z",
          metadata: { competingCount: 2 },
        },
      ],
      scanDurationMs: 1.5,
    })),
    createResourceConflictStore: vi.fn(() => mockStore),
  };
});

// ── Route import ─────────────────────────────────────────────────────────────

import { GET } from "./route";

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeRequest(url: string): Request {
  return new Request(url);
}

// ── GET /api/conflicts ──────────────────────────────────────────────────────

describe("GET /api/conflicts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStore.list.mockReturnValue([]);
  });

  it("returns conflicts when overlaps exist", async () => {
    mockStore.list.mockReturnValue([
      {
        id: "conflict-test-001",
        resourceType: "repository",
        resourceIdentifier: "org/shared-repo",
        competingProjects: ["project-a", "project-b"],
        severity: "high",
        detectedAt: "2026-03-31T12:00:00.000Z",
        metadata: { competingCount: 2 },
      },
    ]);

    const req = makeRequest("http://localhost/api/conflicts");
    const res = await GET(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.conflicts).toHaveLength(1);
    expect(data.conflicts[0].resourceIdentifier).toBe("org/shared-repo");
    expect(data.lastScanAt).toBeDefined();
    expect(data.scanDurationMs).toBeDefined();
  });

  it("returns empty array when no overlaps", async () => {
    mockStore.list.mockReturnValue([]);

    const req = makeRequest("http://localhost/api/conflicts");
    const res = await GET(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.conflicts).toEqual([]);
  });

  it("filters by resourceType", async () => {
    mockStore.list.mockReturnValue([]);

    const req = makeRequest("http://localhost/api/conflicts?resourceType=agent");
    const res = await GET(req);

    expect(res.status).toBe(200);
    expect(mockStore.list).toHaveBeenCalledWith({ resourceType: "agent" });
  });

  it("filters by projectId", async () => {
    mockStore.list.mockReturnValue([]);

    const req = makeRequest("http://localhost/api/conflicts?projectId=project-a");
    const res = await GET(req);

    expect(res.status).toBe(200);
    expect(mockStore.list).toHaveBeenCalledWith({ projectId: "project-a" });
  });

  it("returns 500 on service failure", async () => {
    const { getServices } = await import("@/lib/services");
    vi.mocked(getServices).mockRejectedValueOnce(new Error("Config not found"));

    const req = makeRequest("http://localhost/api/conflicts");
    const res = await GET(req);

    expect(res.status).toBe(500);
  });

  it("uses checkResourceConflicts for detection + persistence + audit", async () => {
    mockStore.list.mockReturnValue([]);

    const req = makeRequest("http://localhost/api/conflicts");
    await GET(req);

    const { checkResourceConflicts } = await import("@composio/ao-core");
    expect(checkResourceConflicts).toHaveBeenCalledTimes(1);
  });
});
