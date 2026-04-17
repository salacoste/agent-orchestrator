/**
 * Conflict History API Route Tests (Epic 52, Story 52.5)
 *
 * Tests for GET /api/conflicts/history and GET /api/conflicts/history/export
 */

import { describe, expect, it, vi, beforeEach } from "vitest";

// ── Mocks (must be before route imports) ──────────────────────────────────────

const mockEntries = [
  {
    id: "history-001",
    conflict: {
      id: "conflict-test-001",
      resourceType: "repository",
      resourceIdentifier: "org/shared-repo",
      competingProjects: ["project-a", "project-b"],
      severity: "high",
      detectedAt: "2026-04-01T12:00:00.000Z",
      metadata: {},
    },
    resolvedAt: "2026-04-01T14:00:00.000Z",
    resolutionStrategy: "sequential-scheduling",
    resolutionOutcome: "resolved",
    resolvedBy: "user@example.com",
    notes: "Queued project B",
  },
  {
    id: "history-002",
    conflict: {
      id: "conflict-test-002",
      resourceType: "agent",
      resourceIdentifier: "shared-pool",
      competingProjects: ["project-a", "project-c"],
      severity: "critical",
      detectedAt: "2026-04-01T08:00:00.000Z",
      metadata: {},
    },
    resolvedAt: "2026-04-01T10:00:00.000Z",
    resolutionStrategy: "agent-reassignment",
    resolutionOutcome: "auto-resolved",
    resolvedBy: "system",
    notes: "",
  },
];

const mockPatterns = {
  totalResolved: 2,
  byResourceType: { repository: 1, agent: 1 },
  byOutcome: { resolved: 1, "auto-resolved": 1 },
  byStrategy: { "sequential-scheduling": 1, "agent-reassignment": 1 },
  mostConflictedResource: "org/shared-repo",
  avgResolutionTimeMs: 7200000,
  recurringConflicts: [],
};

vi.mock("@/lib/services", () => ({
  getServices: vi.fn(async () => ({
    config: { configPath: "/tmp/test-ao-config.yaml", projects: {} },
  })),
}));

vi.mock("@composio/ao-core", () => ({
  readConflictHistory: vi.fn(() => mockEntries),
  filterConflictHistory: vi.fn((entries: unknown[], _filter: unknown) => entries),
  computeConflictPatterns: vi.fn(() => mockPatterns),
  exportConflictHistory: vi.fn((entries: unknown[]) =>
    JSON.stringify({
      exportedAt: new Date().toISOString(),
      entryCount: (entries as unknown[]).length,
      entries,
    }),
  ),
}));

// ── Imports after mocks ──────────────────────────────────────────────────────

import { GET as historyGET } from "./route";
import { GET as exportGET } from "./export/route";
import {
  readConflictHistory,
  filterConflictHistory,
  computeConflictPatterns,
} from "@composio/ao-core";

beforeEach(() => {
  vi.clearAllMocks();
});

function makeRequest(url: string) {
  return new Request(url) as never;
}

// ── History Route Tests ──────────────────────────────────────────────────────

describe("GET /api/conflicts/history", () => {
  it("returns history entries and patterns", async () => {
    const res = await historyGET(makeRequest("http://localhost/api/conflicts/history"), {
      params: Promise.resolve({}),
    });
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.entries).toHaveLength(2);
    expect(body.patterns.totalResolved).toBe(2);
    expect(body.filter).toEqual({});

    expect(vi.mocked(readConflictHistory)).toHaveBeenCalledWith("/tmp/test-ao-config.yaml");
    expect(vi.mocked(computeConflictPatterns)).toHaveBeenCalledTimes(1);
  });

  it("passes query params as filter", async () => {
    const res = await historyGET(
      makeRequest(
        "http://localhost/api/conflicts/history?resourceType=agent&outcome=auto-resolved&dateFrom=2026-04-01T00:00:00Z",
      ),
      { params: Promise.resolve({}) },
    );
    expect(res.status).toBe(200);

    expect(vi.mocked(filterConflictHistory)).toHaveBeenCalledTimes(1);
    const [entries, filter] = vi.mocked(filterConflictHistory).mock.calls[0];
    expect(entries).toEqual(mockEntries);
    expect(filter).toEqual({
      resourceType: "agent",
      resolutionOutcome: "auto-resolved",
      dateFrom: "2026-04-01T00:00:00Z",
    });
  });

  it("returns empty entries when no history exists", async () => {
    vi.mocked(readConflictHistory).mockReturnValueOnce([]);
    vi.mocked(computeConflictPatterns).mockReturnValueOnce({
      totalResolved: 0,
      byResourceType: {},
      byOutcome: {},
      byStrategy: {},
      mostConflictedResource: null,
      avgResolutionTimeMs: 0,
      recurringConflicts: [],
    });

    const res = await historyGET(makeRequest("http://localhost/api/conflicts/history"), {
      params: Promise.resolve({}),
    });
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.entries).toEqual([]);
    expect(body.patterns.totalResolved).toBe(0);
  });

  it("returns 500 when services throw", async () => {
    const { getServices } = await import("@/lib/services");
    vi.mocked(getServices).mockRejectedValueOnce(new Error("Config missing"));

    const res = await historyGET(makeRequest("http://localhost/api/conflicts/history"), {
      params: Promise.resolve({}),
    });
    expect(res.status).toBe(500);

    const body = await res.json();
    expect(body.error).toBe("Config missing");
  });
});

// ── Export Route Tests ───────────────────────────────────────────────────────

describe("GET /api/conflicts/history/export", () => {
  it("returns JSON with download headers", async () => {
    const res = await exportGET(makeRequest("http://localhost/api/conflicts/history/export"), {
      params: Promise.resolve({}),
    });
    expect(res.status).toBe(200);

    const disposition = res.headers.get("Content-Disposition");
    expect(disposition).toContain("attachment");
    expect(disposition).toContain("conflict-history-");
    expect(disposition).toContain(".json");

    const contentType = res.headers.get("Content-Type");
    expect(contentType).toBe("application/json");

    const body = await res.text();
    const parsed = JSON.parse(body);
    expect(parsed.entryCount).toBe(2);
  });

  it("respects projectId filter", async () => {
    const res = await exportGET(
      makeRequest("http://localhost/api/conflicts/history/export?projectId=project-a"),
      { params: Promise.resolve({}) },
    );
    expect(res.status).toBe(200);

    expect(vi.mocked(filterConflictHistory)).toHaveBeenCalledTimes(1);
    const filter = vi.mocked(filterConflictHistory).mock.calls[0][1];
    expect(filter).toEqual({ projectId: "project-a" });
  });

  it("respects resourceType filter", async () => {
    const res = await exportGET(
      makeRequest("http://localhost/api/conflicts/history/export?resourceType=agent"),
      { params: Promise.resolve({}) },
    );
    expect(res.status).toBe(200);

    const filter = vi.mocked(filterConflictHistory).mock.calls[0][1];
    expect(filter).toEqual({ resourceType: "agent" });
  });

  it("respects date range filters", async () => {
    const res = await exportGET(
      makeRequest(
        "http://localhost/api/conflicts/history/export?dateFrom=2026-04-01T00:00:00Z&dateTo=2026-04-02T00:00:00Z",
      ),
      { params: Promise.resolve({}) },
    );
    expect(res.status).toBe(200);

    const filter = vi.mocked(filterConflictHistory).mock.calls[0][1];
    expect(filter).toEqual({
      dateFrom: "2026-04-01T00:00:00Z",
      dateTo: "2026-04-02T00:00:00Z",
    });
  });

  it("respects outcome filter", async () => {
    const res = await exportGET(
      makeRequest("http://localhost/api/conflicts/history/export?outcome=auto-resolved"),
      { params: Promise.resolve({}) },
    );
    expect(res.status).toBe(200);

    const filter = vi.mocked(filterConflictHistory).mock.calls[0][1];
    expect(filter).toEqual({ resolutionOutcome: "auto-resolved" });
  });

  it("returns 500 when services throw", async () => {
    const { getServices } = await import("@/lib/services");
    vi.mocked(getServices).mockRejectedValueOnce(new Error("Service unavailable"));

    const res = await exportGET(makeRequest("http://localhost/api/conflicts/history/export"), {
      params: Promise.resolve({}),
    });
    expect(res.status).toBe(500);
  });
});
