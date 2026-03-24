/**
 * Users API route tests (Story 46b.1).
 */
import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/services", () => ({ getServices: vi.fn() }));

import { GET } from "./route";
import { getServices } from "@/lib/services";

const mockGetServices = vi.mocked(getServices);

beforeEach(() => {
  vi.clearAllMocks();
  mockGetServices.mockResolvedValue({
    config: {
      users: [
        { id: "alice", name: "Alice", role: "lead", email: "alice@co.com" },
        { id: "bob", name: "Bob", role: "dev" },
      ],
    },
  } as never);
});

describe("GET /api/users", () => {
  it("returns configured users", async () => {
    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.users).toHaveLength(2);
    expect(data.users[0].id).toBe("alice");
    expect(data.users[1].role).toBe("dev");
  });

  it("returns empty when no users configured", async () => {
    mockGetServices.mockResolvedValue({ config: {} } as never);

    const response = await GET();
    const data = await response.json();

    expect(data.users).toEqual([]);
  });

  it("returns 500 on service failure", async () => {
    mockGetServices.mockRejectedValue(new Error("Service unavailable"));

    const response = await GET();
    expect(response.status).toBe(500);
  });
});
