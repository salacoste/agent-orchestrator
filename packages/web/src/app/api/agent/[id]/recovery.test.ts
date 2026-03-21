/**
 * Agent recovery API endpoint tests (Story 25a.1).
 */
import { describe, expect, it, vi } from "vitest";

// Mock getServices
const mockGet = vi.fn();
const mockKill = vi.fn();

vi.mock("@/lib/services", () => ({
  getServices: vi.fn().mockResolvedValue({
    sessionManager: {
      get: (...args: unknown[]) => mockGet(...args),
      kill: (...args: unknown[]) => mockKill(...args),
    },
    config: {},
    registry: {},
  }),
}));

// Must import AFTER mocks
const { GET: pingHandler } = await import("./ping/route");
const { POST: restartHandler } = await import("./restart/route");
const { POST: reassignHandler } = await import("./reassign/route");

function makeRequest(): Request {
  return new Request("http://localhost/api/agent/test-agent/ping", { method: "POST" });
}

function makeParams(id: string) {
  return { params: Promise.resolve({ id }) };
}

describe("POST /api/agent/[id]/ping", () => {
  it("returns 200 with status for existing agent", async () => {
    mockGet.mockResolvedValueOnce({ status: "working", lastActivityAt: "2026-03-21T00:00:00Z" });

    const res = await pingHandler(makeRequest() as never, makeParams("agent-1"));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.status).toBe("working");
  });

  it("returns 404 for unknown agent", async () => {
    mockGet.mockResolvedValueOnce(null);

    const res = await pingHandler(makeRequest() as never, makeParams("ghost"));
    expect(res.status).toBe(404);
  });
});

describe("POST /api/agent/[id]/restart", () => {
  it("kills agent and returns confirmation", async () => {
    mockGet.mockResolvedValueOnce({ status: "blocked" });
    mockKill.mockResolvedValueOnce(undefined);

    const res = await restartHandler(makeRequest() as never, makeParams("agent-1"));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.previousStatus).toBe("blocked");
    expect(mockKill).toHaveBeenCalledWith("agent-1");
  });

  it("returns 404 for unknown agent", async () => {
    mockGet.mockResolvedValueOnce(null);

    const res = await restartHandler(makeRequest() as never, makeParams("ghost"));
    expect(res.status).toBe(404);
  });
});

describe("POST /api/agent/[id]/reassign", () => {
  it("kills agent and confirms reassignment", async () => {
    mockGet.mockResolvedValueOnce({ status: "stuck" });
    mockKill.mockResolvedValueOnce(undefined);

    const res = await reassignHandler(makeRequest() as never, makeParams("agent-1"));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(mockKill).toHaveBeenCalledWith("agent-1");
  });

  it("returns 404 for unknown agent", async () => {
    mockGet.mockResolvedValueOnce(null);

    const res = await reassignHandler(makeRequest() as never, makeParams("ghost"));
    expect(res.status).toBe(404);
  });
});
