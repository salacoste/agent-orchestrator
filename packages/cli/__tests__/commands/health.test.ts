import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import type { SprintHealthResult } from "@composio/ao-plugin-tracker-bmad";

const { mockConfigRef, mockGetTracker, mockComputeSprintHealth } = vi.hoisted(() => ({
  mockConfigRef: { current: null as Record<string, unknown> | null },
  mockGetTracker: vi.fn(),
  mockComputeSprintHealth: vi.fn(),
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
  computeSprintHealth: mockComputeSprintHealth,
}));

let tmpDir: string;

import { Command } from "commander";
import { registerHealth } from "../../src/commands/health.js";

let program: Command;
let consoleSpy: ReturnType<typeof vi.spyOn>;
let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

function makeHealth(overrides: Partial<SprintHealthResult> = {}): SprintHealthResult {
  return {
    overall: "ok",
    indicators: [],
    stuckStories: [],
    wipColumns: [],
    ...overrides,
  };
}

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), "ao-health-test-"));

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
  mockComputeSprintHealth.mockReturnValue(makeHealth());

  program = new Command();
  program.exitOverride();
  registerHealth(program);

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

describe("health command", () => {
  it("displays all-ok output when no issues", async () => {
    await program.parseAsync(["node", "test", "health"]);

    const output = consoleSpy.mock.calls.map((c) => String(c[0])).join("\n");
    expect(output).toContain("Sprint Health");
    expect(output).toContain("OK");
  });

  it("displays warning indicators", async () => {
    mockComputeSprintHealth.mockReturnValue(
      makeHealth({
        overall: "warning",
        indicators: [
          {
            id: "stuck-stories",
            severity: "warning",
            message: "1 story stuck for >48h",
            details: ["s1"],
          },
        ],
        stuckStories: ["s1"],
      }),
    );

    await program.parseAsync(["node", "test", "health"]);

    const output = consoleSpy.mock.calls.map((c) => String(c[0])).join("\n");
    expect(output).toContain("WARNING");
    expect(output).toContain("stuck");
    expect(output).toContain("s1");
  });

  it("displays critical indicators", async () => {
    mockComputeSprintHealth.mockReturnValue(
      makeHealth({
        overall: "critical",
        indicators: [
          {
            id: "wip-alert",
            severity: "critical",
            message: "in-progress has 6 stories (limit: 5)",
            details: ["in-progress"],
          },
        ],
        wipColumns: ["in-progress"],
      }),
    );

    await program.parseAsync(["node", "test", "health"]);

    const output = consoleSpy.mock.calls.map((c) => String(c[0])).join("\n");
    expect(output).toContain("CRITICAL");
    expect(output).toContain("in-progress");
  });

  it("outputs valid JSON with --json flag", async () => {
    const health = makeHealth({
      overall: "warning",
      indicators: [
        {
          id: "stuck-stories",
          severity: "warning",
          message: "1 story stuck",
          details: ["s1"],
        },
      ],
      stuckStories: ["s1"],
    });
    mockComputeSprintHealth.mockReturnValue(health);

    await program.parseAsync(["node", "test", "health", "--json"]);

    const output = consoleSpy.mock.calls.map((c) => String(c[0])).join("");
    const parsed = JSON.parse(output) as SprintHealthResult;
    expect(parsed.overall).toBe("warning");
    expect(parsed.stuckStories).toEqual(["s1"]);
  });

  it("handles non-bmad tracker", async () => {
    mockGetTracker.mockReturnValue({ name: "github" });

    await expect(program.parseAsync(["node", "test", "health"])).rejects.toThrow("process.exit(1)");

    const errorOutput = consoleErrorSpy.mock.calls.map((c) => String(c[0])).join("\n");
    expect(errorOutput).toMatch(/bmad tracker/);
  });

  it("resolves project when specified", async () => {
    await program.parseAsync(["node", "test", "health", "my-app"]);

    expect(mockComputeSprintHealth).toHaveBeenCalled();
  });

  it("handles no tracker configured", async () => {
    mockGetTracker.mockReturnValue(null);

    await expect(program.parseAsync(["node", "test", "health"])).rejects.toThrow("process.exit(1)");

    const errorOutput = consoleErrorSpy.mock.calls.map((c) => String(c[0])).join("\n");
    expect(errorOutput).toMatch(/bmad tracker/);
  });
});
