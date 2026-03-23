/**
 * Sprint digest API route tests (Story 44.7).
 */
import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/services", () => ({
  getServices: vi.fn(),
}));

vi.mock("@composio/ao-plugin-tracker-bmad", () => ({
  readSprintStatus: vi.fn(),
}));

// Provide a working generateDigest implementation inline
vi.mock("@composio/ao-core", () => ({
  generateDigest: vi.fn(
    (input: {
      completedStories: string[];
      activeAgents: string[];
      blockers: string[];
      totalStories: number;
      doneStories: number;
    }) => {
      const pct =
        input.totalStories > 0 ? Math.round((input.doneStories / input.totalStories) * 100) : 0;
      return {
        title: `Sprint Digest — ${pct}% complete`,
        sections: [
          { title: "Sprint Progress", items: [`${input.doneStories}/${input.totalStories}`] },
        ],
        markdown: `# Sprint Digest\n\n## Sprint Progress\n\n- ${input.doneStories}/${input.totalStories}`,
        metadata: {
          generatedAt: new Date().toISOString(),
          since: null,
          storiesCompleted: input.completedStories.length,
          activeAgents: input.activeAgents.length,
          blockerCount: input.blockers.length,
          progressPercent: pct,
        },
      };
    },
  ),
}));

import { GET } from "./route";
import { getServices } from "@/lib/services";
import { readSprintStatus } from "@composio/ao-plugin-tracker-bmad";

const mockGetServices = vi.mocked(getServices);
const mockReadSprintStatus = vi.mocked(readSprintStatus);

beforeEach(() => {
  vi.clearAllMocks();

  mockGetServices.mockResolvedValue({
    config: {
      projects: {
        "test-project": {
          name: "Test Project",
          path: "/tmp/test",
          tracker: { plugin: "bmad" },
        },
      },
    },
    sessionManager: {
      list: () => [
        { sessionId: "agent-1", status: "running" },
        { sessionId: "agent-2", status: "completed" },
      ],
    },
  } as never);

  mockReadSprintStatus.mockReturnValue({
    development_status: {
      "epic-1": { status: "done" },
      "1-1-login": { status: "done" },
      "1-2-auth": { status: "done" },
      "1-3-dashboard": { status: "in-progress" },
      "1-4-api": { status: "backlog" },
    },
  } as never);
});

describe("GET /api/sprint/digest", () => {
  it("returns digest with correct structure", async () => {
    const response = await GET(new Request("http://localhost/api/sprint/digest"));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.title).toContain("%");
    expect(data.sections).toBeInstanceOf(Array);
    expect(data.markdown).toContain("# Sprint Digest");
    expect(data.metadata).toBeDefined();
    expect(data.metadata.generatedAt).toBeTruthy();
  });

  it("includes completed stories from sprint status", async () => {
    const response = await GET(new Request("http://localhost/api/sprint/digest"));
    const data = await response.json();

    expect(data.metadata.storiesCompleted).toBe(2);
    expect(data.metadata.progressPercent).toBe(50);
  });

  it("includes active agents from session manager", async () => {
    const response = await GET(new Request("http://localhost/api/sprint/digest"));
    const data = await response.json();

    expect(data.metadata.activeAgents).toBe(1);
  });

  it("handles missing sprint status gracefully", async () => {
    mockReadSprintStatus.mockImplementation(() => {
      throw new Error("File not found");
    });

    const response = await GET(new Request("http://localhost/api/sprint/digest"));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.metadata.storiesCompleted).toBe(0);
    expect(data.metadata.progressPercent).toBe(0);
  });

  it("returns 500 on service failure", async () => {
    mockGetServices.mockRejectedValue(new Error("Service unavailable"));

    const response = await GET(new Request("http://localhost/api/sprint/digest"));
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe("Service unavailable");
  });
});
