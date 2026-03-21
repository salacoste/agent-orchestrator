/**
 * Health API Route Tests (Story 10.3)
 *
 * Tests for GET /api/health endpoint — validates WD-FR31 pattern (always HTTP 200).
 */

import { describe, expect, it, vi, beforeEach } from "vitest";

// Mock getServices — must be before route import
vi.mock("@/lib/services", () => ({
  getServices: vi.fn(async () => ({
    config: {
      health: {
        thresholds: { maxLatencyMs: 1000, maxQueueDepth: 100 },
      },
    },
  })),
}));

// Mock createHealthCheckService
const mockCheck = vi.fn();
vi.mock("@composio/ao-core", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...(actual as Record<string, unknown>),
    createHealthCheckService: vi.fn(() => ({
      check: mockCheck,
    })),
  };
});

import { GET } from "./route";

describe("GET /api/health", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns HTTP 200 with healthy status", async () => {
    mockCheck.mockResolvedValue({
      overall: "healthy",
      components: [{ component: "Event Bus", status: "healthy", message: "Connected" }],
      timestamp: new Date("2026-03-18T12:00:00Z"),
      exitCode: 0,
    });

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.overall).toBe("healthy");
    expect(data.components).toHaveLength(1);
    expect(data.components[0].component).toBe("Event Bus");
    expect(data.timestamp).toBeDefined();
    expect(data.exitCode).toBe(0);
  });

  it("returns HTTP 200 even when unhealthy (WD-FR31)", async () => {
    mockCheck.mockResolvedValue({
      overall: "unhealthy",
      components: [{ component: "BMAD Tracker", status: "unhealthy", message: "Not available" }],
      timestamp: new Date("2026-03-18T12:00:00Z"),
      exitCode: 1,
    });

    const response = await GET();
    const data = await response.json();

    // WD-FR31: Always HTTP 200 for expected states
    expect(response.status).toBe(200);
    expect(data.overall).toBe("unhealthy");
    expect(data.exitCode).toBe(1);
  });

  it("returns HTTP 200 with error message on service failure (WD-FR31)", async () => {
    mockCheck.mockRejectedValue(new Error("Service init failed"));

    const response = await GET();
    const data = await response.json();

    // WD-FR31: Even on thrown error, return 200
    expect(response.status).toBe(200);
    expect(data.overall).toBe("unhealthy");
    expect(data.error).toBeDefined();
  });

  it("includes Cache-Control no-cache header", async () => {
    mockCheck.mockResolvedValue({
      overall: "healthy",
      components: [],
      timestamp: new Date(),
      exitCode: 0,
    });

    const response = await GET();

    expect(response.headers.get("Cache-Control")).toContain("no-cache");
  });

  it("returns components with expected shape", async () => {
    mockCheck.mockResolvedValue({
      overall: "degraded",
      components: [
        {
          component: "DLQ",
          status: "degraded",
          message: "5 entries",
          latencyMs: 2,
          details: ["bmad_sync: 3"],
        },
      ],
      timestamp: new Date(),
      exitCode: 0,
    });

    const response = await GET();
    const data = await response.json();

    expect(data.components[0]).toEqual(
      expect.objectContaining({
        component: "DLQ",
        status: "degraded",
        message: "5 entries",
      }),
    );
  });
});
