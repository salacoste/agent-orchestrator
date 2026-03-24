/**
 * Resources API route tests (Story 46b.3).
 */
import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/services", () => ({ getServices: vi.fn() }));
vi.mock("@composio/ao-core", () => ({
  createResourcePool: vi.fn(() => ({
    getState: () => ({
      total: { used: 3, max: 10 },
      projects: { app: { used: 2, max: 6 }, lib: { used: 1, max: 4 } },
    }),
  })),
}));

import { GET } from "./route";
import { getServices } from "@/lib/services";

const mockGetServices = vi.mocked(getServices);

beforeEach(() => {
  vi.clearAllMocks();
  mockGetServices.mockResolvedValue({
    config: { resourcePool: { total: 10, projects: { app: 6, lib: 4 } } },
  } as never);
});

describe("GET /api/resources", () => {
  it("returns pool state", async () => {
    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.total.used).toBe(3);
    expect(data.total.max).toBe(10);
    expect(data.projects.app.used).toBe(2);
  });

  it("returns 500 on service failure", async () => {
    mockGetServices.mockRejectedValue(new Error("unavailable"));
    const response = await GET();
    expect(response.status).toBe(500);
  });
});
