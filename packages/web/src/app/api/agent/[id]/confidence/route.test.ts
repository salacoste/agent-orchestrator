/**
 * Agent confidence API route tests (Story 45.6).
 */
import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/services", () => ({
  getServices: vi.fn(),
}));

vi.mock("@composio/ao-core", () => ({
  calculateConfidence: vi.fn(
    (input: { retryCount: number; filesModified: string[]; errorCategories: string[] }) => {
      const score = Math.max(0, 100 - input.retryCount * 20 - input.errorCategories.length * 15);
      const confidence = score >= 70 ? "high" : score >= 40 ? "medium" : "low";
      return input.filesModified.map((file: string) => ({ file, confidence, score, reasons: [] }));
    },
  ),
}));

import { GET } from "./route";
import { getServices } from "@/lib/services";

const mockGetServices = vi.mocked(getServices);

beforeEach(() => {
  vi.clearAllMocks();

  mockGetServices.mockResolvedValue({
    learningStore: {
      query: vi.fn(() => [
        {
          retryCount: 1,
          errorCategories: ["timeout"],
          filesModified: ["src/a.ts", "src/b.ts"],
          durationMs: 30000,
        },
      ]),
    },
  } as never);
});

describe("GET /api/agent/[id]/confidence", () => {
  it("returns confidence data for agent", async () => {
    const response = await GET(new Request("http://localhost/api/agent/agent-1/confidence"), {
      params: Promise.resolve({ id: "agent-1" }),
    });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.agentId).toBe("agent-1");
    expect(data.files).toHaveLength(2);
    expect(data.files[0].confidence).toBe("medium"); // 100-20-15=65
  });

  it("returns empty files when no learning data", async () => {
    mockGetServices.mockResolvedValue({
      learningStore: { query: vi.fn(() => []) },
    } as never);

    const response = await GET(new Request("http://localhost/api/agent/agent-1/confidence"), {
      params: Promise.resolve({ id: "agent-1" }),
    });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.files).toHaveLength(0);
  });

  it("returns 400 for invalid agent ID", async () => {
    const response = await GET(new Request("http://localhost/api/agent/../etc/confidence"), {
      params: Promise.resolve({ id: "../etc" }),
    });

    expect(response.status).toBe(400);
  });

  it("returns 500 on service failure", async () => {
    mockGetServices.mockRejectedValue(new Error("Service unavailable"));

    const response = await GET(new Request("http://localhost/api/agent/agent-1/confidence"), {
      params: Promise.resolve({ id: "agent-1" }),
    });
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe("Service unavailable");
  });
});
