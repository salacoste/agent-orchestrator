/**
 * State import route tests (Story 46a.2).
 */
import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/services", () => ({ getServices: vi.fn() }));
vi.mock("@composio/ao-core", () => ({
  validateSnapshot: vi.fn((data: unknown) => {
    const obj = data as Record<string, unknown>;
    if (obj.version !== 1) return { valid: false, errors: ["Invalid version"] };
    return { valid: true, errors: [] };
  }),
  mergeLearnings: vi.fn(
    (existing: Array<{ sessionId: string }>, imported: Array<Record<string, unknown>>) => {
      const ids = new Set(existing.map((e) => e.sessionId));
      return imported.filter((e) => !ids.has(e.sessionId as string));
    },
  ),
}));

import { POST } from "./route";
import { getServices } from "@/lib/services";

const mockGetServices = vi.mocked(getServices);

beforeEach(() => {
  vi.clearAllMocks();
  mockGetServices.mockResolvedValue({
    learningStore: {
      list: () => [{ sessionId: "existing-1" }],
      append: vi.fn(),
    },
  } as never);
});

const validSnapshot = {
  version: 1,
  exportedAt: "2026-03-24T10:00:00Z",
  sessions: [],
  learnings: [{ sessionId: "new-1" }],
  sprintStatus: null,
  collaboration: null,
};

describe("POST /api/state/import", () => {
  it("imports valid snapshot and returns count", async () => {
    const response = await POST(
      new Request("http://localhost/api/state/import", {
        method: "POST",
        body: JSON.stringify(validSnapshot),
      }),
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.imported.learnings).toBe(1);
    expect(data.imported.sessions).toBe(0);
  });

  it("rejects invalid snapshot", async () => {
    const response = await POST(
      new Request("http://localhost/api/state/import", {
        method: "POST",
        body: JSON.stringify({ version: 99 }),
      }),
    );
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain("Invalid snapshot");
  });

  it("rejects invalid JSON", async () => {
    const response = await POST(
      new Request("http://localhost/api/state/import", {
        method: "POST",
        body: "not json",
      }),
    );

    expect(response.status).toBe(400);
  });

  it("returns 500 on service failure", async () => {
    mockGetServices.mockRejectedValue(new Error("Service unavailable"));

    const response = await POST(
      new Request("http://localhost/api/state/import", {
        method: "POST",
        body: JSON.stringify(validSnapshot),
      }),
    );

    expect(response.status).toBe(500);
  });
});
