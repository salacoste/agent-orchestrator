import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  rmSync,
  existsSync,
  readdirSync,
  readFileSync,
} from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  type Session,
  type SessionManager,
  type PRInfo,
  type ReviewComment,
  getSessionsDir,
} from "@composio/ao-core";

const { mockSCM, mockConfigRef, mockSessionManager, sessionsDirRef } = vi.hoisted(() => ({
  mockSCM: {
    name: "github",
    detectPR: vi.fn(),
    getPRState: vi.fn(),
    mergePR: vi.fn(),
    closePR: vi.fn(),
    getCIChecks: vi.fn(),
    getCISummary: vi.fn(),
    getReviews: vi.fn(),
    getReviewDecision: vi.fn(),
    getPendingComments: vi.fn(),
    getAutomatedComments: vi.fn(),
    getMergeability: vi.fn(),
  },
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
  sessionsDirRef: { current: "" },
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

vi.mock("../../src/lib/plugins.js", () => ({
  getSCM: () => mockSCM,
}));

vi.mock("../../src/lib/create-session-manager.js", () => ({
  getSessionManager: async (): Promise<SessionManager> => mockSessionManager as SessionManager,
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
function buildSessionsFromDir(dir: string, projectId: string): Session[] {
  if (!existsSync(dir)) return [];
  const files = readdirSync(dir).filter((f) => !f.startsWith(".") && f !== "archive");
  return files.map((name) => {
    const content = readFileSync(join(dir, name), "utf-8");
    const meta = parseMetadata(content);
    return {
      id: name,
      projectId,
      status: (meta["status"] as Session["status"]) || "spawning",
      activity: null,
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

const MOCK_PR: PRInfo = {
  number: 10,
  url: "https://github.com/org/my-app/pull/10",
  title: "Fix something",
  owner: "org",
  repo: "my-app",
  branch: "feat/fix",
  baseBranch: "main",
  isDraft: false,
};

let tmpDir: string;
let sessionsDir: string;

import { Command } from "commander";
import { registerReviewCheck } from "../../src/commands/review-check.js";

let program: Command;
let consoleSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), "ao-review-test-"));

  const configPath = join(tmpDir, "agent-orchestrator.yaml");
  writeFileSync(configPath, "projects: {}");

  mockConfigRef.current = {
    configPath,
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
        scm: { plugin: "github" },
      },
    },
    notifiers: {},
    notificationRouting: {},
    reactions: {},
  } as Record<string, unknown>;

  sessionsDir = getSessionsDir(configPath, join(tmpDir, "main-repo"));
  mkdirSync(sessionsDir, { recursive: true });
  sessionsDirRef.current = sessionsDir;

  program = new Command();
  program.exitOverride();
  registerReviewCheck(program);
  consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(process, "exit").mockImplementation((code) => {
    throw new Error(`process.exit(${code})`);
  });

  mockSCM.detectPR.mockReset();
  mockSCM.getPendingComments.mockReset();
  mockSCM.getReviewDecision.mockReset();
  mockSessionManager.list.mockReset();
  mockSessionManager.send.mockReset();

  mockSessionManager.list.mockImplementation(async () => {
    return buildSessionsFromDir(sessionsDirRef.current, "my-app");
  });
  mockSessionManager.send.mockResolvedValue(undefined);
});

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true });
  vi.restoreAllMocks();
});

describe("review-check command", () => {
  it("reports no pending reviews when none exist", async () => {
    writeFileSync(
      join(sessionsDir, "app-1"),
      "branch=feat/fix\npr=https://github.com/org/my-app/pull/10\n",
    );

    mockSCM.detectPR.mockResolvedValue(MOCK_PR);
    mockSCM.getPendingComments.mockResolvedValue([]);
    mockSCM.getReviewDecision.mockResolvedValue("approved");

    await program.parseAsync(["node", "test", "review-check"]);

    const output = consoleSpy.mock.calls.map((c) => String(c[0])).join("\n");
    expect(output).toContain("No pending review comments");
  });

  it("finds sessions with pending review comments", async () => {
    writeFileSync(
      join(sessionsDir, "app-1"),
      "branch=feat/fix\npr=https://github.com/org/my-app/pull/10\n",
    );

    mockSCM.detectPR.mockResolvedValue(MOCK_PR);
    mockSCM.getPendingComments.mockResolvedValue([
      { id: "1", body: "Fix this", author: "reviewer" } as ReviewComment,
    ]);
    mockSCM.getReviewDecision.mockResolvedValue("changes_requested");

    await program.parseAsync(["node", "test", "review-check", "--dry-run"]);

    const output = consoleSpy.mock.calls.map((c) => String(c[0])).join("\n");
    expect(output).toContain("app-1");
    expect(output).toContain("PR #10");
    expect(output).toContain("changes_requested");
    expect(output).toContain("dry run");
  });

  it("skips sessions without PR", async () => {
    writeFileSync(join(sessionsDir, "app-1"), "branch=feat/fix\nstatus=working\n");

    mockSCM.detectPR.mockResolvedValue(null);

    await program.parseAsync(["node", "test", "review-check"]);

    const output = consoleSpy.mock.calls.map((c) => String(c[0])).join("\n");
    expect(output).toContain("No pending review comments");
  });

  it("sends fix prompt via session manager when not in dry-run mode", async () => {
    writeFileSync(
      join(sessionsDir, "app-1"),
      "branch=feat/fix\npr=https://github.com/org/my-app/pull/10\n",
    );

    mockSCM.detectPR.mockResolvedValue(MOCK_PR);
    mockSCM.getPendingComments.mockResolvedValue([
      { id: "1", body: "Fix this", author: "reviewer" } as ReviewComment,
    ]);
    mockSCM.getReviewDecision.mockResolvedValue(null);

    await program.parseAsync(["node", "test", "review-check"]);

    const output = consoleSpy.mock.calls.map((c) => String(c[0])).join("\n");
    expect(output).toContain("Fix prompt sent");

    // Should use session manager send instead of raw tmux
    expect(mockSessionManager.send).toHaveBeenCalledWith(
      "app-1",
      expect.stringContaining("review comments"),
    );
  });

  it("handles SCM detectPR failure gracefully", async () => {
    writeFileSync(
      join(sessionsDir, "app-1"),
      "branch=feat/fix\npr=https://github.com/org/my-app/pull/10\n",
    );

    mockSCM.detectPR.mockRejectedValue(new Error("API error"));

    await program.parseAsync(["node", "test", "review-check"]);

    const output = consoleSpy.mock.calls.map((c) => String(c[0])).join("\n");
    expect(output).toContain("No pending review comments");
  });

  it("handles SCM getPendingComments failure gracefully", async () => {
    writeFileSync(
      join(sessionsDir, "app-1"),
      "branch=feat/fix\npr=https://github.com/org/my-app/pull/10\n",
    );

    mockSCM.detectPR.mockResolvedValue(MOCK_PR);
    mockSCM.getPendingComments.mockRejectedValue(new Error("API error"));

    await program.parseAsync(["node", "test", "review-check"]);

    const output = consoleSpy.mock.calls.map((c) => String(c[0])).join("\n");
    expect(output).toContain("No pending review comments");
  });

  it("rejects unknown project ID", async () => {
    await expect(
      program.parseAsync(["node", "test", "review-check", "nonexistent"]),
    ).rejects.toThrow("process.exit(1)");
  });
});
