import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

const {
  mockConfigRef,
  mockGetTracker,
  mockReadSprintStatus,
  mockWriteStoryStatus,
  mockAppendHistory,
  mockCheckWipLimit,
  mockValidateDependencies,
  mockBatchWriteStoryStatus,
} = vi.hoisted(() => ({
  mockConfigRef: { current: null as Record<string, unknown> | null },
  mockGetTracker: vi.fn(),
  mockReadSprintStatus: vi.fn(),
  mockWriteStoryStatus: vi.fn(),
  mockAppendHistory: vi.fn(),
  mockCheckWipLimit: vi.fn(),
  mockValidateDependencies: vi.fn(),
  mockBatchWriteStoryStatus: vi.fn(),
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
  readSprintStatus: mockReadSprintStatus,
  writeStoryStatus: mockWriteStoryStatus,
  appendHistory: mockAppendHistory,
  batchWriteStoryStatus: mockBatchWriteStoryStatus,
  BMAD_COLUMNS: ["backlog", "ready-for-dev", "in-progress", "review", "done"],
  checkWipLimit: mockCheckWipLimit,
  validateDependencies: mockValidateDependencies,
  isValidColumn: (_project: unknown, col: string) =>
    ["backlog", "ready-for-dev", "in-progress", "review", "done"].includes(col),
  getColumns: () => ["backlog", "ready-for-dev", "in-progress", "review", "done"],
}));

let tmpDir: string;

import { Command } from "commander";
import { registerMove } from "../../src/commands/move.js";

let program: Command;
let consoleSpy: ReturnType<typeof vi.spyOn>;
let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), "ao-move-test-"));

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

  mockGetTracker.mockReturnValue({ name: "bmad" });
  mockReadSprintStatus.mockReturnValue({
    development_status: {
      s1: { status: "backlog", epic: "epic-1" },
      s2: { status: "in-progress", epic: "epic-1" },
      s3: { status: "done", epic: "epic-2" },
      s4: { status: "backlog", epic: "epic-2" },
    },
  });
  mockCheckWipLimit.mockReturnValue({ allowed: true, current: 1, limit: 5 });
  mockValidateDependencies.mockReturnValue({ blocked: false, blockers: [], warnings: [] });
  mockWriteStoryStatus.mockImplementation(() => {});
  mockAppendHistory.mockImplementation(() => {});
  mockBatchWriteStoryStatus.mockImplementation(
    (_project: unknown, updates: Array<{ storyId: string }>) => updates.map((u) => u.storyId),
  );

  program = new Command();
  program.exitOverride();
  registerMove(program);

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

describe("move command", () => {
  it("moves a story to a new column", async () => {
    await program.parseAsync(["node", "test", "move", "s1", "in-progress"]);

    expect(mockWriteStoryStatus).toHaveBeenCalledWith(
      expect.objectContaining({ name: "My App" }),
      "s1",
      "in-progress",
    );
    expect(mockAppendHistory).toHaveBeenCalledWith(
      expect.objectContaining({ name: "My App" }),
      "s1",
      "backlog",
      "in-progress",
    );
    const output = consoleSpy.mock.calls.map((c) => String(c[0])).join("\n");
    expect(output).toContain("Story Moved");
  });

  it("outputs JSON with --json flag", async () => {
    await program.parseAsync(["node", "test", "move", "s1", "ready-for-dev", "--json"]);

    const output = consoleSpy.mock.calls.map((c) => String(c[0])).join("");
    const parsed = JSON.parse(output) as {
      storyId: string;
      from: string;
      to: string;
      moved: boolean;
    };
    expect(parsed.storyId).toBe("s1");
    expect(parsed.from).toBe("backlog");
    expect(parsed.to).toBe("ready-for-dev");
    expect(parsed.moved).toBe(true);
  });

  it("rejects invalid column", async () => {
    await expect(program.parseAsync(["node", "test", "move", "s1", "invalid-col"])).rejects.toThrow(
      "process.exit(1)",
    );

    const errorOutput = consoleErrorSpy.mock.calls.map((c) => String(c[0])).join("\n");
    expect(errorOutput).toMatch(/Invalid column/);
  });

  it("rejects unknown story", async () => {
    await expect(
      program.parseAsync(["node", "test", "move", "nonexistent", "done"]),
    ).rejects.toThrow("process.exit(1)");

    const errorOutput = consoleErrorSpy.mock.calls.map((c) => String(c[0])).join("\n");
    expect(errorOutput).toMatch(/not found/);
  });

  it("warns if already in target column", async () => {
    await program.parseAsync(["node", "test", "move", "s1", "backlog"]);

    expect(mockWriteStoryStatus).not.toHaveBeenCalled();
    const output = consoleSpy.mock.calls.map((c) => String(c[0])).join("\n");
    expect(output).toMatch(/already in/);
  });

  it("blocks on WIP limit without --force", async () => {
    mockCheckWipLimit.mockReturnValue({ allowed: false, current: 5, limit: 5 });

    await expect(program.parseAsync(["node", "test", "move", "s1", "in-progress"])).rejects.toThrow(
      "process.exit(1)",
    );

    const errorOutput = consoleErrorSpy.mock.calls.map((c) => String(c[0])).join("\n");
    expect(errorOutput).toMatch(/WIP limit/);
  });

  it("allows move past WIP limit with --force", async () => {
    mockCheckWipLimit.mockReturnValue({ allowed: false, current: 5, limit: 5 });

    await program.parseAsync(["node", "test", "move", "s1", "in-progress", "--force"]);

    expect(mockWriteStoryStatus).toHaveBeenCalled();
  });

  it("shows dependency warnings but does not block", async () => {
    mockValidateDependencies.mockReturnValue({
      blocked: true,
      blockers: [{ id: "s0", status: "backlog" }],
      warnings: [],
    });

    await program.parseAsync(["node", "test", "move", "s1", "in-progress"]);

    expect(mockWriteStoryStatus).toHaveBeenCalled();
    const output = consoleSpy.mock.calls.map((c) => String(c[0])).join("\n");
    expect(output).toMatch(/Blocked by/);
  });

  it("handles non-bmad tracker", async () => {
    mockGetTracker.mockReturnValue({ name: "github" });

    await expect(program.parseAsync(["node", "test", "move", "s1", "done"])).rejects.toThrow(
      "process.exit(1)",
    );

    const errorOutput = consoleErrorSpy.mock.calls.map((c) => String(c[0])).join("\n");
    expect(errorOutput).toMatch(/bmad tracker/);
  });
});

describe("move command — batch mode", () => {
  it("batch moves stories from one column to another", async () => {
    await program.parseAsync([
      "node",
      "test",
      "move",
      "--from",
      "backlog",
      "--to",
      "ready-for-dev",
    ]);

    expect(mockBatchWriteStoryStatus).toHaveBeenCalledWith(
      expect.objectContaining({ name: "My App" }),
      expect.arrayContaining([
        { storyId: "s1", newStatus: "ready-for-dev" },
        { storyId: "s4", newStatus: "ready-for-dev" },
      ]),
    );
    const output = consoleSpy.mock.calls.map((c) => String(c[0])).join("\n");
    expect(output).toContain("Batch Move");
    expect(output).toContain("s1");
    expect(output).toContain("s4");
  });

  it("batch moves with --epic filter", async () => {
    await program.parseAsync([
      "node",
      "test",
      "move",
      "--from",
      "backlog",
      "--to",
      "ready-for-dev",
      "--epic",
      "epic-1",
    ]);

    expect(mockBatchWriteStoryStatus).toHaveBeenCalledWith(
      expect.objectContaining({ name: "My App" }),
      [{ storyId: "s1", newStatus: "ready-for-dev" }],
    );
  });

  it("batch move with --dry-run shows changes without applying", async () => {
    await program.parseAsync([
      "node",
      "test",
      "move",
      "--from",
      "backlog",
      "--to",
      "ready-for-dev",
      "--dry-run",
    ]);

    expect(mockBatchWriteStoryStatus).not.toHaveBeenCalled();
    const output = consoleSpy.mock.calls.map((c) => String(c[0])).join("\n");
    expect(output).toContain("dry-run");
    expect(output).toContain("s1");
  });

  it("batch move with --json outputs JSON", async () => {
    await program.parseAsync([
      "node",
      "test",
      "move",
      "--from",
      "backlog",
      "--to",
      "ready-for-dev",
      "--json",
    ]);

    const output = consoleSpy.mock.calls.map((c) => String(c[0])).join("");
    const parsed = JSON.parse(output) as { moved: string[]; count: number };
    expect(parsed.moved).toContain("s1");
    expect(parsed.moved).toContain("s4");
    expect(parsed.count).toBe(2);
  });

  it("batch move reports no stories when column is empty", async () => {
    await program.parseAsync(["node", "test", "move", "--from", "review", "--to", "done"]);

    expect(mockBatchWriteStoryStatus).not.toHaveBeenCalled();
    const output = consoleSpy.mock.calls.map((c) => String(c[0])).join("\n");
    expect(output).toContain("No stories found");
  });

  it("batch move rejects invalid --from column", async () => {
    await expect(
      program.parseAsync(["node", "test", "move", "--from", "bad-col", "--to", "done"]),
    ).rejects.toThrow("process.exit(1)");

    const errorOutput = consoleErrorSpy.mock.calls.map((c) => String(c[0])).join("\n");
    expect(errorOutput).toMatch(/Invalid --from column/);
  });

  it("batch move blocks on WIP limit without --force", async () => {
    mockCheckWipLimit.mockReturnValue({ allowed: false, current: 5, limit: 5 });

    await expect(
      program.parseAsync(["node", "test", "move", "--from", "backlog", "--to", "in-progress"]),
    ).rejects.toThrow("process.exit(1)");

    const errorOutput = consoleErrorSpy.mock.calls.map((c) => String(c[0])).join("\n");
    expect(errorOutput).toMatch(/WIP limit/);
  });

  it("batch move allows past WIP limit with --force", async () => {
    mockCheckWipLimit.mockReturnValue({ allowed: false, current: 5, limit: 5 });

    await program.parseAsync([
      "node",
      "test",
      "move",
      "--from",
      "backlog",
      "--to",
      "in-progress",
      "--force",
    ]);

    expect(mockBatchWriteStoryStatus).toHaveBeenCalled();
  });
});
