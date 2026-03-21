import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import type { Issue } from "@composio/ao-core";

const { mockConfigRef, mockListIssues, mockGetTracker } = vi.hoisted(() => ({
  mockConfigRef: { current: null as Record<string, unknown> | null },
  mockListIssues: vi.fn(),
  mockGetTracker: vi.fn(),
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

let tmpDir: string;

import { Command } from "commander";
import { registerEpic } from "../../src/commands/epic.js";

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

function makeTracker(
  listIssues = mockListIssues,
  getEpicTitle?: (epicId: string) => string,
): {
  name: string;
  listIssues: typeof mockListIssues;
  getEpicTitle?: (epicId: string) => string;
} {
  return { name: "bmad", listIssues, ...(getEpicTitle ? { getEpicTitle } : {}) };
}

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), "ao-epic-test-"));

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

  mockGetTracker.mockReturnValue(makeTracker());
  mockListIssues.mockResolvedValue([]);

  program = new Command();
  program.exitOverride();
  registerEpic(program);

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

describe("epic command", () => {
  it("lists all epics with progress summaries", async () => {
    const issues: Issue[] = [
      makeIssue({ id: "S-1", title: "Auth story 1", state: "open", labels: ["epic-auth"] }),
      makeIssue({ id: "S-2", title: "Auth story 2", state: "closed", labels: ["epic-auth"] }),
      makeIssue({ id: "S-3", title: "UI story 1", state: "in_progress", labels: ["epic-ui"] }),
    ];
    mockListIssues.mockResolvedValue(issues);

    await program.parseAsync(["node", "test", "epic"]);

    expect(mockListIssues).toHaveBeenCalledWith(
      expect.objectContaining({ state: "all", limit: 200 }),
      expect.anything(),
    );

    const output = consoleSpy.mock.calls.map((c) => String(c[0])).join("\n");
    expect(output).toContain("Epic Progress");
    expect(output).toContain("epic-auth");
    expect(output).toContain("epic-ui");
  });

  it("shows per-epic done counts and totals", async () => {
    const issues: Issue[] = [
      makeIssue({ id: "S-1", title: "Story A", state: "open", labels: ["epic-core"] }),
      makeIssue({ id: "S-2", title: "Story B", state: "closed", labels: ["epic-core"] }),
      makeIssue({ id: "S-3", title: "Story C", state: "closed", labels: ["epic-core"] }),
    ];
    mockListIssues.mockResolvedValue(issues);

    await program.parseAsync(["node", "test", "epic"]);

    const output = consoleSpy.mock.calls.map((c) => String(c[0])).join("\n");
    // 2 done out of 3 stories
    expect(output).toMatch(/2\/3/);
  });

  it("outputs valid JSON with --json flag", async () => {
    const issues: Issue[] = [
      makeIssue({ id: "S-1", title: "Story 1", state: "open", labels: ["epic-a"] }),
      makeIssue({ id: "S-2", title: "Story 2", state: "closed", labels: ["epic-a"] }),
    ];
    mockListIssues.mockResolvedValue(issues);

    await program.parseAsync(["node", "test", "epic", "--json"]);

    const output = consoleSpy.mock.calls.map((c) => String(c[0])).join("");
    const parsed = JSON.parse(output) as Array<{
      id: string;
      title: string;
      open: number;
      inProgress: number;
      done: number;
      total: number;
      stories: unknown[];
    }>;
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].id).toBe("epic-a");
    expect(parsed[0].open).toBe(1);
    expect(parsed[0].done).toBe(1);
    expect(parsed[0].total).toBe(2);
    expect(parsed[0].stories).toHaveLength(2);
  });

  it("handles missing tracker gracefully", async () => {
    mockGetTracker.mockReturnValue(null);

    await expect(program.parseAsync(["node", "test", "epic"])).rejects.toThrow("process.exit(1)");

    const errorOutput = consoleErrorSpy.mock.calls.map((c) => String(c[0])).join("\n");
    expect(errorOutput).toMatch(/No tracker configured/);
  });

  it("handles empty issue list", async () => {
    mockListIssues.mockResolvedValue([]);

    await program.parseAsync(["node", "test", "epic"]);

    const output = consoleSpy.mock.calls.map((c) => String(c[0])).join("\n");
    expect(output).toContain("no epics found");
  });

  it("handles tracker without listIssues support", async () => {
    mockGetTracker.mockReturnValue({ name: "custom" });

    await expect(program.parseAsync(["node", "test", "epic"])).rejects.toThrow("process.exit(1)");

    const errorOutput = consoleErrorSpy.mock.calls.map((c) => String(c[0])).join("\n");
    expect(errorOutput).toMatch(/does not support listing issues/);
  });

  it("shows single epic detail when epic-id is provided", async () => {
    const issues: Issue[] = [
      makeIssue({ id: "S-1", title: "Epic A story 1", state: "open", labels: ["epic-a"] }),
      makeIssue({ id: "S-2", title: "Epic A story 2", state: "closed", labels: ["epic-a"] }),
      makeIssue({ id: "S-3", title: "Epic B story 1", state: "open", labels: ["epic-b"] }),
    ];
    mockListIssues.mockResolvedValue(issues);

    await program.parseAsync(["node", "test", "epic", "my-app", "epic-a"]);

    const output = consoleSpy.mock.calls.map((c) => String(c[0])).join("\n");
    expect(output).toContain("epic-a");
    expect(output).toContain("Epic A story 1");
    expect(output).toContain("Epic A story 2");
    // Should not show epic-b stories
    expect(output).not.toContain("Epic B story 1");
  });

  it("outputs JSON for a specific epic with --json and epic-id", async () => {
    const issues: Issue[] = [
      makeIssue({ id: "S-1", title: "Story in epic-x", state: "open", labels: ["epic-x"] }),
    ];
    mockListIssues.mockResolvedValue(issues);

    await program.parseAsync(["node", "test", "epic", "my-app", "epic-x", "--json"]);

    const output = consoleSpy.mock.calls.map((c) => String(c[0])).join("");
    const parsed = JSON.parse(output) as {
      id: string;
      title: string;
      open: number;
      done: number;
      stories: unknown[];
    };
    expect(parsed).not.toBeNull();
    expect(parsed.id).toBe("epic-x");
    expect(parsed.open).toBe(1);
    expect(parsed.done).toBe(0);
  });

  it("uses epicId as title when tracker lacks getEpicTitle", async () => {
    // Tracker without getEpicTitle — should fall back to raw epicId
    mockGetTracker.mockReturnValue({ name: "github", listIssues: mockListIssues });

    const issues: Issue[] = [
      makeIssue({ id: "S-1", title: "Story 1", state: "open", labels: ["epic-auth"] }),
      makeIssue({ id: "S-2", title: "Story 2", state: "closed", labels: ["epic-auth"] }),
    ];
    mockListIssues.mockResolvedValue(issues);

    await program.parseAsync(["node", "test", "epic", "--json"]);

    const output = consoleSpy.mock.calls.map((c) => String(c[0])).join("");
    const parsed = JSON.parse(output) as Array<{ id: string; title: string }>;
    expect(parsed).toHaveLength(1);
    // Without getEpicTitle, title should be the raw epicId
    expect(parsed[0].title).toBe("epic-auth");
  });

  it("uses getEpicTitle from tracker when available", async () => {
    mockGetTracker.mockReturnValue(
      makeTracker(mockListIssues, (epicId: string) => `Resolved: ${epicId}`),
    );

    const issues: Issue[] = [
      makeIssue({ id: "S-1", title: "Story 1", state: "open", labels: ["epic-auth"] }),
    ];
    mockListIssues.mockResolvedValue(issues);

    await program.parseAsync(["node", "test", "epic", "--json"]);

    const output = consoleSpy.mock.calls.map((c) => String(c[0])).join("");
    const parsed = JSON.parse(output) as Array<{ id: string; title: string }>;
    expect(parsed).toHaveLength(1);
    expect(parsed[0].title).toBe("Resolved: epic-auth");
  });

  it("handles listIssues failure with user-friendly message", async () => {
    mockListIssues.mockRejectedValue(new Error("sprint-status.yaml not found"));

    await expect(program.parseAsync(["node", "test", "epic"])).rejects.toThrow("process.exit(1)");

    const errorOutput = consoleErrorSpy.mock.calls.map((c) => String(c[0])).join("\n");
    expect(errorOutput).toMatch(/Failed to list stories/);
    expect(errorOutput).toContain("sprint-status.yaml not found");
  });

  it("exits with error when epic-id is not found in --json mode", async () => {
    const issues: Issue[] = [
      makeIssue({ id: "S-1", title: "Story", state: "open", labels: ["epic-real"] }),
    ];
    mockListIssues.mockResolvedValue(issues);

    await expect(
      program.parseAsync(["node", "test", "epic", "my-app", "epic-missing", "--json"]),
    ).rejects.toThrow("process.exit(1)");

    const errorOutput = consoleErrorSpy.mock.calls.map((c) => String(c[0])).join("");
    const parsed = JSON.parse(errorOutput) as { error: string };
    expect(parsed.error).toMatch(/Epic not found: epic-missing/);
  });

  it("exits with error when epic-id is not found", async () => {
    const issues: Issue[] = [
      makeIssue({ id: "S-1", title: "Story", state: "open", labels: ["epic-real"] }),
    ];
    mockListIssues.mockResolvedValue(issues);

    await expect(
      program.parseAsync(["node", "test", "epic", "my-app", "epic-missing"]),
    ).rejects.toThrow("process.exit(1)");

    const errorOutput = consoleErrorSpy.mock.calls.map((c) => String(c[0])).join("\n");
    expect(errorOutput).toMatch(/Epic not found/);
  });
});
