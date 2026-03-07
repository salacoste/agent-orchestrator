import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import type { SprintNotification } from "@composio/ao-plugin-tracker-bmad";

const { mockConfigRef, mockGetTracker, mockCheckNotifications } = vi.hoisted(() => ({
  mockConfigRef: { current: null as Record<string, unknown> | null },
  mockGetTracker: vi.fn(),
  mockCheckNotifications: vi.fn(),
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
  checkSprintNotifications: mockCheckNotifications,
}));

let tmpDir: string;

import { Command } from "commander";
import { registerNotifications } from "../../src/commands/notifications.js";

let program: Command;
let consoleSpy: ReturnType<typeof vi.spyOn>;
let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), "ao-notif-test-"));

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

  mockGetTracker.mockReturnValue({ name: "bmad" });
  mockCheckNotifications.mockReturnValue([]);

  program = new Command();
  program.exitOverride();
  registerNotifications(program);

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

describe("notifications command", () => {
  it("displays no-notifications message when list is empty", async () => {
    await program.parseAsync(["node", "test", "notifications"]);

    const output = consoleSpy.mock.calls.map((c) => String(c[0])).join("\n");
    expect(output).toContain("No notifications");
  });

  it("renders notifications with severity", async () => {
    const notifications: SprintNotification[] = [
      {
        type: "sprint.health_warning",
        severity: "warning",
        title: "Sprint Health Warning: stuck-stories",
        message: "1 story stuck for >48h",
        details: ["s1"],
        timestamp: new Date().toISOString(),
      },
      {
        type: "sprint.health_critical",
        severity: "critical",
        title: "Sprint Health Critical: wip-alert",
        message: "WIP limit exceeded",
        details: ["in-progress"],
        timestamp: new Date().toISOString(),
      },
    ];
    mockCheckNotifications.mockReturnValue(notifications);

    await program.parseAsync(["node", "test", "notifications"]);

    const output = consoleSpy.mock.calls.map((c) => String(c[0])).join("\n");
    expect(output).toContain("WARNING");
    expect(output).toContain("CRITICAL");
    expect(output).toContain("stuck");
    expect(output).toContain("WIP");
  });

  it("outputs valid JSON with --json flag", async () => {
    const notifications: SprintNotification[] = [
      {
        type: "sprint.story_stuck",
        severity: "warning",
        title: "Stories Stuck",
        message: "1 story stuck",
        details: ["s1"],
        timestamp: "2026-01-15T00:00:00.000Z",
      },
    ];
    mockCheckNotifications.mockReturnValue(notifications);

    await program.parseAsync(["node", "test", "notifications", "--json"]);

    const output = consoleSpy.mock.calls.map((c) => String(c[0])).join("");
    const parsed = JSON.parse(output) as SprintNotification[];
    expect(parsed).toHaveLength(1);
    expect(parsed[0].type).toBe("sprint.story_stuck");
  });

  it("handles non-bmad tracker", async () => {
    mockGetTracker.mockReturnValue({ name: "github" });

    await expect(program.parseAsync(["node", "test", "notifications"])).rejects.toThrow(
      "process.exit(1)",
    );

    const errorOutput = consoleErrorSpy.mock.calls.map((c) => String(c[0])).join("\n");
    expect(errorOutput).toMatch(/bmad tracker/);
  });

  it("handles no tracker configured", async () => {
    mockGetTracker.mockReturnValue(null);

    await expect(program.parseAsync(["node", "test", "notifications"])).rejects.toThrow(
      "process.exit(1)",
    );

    const errorOutput = consoleErrorSpy.mock.calls.map((c) => String(c[0])).join("\n");
    expect(errorOutput).toMatch(/bmad tracker/);
  });
});
