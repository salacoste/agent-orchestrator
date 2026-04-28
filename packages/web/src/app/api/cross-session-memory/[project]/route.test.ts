/**
 * Cross-session memory API route tests — GET, PUT, DELETE
 * /api/cross-session-memory/[project]
 * Story 61-2, AC #4, #5, #6.
 */
import { describe, expect, it, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/services", () => ({
  getServices: vi.fn(),
}));

vi.mock("@composio/ao-core/memory-bridge", () => ({
  loadAccumulatedMemory: vi.fn(),
  removeEntry: vi.fn(),
  updateEntry: vi.fn(),
}));

import { GET, PUT, DELETE } from "./route";
import { getServices } from "@/lib/services";
import { loadAccumulatedMemory, removeEntry, updateEntry } from "@composio/ao-core/memory-bridge";

const mockGetServices = vi.mocked(getServices);
const mockLoad = vi.mocked(loadAccumulatedMemory);
const mockRemove = vi.mocked(removeEntry);
const mockUpdate = vi.mocked(updateEntry);

const SAMPLE_ENTRIES = [
  {
    id: "e1",
    type: "convention" as const,
    content: "Use kebab-case",
    contentHash: "hash-1",
    sourceSessionIds: ["session-1"],
    firstSeenAt: "2026-04-17T00:00:00Z",
    lastSeenAt: "2026-04-17T00:00:00Z",
  },
  {
    id: "e2",
    type: "decision" as const,
    content: "Use vitest",
    contentHash: "hash-2",
    sourceSessionIds: ["session-1", "session-2"],
    firstSeenAt: "2026-04-17T00:00:00Z",
    lastSeenAt: "2026-04-17T00:00:00Z",
  },
];

function makeContext(project: string) {
  return { params: Promise.resolve({ project }) };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/cross-session-memory/[project]", () => {
  it("returns entries when feature enabled", async () => {
    mockGetServices.mockResolvedValue({
      config: {
        projects: {
          myproject: {
            path: "/tmp/project",
            learning: { crossSessionMemory: true },
          },
        },
      },
    } as never);
    mockLoad.mockResolvedValue(SAMPLE_ENTRIES);

    const res = await GET(new NextRequest("http://localhost"), makeContext("myproject"));
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.entries).toHaveLength(2);
    expect(data.project).toBe("myproject");
    expect(data.enabled).toBe(true);
    expect(mockLoad).toHaveBeenCalledWith("/tmp/project");
  });

  it("returns empty entries when feature disabled", async () => {
    mockGetServices.mockResolvedValue({
      config: {
        projects: {
          myproject: {
            path: "/tmp/project",
          },
        },
      },
    } as never);

    const res = await GET(new NextRequest("http://localhost"), makeContext("myproject"));
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.entries).toEqual([]);
    expect(data.enabled).toBe(false);
    expect(mockLoad).not.toHaveBeenCalled();
  });

  it("returns 404 for unknown project", async () => {
    mockGetServices.mockResolvedValue({
      config: { projects: {} },
    } as never);

    const res = await GET(new NextRequest("http://localhost"), makeContext("unknown"));
    expect(res.status).toBe(404);
  });

  it("returns 500 when getServices throws", async () => {
    mockGetServices.mockRejectedValue(new Error("Service unavailable"));

    const res = await GET(new NextRequest("http://localhost"), makeContext("myproject"));
    expect(res.status).toBe(500);
  });
});

describe("DELETE /api/cross-session-memory/[project]", () => {
  it("removes entry and returns updated list", async () => {
    mockGetServices.mockResolvedValue({
      config: {
        projects: {
          myproject: {
            path: "/tmp/project",
            learning: { crossSessionMemory: true },
          },
        },
      },
    } as never);
    mockRemove.mockResolvedValue(undefined);
    mockLoad.mockResolvedValue([SAMPLE_ENTRIES[1]!]);

    const req = new NextRequest("http://localhost", {
      method: "DELETE",
      body: JSON.stringify({ contentHash: "hash-1" }),
      headers: { "Content-Type": "application/json" },
    });

    const res = await DELETE(req, makeContext("myproject"));
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.entries).toHaveLength(1);
    expect(mockRemove).toHaveBeenCalledWith("/tmp/project", "hash-1");
  });

  it("returns 400 when contentHash missing", async () => {
    mockGetServices.mockResolvedValue({
      config: {
        projects: {
          myproject: {
            path: "/tmp/project",
            learning: { crossSessionMemory: true },
          },
        },
      },
    } as never);

    const req = new NextRequest("http://localhost", {
      method: "DELETE",
      body: JSON.stringify({}),
      headers: { "Content-Type": "application/json" },
    });

    const res = await DELETE(req, makeContext("myproject"));
    expect(res.status).toBe(400);
  });

  it("returns 400 for invalid JSON body", async () => {
    mockGetServices.mockResolvedValue({
      config: {
        projects: {
          myproject: {
            path: "/tmp/project",
            learning: { crossSessionMemory: true },
          },
        },
      },
    } as never);

    const req = new NextRequest("http://localhost", {
      method: "DELETE",
      body: "not-json{",
      headers: { "Content-Type": "application/json" },
    });

    const res = await DELETE(req, makeContext("myproject"));
    expect(res.status).toBe(400);
  });

  it("returns 403 when feature disabled", async () => {
    mockGetServices.mockResolvedValue({
      config: {
        projects: {
          myproject: {
            path: "/tmp/project",
          },
        },
      },
    } as never);

    const req = new NextRequest("http://localhost", {
      method: "DELETE",
      body: JSON.stringify({ contentHash: "hash-1" }),
      headers: { "Content-Type": "application/json" },
    });

    const res = await DELETE(req, makeContext("myproject"));
    expect(res.status).toBe(403);
  });

  it("returns 404 for unknown project", async () => {
    mockGetServices.mockResolvedValue({
      config: { projects: {} },
    } as never);

    const req = new NextRequest("http://localhost", {
      method: "DELETE",
      body: JSON.stringify({ contentHash: "hash-1" }),
      headers: { "Content-Type": "application/json" },
    });

    const res = await DELETE(req, makeContext("unknown"));
    expect(res.status).toBe(404);
  });
});

describe("PUT /api/cross-session-memory/[project]", () => {
  it("updates entry and returns updated list", async () => {
    mockGetServices.mockResolvedValue({
      config: {
        projects: {
          myproject: {
            path: "/tmp/project",
            learning: { crossSessionMemory: true },
          },
        },
      },
    } as never);
    mockUpdate.mockResolvedValue(undefined);
    const updatedEntry = {
      ...SAMPLE_ENTRIES[0],
      content: "Use PascalCase",
      contentHash: "hash-1-updated",
    };
    mockLoad.mockResolvedValue([updatedEntry, SAMPLE_ENTRIES[1]!]);

    const req = new NextRequest("http://localhost", {
      method: "PUT",
      body: JSON.stringify({ contentHash: "hash-1", content: "Use PascalCase" }),
      headers: { "Content-Type": "application/json" },
    });

    const res = await PUT(req, makeContext("myproject"));
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.entries).toHaveLength(2);
    expect(mockUpdate).toHaveBeenCalledWith("/tmp/project", "hash-1", "Use PascalCase");
  });

  it("returns 400 when contentHash missing", async () => {
    mockGetServices.mockResolvedValue({
      config: {
        projects: {
          myproject: {
            path: "/tmp/project",
            learning: { crossSessionMemory: true },
          },
        },
      },
    } as never);

    const req = new NextRequest("http://localhost", {
      method: "PUT",
      body: JSON.stringify({ content: "new content" }),
      headers: { "Content-Type": "application/json" },
    });

    const res = await PUT(req, makeContext("myproject"));
    expect(res.status).toBe(400);
  });

  it("returns 400 when content missing", async () => {
    mockGetServices.mockResolvedValue({
      config: {
        projects: {
          myproject: {
            path: "/tmp/project",
            learning: { crossSessionMemory: true },
          },
        },
      },
    } as never);

    const req = new NextRequest("http://localhost", {
      method: "PUT",
      body: JSON.stringify({ contentHash: "hash-1" }),
      headers: { "Content-Type": "application/json" },
    });

    const res = await PUT(req, makeContext("myproject"));
    expect(res.status).toBe(400);
  });

  it("returns 400 for invalid JSON body", async () => {
    mockGetServices.mockResolvedValue({
      config: {
        projects: {
          myproject: {
            path: "/tmp/project",
            learning: { crossSessionMemory: true },
          },
        },
      },
    } as never);

    const req = new NextRequest("http://localhost", {
      method: "PUT",
      body: "broken-json[",
      headers: { "Content-Type": "application/json" },
    });

    const res = await PUT(req, makeContext("myproject"));
    expect(res.status).toBe(400);
  });

  it("returns 403 when feature disabled", async () => {
    mockGetServices.mockResolvedValue({
      config: {
        projects: {
          myproject: {
            path: "/tmp/project",
          },
        },
      },
    } as never);

    const req = new NextRequest("http://localhost", {
      method: "PUT",
      body: JSON.stringify({ contentHash: "hash-1", content: "new" }),
      headers: { "Content-Type": "application/json" },
    });

    const res = await PUT(req, makeContext("myproject"));
    expect(res.status).toBe(403);
  });

  it("returns 404 for unknown project", async () => {
    mockGetServices.mockResolvedValue({
      config: { projects: {} },
    } as never);

    const req = new NextRequest("http://localhost", {
      method: "PUT",
      body: JSON.stringify({ contentHash: "hash-1", content: "new" }),
      headers: { "Content-Type": "application/json" },
    });

    const res = await PUT(req, makeContext("unknown"));
    expect(res.status).toBe(404);
  });
});
