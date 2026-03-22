/**
 * GET /api/agent/[id]/logs — Logs API tests (Story 38.3)
 */
import { describe, expect, it, vi, beforeEach } from "vitest";

const mockGet = vi.fn();

vi.mock("@/lib/services", () => ({
  getServices: vi.fn().mockResolvedValue({
    sessionManager: {
      get: (...args: unknown[]) => mockGet(...args),
    },
    config: {
      configPath: "/tmp/test-config.yaml",
      projects: {
        "my-project": { path: "/tmp/my-project" },
      },
    },
  }),
}));

const mockHasLogFile = vi.fn();
const mockGetLogFilePath = vi.fn();
const mockReadLastLogLines = vi.fn();
const mockGetSessionsDir = vi.fn();

vi.mock("@composio/ao-core", () => ({
  readLastLogLines: (...args: unknown[]) => mockReadLastLogLines(...args),
  getLogFilePath: (...args: unknown[]) => mockGetLogFilePath(...args),
  hasLogFile: (...args: unknown[]) => mockHasLogFile(...args),
  getSessionsDir: (...args: unknown[]) => mockGetSessionsDir(...args),
}));

const { GET } = await import("./route");

beforeEach(() => {
  vi.clearAllMocks();
});

function makeRequest(lines?: number): Request {
  const url = lines
    ? `http://localhost/api/agent/a1/logs?lines=${lines}`
    : "http://localhost/api/agent/a1/logs";
  return new Request(url, { method: "GET" });
}

function makeParams(id: string) {
  return { params: Promise.resolve({ id }) };
}

describe("GET /api/agent/[id]/logs", () => {
  it("returns 404 for unknown agent", async () => {
    mockGet.mockResolvedValueOnce(null);

    const res = await GET(makeRequest() as never, makeParams("ghost"));
    expect(res.status).toBe(404);
  });

  it("returns primary log lines when log file exists", async () => {
    mockGet.mockResolvedValueOnce({
      id: "agent-1",
      projectId: "my-project",
      metadata: {},
    });
    mockGetSessionsDir.mockReturnValue("/tmp/sessions");
    mockHasLogFile.mockReturnValue(true);
    mockGetLogFilePath.mockReturnValue("/tmp/sessions/logs/agent-1.log");
    mockReadLastLogLines.mockReturnValue(["line 1", "line 2", "line 3"]);

    const res = await GET(makeRequest() as never, makeParams("agent-1"));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.logs).toEqual(["line 1", "line 2", "line 3"]);
    expect(data.source).toBe("primary");
  });

  it("falls back to previousLogsPath when primary is missing", async () => {
    mockGet.mockResolvedValueOnce({
      id: "agent-1",
      projectId: "my-project",
      metadata: { previousLogsPath: "/tmp/sessions/logs/agent-1-prev.log" },
    });
    mockGetSessionsDir.mockReturnValue("/tmp/sessions");
    mockHasLogFile.mockReturnValue(false);
    mockReadLastLogLines.mockReturnValue(["old line 1", "old line 2"]);

    const res = await GET(makeRequest() as never, makeParams("agent-1"));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.logs).toEqual(["old line 1", "old line 2"]);
    expect(data.source).toBe("previous");
  });

  it("returns empty logs when no log files exist", async () => {
    mockGet.mockResolvedValueOnce({
      id: "agent-1",
      projectId: "my-project",
      metadata: {},
    });
    mockGetSessionsDir.mockReturnValue("/tmp/sessions");
    mockHasLogFile.mockReturnValue(false);

    const res = await GET(makeRequest() as never, makeParams("agent-1"));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.logs).toEqual([]);
    expect(data.source).toBe("none");
  });

  it("returns empty when project not in config", async () => {
    mockGet.mockResolvedValueOnce({
      id: "agent-1",
      projectId: "unknown-project",
      metadata: {},
    });

    const res = await GET(makeRequest() as never, makeParams("agent-1"));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.source).toBe("none");
  });
});
