import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

const {
  mockConfigRef,
  mockGetTracker,
  mockReadSprintStatus,
  mockComputeSprintHealth,
  mockComputeForecast,
  mockComputeVelocityComparison,
  mockCheckSprintNotifications,
  mockGetPoints,
  mockHasPointsData,
} = vi.hoisted(() => ({
  mockConfigRef: { current: null as Record<string, unknown> | null },
  mockGetTracker: vi.fn(),
  mockReadSprintStatus: vi.fn(),
  mockComputeSprintHealth: vi.fn(),
  mockComputeForecast: vi.fn(),
  mockComputeVelocityComparison: vi.fn(),
  mockCheckSprintNotifications: vi.fn(),
  mockGetPoints: vi.fn(),
  mockHasPointsData: vi.fn(),
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
  computeSprintHealth: mockComputeSprintHealth,
  computeForecast: mockComputeForecast,
  computeVelocityComparison: mockComputeVelocityComparison,
  checkSprintNotifications: mockCheckSprintNotifications,
  getPoints: mockGetPoints,
  hasPointsData: mockHasPointsData,
  categorizeStatus: (s: string) => {
    if (s === "done") return "done";
    if (s === "in-progress" || s === "review") return "in-progress";
    return "open";
  },
  BMAD_COLUMNS: ["backlog", "ready-for-dev", "in-progress", "review", "done"],
}));

let tmpDir: string;

import { Command } from "commander";
import { registerSprintSummary } from "../../src/commands/sprint-summary.js";

let program: Command;
let consoleSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), "ao-summary-test-"));

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
        tracker: { plugin: "bmad", sprintGoal: "Ship MVP" },
      },
    },
    notifiers: {},
    notificationRouting: {},
    reactions: {},
  } as Record<string, unknown>;

  mockGetTracker.mockReturnValue({ name: "bmad" });
  mockReadSprintStatus.mockReturnValue({
    development_status: {
      s1: { status: "done", epic: "epic-1" },
      s2: { status: "in-progress", epic: "epic-1" },
      s3: { status: "backlog", epic: "epic-2" },
    },
  });
  mockHasPointsData.mockReturnValue(false);
  mockGetPoints.mockReturnValue(1);
  mockComputeSprintHealth.mockReturnValue({ overall: "ok", indicators: [] });
  mockComputeForecast.mockReturnValue({ pace: "on-track", daysRemaining: 5 });
  mockComputeVelocityComparison.mockReturnValue({
    averageVelocity: 4,
    trend: "stable",
  });
  mockCheckSprintNotifications.mockReturnValue([]);

  program = new Command();
  program.exitOverride();
  registerSprintSummary(program);

  consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(process, "exit").mockImplementation((code) => {
    throw new Error(`process.exit(${code})`);
  });
});

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true });
  vi.restoreAllMocks();
});

describe("sprint-summary command", () => {
  it("displays formatted summary", async () => {
    await program.parseAsync(["node", "test", "sprint-summary"]);

    const output = consoleSpy.mock.calls.map((c) => String(c[0])).join("\n");
    expect(output).toContain("Sprint Summary");
    expect(output).toContain("Progress");
    expect(output).toContain("Columns");
  });

  it("outputs JSON with --json flag", async () => {
    await program.parseAsync(["node", "test", "sprint-summary", "--json"]);

    const output = consoleSpy.mock.calls.map((c) => String(c[0])).join("");
    const parsed = JSON.parse(output) as {
      projectId: string;
      stats: { total: number; done: number };
      velocity: number;
    };
    expect(parsed.projectId).toBe("my-app");
    expect(parsed.stats.total).toBe(3);
    expect(parsed.stats.done).toBe(1);
    expect(parsed.velocity).toBe(4);
  });

  it("shows stuck stories when present", async () => {
    mockCheckSprintNotifications.mockReturnValue([
      {
        type: "sprint.story_stuck",
        message: "s2 stuck in-progress for 3 days",
        severity: "warning",
        title: "Stuck Story",
        details: ["s2"],
        timestamp: new Date().toISOString(),
      },
    ]);

    await program.parseAsync(["node", "test", "sprint-summary"]);

    const output = consoleSpy.mock.calls.map((c) => String(c[0])).join("\n");
    expect(output).toContain("Stuck");
    expect(output).toContain("s2");
  });

  it("handles non-bmad tracker", async () => {
    mockGetTracker.mockReturnValue({ name: "github" });

    await expect(program.parseAsync(["node", "test", "sprint-summary"])).rejects.toThrow(
      "process.exit(1)",
    );
  });
});
