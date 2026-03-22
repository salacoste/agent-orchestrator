/**
 * GET /api/sprint/conflicts — Conflict/checkpoint API tests (Story 40.3).
 */
import { describe, expect, it, vi, beforeEach } from "vitest";

const mockList = vi.fn();
const mockGetLearningStore = vi.fn();

vi.mock("@/lib/services", () => ({
  getServices: vi.fn().mockResolvedValue({
    sessionManager: {
      list: (...args: unknown[]) => mockList(...args),
    },
  }),
}));

vi.mock("@composio/ao-core", () => ({
  getLearningStore: () => mockGetLearningStore(),
}));

const { GET } = await import("./route");

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/sprint/conflicts", () => {
  it("detects conflicts from overlapping files in learning store", () => {
    mockList.mockResolvedValueOnce([
      { id: "agent-1", status: "working", metadata: {}, workspacePath: null },
      { id: "agent-2", status: "working", metadata: {}, workspacePath: null },
    ]);
    mockGetLearningStore.mockReturnValue({
      list: () => [
        { agentId: "agent-1", filesModified: ["src/index.ts", "src/utils.ts"] },
        { agentId: "agent-2", filesModified: ["src/index.ts", "src/other.ts"] },
      ],
    });

    return GET().then(async (res) => {
      const data = await res.json();
      expect(res.status).toBe(200);
      expect(data.conflicts).toHaveLength(1);
      expect(data.conflicts[0].filePath).toBe("src/index.ts");
      expect(data.conflicts[0].agentA).toBe("agent-1");
      expect(data.conflicts[0].agentB).toBe("agent-2");
    });
  });

  it("returns empty conflicts when no file overlap", async () => {
    mockList.mockResolvedValueOnce([
      { id: "agent-1", status: "working", metadata: {}, workspacePath: null },
      { id: "agent-2", status: "working", metadata: {}, workspacePath: null },
    ]);
    mockGetLearningStore.mockReturnValue({
      list: () => [
        { agentId: "agent-1", filesModified: ["src/a.ts"] },
        { agentId: "agent-2", filesModified: ["src/b.ts"] },
      ],
    });

    const res = await GET();
    const data = await res.json();
    expect(data.conflicts).toHaveLength(0);
  });

  it("returns empty when no learning store available", async () => {
    mockList.mockResolvedValueOnce([
      { id: "agent-1", status: "working", metadata: {}, workspacePath: null },
    ]);
    mockGetLearningStore.mockReturnValue(undefined);

    const res = await GET();
    const data = await res.json();
    expect(data.conflicts).toHaveLength(0);
  });

  it("uses session metadata filesModified as fallback", async () => {
    mockList.mockResolvedValueOnce([
      {
        id: "agent-1",
        status: "working",
        metadata: { filesModified: '["src/shared.ts"]' },
        workspacePath: null,
      },
      {
        id: "agent-2",
        status: "working",
        metadata: { filesModified: '["src/shared.ts"]' },
        workspacePath: null,
      },
    ]);
    mockGetLearningStore.mockReturnValue({ list: () => [] });

    const res = await GET();
    const data = await res.json();
    expect(data.conflicts).toHaveLength(1);
    expect(data.conflicts[0].filePath).toBe("src/shared.ts");
  });

  it("returns null timeline (checkpoint git log deferred)", async () => {
    mockList.mockResolvedValueOnce([
      { id: "agent-1", status: "working", metadata: {}, workspacePath: "/tmp/worktree-1" },
    ]);
    mockGetLearningStore.mockReturnValue({ list: () => [] });

    const res = await GET();
    const data = await res.json();
    // Timeline is null until git log checkpoint implementation
    expect(data.timeline).toBeNull();
  });

  it("graceful fallback on error", async () => {
    mockList.mockRejectedValueOnce(new Error("fail"));

    const res = await GET();
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.conflicts).toEqual([]);
    expect(data.timeline).toBeNull();
  });
});
