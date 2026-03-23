/**
 * Standup API route tests (Story 45.5).
 */
import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/services", () => ({
  getServices: vi.fn(),
}));

vi.mock("@composio/ao-plugin-tracker-bmad", () => ({
  readSprintStatus: vi.fn(),
}));

vi.mock("@composio/ao-core", () => ({
  generateStandup: vi.fn(
    (input: {
      completedStories: string[];
      inProgressStories: string[];
      blockers: string[];
      activeAgents: string[];
    }) => {
      const hasActivity =
        input.completedStories.length > 0 ||
        input.inProgressStories.length > 0 ||
        input.activeAgents.length > 0;
      return {
        title: "Daily Standup",
        generatedAt: new Date().toISOString(),
        hasActivity,
        sections: hasActivity ? [{ title: "Completed", items: input.completedStories }] : [],
        markdown: hasActivity
          ? `**Completed:**\n${input.completedStories.map((s) => `- ${s}`).join("\n")}`
          : "No activity to report.",
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
        "test-project": { name: "Test", path: "/tmp", tracker: { plugin: "bmad" } },
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
      "1-1-auth": { status: "done" },
      "1-2-api": { status: "in-progress" },
      "1-3-db": { status: "backlog" },
    },
  } as never);
});

describe("GET /api/sprint/standup", () => {
  it("returns standup summary with correct structure", async () => {
    const response = await GET(new Request("http://localhost/api/sprint/standup"));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.hasActivity).toBe(true);
    expect(data.title).toContain("Standup");
    expect(data.generatedAt).toBeTruthy();
  });

  it("returns no-activity when sprint is empty", async () => {
    mockReadSprintStatus.mockImplementation(() => {
      throw new Error("No sprint");
    });
    mockGetServices.mockResolvedValue({
      config: { projects: { p: { name: "P", path: "/", tracker: {} } } },
      sessionManager: { list: () => [] },
    } as never);

    const response = await GET(new Request("http://localhost/api/sprint/standup"));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.hasActivity).toBe(false);
  });

  it("returns 500 on service failure", async () => {
    mockGetServices.mockRejectedValue(new Error("Service unavailable"));

    const response = await GET(new Request("http://localhost/api/sprint/standup"));
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe("Service unavailable");
  });
});
