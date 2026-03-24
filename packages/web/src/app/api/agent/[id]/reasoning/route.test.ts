/**
 * Agent reasoning trail API route tests (Story 45.7).
 */
import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/services", () => ({
  getServices: vi.fn(),
}));

vi.mock("@composio/ao-core", () => ({
  extractReasoning: vi.fn(
    (input: { agentId: string; summary: string | null; domainTags: string[] }) => ({
      agentId: input.agentId,
      hasData: !!input.summary || input.domainTags.length > 0,
      decisions: input.summary
        ? [{ category: "general", decision: input.summary, rationale: "From summary" }]
        : [],
    }),
  ),
}));

import { GET } from "./route";
import { getServices } from "@/lib/services";

const mockGetServices = vi.mocked(getServices);

beforeEach(() => {
  vi.clearAllMocks();

  mockGetServices.mockResolvedValue({
    sessionManager: {
      get: vi.fn(() => ({
        agentInfo: { summary: "Chose vitest for testing because ESM support" },
      })),
    },
    learningStore: {
      query: vi.fn(() => [
        {
          domainTags: ["backend"],
          errorCategories: [],
          filesModified: ["src/index.ts"],
          retryCount: 0,
        },
      ]),
    },
  } as never);
});

describe("GET /api/agent/[id]/reasoning", () => {
  it("returns reasoning trail with decisions", async () => {
    const response = await GET(new Request("http://localhost/api/agent/agent-1/reasoning"), {
      params: Promise.resolve({ id: "agent-1" }),
    });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.agentId).toBe("agent-1");
    expect(data.hasData).toBe(true);
    expect(data.decisions.length).toBeGreaterThan(0);
  });

  it("returns empty trail when no data available", async () => {
    mockGetServices.mockResolvedValue({
      sessionManager: { get: vi.fn(() => null) },
      learningStore: { query: vi.fn(() => []) },
    } as never);

    const response = await GET(new Request("http://localhost/api/agent/agent-1/reasoning"), {
      params: Promise.resolve({ id: "agent-1" }),
    });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.hasData).toBe(false);
  });

  it("returns 400 for invalid agent ID", async () => {
    const response = await GET(new Request("http://localhost/api/agent/../etc/reasoning"), {
      params: Promise.resolve({ id: "../etc" }),
    });

    expect(response.status).toBe(400);
  });

  it("returns 500 on service failure", async () => {
    mockGetServices.mockRejectedValue(new Error("Service unavailable"));

    const response = await GET(new Request("http://localhost/api/agent/agent-1/reasoning"), {
      params: Promise.resolve({ id: "agent-1" }),
    });

    expect(response.status).toBe(500);
  });
});
