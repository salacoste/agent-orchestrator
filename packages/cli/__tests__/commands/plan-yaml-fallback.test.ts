import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, copyFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const { mockConfigRef } = vi.hoisted(() => ({
  mockConfigRef: { current: null as Record<string, unknown> | null },
}));

vi.mock("@composio/ao-core", async (importOriginal) => {
  // eslint-disable-next-line @typescript-eslint/consistent-type-imports
  const actual = await importOriginal<typeof import("@composio/ao-core")>();
  return {
    ...actual,
    loadConfig: () => mockConfigRef.current,
  };
});

// Mock tracker-bmad to prevent import errors (not used in fallback path)
vi.mock("@composio/ao-plugin-tracker-bmad", () => ({
  computeSprintPlan: vi.fn(),
  acceptPlan: vi.fn(),
}));

import { Command } from "commander";
import { registerPlan } from "../../src/commands/plan.js";

let tmpDir: string;
let program: Command;
let consoleSpy: ReturnType<typeof vi.spyOn>;
let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

const FIXTURE_DIR = join(__dirname, "..", "fixtures");
const FIXTURE_FILE = join(FIXTURE_DIR, "sprint-status-plan-view.yaml");

function makeConfig(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    configPath: join(tmpDir, "agent-orchestrator.yaml"),
    port: 5000,
    defaults: {
      runtime: "tmux",
      agent: "claude-code",
      workspace: "worktree",
      notifiers: ["desktop"],
    },
    projects: {
      "test-project": {
        name: "Test Project",
        repo: "org/test-project",
        path: tmpDir,
        defaultBranch: "main",
        sessionPrefix: "test",
        // No tracker plugin → triggers YAML fallback
      },
    },
    notifiers: {},
    notificationRouting: {},
    reactions: {},
    ...overrides,
  };
}

function setupFixture(fixtureName?: string): void {
  const storyDir = join(tmpDir, "_bmad-output", "implementation-artifacts");
  mkdirSync(storyDir, { recursive: true });
  const source = fixtureName ? join(FIXTURE_DIR, fixtureName) : FIXTURE_FILE;
  copyFileSync(source, join(storyDir, "sprint-status.yaml"));
}

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), "ao-plan-yaml-test-"));
  mockConfigRef.current = makeConfig();

  program = new Command();
  program.exitOverride();
  registerPlan(program);

  consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
  consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(process, "exit").mockImplementation((code) => {
    throw new Error(`process.exit(${code})`);
  });
});

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true });
  vi.restoreAllMocks();
});

describe("plan command (YAML fallback)", () => {
  it("displays summary with story count and status breakdown (AC #1)", async () => {
    setupFixture();

    await program.parseAsync(["node", "test", "plan"]);

    const output = consoleSpy.mock.calls.map((c) => String(c[0])).join("\n");
    expect(output).toContain("Sprint Plan");
    expect(output).toContain("test-project");
    // 8 stories total in fixture (excluding epics and retrospectives)
    expect(output).toContain("8");
    expect(output).toContain("READY TO START");
  });

  it("shows actionable stories sorted by epic then story number (AC #1, #3)", async () => {
    setupFixture();

    await program.parseAsync(["node", "test", "plan"]);

    const output = consoleSpy.mock.calls.map((c) => String(c[0])).join("\n");
    // Actionable = backlog + ready-for-dev: 1-2, 1-3, 2-1, 2-2
    expect(output).toContain("1-2-story-aware-agent-spawning");
    expect(output).toContain("1-3-agent-story-status-tracking");
    expect(output).toContain("2-1-bmad-tracker-sync-bridge");
    expect(output).toContain("2-2-story-lifecycle-events");
  });

  it("shows --full flag with all stories grouped by epic (AC #2)", async () => {
    setupFixture();

    await program.parseAsync(["node", "test", "plan", "--full"]);

    const output = consoleSpy.mock.calls.map((c) => String(c[0])).join("\n");
    expect(output).toContain("Full");
    expect(output).toContain("Epic 1");
    expect(output).toContain("Epic 2");
    expect(output).toContain("Epic 6");
    // Should include done and review stories in full view
    expect(output).toContain("6-1-artifact-scanner-phase-engine");
    expect(output).toContain("6-2-workflow-api-route");
  });

  it("shows error and exit code 1 when sprint-status.yaml is missing (AC #4)", async () => {
    // Don't set up fixture — no YAML file exists

    await expect(program.parseAsync(["node", "test", "plan"])).rejects.toThrow("process.exit(1)");

    const errorOutput = consoleErrorSpy.mock.calls.map((c) => String(c[0])).join("\n");
    expect(errorOutput).toContain("sprint-status.yaml not found");
    expect(errorOutput).toContain("sprint-planning");
  });

  it("shows error and exit code 1 for malformed YAML (AC #5)", async () => {
    const storyDir = join(tmpDir, "_bmad-output", "implementation-artifacts");
    mkdirSync(storyDir, { recursive: true });
    writeFileSync(join(storyDir, "sprint-status.yaml"), "{{invalid: yaml: [}", "utf-8");

    await expect(program.parseAsync(["node", "test", "plan"])).rejects.toThrow("process.exit(1)");

    const errorOutput = consoleErrorSpy.mock.calls.map((c) => String(c[0])).join("\n");
    expect(errorOutput).toContain("Failed to parse");
  });

  it("shows info message for empty development_status (AC #1)", async () => {
    const storyDir = join(tmpDir, "_bmad-output", "implementation-artifacts");
    mkdirSync(storyDir, { recursive: true });
    writeFileSync(
      join(storyDir, "sprint-status.yaml"),
      "project: empty-project\ndevelopment_status:\n  epic-1: backlog\n",
      "utf-8",
    );

    await program.parseAsync(["node", "test", "plan"]);

    const output = consoleSpy.mock.calls.map((c) => String(c[0])).join("\n");
    expect(output).toContain("No stories found");
  });

  it("outputs valid JSON with --json flag", async () => {
    setupFixture();

    await program.parseAsync(["node", "test", "plan", "--json"]);

    const output = consoleSpy.mock.calls.map((c) => String(c[0])).join("");
    const parsed = JSON.parse(output) as Record<string, unknown>;
    expect(parsed).toHaveProperty("projectName", "test-project");
    expect(parsed).toHaveProperty("summary");
    expect(parsed).toHaveProperty("actionable");
    expect(parsed).toHaveProperty("review");
    expect(parsed).toHaveProperty("epicGroups");
  });

  it("displays blocked stories in default view", async () => {
    setupFixture();

    await program.parseAsync(["node", "test", "plan"]);

    const output = consoleSpy.mock.calls.map((c) => String(c[0])).join("\n");
    expect(output).toContain("BLOCKED");
    expect(output).toContain("2-3-dependency-resolution");
  });

  it("displays review stories in default view", async () => {
    setupFixture();

    await program.parseAsync(["node", "test", "plan"]);

    const output = consoleSpy.mock.calls.map((c) => String(c[0])).join("\n");
    expect(output).toContain("IN REVIEW");
    expect(output).toContain("6-2-workflow-api-route");
  });

  it("rejects --accept flag with error in YAML fallback path", async () => {
    setupFixture();

    await expect(program.parseAsync(["node", "test", "plan", "--accept"])).rejects.toThrow(
      "process.exit(1)",
    );

    const errorOutput = consoleErrorSpy.mock.calls.map((c) => String(c[0])).join("\n");
    expect(errorOutput).toContain("--accept is only supported");
  });

  it("warns on unknown status values and treats them as backlog", async () => {
    const storyDir = join(tmpDir, "_bmad-output", "implementation-artifacts");
    mkdirSync(storyDir, { recursive: true });
    writeFileSync(
      join(storyDir, "sprint-status.yaml"),
      "project: test\ndevelopment_status:\n  1-1-some-story: wip\n",
      "utf-8",
    );

    await program.parseAsync(["node", "test", "plan"]);

    const warnOutput = vi
      .mocked(console.warn)
      .mock.calls.map((c) => String(c[0]))
      .join("\n");
    expect(warnOutput).toContain("unknown status");
    expect(warnOutput).toContain("wip");
  });

  it("rejects development_status that is not a mapping", async () => {
    const storyDir = join(tmpDir, "_bmad-output", "implementation-artifacts");
    mkdirSync(storyDir, { recursive: true });
    writeFileSync(
      join(storyDir, "sprint-status.yaml"),
      "project: test\ndevelopment_status:\n  - item1\n  - item2\n",
      "utf-8",
    );

    await expect(program.parseAsync(["node", "test", "plan"])).rejects.toThrow("process.exit(1)");

    const errorOutput = consoleErrorSpy.mock.calls.map((c) => String(c[0])).join("\n");
    expect(errorOutput).toContain("must be a mapping");
  });

  it("completes within 500ms (AC #6)", async () => {
    setupFixture();

    const start = Date.now();
    await program.parseAsync(["node", "test", "plan"]);
    const elapsed = Date.now() - start;

    expect(elapsed).toBeLessThan(500);
  });
});
