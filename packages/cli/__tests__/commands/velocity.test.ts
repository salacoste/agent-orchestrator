import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import type { VelocityComparisonResult } from "@composio/ao-plugin-tracker-bmad";

const { mockConfigRef, mockComputeVelocityComparison } = vi.hoisted(() => ({
  mockConfigRef: { current: null as Record<string, unknown> | null },
  mockComputeVelocityComparison: vi.fn(),
}));

vi.mock("@composio/ao-core", async (importOriginal) => {
  // eslint-disable-next-line @typescript-eslint/consistent-type-imports
  const actual = await importOriginal<typeof import("@composio/ao-core")>();
  return {
    ...actual,
    loadConfig: () => mockConfigRef.current,
  };
});

vi.mock("@composio/ao-plugin-tracker-bmad", () => ({
  computeVelocityComparison: mockComputeVelocityComparison,
}));

let tmpDir: string;

import { Command } from "commander";
import { registerVelocity } from "../../src/commands/velocity.js";

let program: Command;
let consoleSpy: ReturnType<typeof vi.spyOn>;
let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

function makeResult(overrides: Partial<VelocityComparisonResult> = {}): VelocityComparisonResult {
  return {
    weeks: [],
    averageVelocity: 0,
    stdDeviation: 0,
    trend: "stable" as const,
    trendSlope: 0,
    trendConfidence: 0,
    nextWeekEstimate: 0,
    currentWeekSoFar: 0,
    completionWeeks: null,
    remainingStories: 0,
    hasPoints: false,
    ...overrides,
  };
}

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), "ao-velocity-test-"));

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

  mockComputeVelocityComparison.mockReturnValue(makeResult());

  program = new Command();
  program.exitOverride();
  registerVelocity(program);

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

describe("velocity command", () => {
  it("displays formatted output with weeks", async () => {
    mockComputeVelocityComparison.mockReturnValue(
      makeResult({
        weeks: [
          {
            weekStart: "2026-01-05",
            weekEnd: "2026-01-11",
            completedCount: 3,
            storyIds: ["s1", "s2", "s3"],
          },
          {
            weekStart: "2026-01-12",
            weekEnd: "2026-01-18",
            completedCount: 5,
            storyIds: ["s4", "s5", "s6", "s7", "s8"],
          },
        ],
        averageVelocity: 4,
        trend: "improving",
        nextWeekEstimate: 6,
      }),
    );

    await program.parseAsync(["node", "test", "velocity"]);

    const output = consoleSpy.mock.calls.map((c) => String(c[0])).join("\n");
    expect(output).toContain("Velocity History");
    expect(output).toContain("3 stories");
    expect(output).toContain("5 stories");
    expect(output).toContain("4.0");
    expect(output).toContain("improving");
  });

  it("outputs valid JSON with --json flag", async () => {
    const result = makeResult({
      weeks: [
        {
          weekStart: "2026-01-05",
          weekEnd: "2026-01-11",
          completedCount: 2,
          storyIds: ["s1", "s2"],
        },
      ],
      averageVelocity: 2,
      trend: "stable",
    });
    mockComputeVelocityComparison.mockReturnValue(result);

    await program.parseAsync(["node", "test", "velocity", "--json"]);

    const output = consoleSpy.mock.calls.map((c) => String(c[0])).join("");
    const parsed = JSON.parse(output) as VelocityComparisonResult;
    expect(parsed.averageVelocity).toBe(2);
    expect(parsed.weeks).toHaveLength(1);
  });

  it("handles non-bmad tracker", async () => {
    const projects = (mockConfigRef.current as Record<string, unknown>)["projects"] as Record<
      string,
      Record<string, unknown>
    >;
    projects["my-app"]["tracker"] = { plugin: "github" };

    await expect(program.parseAsync(["node", "test", "velocity"])).rejects.toThrow(
      "process.exit(1)",
    );

    const errorOutput = consoleErrorSpy.mock.calls.map((c) => String(c[0])).join("\n");
    expect(errorOutput).toMatch(/bmad tracker/);
  });

  it("shows empty message when no weeks", async () => {
    mockComputeVelocityComparison.mockReturnValue(makeResult());

    await program.parseAsync(["node", "test", "velocity"]);

    const output = consoleSpy.mock.calls.map((c) => String(c[0])).join("\n");
    expect(output).toContain("No completed stories");
  });

  it("respects --weeks flag", async () => {
    const weeks = Array.from({ length: 10 }, (_, i) => ({
      weekStart: `2026-01-${String((i + 1) * 7).padStart(2, "0")}`,
      weekEnd: `2026-01-${String((i + 1) * 7 + 6).padStart(2, "0")}`,
      completedCount: i + 1,
      storyIds: [`s${i}`],
    }));
    mockComputeVelocityComparison.mockReturnValue(makeResult({ weeks }));

    await program.parseAsync(["node", "test", "velocity", "--weeks", "3"]);

    const output = consoleSpy.mock.calls.map((c) => String(c[0])).join("\n");
    // Should show the last 3 weeks only (8, 9, 10 stories)
    expect(output).toContain("10 stories");
    expect(output).not.toContain("1 story");
  });

  it("resolves project when specified", async () => {
    await program.parseAsync(["node", "test", "velocity", "my-app"]);

    expect(mockComputeVelocityComparison).toHaveBeenCalled();
  });

  it("handles missing tracker config", async () => {
    const projects = (mockConfigRef.current as Record<string, unknown>)["projects"] as Record<
      string,
      Record<string, unknown>
    >;
    delete projects["my-app"]["tracker"];

    await expect(program.parseAsync(["node", "test", "velocity"])).rejects.toThrow(
      "process.exit(1)",
    );

    const errorOutput = consoleErrorSpy.mock.calls.map((c) => String(c[0])).join("\n");
    expect(errorOutput).toMatch(/bmad tracker/);
  });
});
