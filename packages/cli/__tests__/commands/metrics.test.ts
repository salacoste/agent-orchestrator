import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import type { CycleTimeStats } from "@composio/ao-plugin-tracker-bmad";

const { mockConfigRef, mockGetTracker, mockComputeCycleTime } = vi.hoisted(() => ({
  mockConfigRef: { current: null as Record<string, unknown> | null },
  mockGetTracker: vi.fn(),
  mockComputeCycleTime: vi.fn(),
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
  computeCycleTime: mockComputeCycleTime,
}));

let tmpDir: string;

import { Command } from "commander";
import { registerMetrics } from "../../src/commands/metrics.js";

let program: Command;
let consoleSpy: ReturnType<typeof vi.spyOn>;
let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

function makeStats(overrides: Partial<CycleTimeStats> = {}): CycleTimeStats {
  return {
    stories: [],
    averageCycleTimeMs: 0,
    medianCycleTimeMs: 0,
    averageColumnDwells: [],
    bottleneckColumn: null,
    throughputPerDay: 0,
    throughputPerWeek: 0,
    completedCount: 0,
    ...overrides,
  };
}

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), "ao-metrics-test-"));

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
  mockComputeCycleTime.mockReturnValue(makeStats());

  program = new Command();
  program.exitOverride();
  registerMetrics(program);

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

describe("metrics command", () => {
  it("displays formatted output with stats", async () => {
    const DAY = 24 * 60 * 60 * 1000;
    mockComputeCycleTime.mockReturnValue(
      makeStats({
        completedCount: 5,
        averageCycleTimeMs: 3 * DAY,
        medianCycleTimeMs: 2.5 * DAY,
        throughputPerDay: 0.71,
        throughputPerWeek: 5.0,
        averageColumnDwells: [
          { column: "in-progress", dwellMs: 2 * DAY },
          { column: "review", dwellMs: 1 * DAY },
        ],
        bottleneckColumn: "in-progress",
      }),
    );

    await program.parseAsync(["node", "test", "metrics"]);

    const output = consoleSpy.mock.calls.map((c) => String(c[0])).join("\n");
    expect(output).toContain("Cycle Time Metrics");
    expect(output).toContain("5");
    expect(output).toContain("3d");
    expect(output).toContain("in-progress");
    expect(output).toContain("review");
    expect(output).toContain("bottleneck");
  });

  it("outputs valid JSON with --json flag", async () => {
    const stats = makeStats({ completedCount: 2, averageCycleTimeMs: 86400000 });
    mockComputeCycleTime.mockReturnValue(stats);

    await program.parseAsync(["node", "test", "metrics", "--json"]);

    const output = consoleSpy.mock.calls.map((c) => String(c[0])).join("");
    const parsed = JSON.parse(output) as CycleTimeStats;
    expect(parsed.completedCount).toBe(2);
    expect(parsed.averageCycleTimeMs).toBe(86400000);
  });

  it("handles non-bmad tracker", async () => {
    mockGetTracker.mockReturnValue({ name: "github" });

    await expect(program.parseAsync(["node", "test", "metrics"])).rejects.toThrow(
      "process.exit(1)",
    );

    const errorOutput = consoleErrorSpy.mock.calls.map((c) => String(c[0])).join("\n");
    expect(errorOutput).toMatch(/bmad tracker/);
  });

  it("handles empty history gracefully", async () => {
    mockComputeCycleTime.mockReturnValue(makeStats());

    await program.parseAsync(["node", "test", "metrics"]);

    const output = consoleSpy.mock.calls.map((c) => String(c[0])).join("\n");
    expect(output).toContain("No completed stories");
  });

  it("resolves project when specified", async () => {
    await program.parseAsync(["node", "test", "metrics", "my-app"]);

    expect(mockComputeCycleTime).toHaveBeenCalled();
  });

  it("handles no tracker configured", async () => {
    mockGetTracker.mockReturnValue(null);

    await expect(program.parseAsync(["node", "test", "metrics"])).rejects.toThrow(
      "process.exit(1)",
    );

    const errorOutput = consoleErrorSpy.mock.calls.map((c) => String(c[0])).join("\n");
    expect(errorOutput).toMatch(/bmad tracker/);
  });
});
