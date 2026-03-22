/**
 * POST /api/chat — Project chat API tests (Story 40.4).
 */
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

// Mock external fetch for Anthropic API calls
const mockExternalFetch = vi.fn();

vi.mock("@/lib/services", () => ({
  getServices: vi.fn().mockResolvedValue({
    sessionManager: {
      list: vi
        .fn()
        .mockResolvedValue([{ status: "working" }, { status: "merged" }, { status: "working" }]),
    },
  }),
}));

vi.mock("@/lib/workflow/project-context-aggregator", () => ({
  aggregateProjectContext: () => ({
    fullContext: "Test project context",
    phaseSummary: "",
    artifactSummary: "",
    sprintSummary: "",
    agentSummary: "",
    recentEvents: "",
    estimatedTokens: 100,
  }),
}));

const { POST } = await import("./route");

function makeRequest(body: unknown): Request {
  return new Request("http://localhost/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  delete process.env.ANTHROPIC_API_KEY;
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("POST /api/chat", () => {
  it("returns fallback when no API key configured", async () => {
    const res = await POST(makeRequest({ question: "What is the project status?" }) as never);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.fallback).toBe(true);
    expect(data.answer).toContain("ANTHROPIC_API_KEY");
  });

  it("returns 400 for empty question", async () => {
    const res = await POST(makeRequest({ question: "" }) as never);
    expect(res.status).toBe(400);

    const data = await res.json();
    expect(data.error).toContain("required");
  });

  it("returns 400 for missing question", async () => {
    const res = await POST(makeRequest({}) as never);
    expect(res.status).toBe(400);
  });

  it("calls Anthropic API when key is configured", async () => {
    process.env.ANTHROPIC_API_KEY = "test-key-123";
    vi.stubGlobal("fetch", mockExternalFetch);
    mockExternalFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          content: [{ type: "text", text: "The project is 93% complete." }],
        }),
    });

    const res = await POST(makeRequest({ question: "Project status?" }) as never);
    const data = await res.json();

    expect(data.answer).toBe("The project is 93% complete.");
    expect(data.fallback).toBeUndefined();
    expect(mockExternalFetch).toHaveBeenCalledWith(
      "https://api.anthropic.com/v1/messages",
      expect.objectContaining({ method: "POST", signal: expect.any(AbortSignal) }),
    );
  });

  it("handles Anthropic API error without leaking details", async () => {
    process.env.ANTHROPIC_API_KEY = "test-key-123";
    vi.stubGlobal("fetch", mockExternalFetch);
    mockExternalFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      text: () => Promise.resolve("Sensitive: Invalid API key sk-ant-xxx"),
    });

    const res = await POST(makeRequest({ question: "Status?" }) as never);
    const data = await res.json();

    expect(data.fallback).toBe(true);
    expect(data.answer).toContain("failed");
    // Should NOT leak the sensitive error text to client
    expect(data.error).toBeUndefined();
  });

  it("validates question is a string", async () => {
    const res = await POST(makeRequest({ question: 12345 }) as never);
    expect(res.status).toBe(400);
  });
});
