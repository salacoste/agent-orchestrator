/**
 * Conflict Suggestions API Route Tests (Epic 52, Story 52.3)
 *
 * Tests for GET /api/conflicts/[conflictId]/suggestions
 */

import { describe, expect, it, vi, beforeEach } from "vitest";

// ── Mocks (must be before route imports) ──────────────────────────────────────

const mockConflict = {
  id: "conflict-test-001",
  resourceType: "repository",
  resourceIdentifier: "org/shared-repo",
  competingProjects: ["project-a", "project-b"],
  severity: "high",
  detectedAt: "2026-04-01T12:00:00.000Z",
  metadata: {},
};

const mockStore = {
  save: vi.fn(),
  list: vi.fn(() => [mockConflict]),
  getActive: vi.fn(() => [mockConflict]),
  clear: vi.fn(),
};

const mockSuggestions = [
  {
    id: "suggestion-abc123",
    conflictId: "conflict-test-001",
    strategy: "sequential-scheduling",
    description: "Queue project work sequentially",
    impactEstimate: "Delays lower-priority project by ~2 work cycles",
    recommended: true,
    actions: [{ type: "schedule-change", description: "Define priority order" }],
  },
  {
    id: "suggestion-def456",
    conflictId: "conflict-test-001",
    strategy: "resource-isolation",
    description: "Assign dedicated resource",
    impactEstimate: "Eliminates conflict",
    recommended: false,
    actions: [{ type: "config-change", description: "Configure separate branches" }],
  },
];

vi.mock("@/lib/services", () => ({
  getServices: vi.fn(async () => ({
    config: {
      configPath: "/tmp/test-ao-config.yaml",
      projects: {},
    },
  })),
}));

vi.mock("@composio/ao-core", () => ({
  createResourceConflictStore: vi.fn(() => mockStore),
  generateSuggestions: vi.fn(() => mockSuggestions),
}));

// ── Imports after mocks ──────────────────────────────────────────────────────

import { GET } from "./route";
import { getServices } from "@/lib/services";
import { generateSuggestions } from "@composio/ao-core";

beforeEach(() => {
  vi.clearAllMocks();
  mockStore.list.mockReturnValue([mockConflict]);
});

function makeParams(conflictId: string) {
  return { params: Promise.resolve({ conflictId }) };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("GET /api/conflicts/[conflictId]/suggestions", () => {
  it("returns suggestions for a known conflict", async () => {
    const res = await GET(
      new Request("http://localhost") as never,
      makeParams("conflict-test-001"),
    );
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.conflict.id).toBe("conflict-test-001");
    expect(body.suggestions).toHaveLength(2);
    expect(body.suggestions[0].strategy).toBe("sequential-scheduling");
    expect(body.generatedAt).toBeTruthy();

    expect(vi.mocked(generateSuggestions)).toHaveBeenCalledWith(mockConflict, expect.anything());
  });

  it("returns 404 for unknown conflict ID", async () => {
    mockStore.list.mockReturnValue([]);

    const res = await GET(new Request("http://localhost") as never, makeParams("conflict-missing"));
    expect(res.status).toBe(404);

    const body = await res.json();
    expect(body.error).toContain("conflict-missing");
    expect(vi.mocked(generateSuggestions)).not.toHaveBeenCalled();
  });

  it("returns 500 when services throw", async () => {
    vi.mocked(getServices).mockRejectedValueOnce(new Error("Config file missing"));

    const res = await GET(
      new Request("http://localhost") as never,
      makeParams("conflict-test-001"),
    );
    expect(res.status).toBe(500);

    const body = await res.json();
    expect(body.error).toBe("Config file missing");
  });

  it("passes config to generateSuggestions", async () => {
    await GET(new Request("http://localhost") as never, makeParams("conflict-test-001"));

    expect(vi.mocked(generateSuggestions)).toHaveBeenCalledTimes(1);
    const [, configArg] = vi.mocked(generateSuggestions).mock.calls[0];
    expect(configArg).toHaveProperty("projects");
  });

  it("returns 200 with empty suggestions for low-severity conflict", async () => {
    vi.mocked(generateSuggestions).mockReturnValueOnce([]);

    const res = await GET(
      new Request("http://localhost") as never,
      makeParams("conflict-test-001"),
    );
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.suggestions).toEqual([]);
    expect(body.conflict.id).toBe("conflict-test-001");
  });
});
