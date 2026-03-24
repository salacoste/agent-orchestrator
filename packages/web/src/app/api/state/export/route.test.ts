/**
 * State export route tests (Story 46a.2).
 */
import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/services", () => ({ getServices: vi.fn() }));
vi.mock("@composio/ao-plugin-tracker-bmad", () => ({ readSprintStatus: vi.fn() }));
vi.mock("@composio/ao-core", () => ({
  assembleSnapshot: vi.fn((data: { sessions: unknown[]; learnings: unknown[] }) => ({
    version: 1,
    exportedAt: new Date().toISOString(),
    sessions: data.sessions,
    learnings: data.learnings,
    sprintStatus: null,
    collaboration: null,
  })),
}));

import { GET } from "./route";
import { getServices } from "@/lib/services";

const mockGetServices = vi.mocked(getServices);

beforeEach(() => {
  vi.clearAllMocks();
  mockGetServices.mockResolvedValue({
    sessionManager: { list: () => [{ sessionId: "s-1", status: "running" }] },
    learningStore: { list: () => [{ sessionId: "s-1", outcome: "completed" }] },
    config: { projects: {} },
  } as never);
});

describe("GET /api/state/export", () => {
  it("returns snapshot with version and sections", async () => {
    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.version).toBe(1);
    expect(data.sessions).toHaveLength(1);
    expect(data.learnings).toHaveLength(1);
  });

  it("returns 500 on service failure", async () => {
    mockGetServices.mockRejectedValue(new Error("Service unavailable"));
    const response = await GET();
    expect(response.status).toBe(500);
  });
});
