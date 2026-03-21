import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  mkdtempSync,
  writeFileSync,
  rmSync,
  mkdirSync,
  existsSync,
  readdirSync,
  readFileSync,
} from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  type Session,
  type SessionManager,
  type ActivityState,
  getSessionsDir,
} from "@composio/ao-core";

const {
  mockTmux,
  mockGit,
  mockConfigRef,
  mockIntrospect,
  mockGetActivityState,
  mockDetectPR,
  mockGetCISummary,
  mockGetReviewDecision,
  mockGetPendingComments,
  mockSessionManager,
  sessionsDirRef,
  mockRegistryRef,
} = vi.hoisted(() => ({
  mockTmux: vi.fn(),
  mockGit: vi.fn(),
  mockConfigRef: { current: null as Record<string, unknown> | null },
  mockIntrospect: vi.fn(),
  mockGetActivityState: vi.fn(),
  mockDetectPR: vi.fn(),
  mockGetCISummary: vi.fn(),
  mockGetReviewDecision: vi.fn(),
  mockGetPendingComments: vi.fn(),
  mockSessionManager: {
    list: vi.fn(),
    kill: vi.fn(),
    cleanup: vi.fn(),
    get: vi.fn(),
    spawn: vi.fn(),
    spawnOrchestrator: vi.fn(),
    send: vi.fn(),
  },
  sessionsDirRef: { current: "" },
  mockRegistryRef: {
    current: {
      getByAgent: vi.fn().mockReturnValue(null),
      getByStory: vi.fn().mockReturnValue(null),
      findActiveByStory: vi.fn().mockReturnValue(null),
      list: vi.fn().mockReturnValue([]),
      register: vi.fn(),
      remove: vi.fn(),
      updateStatus: vi.fn(),
      getZombies: vi.fn().mockReturnValue([]),
      reload: vi.fn(),
      getRetryCount: vi.fn().mockReturnValue(0),
      incrementRetry: vi.fn(),
      getRetryHistory: vi.fn().mockReturnValue(null),
    },
  },
}));

vi.mock("../../src/lib/shell.js", () => ({
  tmux: mockTmux,
  exec: vi.fn().mockResolvedValue({ stdout: "", stderr: "" }),
  execSilent: vi.fn(),
  git: mockGit,
  gh: vi.fn(),
  getTmuxSessions: async () => {
    const output = await mockTmux("list-sessions", "-F", "#{session_name}");
    if (!output) return [];
    return output.split("\n").filter(Boolean);
  },
  getTmuxActivity: async (session: string) => {
    const output = await mockTmux("display-message", "-t", session, "-p", "#{session_activity}");
    if (!output) return null;
    const ts = parseInt(output, 10);
    return isNaN(ts) ? null : ts * 1000;
  },
}));

vi.mock("@composio/ao-core", async (importOriginal) => {
  // eslint-disable-next-line @typescript-eslint/consistent-type-imports
  const actual = await importOriginal<typeof import("@composio/ao-core")>();
  return {
    ...actual,
    loadConfig: () => mockConfigRef.current,
    getAgentRegistry: () => mockRegistryRef.current,
  };
});

vi.mock("../../src/lib/plugins.js", () => ({
  getAgent: () => ({
    name: "claude-code",
    processName: "claude",
    detectActivity: () => "idle",
    getSessionInfo: mockIntrospect,
    getActivityState: mockGetActivityState,
  }),
  getAgentByName: () => ({
    name: "claude-code",
    processName: "claude",
    detectActivity: () => "idle",
    getSessionInfo: mockIntrospect,
    getActivityState: mockGetActivityState,
  }),
  getSCM: () => ({
    name: "github",
    detectPR: mockDetectPR,
    getCISummary: mockGetCISummary,
    getReviewDecision: mockGetReviewDecision,
    getPendingComments: mockGetPendingComments,
    getAutomatedComments: vi.fn().mockResolvedValue([]),
    getCIChecks: vi.fn().mockResolvedValue([]),
    getReviews: vi.fn().mockResolvedValue([]),
    getMergeability: vi.fn().mockResolvedValue({
      mergeable: true,
      ciPassing: true,
      approved: false,
      noConflicts: true,
      blockers: [],
    }),
    getPRState: vi.fn().mockResolvedValue("open"),
    mergePR: vi.fn(),
    closePR: vi.fn(),
  }),
  getTracker: () => null,
}));

/** Parse a key=value metadata file into a Record<string, string>. */
function parseMetadata(content: string): Record<string, string> {
  const meta: Record<string, string> = {};
  for (const line of content.split("\n")) {
    const idx = line.indexOf("=");
    if (idx > 0) {
      meta[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
    }
  }
  return meta;
}

/** Build Session objects from metadata files in sessionsDir. */
function buildSessionsFromDir(
  dir: string,
  projectId: string,
  activityOverride?: ActivityState | null,
): Session[] {
  if (!existsSync(dir)) return [];
  const files = readdirSync(dir).filter((f) => !f.startsWith(".") && f !== "archive");
  return files.map((name) => {
    const content = readFileSync(join(dir, name), "utf-8");
    const meta = parseMetadata(content);
    return {
      id: name,
      projectId,
      status: (meta["status"] as Session["status"]) || "spawning",
      activity: activityOverride !== undefined ? activityOverride : null,
      branch: meta["branch"] || null,
      issueId: meta["issue"] || null,
      pr: null,
      workspacePath: meta["worktree"] || null,
      runtimeHandle: { id: name, runtimeName: "tmux", data: {} },
      agentInfo: null,
      createdAt: new Date(),
      lastActivityAt: new Date(),
      metadata: meta,
    } satisfies Session;
  });
}

vi.mock("../../src/lib/create-session-manager.js", () => ({
  getSessionManager: async (): Promise<SessionManager> => mockSessionManager as SessionManager,
}));

let tmpDir: string;
let sessionsDir: string;

import { Command } from "commander";
import { registerStatus } from "../../src/commands/status.js";

let program: Command;
let consoleSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), "ao-status-story-test-"));

  const configPath = join(tmpDir, "agent-orchestrator.yaml");
  writeFileSync(configPath, "projects: {}");

  mockConfigRef.current = {
    configPath,
    port: 5000,
    readyThresholdMs: 300_000,
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
        scm: { plugin: "github" },
      },
    },
    notifiers: {},
    notificationRouting: {},
    reactions: {},
  } as Record<string, unknown>;

  // Calculate and create sessions directory for hash-based architecture
  sessionsDir = getSessionsDir(configPath, join(tmpDir, "main-repo"));
  mkdirSync(sessionsDir, { recursive: true });
  sessionsDirRef.current = sessionsDir;

  program = new Command();
  program.exitOverride();
  registerStatus(program);
  consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(process, "exit").mockImplementation((code) => {
    throw new Error(`process.exit(${code})`);
  });
  mockTmux.mockReset();
  mockGit.mockReset();
  mockIntrospect.mockReset();
  mockIntrospect.mockResolvedValue(null);
  mockGetActivityState.mockReset();
  mockGetActivityState.mockResolvedValue("active");
  mockDetectPR.mockReset();
  mockDetectPR.mockResolvedValue(null);
  mockGetCISummary.mockReset();
  mockGetCISummary.mockResolvedValue("none");
  mockGetReviewDecision.mockReset();
  mockGetReviewDecision.mockResolvedValue("none");
  mockGetPendingComments.mockReset();
  mockGetPendingComments.mockResolvedValue([]);
  mockSessionManager.list.mockReset();

  // Reset registry mocks
  mockRegistryRef.current.getByAgent.mockReset().mockReturnValue(null);
  mockRegistryRef.current.getByStory.mockReset().mockReturnValue(null);
  mockRegistryRef.current.findActiveByStory.mockReset().mockReturnValue(null);
  mockRegistryRef.current.list.mockReset().mockReturnValue([]);

  // Default: list reads from sessionsDir
  mockSessionManager.list.mockImplementation(async () => {
    return buildSessionsFromDir(sessionsDirRef.current, "my-app");
  });
});

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true });
  vi.restoreAllMocks();
});

describe("ao status — agent-story mapping (AC #1)", () => {
  it("shows Story and AgentSt columns in table header", async () => {
    writeFileSync(join(sessionsDir, "app-1"), "branch=main\nstatus=working\n");
    mockTmux.mockResolvedValue(null);
    mockGit.mockResolvedValue(null);

    await program.parseAsync(["node", "test", "status"]);

    const output = consoleSpy.mock.calls.map((c) => c[0]).join("\n");
    expect(output).toContain("Story");
    expect(output).toContain("AgentSt");
  });

  it("shows story ID and agent status from registry", async () => {
    writeFileSync(join(sessionsDir, "app-1"), "branch=feat/1-2-auth\nstatus=working\n");
    mockTmux.mockResolvedValue(null);
    mockGit.mockResolvedValue(null);

    // Registry returns an assignment for this session
    mockRegistryRef.current.getByAgent.mockImplementation((agentId: string) => {
      if (agentId === "app-1") {
        return {
          agentId: "app-1",
          storyId: "1-2-user-auth",
          assignedAt: new Date(),
          status: "active",
          contextHash: "abc123",
        };
      }
      return null;
    });

    await program.parseAsync(["node", "test", "status"]);

    const output = consoleSpy.mock.calls.map((c) => c[0]).join("\n");
    expect(output).toContain("1-2-user-au"); // truncated to column width
    expect(output).toContain("active");
  });

  it("falls back to metadata storyId when registry returns null", async () => {
    writeFileSync(
      join(sessionsDir, "app-1"),
      "branch=feat/1-3-foo\nstatus=working\nstoryId=1-3-foo-bar\nagentStatus=active\n",
    );
    mockTmux.mockResolvedValue(null);
    mockGit.mockResolvedValue(null);

    await program.parseAsync(["node", "test", "status"]);

    const output = consoleSpy.mock.calls.map((c) => c[0]).join("\n");
    expect(output).toContain("1-3-foo-bar");
    expect(output).toContain("active");
  });

  it("shows dash when no story assignment", async () => {
    writeFileSync(join(sessionsDir, "app-1"), "branch=feat/ISSUE-42\nstatus=working\n");
    mockTmux.mockResolvedValue(null);
    mockGit.mockResolvedValue(null);

    await program.parseAsync(["node", "test", "status"]);

    // The story column should show "-" when no assignment
    const output = consoleSpy.mock.calls.map((c) => c[0]).join("\n");
    // Both Story and AgentSt should be present but showing "-"
    expect(output).toContain("Story");
    expect(output).toContain("AgentSt");
  });

  it("includes storyId and agentStatus in JSON output", async () => {
    writeFileSync(join(sessionsDir, "app-1"), "branch=feat/1-2-auth\nstatus=working\n");
    mockTmux.mockResolvedValue(null);
    mockGit.mockResolvedValue(null);

    mockRegistryRef.current.getByAgent.mockImplementation((agentId: string) => {
      if (agentId === "app-1") {
        return {
          agentId: "app-1",
          storyId: "1-2-user-auth",
          assignedAt: new Date(),
          status: "blocked",
          contextHash: "abc123",
        };
      }
      return null;
    });

    await program.parseAsync(["node", "test", "status", "--json"]);

    const jsonCalls = consoleSpy.mock.calls.map((c) => c[0]).join("");
    const parsed = JSON.parse(jsonCalls);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].storyId).toBe("1-2-user-auth");
    expect(parsed[0].agentStatus).toBe("blocked");
  });

  it("shows null storyId and agentStatus in JSON when no assignment", async () => {
    writeFileSync(join(sessionsDir, "app-1"), "branch=feat/ISSUE-42\nstatus=working\n");
    mockTmux.mockResolvedValue(null);
    mockGit.mockResolvedValue(null);

    await program.parseAsync(["node", "test", "status", "--json"]);

    const jsonCalls = consoleSpy.mock.calls.map((c) => c[0]).join("");
    const parsed = JSON.parse(jsonCalls);
    expect(parsed[0].storyId).toBeNull();
    expect(parsed[0].agentStatus).toBeNull();
  });
});

describe("ao status --story (AC #2)", () => {
  it("shows detailed story view with assigned agent info", async () => {
    writeFileSync(join(sessionsDir, "app-1"), "branch=feat/1-2-auth\nstatus=working\n");
    mockTmux.mockResolvedValue(null);
    mockGit.mockResolvedValue(null);

    mockRegistryRef.current.getByAgent.mockImplementation((agentId: string) => {
      if (agentId === "app-1") {
        return {
          agentId: "app-1",
          storyId: "1-2-user-auth",
          assignedAt: new Date(),
          status: "active",
          contextHash: "abc123",
        };
      }
      return null;
    });

    // Create sprint-status.yaml in the project directory
    const storyDir = join(tmpDir, "main-repo", "_bmad-output", "implementation-artifacts");
    mkdirSync(storyDir, { recursive: true });
    writeFileSync(
      join(storyDir, "sprint-status.yaml"),
      [
        "development_status:",
        "  1-2-user-auth: in-progress",
        "  1-3-next-story: backlog",
        "dependencies:",
        "  1-3-next-story:",
        "    - 1-2-user-auth",
      ].join("\n"),
    );

    await program.parseAsync(["node", "test", "status", "--story", "1-2-user-auth"]);

    const output = consoleSpy.mock.calls.map((c) => c[0]).join("\n");
    expect(output).toContain("Story: 1-2-user-auth");
    expect(output).toContain("in-progress");
    expect(output).toContain("app-1");
    expect(output).toContain("active");
  });

  it("shows no agent assigned message when story has no agent", async () => {
    // No sessions
    mockSessionManager.list.mockResolvedValue([]);
    mockTmux.mockResolvedValue(null);
    mockGit.mockResolvedValue(null);

    const storyDir = join(tmpDir, "main-repo", "_bmad-output", "implementation-artifacts");
    mkdirSync(storyDir, { recursive: true });
    writeFileSync(
      join(storyDir, "sprint-status.yaml"),
      ["development_status:", "  1-2-user-auth: ready-for-dev"].join("\n"),
    );

    await program.parseAsync(["node", "test", "status", "--story", "1-2-user-auth"]);

    const output = consoleSpy.mock.calls.map((c) => c[0]).join("\n");
    expect(output).toContain("Story: 1-2-user-auth");
    expect(output).toContain("ready-for-dev");
    expect(output).toContain("no agent assigned");
  });

  it("shows dependency status in story detail view", async () => {
    mockSessionManager.list.mockResolvedValue([]);
    mockTmux.mockResolvedValue(null);

    const storyDir = join(tmpDir, "main-repo", "_bmad-output", "implementation-artifacts");
    mkdirSync(storyDir, { recursive: true });
    writeFileSync(
      join(storyDir, "sprint-status.yaml"),
      [
        "development_status:",
        "  1-1-foundation: done",
        "  1-2-user-auth: in-progress",
        "  1-3-next-story: backlog",
        "dependencies:",
        "  1-3-next-story:",
        "    - 1-1-foundation",
        "    - 1-2-user-auth",
      ].join("\n"),
    );

    await program.parseAsync(["node", "test", "status", "--story", "1-3-next-story"]);

    const output = consoleSpy.mock.calls.map((c) => c[0]).join("\n");
    expect(output).toContain("Dependencies");
    expect(output).toContain("1-1-foundation");
    expect(output).toContain("done");
    expect(output).toContain("1-2-user-auth");
    expect(output).toContain("in-progress");
  });
});
