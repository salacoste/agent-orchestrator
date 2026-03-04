import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import type { RetrospectiveResult } from "@composio/ao-plugin-tracker-bmad";

const { mockConfigRef, mockGetTracker, mockComputeRetrospective } = vi.hoisted(() => ({
  mockConfigRef: { current: null as Record<string, unknown> | null },
  mockGetTracker: vi.fn(),
  mockComputeRetrospective: vi.fn(),
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
  computeRetrospective: mockComputeRetrospective,
}));

let tmpDir: string;

import { Command } from "commander";
import { registerRetro } from "../../src/commands/retro.js";

let program: Command;
let consoleSpy: ReturnType<typeof vi.spyOn>;
let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

function makeResult(overrides: Partial<RetrospectiveResult> = {}): RetrospectiveResult {
  return {
    periods: [],
    velocityTrend: [],
    averageVelocity: 0,
    velocityChange: 0,
    totalCompleted: 0,
    overallAverageCycleTimeMs: 0,
    ...overrides,
  };
}

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), "ao-retro-test-"));

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
  mockComputeRetrospective.mockReturnValue(makeResult());

  program = new Command();
  program.exitOverride();
  registerRetro(program);

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

describe("retro command", () => {
  it("displays formatted output with periods", async () => {
    const DAY = 24 * 60 * 60 * 1000;
    mockComputeRetrospective.mockReturnValue(
      makeResult({
        periods: [
          {
            startDate: "2026-01-05",
            endDate: "2026-01-11",
            completedCount: 3,
            averageCycleTimeMs: 2 * DAY,
            carryOverCount: 1,
            storyIds: ["s1", "s2", "s3"],
          },
          {
            startDate: "2026-01-12",
            endDate: "2026-01-18",
            completedCount: 5,
            averageCycleTimeMs: 1.5 * DAY,
            carryOverCount: 0,
            storyIds: ["s4", "s5", "s6", "s7", "s8"],
          },
        ],
        velocityTrend: [3, 5],
        averageVelocity: 4,
        velocityChange: 25,
        totalCompleted: 8,
        overallAverageCycleTimeMs: 1.75 * DAY,
      }),
    );

    await program.parseAsync(["node", "test", "retro"]);

    const output = consoleSpy.mock.calls.map((c) => String(c[0])).join("\n");
    expect(output).toContain("Sprint Retrospective");
    expect(output).toContain("2026-01-05");
    expect(output).toContain("2026-01-12");
    expect(output).toContain("8");
    expect(output).toContain("4.0");
    expect(output).toContain("+25.0%");
  });

  it("outputs valid JSON with --json flag", async () => {
    const result = makeResult({
      totalCompleted: 4,
      averageVelocity: 2,
      velocityChange: 0,
    });
    mockComputeRetrospective.mockReturnValue(result);

    await program.parseAsync(["node", "test", "retro", "--json"]);

    const output = consoleSpy.mock.calls.map((c) => String(c[0])).join("");
    const parsed = JSON.parse(output) as RetrospectiveResult;
    expect(parsed.totalCompleted).toBe(4);
    expect(parsed.averageVelocity).toBe(2);
  });

  it("handles non-bmad tracker", async () => {
    mockGetTracker.mockReturnValue({ name: "github" });

    await expect(program.parseAsync(["node", "test", "retro"])).rejects.toThrow("process.exit(1)");

    const errorOutput = consoleErrorSpy.mock.calls.map((c) => String(c[0])).join("\n");
    expect(errorOutput).toMatch(/bmad tracker/);
  });

  it("handles empty result gracefully", async () => {
    mockComputeRetrospective.mockReturnValue(makeResult());

    await program.parseAsync(["node", "test", "retro"]);

    const output = consoleSpy.mock.calls.map((c) => String(c[0])).join("\n");
    expect(output).toContain("No completed stories");
  });
});
