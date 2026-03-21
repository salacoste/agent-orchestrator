import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, writeFileSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { stringify as stringifyYaml, parse as parseYaml } from "yaml";

const { mockConfigRef, mockFindConfig } = vi.hoisted(() => ({
  mockConfigRef: { current: null as Record<string, unknown> | null },
  mockFindConfig: vi.fn(),
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

let tmpDir: string;
let configPath: string;

import { Command } from "commander";
import { registerSprintConfig } from "../../src/commands/sprint-config.js";

let program: Command;
let consoleSpy: ReturnType<typeof vi.spyOn>;
let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

function writeConfig(rawConfig: Record<string, unknown>) {
  writeFileSync(configPath, stringifyYaml(rawConfig, { indent: 2 }), "utf-8");
}

function readConfig(): Record<string, unknown> {
  return parseYaml(readFileSync(configPath, "utf-8")) as Record<string, unknown>;
}

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), "ao-sprint-config-test-"));
  configPath = join(tmpDir, "agent-orchestrator.yaml");

  const rawConfig = {
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
          sprintGoal: "Finish auth",
          targetVelocity: 5,
        },
      },
    },
  };

  writeConfig(rawConfig);

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
        tracker: {
          plugin: "bmad",
          sprintStartDate: "2026-03-01",
          sprintEndDate: "2026-03-14",
          sprintGoal: "Finish auth",
          targetVelocity: 5,
        },
      },
    },
    notifiers: {},
    notificationRouting: {},
    reactions: {},
  } as Record<string, unknown>;

  mockFindConfig.mockReturnValue(configPath);

  program = new Command();
  program.exitOverride();
  registerSprintConfig(program);

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

// ---------------------------------------------------------------------------
// Read mode
// ---------------------------------------------------------------------------

describe("sprint-config read mode", () => {
  it("displays current sprint config", async () => {
    await program.parseAsync(["node", "test", "sprint-config"]);

    const output = consoleSpy.mock.calls.map((c) => String(c[0])).join("\n");
    expect(output).toContain("Sprint Config");
    expect(output).toContain("2026-03-01");
    expect(output).toContain("2026-03-14");
    expect(output).toContain("Finish auth");
    expect(output).toContain("5");
  });

  it("outputs JSON with --json flag", async () => {
    await program.parseAsync(["node", "test", "sprint-config", "--json"]);

    const output = consoleSpy.mock.calls.map((c) => String(c[0])).join("");
    const parsed = JSON.parse(output) as Record<string, unknown>;
    expect(parsed["sprintStartDate"]).toBe("2026-03-01");
    expect(parsed["sprintEndDate"]).toBe("2026-03-14");
    expect(parsed["sprintGoal"]).toBe("Finish auth");
    expect(parsed["targetVelocity"]).toBe(5);
  });

  it("shows (not set) for missing fields", async () => {
    const projects = (mockConfigRef.current as Record<string, unknown>)["projects"] as Record<
      string,
      Record<string, unknown>
    >;
    projects["my-app"]["tracker"] = { plugin: "bmad" };

    await program.parseAsync(["node", "test", "sprint-config"]);

    const output = consoleSpy.mock.calls.map((c) => String(c[0])).join("\n");
    expect(output).toContain("(not set)");
  });
});

// ---------------------------------------------------------------------------
// Write mode
// ---------------------------------------------------------------------------

describe("sprint-config write mode", () => {
  it("sets end date", async () => {
    await program.parseAsync(["node", "test", "sprint-config", "--end-date", "2026-03-28"]);

    const output = consoleSpy.mock.calls.map((c) => String(c[0])).join("\n");
    expect(output).toContain("Set end date to 2026-03-28");

    const cfg = readConfig();
    const tracker = (cfg["projects"] as Record<string, Record<string, unknown>>)["my-app"][
      "tracker"
    ] as Record<string, unknown>;
    expect(tracker["sprintEndDate"]).toBe("2026-03-28");
  });

  it("sets start date", async () => {
    await program.parseAsync(["node", "test", "sprint-config", "--start-date", "2026-04-01"]);

    const output = consoleSpy.mock.calls.map((c) => String(c[0])).join("\n");
    expect(output).toContain("Set start date to 2026-04-01");

    const cfg = readConfig();
    const tracker = (cfg["projects"] as Record<string, Record<string, unknown>>)["my-app"][
      "tracker"
    ] as Record<string, unknown>;
    expect(tracker["sprintStartDate"]).toBe("2026-04-01");
  });

  it("clears end date", async () => {
    await program.parseAsync(["node", "test", "sprint-config", "--clear-end-date"]);

    const output = consoleSpy.mock.calls.map((c) => String(c[0])).join("\n");
    expect(output).toContain("Cleared sprint end date");

    const cfg = readConfig();
    const tracker = (cfg["projects"] as Record<string, Record<string, unknown>>)["my-app"][
      "tracker"
    ] as Record<string, unknown>;
    expect(tracker["sprintEndDate"]).toBeUndefined();
  });

  it("sets goal", async () => {
    await program.parseAsync(["node", "test", "sprint-config", "--goal", "Launch MVP"]);

    const output = consoleSpy.mock.calls.map((c) => String(c[0])).join("\n");
    expect(output).toContain('Set goal to "Launch MVP"');

    const cfg = readConfig();
    const tracker = (cfg["projects"] as Record<string, Record<string, unknown>>)["my-app"][
      "tracker"
    ] as Record<string, unknown>;
    expect(tracker["sprintGoal"]).toBe("Launch MVP");
  });

  it("sets target velocity", async () => {
    await program.parseAsync(["node", "test", "sprint-config", "--target-velocity", "10"]);

    const output = consoleSpy.mock.calls.map((c) => String(c[0])).join("\n");
    expect(output).toContain("Set target velocity to 10");

    const cfg = readConfig();
    const tracker = (cfg["projects"] as Record<string, Record<string, unknown>>)["my-app"][
      "tracker"
    ] as Record<string, unknown>;
    expect(tracker["targetVelocity"]).toBe(10);
  });

  it("sets WIP limit", async () => {
    await program.parseAsync(["node", "test", "sprint-config", "--wip-limit", "in-progress:3"]);

    const output = consoleSpy.mock.calls.map((c) => String(c[0])).join("\n");
    expect(output).toContain("Set WIP limits: in-progress:3");

    const cfg = readConfig();
    const tracker = (cfg["projects"] as Record<string, Record<string, unknown>>)["my-app"][
      "tracker"
    ] as Record<string, unknown>;
    const wip = tracker["wipLimits"] as Record<string, number>;
    expect(wip["in-progress"]).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

describe("sprint-config validation", () => {
  it("rejects invalid date format", async () => {
    await expect(
      program.parseAsync(["node", "test", "sprint-config", "--end-date", "not-a-date"]),
    ).rejects.toThrow("process.exit(1)");

    const errorOutput = consoleErrorSpy.mock.calls.map((c) => String(c[0])).join("\n");
    expect(errorOutput).toMatch(/Invalid.*date/i);
  });

  it("rejects non-positive target velocity", async () => {
    await expect(
      program.parseAsync(["node", "test", "sprint-config", "--target-velocity", "0"]),
    ).rejects.toThrow("process.exit(1)");

    const errorOutput = consoleErrorSpy.mock.calls.map((c) => String(c[0])).join("\n");
    expect(errorOutput).toMatch(/positive number/i);
  });

  it("rejects invalid WIP limit format", async () => {
    await expect(
      program.parseAsync(["node", "test", "sprint-config", "--wip-limit", "badformat"]),
    ).rejects.toThrow("process.exit(1)");

    const errorOutput = consoleErrorSpy.mock.calls.map((c) => String(c[0])).join("\n");
    expect(errorOutput).toMatch(/Invalid WIP limit/i);
  });
});
