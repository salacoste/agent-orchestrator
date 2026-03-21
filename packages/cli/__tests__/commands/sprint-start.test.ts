import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from "node:fs";
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
import { registerSprintStart } from "../../src/commands/sprint-start.js";

let program: Command;
let consoleSpy: ReturnType<typeof vi.spyOn>;
let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

function writeConfig(tracker: Record<string, unknown> = { plugin: "bmad" }): void {
  const config = {
    projects: {
      "my-app": {
        name: "My App",
        repo: "org/my-app",
        path: join(tmpDir, "main-repo"),
        defaultBranch: "main",
        sessionPrefix: "app",
        tracker,
      },
    },
  };
  writeFileSync(configPath, stringifyYaml(config, { indent: 2 }), "utf-8");
}

function readConfig(): Record<string, unknown> {
  return parseYaml(readFileSync(configPath, "utf-8")) as Record<string, unknown>;
}

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), "ao-sprint-start-test-"));
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

  program = new Command();
  program.exitOverride();
  registerSprintStart(program);

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

describe("sprint-start command", () => {
  it("writes sprint start date to config", async () => {
    await program.parseAsync([
      "node",
      "test",
      "sprint-start",
      "--start-date",
      "2026-03-01",
      "--goal",
      "Ship auth",
    ]);

    const raw = readConfig();
    const projects = raw["projects"] as Record<string, Record<string, unknown>>;
    const tracker = projects["my-app"]["tracker"] as Record<string, unknown>;
    expect(tracker["sprintStartDate"]).toBe("2026-03-01");
    expect(tracker["sprintGoal"]).toBe("Ship auth");
  });

  it("writes all config values", async () => {
    await program.parseAsync([
      "node",
      "test",
      "sprint-start",
      "--start-date",
      "2026-03-01",
      "--end-date",
      "2026-03-14",
      "--goal",
      "Ship auth",
      "--velocity",
      "10",
    ]);

    const raw = readConfig();
    const projects = raw["projects"] as Record<string, Record<string, unknown>>;
    const tracker = projects["my-app"]["tracker"] as Record<string, unknown>;
    expect(tracker["sprintStartDate"]).toBe("2026-03-01");
    expect(tracker["sprintEndDate"]).toBe("2026-03-14");
    expect(tracker["sprintGoal"]).toBe("Ship auth");
    expect(tracker["targetVelocity"]).toBe(10);
  });

  it("rejects invalid date format", async () => {
    await expect(
      program.parseAsync(["node", "test", "sprint-start", "--start-date", "not-a-date"]),
    ).rejects.toThrow("process.exit(1)");

    const errorOutput = consoleErrorSpy.mock.calls.map((c) => String(c[0])).join("\n");
    expect(errorOutput).toMatch(/date format/i);
  });

  it("outputs JSON with --json flag", async () => {
    await program.parseAsync([
      "node",
      "test",
      "sprint-start",
      "--start-date",
      "2026-03-01",
      "--json",
    ]);

    const output = consoleSpy.mock.calls.map((c) => String(c[0])).join("");
    const parsed = JSON.parse(output) as Record<string, unknown>;
    expect(parsed["sprintStartDate"]).toBe("2026-03-01");
  });

  it("defaults start date to today when not specified", async () => {
    await program.parseAsync(["node", "test", "sprint-start", "--goal", "Test"]);

    const raw = readConfig();
    const projects = raw["projects"] as Record<string, Record<string, unknown>>;
    const tracker = projects["my-app"]["tracker"] as Record<string, unknown>;
    expect(tracker["sprintStartDate"]).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
