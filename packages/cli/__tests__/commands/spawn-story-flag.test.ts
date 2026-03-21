import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, mkdirSync, copyFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Hoisted mocks — required because vi.mock() is hoisted above imports
const {
  mockConfigRef,
  mockSpawnFn,
  mockRegistryRef,
  mockConflictServiceRef,
  mockPromptConfirmation,
} = vi.hoisted(() => ({
  mockConfigRef: { current: null as Record<string, unknown> | null },
  mockSpawnFn: vi.fn(),
  mockPromptConfirmation: vi.fn().mockResolvedValue(true),
  mockRegistryRef: {
    current: {
      register: vi.fn(),
      findActiveByStory: vi.fn().mockReturnValue(null),
      findActiveByAgent: vi.fn().mockReturnValue(null),
      getAll: vi.fn().mockReturnValue([]),
    },
  },
  mockConflictServiceRef: {
    current: {
      canAssign: () => true,
      detectConflict: () => null,
      recordConflict: vi.fn(),
      getConflictsByStory: () => [] as unknown[],
    },
  },
}));

vi.mock("@composio/ao-core", async (importOriginal) => {
  // eslint-disable-next-line @typescript-eslint/consistent-type-imports
  const actual = await importOriginal<typeof import("@composio/ao-core")>();
  return {
    ...actual,
    loadConfig: () => mockConfigRef.current,
    getAgentRegistry: () => mockRegistryRef.current,
    getSessionsDir: () => "/tmp/ao-sessions",
    computeStoryContextHash: () => "abc123hash",
    createConflictDetectionService: () => mockConflictServiceRef.current,
  };
});

vi.mock("../../src/lib/create-session-manager.js", () => ({
  getSessionManager: () =>
    Promise.resolve({
      spawn: mockSpawnFn,
      list: vi.fn().mockResolvedValue([]),
      get: vi.fn(),
      kill: vi.fn(),
    }),
}));

vi.mock("../../src/lib/preflight.js", () => ({
  preflight: {
    checkTmux: vi.fn(),
    checkGhAuth: vi.fn(),
  },
}));

vi.mock("../../src/lib/shell.js", () => ({
  exec: vi.fn(),
}));

vi.mock("../../src/lib/story-context.js", async (importOriginal) => {
  // eslint-disable-next-line @typescript-eslint/consistent-type-imports
  const actual = await importOriginal<typeof import("../../src/lib/story-context.js")>();
  return {
    ...actual,
    promptConfirmation: mockPromptConfirmation,
  };
});

import { Command } from "commander";
import { registerSpawn } from "../../src/commands/spawn.js";

const FIXTURE_DIR = join(__dirname, "..", "fixtures");

let tmpDir: string;
let program: Command;
let consoleSpy: ReturnType<typeof vi.spyOn>;
let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

function makeConfig(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    configPath: join(tmpDir, "agent-orchestrator.yaml"),
    port: 5000,
    defaults: {
      runtime: "process",
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
      },
    },
    notifiers: {},
    notificationRouting: {},
    reactions: {},
    ...overrides,
  };
}

function setupFixtures(): void {
  const storyDir = join(tmpDir, "_bmad-output", "implementation-artifacts");
  mkdirSync(storyDir, { recursive: true });
  copyFileSync(join(FIXTURE_DIR, "sprint-status-spawn.yaml"), join(storyDir, "sprint-status.yaml"));
  copyFileSync(
    join(FIXTURE_DIR, "1-2-test-story.md"),
    join(storyDir, "1-2-story-aware-agent-spawning.md"),
  );
}

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), "ao-spawn-story-test-"));
  mockConfigRef.current = makeConfig();

  mockSpawnFn.mockResolvedValue({
    id: "test-1",
    projectId: "test-project",
    status: "running",
    workspacePath: "/tmp/workspace",
    branch: "feat/1-2-story-aware-agent-spawning",
    runtimeHandle: { id: "test-tmux-1", runtimeName: "process", data: {} },
  });

  mockRegistryRef.current = {
    register: vi.fn(),
    findActiveByStory: vi.fn().mockReturnValue(null),
    findActiveByAgent: vi.fn().mockReturnValue(null),
    getAll: vi.fn().mockReturnValue([]),
  };

  program = new Command();
  program.exitOverride();
  registerSpawn(program);

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

describe("ao spawn --story", () => {
  it("reads sprint-status.yaml and spawns with story prompt (AC #1)", async () => {
    setupFixtures();

    await program.parseAsync([
      "node",
      "test",
      "spawn",
      "test-project",
      "--story",
      "1-2-story-aware-agent-spawning",
    ]);

    // Verify spawn was called with story context
    expect(mockSpawnFn).toHaveBeenCalledOnce();
    const spawnArg = mockSpawnFn.mock.calls[0][0] as Record<string, unknown>;
    expect(spawnArg.projectId).toBe("test-project");
    expect(spawnArg.issueId).toBe("1-2-story-aware-agent-spawning");
    expect(spawnArg.storyContext).toBeDefined();
    expect(typeof spawnArg.storyContext).toBe("string");
    expect(spawnArg.storyContext as string).toContain("Story-Aware Agent Spawning");
  });

  it("passes --agent override when --story is also specified (AC #2)", async () => {
    setupFixtures();

    await program.parseAsync([
      "node",
      "test",
      "spawn",
      "test-project",
      "--story",
      "1-2-story-aware-agent-spawning",
      "--agent",
      "codex",
    ]);

    const spawnArg = mockSpawnFn.mock.calls[0][0] as Record<string, unknown>;
    expect(spawnArg.agent).toBe("codex");
  });

  it("shows error and exits when sprint-status.yaml is missing", async () => {
    // Don't set up fixtures — no YAML file

    await expect(
      program.parseAsync(["node", "test", "spawn", "test-project", "--story", "1-2-test"]),
    ).rejects.toThrow("process.exit(1)");

    const errorOutput = consoleErrorSpy.mock.calls.map((c) => String(c[0])).join("\n");
    expect(errorOutput).toContain("sprint-status.yaml not found");
  });

  it("shows error when story not found in sprint-status.yaml", async () => {
    setupFixtures();

    await expect(
      program.parseAsync(["node", "test", "spawn", "test-project", "--story", "99-99-nonexistent"]),
    ).rejects.toThrow("process.exit(1)");

    const errorOutput = consoleErrorSpy.mock.calls.map((c) => String(c[0])).join("\n");
    expect(errorOutput).toContain("99-99-nonexistent");
    expect(errorOutput).toContain("not found in sprint-status.yaml");
    expect(errorOutput).toContain("Available stories");
  });

  it("shows error when story file is missing", async () => {
    const storyDir = join(tmpDir, "_bmad-output", "implementation-artifacts");
    mkdirSync(storyDir, { recursive: true });
    // Copy sprint-status but NOT the story file
    copyFileSync(
      join(FIXTURE_DIR, "sprint-status-spawn.yaml"),
      join(storyDir, "sprint-status.yaml"),
    );

    await expect(
      program.parseAsync([
        "node",
        "test",
        "spawn",
        "test-project",
        "--story",
        "1-2-story-aware-agent-spawning",
      ]),
    ).rejects.toThrow("process.exit(1)");

    const errorOutput = consoleErrorSpy.mock.calls.map((c) => String(c[0])).join("\n");
    expect(errorOutput).toContain("Story file");
    expect(errorOutput).toContain("not found");
  });

  it("registers agent-story assignment after spawn (AC #5)", async () => {
    setupFixtures();

    await program.parseAsync([
      "node",
      "test",
      "spawn",
      "test-project",
      "--story",
      "1-2-story-aware-agent-spawning",
    ]);

    expect(mockRegistryRef.current.register).toHaveBeenCalledOnce();
    const registerArg = mockRegistryRef.current.register.mock.calls[0][0] as Record<
      string,
      unknown
    >;
    expect(registerArg.agentId).toBe("test-1");
    expect(registerArg.storyId).toBe("1-2-story-aware-agent-spawning");
    expect(registerArg.status).toBe("active");
    expect(registerArg.contextHash).toBe("abc123hash");
  });

  it("uses storyId as issueId for branch naming (Task 1.6)", async () => {
    setupFixtures();

    await program.parseAsync([
      "node",
      "test",
      "spawn",
      "test-project",
      "--story",
      "1-2-story-aware-agent-spawning",
    ]);

    const spawnArg = mockSpawnFn.mock.calls[0][0] as Record<string, unknown>;
    expect(spawnArg.issueId).toBe("1-2-story-aware-agent-spawning");
  });

  it("normalizes story ID by stripping 'story-' prefix", async () => {
    setupFixtures();

    await program.parseAsync([
      "node",
      "test",
      "spawn",
      "test-project",
      "--story",
      "story-1-2-story-aware-agent-spawning",
    ]);

    const spawnArg = mockSpawnFn.mock.calls[0][0] as Record<string, unknown>;
    expect(spawnArg.issueId).toBe("1-2-story-aware-agent-spawning");
  });

  it("displays spawn summary with story details", async () => {
    setupFixtures();

    await program.parseAsync([
      "node",
      "test",
      "spawn",
      "test-project",
      "--story",
      "1-2-story-aware-agent-spawning",
    ]);

    const output = consoleSpy.mock.calls.map((c) => String(c[0])).join("\n");
    expect(output).toContain("Spawning Agent for Story");
    expect(output).toContain("1-2-story-aware-agent-spawning");
  });

  it("--story takes precedence over [issue] argument", async () => {
    setupFixtures();

    await program.parseAsync([
      "node",
      "test",
      "spawn",
      "test-project",
      "ISSUE-123",
      "--story",
      "1-2-story-aware-agent-spawning",
    ]);

    // Should use story flow, not issue flow
    const spawnArg = mockSpawnFn.mock.calls[0][0] as Record<string, unknown>;
    expect(spawnArg.storyContext).toBeDefined();
    expect(spawnArg.issueId).toBe("1-2-story-aware-agent-spawning");
  });
});

describe("ao spawn --story conflict detection (AC #7)", () => {
  it("warns when story already has an active agent", async () => {
    setupFixtures();

    // User declines the confirmation prompt
    mockPromptConfirmation.mockResolvedValueOnce(false);

    // Override conflict service to report a conflict
    mockConflictServiceRef.current = {
      canAssign: () => false,
      detectConflict: () => ({
        storyId: "1-2-story-aware-agent-spawning",
        agents: ["existing-agent-1"],
        detectedAt: new Date(),
      }),
      recordConflict: vi.fn(),
      getConflictsByStory: () => [],
    };

    mockRegistryRef.current.findActiveByStory.mockReturnValue({
      agentId: "existing-agent-1",
      storyId: "1-2-story-aware-agent-spawning",
      assignedAt: new Date(),
      status: "active",
    });

    // Mock stdin to auto-decline the confirmation prompt
    // Since promptConfirmation reads stdin, we mock process.exit to catch the "cancelled" path
    await expect(
      program.parseAsync([
        "node",
        "test",
        "spawn",
        "test-project",
        "--story",
        "1-2-story-aware-agent-spawning",
      ]),
    ).rejects.toThrow("process.exit");

    const output = consoleSpy.mock.calls.map((c) => String(c[0])).join("\n");
    expect(output).toContain("Conflict");
    expect(output).toContain("1-2-story-aware-agent-spawning");
  });

  it("warns when story has unresolved dependencies (AC #3)", async () => {
    setupFixtures();

    // Override sprint-status to make dependency unresolved (1-1 not done)
    const storyDir = join(tmpDir, "_bmad-output", "implementation-artifacts");
    writeFileSync(
      join(storyDir, "sprint-status.yaml"),
      [
        "project: test-project",
        "story_location: _bmad-output/implementation-artifacts",
        "development_status:",
        "  1-1-sprint-plan-cli: in-progress",
        "  1-2-story-aware-agent-spawning: ready-for-dev",
        "dependencies:",
        "  1-2-story-aware-agent-spawning:",
        "    - 1-1-sprint-plan-cli",
        "",
      ].join("\n"),
      "utf-8",
    );

    // User declines the confirmation prompt
    mockPromptConfirmation.mockResolvedValueOnce(false);

    await expect(
      program.parseAsync([
        "node",
        "test",
        "spawn",
        "test-project",
        "--story",
        "1-2-story-aware-agent-spawning",
      ]),
    ).rejects.toThrow("process.exit");

    const output = consoleSpy.mock.calls.map((c) => String(c[0])).join("\n");
    expect(output).toContain("Unresolved Dependencies");
    expect(output).toContain("1-1-sprint-plan-cli");
  });

  it("skips conflict check with --force flag", async () => {
    setupFixtures();

    await program.parseAsync([
      "node",
      "test",
      "spawn",
      "test-project",
      "--story",
      "1-2-story-aware-agent-spawning",
      "--force",
    ]);

    // Should spawn successfully despite any conflicts
    expect(mockSpawnFn).toHaveBeenCalledOnce();
  });
});

describe("ao spawn --story input validation", () => {
  it("rejects story IDs with path traversal characters", async () => {
    await expect(
      program.parseAsync(["node", "test", "spawn", "test-project", "--story", "../../etc/passwd"]),
    ).rejects.toThrow("process.exit(1)");

    const errorOutput = consoleErrorSpy.mock.calls.map((c) => String(c[0])).join("\n");
    expect(errorOutput).toContain("Invalid story ID");
  });
});

describe("ao spawn without --story (backward compatibility)", () => {
  it("spawns normally with just project and issue", async () => {
    await program.parseAsync(["node", "test", "spawn", "test-project", "ISSUE-42"]);

    expect(mockSpawnFn).toHaveBeenCalledOnce();
    const spawnArg = mockSpawnFn.mock.calls[0][0] as Record<string, unknown>;
    expect(spawnArg.projectId).toBe("test-project");
    expect(spawnArg.issueId).toBe("ISSUE-42");
    expect(spawnArg.storyContext).toBeUndefined();
  });

  it("spawns normally with just project (no issue)", async () => {
    await program.parseAsync(["node", "test", "spawn", "test-project"]);

    expect(mockSpawnFn).toHaveBeenCalledOnce();
    const spawnArg = mockSpawnFn.mock.calls[0][0] as Record<string, unknown>;
    expect(spawnArg.projectId).toBe("test-project");
    expect(spawnArg.issueId).toBeUndefined();
  });
});
