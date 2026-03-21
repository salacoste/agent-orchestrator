import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import type { StoryDetail } from "@composio/ao-plugin-tracker-bmad";

const { mockConfigRef, mockGetTracker, mockGetStoryDetail } = vi.hoisted(() => ({
  mockConfigRef: { current: null as Record<string, unknown> | null },
  mockGetTracker: vi.fn(),
  mockGetStoryDetail: vi.fn(),
}));

vi.mock("@composio/ao-core", async (importOriginal) => {
  // eslint-disable-next-line @typescript-eslint/consistent-type-imports
  const actual = await importOriginal<typeof import("@composio/ao-core")>();
  return {
    ...actual,
    loadConfig: () => mockConfigRef.current,
  };
});

vi.mock("../../src/lib/plugins.js", () => ({
  getTracker: mockGetTracker,
  getAgent: vi.fn(),
  getAgentByName: vi.fn(),
  getSCM: vi.fn(),
}));

vi.mock("@composio/ao-plugin-tracker-bmad", () => ({
  getStoryDetail: mockGetStoryDetail,
}));

let tmpDir: string;

import { Command } from "commander";
import { registerStory } from "../../src/commands/story.js";

let program: Command;
let consoleSpy: ReturnType<typeof vi.spyOn>;
let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

function makeDetail(overrides: Partial<StoryDetail> = {}): StoryDetail {
  return {
    storyId: "1-1-auth",
    currentStatus: "in-progress",
    epic: null,
    transitions: [],
    columnDwells: [],
    totalCycleTimeMs: null,
    startedAt: null,
    completedAt: null,
    isCompleted: false,
    ...overrides,
  };
}

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), "ao-story-test-"));

  mockConfigRef.current = {
    configPath: join(tmpDir, "agent-orchestrator.yaml"),
    port: 5000,
    defaults: {
      runtime: "tmux",
      agent: "claude-code",
      workspace: "worktree",
      notifiers: ["desktop"],
    },
    projects: {
      "my-app": {
        name: "My App",
        repo: "org/my-app",
        path: join(tmpDir, "main-repo"),
        defaultBranch: "main",
        sessionPrefix: "app",
        tracker: { plugin: "bmad" },
      },
    },
    notifiers: {},
    notificationRouting: {},
    reactions: {},
  } as Record<string, unknown>;

  mockGetTracker.mockReturnValue({ name: "bmad" });
  mockGetStoryDetail.mockReturnValue(makeDetail());

  program = new Command();
  program.exitOverride();
  registerStory(program);

  consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
  consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(process, "exit").mockImplementation((code) => {
    throw new Error(`process.exit(${code})`);
  });
});

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true });
  vi.restoreAllMocks();
});

describe("story command", () => {
  it("displays formatted output with transitions", async () => {
    const DAY = 24 * 60 * 60 * 1000;
    mockGetStoryDetail.mockReturnValue(
      makeDetail({
        storyId: "1-1-auth",
        currentStatus: "review",
        epic: "epic-1",
        transitions: [
          {
            timestamp: "2026-01-01T00:00:00.000Z",
            fromStatus: "backlog",
            toStatus: "ready-for-dev",
            dwellMs: null,
          },
          {
            timestamp: "2026-01-02T00:00:00.000Z",
            fromStatus: "ready-for-dev",
            toStatus: "in-progress",
            dwellMs: 1 * DAY,
          },
          {
            timestamp: "2026-01-04T00:00:00.000Z",
            fromStatus: "in-progress",
            toStatus: "review",
            dwellMs: 2 * DAY,
          },
        ],
        columnDwells: [
          { column: "in-progress", totalDwellMs: 2 * DAY },
          { column: "ready-for-dev", totalDwellMs: 1 * DAY },
        ],
        startedAt: "2026-01-01T00:00:00.000Z",
      }),
    );

    await program.parseAsync(["node", "test", "story", "1-1-auth"]);

    const output = consoleSpy.mock.calls.map((c) => String(c[0])).join("\n");
    expect(output).toContain("1-1-auth");
    expect(output).toContain("review");
    expect(output).toContain("epic-1");
    expect(output).toContain("Timeline");
    expect(output).toContain("Column Dwell Times");
    expect(output).toContain("in-progress");
    expect(output).toContain("ready-for-dev");
  });

  it("outputs valid JSON with --json flag", async () => {
    const detail = makeDetail({
      storyId: "1-1-auth",
      currentStatus: "in-progress",
      isCompleted: false,
    });
    mockGetStoryDetail.mockReturnValue(detail);

    await program.parseAsync(["node", "test", "story", "1-1-auth", "--json"]);

    const output = consoleSpy.mock.calls.map((c) => String(c[0])).join("");
    const parsed = JSON.parse(output) as StoryDetail;
    expect(parsed.storyId).toBe("1-1-auth");
    expect(parsed.currentStatus).toBe("in-progress");
    expect(parsed.isCompleted).toBe(false);
  });

  it("handles non-bmad tracker", async () => {
    mockGetTracker.mockReturnValue({ name: "github" });

    await expect(program.parseAsync(["node", "test", "story", "1-1-auth"])).rejects.toThrow(
      "process.exit(1)",
    );

    const errorOutput = consoleErrorSpy.mock.calls.map((c) => String(c[0])).join("\n");
    expect(errorOutput).toMatch(/bmad tracker/);
  });

  it("displays completed story with cycle time", async () => {
    const DAY = 24 * 60 * 60 * 1000;
    mockGetStoryDetail.mockReturnValue(
      makeDetail({
        storyId: "1-1-auth",
        currentStatus: "done",
        isCompleted: true,
        totalCycleTimeMs: 4 * DAY,
        startedAt: "2026-01-01T00:00:00.000Z",
        completedAt: "2026-01-05T00:00:00.000Z",
        transitions: [
          {
            timestamp: "2026-01-01T00:00:00.000Z",
            fromStatus: "backlog",
            toStatus: "in-progress",
            dwellMs: null,
          },
          {
            timestamp: "2026-01-05T00:00:00.000Z",
            fromStatus: "in-progress",
            toStatus: "done",
            dwellMs: 4 * DAY,
          },
        ],
      }),
    );

    await program.parseAsync(["node", "test", "story", "1-1-auth"]);

    const output = consoleSpy.mock.calls.map((c) => String(c[0])).join("\n");
    expect(output).toContain("done");
    expect(output).toContain("Cycle time");
    expect(output).toContain("4d");
  });

  it("displays story with no history", async () => {
    mockGetStoryDetail.mockReturnValue(
      makeDetail({
        storyId: "1-1-auth",
        currentStatus: "backlog",
        transitions: [],
      }),
    );

    await program.parseAsync(["node", "test", "story", "1-1-auth"]);

    const output = consoleSpy.mock.calls.map((c) => String(c[0])).join("\n");
    expect(output).toContain("1-1-auth");
    expect(output).toContain("No transitions recorded");
  });
});
