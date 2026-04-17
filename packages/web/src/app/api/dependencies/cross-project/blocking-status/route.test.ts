/**
 * Tests for GET /api/dependencies/cross-project/blocking-status (Story 51.5).
 */

import { describe, expect, it, vi, beforeEach } from "vitest";

// ── Mocks (must be before route imports) ──────────────────────────────────────

const mockDepStore = {
  list: vi.fn(),
  add: vi.fn(),
  remove: vi.fn(),
  getForStory: vi.fn(),
};

const mockBlockingStore = {
  load: vi.fn(),
  save: vi.fn(),
  refresh: vi.fn(),
};

vi.mock("@/lib/services", () => ({
  getServices: vi.fn(async () => ({
    config: {
      configPath: "/tmp/test-ao-config.yaml",
      projects: {
        "project-a": {},
        "project-b": {},
      },
    },
  })),
}));

vi.mock("@composio/ao-core", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...(actual as Record<string, unknown>),
    createCrossProjectDepStore: vi.fn(() => mockDepStore),
    createBlockingTimesStore: vi.fn(() => mockBlockingStore),
  };
});

vi.mock("@/lib/sprint-data-map.js", () => ({
  buildSprintDataMap: vi.fn(async () => ({
    "project-a": { development_status: { "story-1": "in-progress" } },
    "project-b": { development_status: { "story-2": "in-progress" } },
  })),
}));

// ── Route imports ─────────────────────────────────────────────────────────────

import { GET } from "./route";

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeRequest(url: string): Request {
  return new Request(url);
}

const SAMPLE_DEP = {
  id: "dep-test0001-abc12345",
  sourceProjectId: "project-a",
  sourceStoryId: "story-1",
  targetProjectId: "project-b",
  targetStoryId: "story-2",
  createdAt: "2026-03-30T10:00:00.000Z",
};

const SAMPLE_ALERT = {
  dep: SAMPLE_DEP,
  blockedStoryId: "story-1",
  blockedProjectId: "project-a",
  blockingStoryId: "story-2",
  blockingProjectId: "project-b",
  blockingDurationMs: 7_200_000,
  blockingDurationLabel: "2h",
  thresholdExceeded: true,
};

// ── GET /api/dependencies/cross-project/blocking-status ──────────────────────

describe("GET /api/dependencies/cross-project/blocking-status", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDepStore.list.mockReturnValue([]);
    mockBlockingStore.refresh.mockReturnValue({ times: {}, alerts: [] });
  });

  it("returns empty alerts when no deps exist", async () => {
    mockDepStore.list.mockReturnValue([]);

    const req = makeRequest("http://localhost/api/dependencies/cross-project/blocking-status");
    const res = await GET(req as never);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.alerts).toHaveLength(0);
    expect(data.totalBlocked).toBe(0);
    expect(data.blockingThresholdMs).toBe(3_600_000);
  });

  it("returns alerts for blocked deps", async () => {
    mockDepStore.list.mockReturnValue([SAMPLE_DEP]);
    mockBlockingStore.refresh.mockReturnValue({
      times: { "dep-test0001-abc12345": "2026-03-30T10:00:00.000Z" },
      alerts: [SAMPLE_ALERT],
    });

    const req = makeRequest("http://localhost/api/dependencies/cross-project/blocking-status");
    const res = await GET(req as never);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.alerts).toHaveLength(1);
    expect(data.alerts[0].thresholdExceeded).toBe(true);
    expect(data.totalBlocked).toBe(1);
  });

  it("accepts threshold query param override", async () => {
    mockDepStore.list.mockReturnValue([SAMPLE_DEP]);
    mockBlockingStore.refresh.mockReturnValue({ times: {}, alerts: [] });

    const req = makeRequest(
      "http://localhost/api/dependencies/cross-project/blocking-status?threshold=7200000",
    );
    const res = await GET(req as never);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.blockingThresholdMs).toBe(7_200_000);
    expect(mockBlockingStore.refresh).toHaveBeenCalledWith(
      [SAMPLE_DEP],
      expect.any(Object),
      7_200_000,
    );
  });

  it("returns 400 for invalid threshold param", async () => {
    const req = makeRequest(
      "http://localhost/api/dependencies/cross-project/blocking-status?threshold=notanumber",
    );
    const res = await GET(req as never);
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toContain("positive integer");
  });

  it("returns 400 for negative threshold param", async () => {
    const req = makeRequest(
      "http://localhost/api/dependencies/cross-project/blocking-status?threshold=-1000",
    );
    const res = await GET(req as never);
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toContain("positive integer");
  });

  it("returns 400 for zero threshold param (would cause alert storm)", async () => {
    const req = makeRequest(
      "http://localhost/api/dependencies/cross-project/blocking-status?threshold=0",
    );
    const res = await GET(req as never);
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toContain("positive integer");
  });

  it("returns 500 on service failure", async () => {
    const { getServices } = await import("@/lib/services");
    vi.mocked(getServices).mockRejectedValueOnce(new Error("Config not found"));

    const req = makeRequest("http://localhost/api/dependencies/cross-project/blocking-status");
    const res = await GET(req as never);

    expect(res.status).toBe(500);
  });

  it("counts only threshold-exceeded alerts in totalBlocked", async () => {
    mockDepStore.list.mockReturnValue([SAMPLE_DEP]);
    mockBlockingStore.refresh.mockReturnValue({
      times: { "dep-test0001-abc12345": "2026-03-30T11:30:00.000Z" },
      alerts: [
        {
          ...SAMPLE_ALERT,
          blockingDurationMs: 1_800_000,
          blockingDurationLabel: "30m",
          thresholdExceeded: false,
        },
      ],
    });

    const req = makeRequest("http://localhost/api/dependencies/cross-project/blocking-status");
    const res = await GET(req as never);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.alerts).toHaveLength(1);
    expect(data.totalBlocked).toBe(0);
  });
});
