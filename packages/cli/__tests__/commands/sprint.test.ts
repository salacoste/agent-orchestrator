import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import type { Issue, Session, SessionManager } from "@composio/ao-core";

const { mockConfigRef, mockListIssues, mockGetTracker, mockSessionManager } = vi.hoisted(() => ({
  mockConfigRef: { current: null as Record<string, unknown> | null },
  mockListIssues: vi.fn(),
  mockGetTracker: vi.fn(),
  mockSessionManager: {
    list: vi.fn(),
    kill: vi.fn(),
    cleanup: vi.fn(),
    get: vi.fn(),
    spawn: vi.fn(),
    spawnOrchestrator: vi.fn(),
    send: vi.fn(),
  },
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

vi.mock("../../src/lib/create-session-manager.js", () => ({
  getSessionManager: async (): Promise<SessionManager> => mockSessionManager as SessionManager,
}));

vi.mock("@composio/ao-plugin-tracker-bmad", () => ({
  getBmadStatus: (labels: string[]): string => {
    if (labels.length === 0) return "backlog";
    const last = labels[labels.length - 1];
    return last ? last.toLowerCase() : "backlog";
  },
}));

let tmpDir: string;

import { Command } from "commander";
import { registerSprint } from "../../src/commands/sprint.js";

let program: Command;
let consoleSpy: ReturnType<typeof vi.spyOn>;
let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

function makeIssue(partial: Partial<Issue> & { id: string; title: string }): Issue {
  return {
    id: partial.id,
    title: partial.title,
    description: partial.description ?? "",
    url: partial.url ?? `https://example.com/issues/${partial.id}`,
    state: partial.state ?? "open",
    labels: partial.labels ?? [],
    assignee: partial.assignee,
    priority: partial.priority,
  };
}

function makeSession(partial: Partial<Session> & { id: string; projectId: string }): Session {
  return {
    id: partial.id,
    projectId: partial.projectId,
    status: partial.status ?? "working",
    activity: partial.activity ?? null,
    branch: partial.branch ?? null,
    issueId: partial.issueId ?? null,
    pr: partial.pr ?? null,
    workspacePath: partial.workspacePath ?? null,
    runtimeHandle: partial.runtimeHandle ?? { id: partial.id, runtimeName: "tmux", data: {} },
    agentInfo: partial.agentInfo ?? null,
    createdAt: partial.createdAt ?? new Date(),
    lastActivityAt: partial.lastActivityAt ?? new Date(),
    metadata: partial.metadata ?? {},
  };
}

function makeTracker(listIssues = mockListIssues): {
  name: string;
  listIssues: typeof mockListIssues;
} {
  return { name: "bmad", listIssues };
}

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), "ao-sprint-test-"));

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

  mockGetTracker.mockReturnValue(makeTracker());
  mockListIssues.mockResolvedValue([]);
  mockSessionManager.list.mockResolvedValue([]);

  program = new Command();
  program.exitOverride();
  registerSprint(program);

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

describe("sprint command", () => {
  it("lists issues grouped by status columns", async () => {
    const issues: Issue[] = [
      makeIssue({ id: "1", title: "Do the thing", state: "open", labels: ["epic-1", "backlog"] }),
      makeIssue({
        id: "2",
        title: "Review PR",
        state: "in_progress",
        labels: ["epic-1", "in-progress"],
      }),
      makeIssue({ id: "3", title: "Ship feature", state: "closed", labels: ["epic-1", "done"] }),
    ];
    mockListIssues.mockResolvedValue(issues);

    await program.parseAsync(["node", "test", "sprint"]);

    expect(mockListIssues).toHaveBeenCalledWith(
      expect.objectContaining({ state: "all" }),
      expect.anything(),
    );

    const output = consoleSpy.mock.calls.map((c) => String(c[0])).join("\n");
    expect(output).toContain("Sprint Progress");
    expect(output).toContain("Do the thing");
    expect(output).toContain("Review PR");
    expect(output).toContain("Ship feature");
  });

  it("shows only column counts in --compact mode", async () => {
    const issues: Issue[] = [
      makeIssue({ id: "1", title: "Story A", state: "open", labels: ["epic-1", "backlog"] }),
      makeIssue({ id: "2", title: "Story B", state: "open", labels: ["epic-1", "ready-for-dev"] }),
    ];
    mockListIssues.mockResolvedValue(issues);

    await program.parseAsync(["node", "test", "sprint", "--compact"]);

    const output = consoleSpy.mock.calls.map((c) => String(c[0])).join("\n");
    // In compact mode, issue titles should not appear in per-story lines
    // but column names should still appear
    expect(output).toContain("backlog");
    expect(output).toContain("ready-for-dev");
    // Stories should not be listed individually in compact mode
    expect(output).not.toContain("Story A");
    expect(output).not.toContain("Story B");
  });

  it("outputs valid JSON with --json flag", async () => {
    const issues: Issue[] = [
      makeIssue({ id: "1", title: "Backlog item", state: "open", labels: ["epic-1", "backlog"] }),
    ];
    mockListIssues.mockResolvedValue(issues);

    await program.parseAsync(["node", "test", "sprint", "--json"]);

    const output = consoleSpy.mock.calls.map((c) => String(c[0])).join("");
    const parsed = JSON.parse(output) as {
      projectId: string;
      totalStories: number;
      doneCount: number;
      inProgressCount: number;
      openCount: number;
      columns: Record<string, unknown[]>;
    };
    expect(parsed.projectId).toBe("my-app");
    expect(parsed.totalStories).toBe(1);
    expect(parsed.doneCount).toBe(0);
    expect(parsed.inProgressCount).toBe(0);
    expect(parsed.openCount).toBe(1);
    expect(parsed.columns).toHaveProperty("backlog");
    expect(parsed.columns["backlog"]).toHaveLength(1);
  });

  it("handles missing tracker gracefully", async () => {
    mockGetTracker.mockReturnValue(null);

    await expect(program.parseAsync(["node", "test", "sprint"])).rejects.toThrow("process.exit(1)");

    const errorOutput = consoleErrorSpy.mock.calls.map((c) => String(c[0])).join("\n");
    expect(errorOutput).toMatch(/No tracker configured/);
  });

  it("handles empty issue list", async () => {
    mockListIssues.mockResolvedValue([]);

    await program.parseAsync(["node", "test", "sprint"]);

    const output = consoleSpy.mock.calls.map((c) => String(c[0])).join("\n");
    expect(output).toContain("Sprint Progress");
    // All columns should show 0 count
    expect(output).toContain("(0)");
  });

  it("handles tracker without listIssues support", async () => {
    mockGetTracker.mockReturnValue({ name: "custom" });

    await expect(program.parseAsync(["node", "test", "sprint"])).rejects.toThrow("process.exit(1)");

    const errorOutput = consoleErrorSpy.mock.calls.map((c) => String(c[0])).join("\n");
    expect(errorOutput).toMatch(/does not support listing issues/);
  });

  it("cross-references active sessions for story rows", async () => {
    const issues: Issue[] = [
      makeIssue({
        id: "42",
        title: "My story",
        state: "in_progress",
        labels: ["epic-1", "in-progress"],
      }),
    ];
    mockListIssues.mockResolvedValue(issues);

    const sessions: Session[] = [
      makeSession({ id: "app-1", projectId: "my-app", issueId: "42", status: "working" }),
    ];
    mockSessionManager.list.mockResolvedValue(sessions);

    await program.parseAsync(["node", "test", "sprint"]);

    const output = consoleSpy.mock.calls.map((c) => String(c[0])).join("\n");
    expect(output).toContain("My story");
    expect(output).toContain("app-1");
  });

  it("shows progress bar in output", async () => {
    const issues: Issue[] = [
      makeIssue({ id: "1", title: "Done story", state: "closed", labels: ["epic-1", "done"] }),
    ];
    mockListIssues.mockResolvedValue(issues);

    await program.parseAsync(["node", "test", "sprint"]);

    const output = consoleSpy.mock.calls.map((c) => String(c[0])).join("\n");
    // Progress bar characters
    expect(output).toMatch(/\[.*\]/);
    expect(output).toMatch(/1\/1/);
  });

  it("handles listIssues failure with user-friendly message", async () => {
    mockListIssues.mockRejectedValue(new Error("sprint-status.yaml not found"));

    await expect(program.parseAsync(["node", "test", "sprint"])).rejects.toThrow("process.exit(1)");

    const errorOutput = consoleErrorSpy.mock.calls.map((c) => String(c[0])).join("\n");
    expect(errorOutput).toMatch(/Failed to list issues/);
    expect(errorOutput).toContain("sprint-status.yaml not found");
  });

  it("places stories with unknown BMad status into backlog column", async () => {
    const issues: Issue[] = [
      makeIssue({
        id: "1",
        title: "Custom status story",
        state: "open",
        labels: ["epic-1", "custom-wip"],
      }),
    ];
    mockListIssues.mockResolvedValue(issues);

    await program.parseAsync(["node", "test", "sprint", "--json"]);

    const output = consoleSpy.mock.calls.map((c) => String(c[0])).join("");
    const parsed = JSON.parse(output) as {
      columns: Record<string, Array<{ id: string }>>;
    };
    expect(parsed.columns["backlog"]).toHaveLength(1);
    expect(parsed.columns["backlog"][0].id).toBe("1");
  });

  it("handles session manager failure gracefully and still shows stories", async () => {
    const issues: Issue[] = [
      makeIssue({ id: "1", title: "A story", state: "open", labels: ["backlog"] }),
    ];
    mockListIssues.mockResolvedValue(issues);
    mockSessionManager.list.mockRejectedValue(new Error("session manager unavailable"));

    // Should not throw — session lookup is non-critical
    await program.parseAsync(["node", "test", "sprint"]);

    const output = consoleSpy.mock.calls.map((c) => String(c[0])).join("\n");
    expect(output).toContain("A story");
  });
});
