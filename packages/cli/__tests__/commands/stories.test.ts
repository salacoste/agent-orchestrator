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
import { registerStories } from "../../src/commands/stories.js";

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

function makeTracker(listIssues = mockListIssues): {
  name: string;
  listIssues: typeof mockListIssues;
} {
  return { name: "bmad", listIssues };
}

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), "ao-stories-test-"));

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

  program = new Command();
  program.exitOverride();
  registerStories(program);

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

describe("stories command", () => {
  it("lists issues with default open state filter", async () => {
    const issues: Issue[] = [
      makeIssue({ id: "S-1", title: "Fix login bug", state: "open", labels: ["epic-auth"] }),
      makeIssue({ id: "S-2", title: "Add dashboard", state: "open", labels: ["epic-ui"] }),
    ];
    mockListIssues.mockResolvedValue(issues);

    await program.parseAsync(["node", "test", "stories"]);

    expect(mockListIssues).toHaveBeenCalledWith(
      expect.objectContaining({ state: "open" }),
      expect.anything(),
    );

    const output = consoleSpy.mock.calls.map((c) => String(c[0])).join("\n");
    expect(output).toContain("S-1");
    expect(output).toContain("Fix login bug");
    expect(output).toContain("S-2");
    expect(output).toContain("Add dashboard");
  });

  it("filters by --state closed", async () => {
    const issues: Issue[] = [
      makeIssue({ id: "S-3", title: "Old story", state: "closed", labels: [] }),
    ];
    mockListIssues.mockResolvedValue(issues);

    await program.parseAsync(["node", "test", "stories", "--state", "closed"]);

    expect(mockListIssues).toHaveBeenCalledWith(
      expect.objectContaining({ state: "closed" }),
      expect.anything(),
    );
  });

  it("filters by --epic label", async () => {
    const issues: Issue[] = [
      makeIssue({ id: "S-4", title: "Epic story", state: "open", labels: ["epic-auth"] }),
    ];
    mockListIssues.mockResolvedValue(issues);

    await program.parseAsync(["node", "test", "stories", "--epic", "epic-auth"]);

    expect(mockListIssues).toHaveBeenCalledWith(
      expect.objectContaining({ labels: ["epic-auth"] }),
      expect.anything(),
    );
  });

  it("outputs valid JSON with --json flag", async () => {
    const issues: Issue[] = [
      makeIssue({ id: "S-5", title: "JSON story", state: "open", labels: ["epic-core"] }),
    ];
    mockListIssues.mockResolvedValue(issues);

    await program.parseAsync(["node", "test", "stories", "--json"]);

    const output = consoleSpy.mock.calls.map((c) => String(c[0])).join("");
    const parsed: unknown = JSON.parse(output);
    expect(Array.isArray(parsed)).toBe(true);
    expect((parsed as Issue[])[0]).toMatchObject({ id: "S-5", title: "JSON story" });
  });

  it("handles missing tracker gracefully", async () => {
    mockGetTracker.mockReturnValue(null);

    await expect(program.parseAsync(["node", "test", "stories"])).rejects.toThrow(
      "process.exit(1)",
    );

    const errorOutput = consoleErrorSpy.mock.calls.map((c) => String(c[0])).join("\n");
    expect(errorOutput).toMatch(/No tracker configured/);
  });

  it("handles empty issue list", async () => {
    mockListIssues.mockResolvedValue([]);

    await program.parseAsync(["node", "test", "stories"]);

    const output = consoleSpy.mock.calls.map((c) => String(c[0])).join("\n");
    expect(output).toContain("no stories found");
  });

  it("handles tracker without listIssues support", async () => {
    mockGetTracker.mockReturnValue({ name: "custom" });

    await expect(program.parseAsync(["node", "test", "stories"])).rejects.toThrow(
      "process.exit(1)",
    );

    const errorOutput = consoleErrorSpy.mock.calls.map((c) => String(c[0])).join("\n");
    expect(errorOutput).toMatch(/does not support listing issues/);
  });

  it("handles listIssues failure gracefully", async () => {
    mockListIssues.mockRejectedValue(new Error("tracker API unavailable"));

    await expect(program.parseAsync(["node", "test", "stories"])).rejects.toThrow(
      "process.exit(1)",
    );

    const errorOutput = consoleErrorSpy.mock.calls.map((c) => String(c[0])).join("\n");
    expect(errorOutput).toMatch(/Failed to list stories/);
  });

  it("groups stories by epic in table output", async () => {
    const issues: Issue[] = [
      makeIssue({ id: "S-10", title: "Auth story 1", state: "open", labels: ["epic-auth"] }),
      makeIssue({ id: "S-11", title: "UI story 1", state: "open", labels: ["epic-ui"] }),
      makeIssue({ id: "S-12", title: "Auth story 2", state: "open", labels: ["epic-auth"] }),
    ];
    mockListIssues.mockResolvedValue(issues);

    await program.parseAsync(["node", "test", "stories"]);

    const output = consoleSpy.mock.calls.map((c) => String(c[0])).join("\n");
    expect(output).toContain("S-10");
    expect(output).toContain("S-11");
    expect(output).toContain("S-12");
  });

  it("shows dash for epic when story has no epic label", async () => {
    // BMad tracker returns [status] when no epic, [epic, status] when epic exists
    const issues: Issue[] = [
      makeIssue({
        id: "S-20",
        title: "Story with epic",
        state: "open",
        labels: ["epic-auth", "in-progress"],
      }),
      makeIssue({
        id: "S-21",
        title: "Story without epic",
        state: "open",
        labels: ["backlog"],
      }),
    ];
    mockListIssues.mockResolvedValue(issues);

    await program.parseAsync(["node", "test", "stories"]);

    const output = consoleSpy.mock.calls.map((c) => String(c[0])).join("\n");
    // Story with epic should show epic-auth
    expect(output).toContain("epic-auth");
    // Story without epic should NOT show "backlog" as the epic column
    // (that's the status, not an epic)
    const lines = output.split("\n");
    const s21Line = lines.find((l) => l.includes("S-21"));
    expect(s21Line).toBeDefined();
    // The epic column for S-21 should show "-" not "backlog"
    expect(s21Line).not.toContain("epic-");
  });
});
