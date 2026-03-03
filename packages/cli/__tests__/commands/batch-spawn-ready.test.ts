import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import type { Session, SessionManager } from "@composio/ao-core";

// ---------------------------------------------------------------------------
// Hoisted mocks — must be declared before any imports that use them
// ---------------------------------------------------------------------------

const { mockConfigRef, mockSessionManager, mockGetTracker } = vi.hoisted(() => ({
  mockConfigRef: { current: null as Record<string, unknown> | null },
  mockSessionManager: {
    list: vi.fn(),
    kill: vi.fn(),
    cleanup: vi.fn(),
    get: vi.fn(),
    spawn: vi.fn(),
    spawnOrchestrator: vi.fn(),
    send: vi.fn(),
  },
  mockGetTracker: vi.fn(),
}));

vi.mock("../../src/lib/shell.js", () => ({
  tmux: vi.fn(),
  exec: vi.fn(),
  execSilent: vi.fn(),
  git: vi.fn(),
  gh: vi.fn(),
  getTmuxSessions: vi.fn().mockResolvedValue([]),
  getTmuxActivity: vi.fn().mockResolvedValue(null),
}));

vi.mock("ora", () => ({
  default: () => ({
    start: vi.fn().mockReturnThis(),
    stop: vi.fn().mockReturnThis(),
    succeed: vi.fn().mockReturnThis(),
    fail: vi.fn().mockReturnThis(),
    text: "",
  }),
}));

vi.mock("@composio/ao-core", async (importOriginal) => {
  // eslint-disable-next-line @typescript-eslint/consistent-type-imports
  const actual = await importOriginal<typeof import("@composio/ao-core")>();
  return {
    ...actual,
    loadConfig: () => mockConfigRef.current,
  };
});

vi.mock("../../src/lib/create-session-manager.js", () => ({
  getSessionManager: async (): Promise<SessionManager> => mockSessionManager as SessionManager,
}));

vi.mock("../../src/lib/plugins.js", () => ({
  getTracker: mockGetTracker,
  getAgent: vi.fn(),
  getAgentByName: vi.fn(),
  getSCM: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Imports after mocks
// ---------------------------------------------------------------------------

import { Command } from "commander";
import { registerBatchSpawn } from "../../src/commands/spawn.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeSession(overrides: Partial<Session> = {}): Session {
  return {
    id: "app-1",
    projectId: "my-app",
    status: "working",
    activity: null,
    branch: null,
    issueId: null,
    pr: null,
    workspacePath: "/tmp/wt/app-1",
    runtimeHandle: { id: "hash-app-1", runtimeName: "tmux", data: {} },
    agentInfo: null,
    createdAt: new Date(),
    lastActivityAt: new Date(),
    metadata: {},
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Test setup
// ---------------------------------------------------------------------------

let tmpDir: string;
let program: Command;
let consoleSpy: ReturnType<typeof vi.spyOn>;
let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), "ao-batch-spawn-ready-"));
  const configPath = join(tmpDir, "agent-orchestrator.yaml");
  writeFileSync(configPath, "projects: {}");
  mkdirSync(join(tmpDir, "main-repo"), { recursive: true });

  mockConfigRef.current = {
    configPath,
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
        tracker: { plugin: "github" },
      },
    },
    notifiers: {},
    notificationRouting: {},
    reactions: {},
  } as Record<string, unknown>;

  program = new Command();
  program.exitOverride();
  registerBatchSpawn(program);

  consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
  consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(process, "exit").mockImplementation((code) => {
    throw new Error(`process.exit(${code})`);
  });

  mockSessionManager.list.mockResolvedValue([]);
  mockSessionManager.spawn.mockReset();
  mockGetTracker.mockReset();
});

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true });
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("batch-spawn --ready flag", () => {
  it("discovers ready stories from tracker and spawns sessions", async () => {
    const mockTracker = {
      name: "github",
      listIssues: vi.fn().mockResolvedValue([
        {
          id: "INT-10",
          title: "Ready story 1",
          description: "",
          url: "https://github.com/org/my-app/issues/10",
          state: "open",
          labels: ["ready-for-dev"],
        },
        {
          id: "INT-11",
          title: "Ready story 2",
          description: "",
          url: "https://github.com/org/my-app/issues/11",
          state: "open",
          labels: ["ready-for-dev"],
        },
      ]),
    };
    mockGetTracker.mockReturnValue(mockTracker);

    mockSessionManager.spawn
      .mockResolvedValueOnce(makeSession({ id: "app-1", issueId: "INT-10" }))
      .mockResolvedValueOnce(makeSession({ id: "app-2", issueId: "INT-11" }));

    await program.parseAsync(["node", "test", "batch-spawn", "my-app", "--ready"]);

    expect(mockTracker.listIssues).toHaveBeenCalledWith(
      { state: "open", labels: ["ready-for-dev"] },
      expect.objectContaining({ name: "My App" }),
    );

    expect(mockSessionManager.spawn).toHaveBeenCalledTimes(2);
    expect(mockSessionManager.spawn).toHaveBeenCalledWith(
      expect.objectContaining({ projectId: "my-app", issueId: "INT-10" }),
    );
    expect(mockSessionManager.spawn).toHaveBeenCalledWith(
      expect.objectContaining({ projectId: "my-app", issueId: "INT-11" }),
    );

    const output = consoleSpy.mock.calls.map((c) => String(c[0])).join("\n");
    expect(output).toContain("INT-10");
    expect(output).toContain("INT-11");
  });

  it("combines explicit issue IDs with --ready discovered issues (deduplicates)", async () => {
    const mockTracker = {
      name: "github",
      listIssues: vi.fn().mockResolvedValue([
        {
          id: "INT-10",
          title: "Ready story",
          description: "",
          url: "https://github.com/org/my-app/issues/10",
          state: "open",
          labels: ["ready-for-dev"],
        },
        {
          id: "INT-20",
          title: "Another ready story",
          description: "",
          url: "https://github.com/org/my-app/issues/20",
          state: "open",
          labels: ["ready-for-dev"],
        },
      ]),
    };
    mockGetTracker.mockReturnValue(mockTracker);

    // INT-10 is provided explicitly AND returned by --ready — should only spawn once
    mockSessionManager.spawn
      .mockResolvedValueOnce(makeSession({ id: "app-1", issueId: "INT-10" }))
      .mockResolvedValueOnce(makeSession({ id: "app-2", issueId: "INT-20" }));

    await program.parseAsync(["node", "test", "batch-spawn", "my-app", "INT-10", "--ready"]);

    // INT-10 once (explicit) + INT-20 once (from --ready, not a duplicate)
    expect(mockSessionManager.spawn).toHaveBeenCalledTimes(2);
    expect(mockSessionManager.spawn).toHaveBeenCalledWith(
      expect.objectContaining({ issueId: "INT-10" }),
    );
    expect(mockSessionManager.spawn).toHaveBeenCalledWith(
      expect.objectContaining({ issueId: "INT-20" }),
    );
  });

  it("exits with error when no tracker is configured and --ready is used", async () => {
    mockGetTracker.mockReturnValue(null);

    await expect(
      program.parseAsync(["node", "test", "batch-spawn", "my-app", "--ready"]),
    ).rejects.toThrow("process.exit(1)");

    const errOutput = consoleErrorSpy.mock.calls.map((c) => String(c[0])).join("\n");
    expect(errOutput).toContain("No tracker configured");
  });

  it("exits with error when tracker does not implement listIssues", async () => {
    const mockTracker = {
      name: "minimal-tracker",
      // listIssues intentionally omitted
    };
    mockGetTracker.mockReturnValue(mockTracker);

    await expect(
      program.parseAsync(["node", "test", "batch-spawn", "my-app", "--ready"]),
    ).rejects.toThrow("process.exit(1)");

    const errOutput = consoleErrorSpy.mock.calls.map((c) => String(c[0])).join("\n");
    expect(errOutput).toContain("does not support listing issues");
  });

  it("prints a warning and exits when no ready stories are found", async () => {
    const mockTracker = {
      name: "github",
      listIssues: vi.fn().mockResolvedValue([]),
    };
    mockGetTracker.mockReturnValue(mockTracker);

    await expect(
      program.parseAsync(["node", "test", "batch-spawn", "my-app", "--ready"]),
    ).rejects.toThrow("process.exit(1)");

    const output = consoleSpy.mock.calls.map((c) => String(c[0])).join("\n");
    expect(output).toContain("No ready-for-dev stories found");

    // Nothing should have been spawned
    expect(mockSessionManager.spawn).not.toHaveBeenCalled();
  });

  it("requires at least one issue when --ready is not set", async () => {
    // Without --ready and without explicit issues, commander will not error via
    // exitOverride for optional variadic args — the action runs with an empty array
    // and the command itself should exit with an error.
    await expect(program.parseAsync(["node", "test", "batch-spawn", "my-app"])).rejects.toThrow(
      "process.exit(1)",
    );

    const errOutput = consoleErrorSpy.mock.calls.map((c) => String(c[0])).join("\n");
    expect(errOutput).toContain("No issues to spawn");
  });
});
