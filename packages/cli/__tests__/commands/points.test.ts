import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

const { mockConfigRef, mockGetTracker, mockReadSprintStatus, mockWriteStoryPoints, mockGetPoints } =
  vi.hoisted(() => ({
    mockConfigRef: { current: null as Record<string, unknown> | null },
    mockGetTracker: vi.fn(),
    mockReadSprintStatus: vi.fn(),
    mockWriteStoryPoints: vi.fn(),
    mockGetPoints: vi.fn(),
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
  readSprintStatus: mockReadSprintStatus,
  writeStoryPoints: mockWriteStoryPoints,
  getPoints: mockGetPoints,
}));

let tmpDir: string;

import { Command } from "commander";
import { registerPoints } from "../../src/commands/points.js";

let program: Command;
let consoleSpy: ReturnType<typeof vi.spyOn>;
let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), "ao-points-test-"));

  mockConfigRef.current = {
    configPath: join(tmpDir, "agent-orchestrator.yaml"),
    port: 3000,
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
  mockReadSprintStatus.mockReturnValue({
    development_status: {
      s1: { status: "in-progress", points: 5 },
      s2: { status: "backlog" },
    },
  });
  mockGetPoints.mockImplementation((entry: Record<string, unknown>) =>
    typeof entry.points === "number" ? entry.points : 1,
  );
  mockWriteStoryPoints.mockImplementation(() => {});

  program = new Command();
  program.exitOverride();
  registerPoints(program);

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

describe("points command", () => {
  it("displays current points for a story", async () => {
    await program.parseAsync(["node", "test", "points", "s1"]);

    const output = consoleSpy.mock.calls.map((c) => String(c[0])).join("\n");
    expect(output).toContain("Points");
    expect(output).toContain("5");
  });

  it("sets points for a story", async () => {
    await program.parseAsync(["node", "test", "points", "s1", "3"]);

    expect(mockWriteStoryPoints).toHaveBeenCalledOnce();
    const output = consoleSpy.mock.calls.map((c) => String(c[0])).join("\n");
    expect(output).toContain("3");
    expect(output).toContain("point");
  });

  it("outputs JSON when setting points with --json", async () => {
    await program.parseAsync(["node", "test", "points", "s1", "8", "--json"]);

    const output = consoleSpy.mock.calls.map((c) => String(c[0])).join("");
    const parsed = JSON.parse(output) as { storyId: string; points: number };
    expect(parsed.storyId).toBe("s1");
    expect(parsed.points).toBe(8);
  });

  it("outputs JSON when viewing points with --json", async () => {
    await program.parseAsync(["node", "test", "points", "s1", "--json"]);

    const output = consoleSpy.mock.calls.map((c) => String(c[0])).join("");
    const parsed = JSON.parse(output) as { storyId: string; points: number; explicit: boolean };
    expect(parsed.storyId).toBe("s1");
    expect(parsed.points).toBe(5);
    expect(parsed.explicit).toBe(true);
  });

  it("rejects invalid points value", async () => {
    await expect(program.parseAsync(["node", "test", "points", "s1", "abc"])).rejects.toThrow(
      "process.exit(1)",
    );

    const errorOutput = consoleErrorSpy.mock.calls.map((c) => String(c[0])).join("\n");
    expect(errorOutput).toMatch(/non-negative integer/);
  });

  it("handles non-bmad tracker", async () => {
    mockGetTracker.mockReturnValue({ name: "github" });

    await expect(program.parseAsync(["node", "test", "points", "s1"])).rejects.toThrow(
      "process.exit(1)",
    );

    const errorOutput = consoleErrorSpy.mock.calls.map((c) => String(c[0])).join("\n");
    expect(errorOutput).toMatch(/bmad tracker/);
  });
});
