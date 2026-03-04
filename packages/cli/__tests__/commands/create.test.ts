import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

const { mockConfigRef, mockGetTracker } = vi.hoisted(() => ({
  mockConfigRef: { current: null as Record<string, unknown> | null },
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
import { registerCreate } from "../../src/commands/create.js";

let program: Command;
let consoleSpy: ReturnType<typeof vi.spyOn>;
let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), "ao-create-test-"));

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

  const mockCreateIssue = vi.fn().mockResolvedValue({
    id: "s5",
    title: "New Feature",
    description: "# New Feature\n",
    url: "file:///test/story-s5.md",
    state: "open",
    labels: ["backlog"],
  });

  mockGetTracker.mockReturnValue({
    name: "bmad",
    createIssue: mockCreateIssue,
  });

  program = new Command();
  program.exitOverride();
  registerCreate(program);

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

describe("create command", () => {
  it("creates a story with title", async () => {
    await program.parseAsync(["node", "test", "create", "-t", "New Feature"]);

    const output = consoleSpy.mock.calls.map((c) => String(c[0])).join("\n");
    expect(output).toContain("Story Created");
    expect(output).toContain("s5");
    expect(output).toContain("New Feature");
  });

  it("passes epic label to createIssue", async () => {
    const mockCreateIssue = vi.fn().mockResolvedValue({
      id: "s5",
      title: "Auth Feature",
      description: "",
      url: "file:///test/story-s5.md",
      state: "open",
      labels: ["epic-auth", "backlog"],
    });

    mockGetTracker.mockReturnValue({
      name: "bmad",
      createIssue: mockCreateIssue,
    });

    await program.parseAsync(["node", "test", "create", "-t", "Auth Feature", "-e", "epic-auth"]);

    expect(mockCreateIssue).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Auth Feature",
        labels: ["epic-auth"],
      }),
      expect.anything(),
    );

    const output = consoleSpy.mock.calls.map((c) => String(c[0])).join("\n");
    expect(output).toContain("epic-auth");
  });

  it("outputs valid JSON with --json flag", async () => {
    await program.parseAsync(["node", "test", "create", "-t", "New Feature", "--json"]);

    const output = consoleSpy.mock.calls.map((c) => String(c[0])).join("");
    const parsed = JSON.parse(output) as { id: string; title: string };
    expect(parsed.id).toBe("s5");
    expect(parsed.title).toBe("New Feature");
  });

  it("handles non-bmad tracker", async () => {
    mockGetTracker.mockReturnValue({ name: "github" });

    await expect(program.parseAsync(["node", "test", "create", "-t", "Feature"])).rejects.toThrow(
      "process.exit(1)",
    );

    const errorOutput = consoleErrorSpy.mock.calls.map((c) => String(c[0])).join("\n");
    expect(errorOutput).toMatch(/bmad tracker/);
  });

  it("handles createIssue failure", async () => {
    mockGetTracker.mockReturnValue({
      name: "bmad",
      createIssue: vi.fn().mockRejectedValue(new Error("YAML write failed")),
    });

    await expect(program.parseAsync(["node", "test", "create", "-t", "Feature"])).rejects.toThrow(
      "process.exit(1)",
    );

    const errorOutput = consoleErrorSpy.mock.calls.map((c) => String(c[0])).join("\n");
    expect(errorOutput).toContain("YAML write failed");
  });
});
