import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { stringify as stringifyYaml, parse as parseYaml } from "yaml";

const {
  mockConfigRef,
  mockGetTracker,
  mockFindConfig,
  mockComputeRetro,
  mockComputeForecast,
  mockComputeHealth,
  mockArchiveSprint,
} = vi.hoisted(() => ({
  mockConfigRef: { current: null as Record<string, unknown> | null },
  mockGetTracker: vi.fn(),
  mockFindConfig: vi.fn(),
  mockComputeRetro: vi.fn(),
  mockComputeForecast: vi.fn(),
  mockComputeHealth: vi.fn(),
  mockArchiveSprint: vi.fn(),
}));

vi.mock("@composio/ao-core", async (importOriginal) => {
  // eslint-disable-next-line @typescript-eslint/consistent-type-imports
  const actual = await importOriginal<typeof import("@composio/ao-core")>();
  return {
    ...actual,
    loadConfig: () => mockConfigRef.current,
    findConfig: mockFindConfig,
  };
});

vi.mock("../../src/lib/plugins.js", () => ({
  getTracker: mockGetTracker,
  getAgent: vi.fn(),
  getAgentByName: vi.fn(),
  getSCM: vi.fn(),
}));

vi.mock("@composio/ao-plugin-tracker-bmad", () => ({
  computeRetrospective: mockComputeRetro,
  computeForecast: mockComputeForecast,
  computeSprintHealth: mockComputeHealth,
  archiveSprint: mockArchiveSprint,
}));

let tmpDir: string;
let configPath: string;

import { Command } from "commander";
import { registerSprintEnd } from "../../src/commands/sprint-end.js";

let program: Command;
let consoleSpy: ReturnType<typeof vi.spyOn>;
let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

function writeConfig(): void {
  const config = {
    projects: {
      "my-app": {
        name: "My App",
        repo: "org/my-app",
        path: join(tmpDir, "main-repo"),
        defaultBranch: "main",
        sessionPrefix: "app",
        tracker: {
          plugin: "bmad",
          sprintStartDate: "2026-03-01",
          sprintEndDate: "2026-03-14",
          sprintGoal: "Ship auth",
        },
      },
    },
  };
  writeFileSync(configPath, stringifyYaml(config, { indent: 2 }), "utf-8");
}

function readConfig(): Record<string, unknown> {
  return parseYaml(readFileSync(configPath, "utf-8")) as Record<string, unknown>;
}

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), "ao-sprint-end-test-"));
  configPath = join(tmpDir, "agent-orchestrator.yaml");

  writeConfig();
  mockFindConfig.mockReturnValue(configPath);

  mockConfigRef.current = {
    configPath,
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
  mockComputeRetro.mockReturnValue({
    period: { startDate: "2026-03-01", endDate: "2026-03-14" },
    velocity: 8,
    completedCount: 8,
    avgCycleTimeHours: 12.5,
  });
  mockComputeForecast.mockReturnValue({
    pace: "on-track",
    currentVelocity: 1.2,
    requiredVelocity: 1.0,
    remainingStories: 3,
  });
  mockComputeHealth.mockReturnValue({
    overall: "ok",
    indicators: [],
    stuckStories: [],
    wipColumns: [],
  });
  mockArchiveSprint.mockReturnValue({
    archivePath: "sprint-history-2026-03-14.jsonl",
    archivedEntries: 0,
    carriedOver: [],
    removedDone: [],
  });

  program = new Command();
  program.exitOverride();
  registerSprintEnd(program);

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

describe("sprint-end command", () => {
  it("computes and displays sprint metrics", async () => {
    await program.parseAsync(["node", "test", "sprint-end"]);

    expect(mockComputeRetro).toHaveBeenCalledOnce();
    expect(mockComputeForecast).toHaveBeenCalledOnce();
    expect(mockComputeHealth).toHaveBeenCalledOnce();

    const output = consoleSpy.mock.calls.map((c) => String(c[0])).join("\n");
    expect(output).toContain("Sprint Report");
    expect(output).toContain("Velocity");
    expect(output).toContain("8");
  });

  it("outputs JSON with --json flag", async () => {
    await program.parseAsync(["node", "test", "sprint-end", "--json"]);

    const output = consoleSpy.mock.calls.map((c) => String(c[0])).join("");
    const parsed = JSON.parse(output) as Record<string, unknown>;
    expect(parsed["retrospective"]).toBeDefined();
    expect(parsed["forecast"]).toBeDefined();
    expect(parsed["health"]).toBeDefined();
  });

  it("clears sprint config with --clear flag", async () => {
    await program.parseAsync(["node", "test", "sprint-end", "--clear"]);

    const raw = readConfig();
    const projects = raw["projects"] as Record<string, Record<string, unknown>>;
    const tracker = projects["my-app"]["tracker"] as Record<string, unknown>;
    expect(tracker["sprintStartDate"]).toBeUndefined();
    expect(tracker["sprintEndDate"]).toBeUndefined();
    expect(tracker["sprintGoal"]).toBeUndefined();
    // Plugin should remain
    expect(tracker["plugin"]).toBe("bmad");
  });

  it("handles non-bmad tracker", async () => {
    mockGetTracker.mockReturnValue({ name: "github" });

    await expect(program.parseAsync(["node", "test", "sprint-end"])).rejects.toThrow(
      "process.exit(1)",
    );

    const errorOutput = consoleErrorSpy.mock.calls.map((c) => String(c[0])).join("\n");
    expect(errorOutput).toMatch(/bmad tracker/);
  });
});
