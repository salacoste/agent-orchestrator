/**
 * Sprint simulation route tests (Story 48.2).
 */
import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/services", () => ({ getServices: vi.fn() }));
vi.mock("@composio/ao-plugin-tracker-bmad", () => ({ readSprintStatus: vi.fn() }));
vi.mock("@composio/ao-core", () => ({
  simulateSprint: vi.fn(() => ({
    p50Days: 3.2,
    p80Days: 4.5,
    p95Days: 6.1,
    onTimeProbability: 0.75,
    confidence: 0.8,
    iterationsRun: 1000,
  })),
  getSimulationColor: vi.fn((p: number) => (p > 0.8 ? "green" : p >= 0.5 ? "amber" : "red")),
}));

import { GET } from "./route";
import { getServices } from "@/lib/services";
import { readSprintStatus } from "@composio/ao-plugin-tracker-bmad";

const mockGetServices = vi.mocked(getServices);
const mockReadSprintStatus = vi.mocked(readSprintStatus);

beforeEach(() => {
  vi.clearAllMocks();
  mockGetServices.mockResolvedValue({
    config: { projects: { app: { name: "App", path: "/tmp" } } },
    learningStore: { list: () => [] },
  } as never);
  mockReadSprintStatus.mockReturnValue({
    development_status: {
      "epic-1": { status: "done" },
      "1-1-auth": { status: "backlog" },
      "1-2-api": { status: "in-progress" },
      "1-3-done": { status: "done" },
    },
  } as never);
});

describe("GET /api/sprint/simulate", () => {
  it("returns simulation results with color", async () => {
    const response = await GET(new Request("http://localhost/api/sprint/simulate"));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.p50Days).toBe(3.2);
    expect(data.p80Days).toBe(4.5);
    expect(data.onTimeProbability).toBe(0.75);
    expect(data.color).toBe("amber");
  });

  it("accepts iterations query param", async () => {
    const response = await GET(new Request("http://localhost/api/sprint/simulate?iterations=500"));

    expect(response.status).toBe(200);
  });

  it("returns 500 on service failure", async () => {
    mockGetServices.mockRejectedValue(new Error("unavailable"));

    const response = await GET(new Request("http://localhost/api/sprint/simulate"));
    expect(response.status).toBe(500);
  });
});
