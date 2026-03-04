import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdirSync, rmSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";
import { createLifecycleManager } from "../lifecycle-manager.js";
import { writeMetadata, readMetadataRaw } from "../metadata.js";
import { getSessionsDir, getProjectBaseDir } from "../paths.js";
import type {
  OrchestratorConfig,
  PluginRegistry,
  SessionManager,
  Session,
  Runtime,
  Agent,
  SCM,
  Tracker,
  Notifier,
  ActivityState,
  OrchestratorEvent,
  PRInfo,
} from "../types.js";

let tmpDir: string;
let configPath: string;
let sessionsDir: string;
let mockSessionManager: SessionManager;
let mockRuntime: Runtime;
let mockAgent: Agent;
let mockRegistry: PluginRegistry;
let config: OrchestratorConfig;

function makeSession(overrides: Partial<Session> = {}): Session {
  return {
    id: "app-1",
    projectId: "my-app",
    status: "spawning",
    activity: "active",
    branch: "feat/test",
    issueId: null,
    pr: null,
    workspacePath: "/tmp/ws",
    runtimeHandle: { id: "rt-1", runtimeName: "mock", data: {} },
    agentInfo: null,
    createdAt: new Date(),
    lastActivityAt: new Date(),
    metadata: {},
    ...overrides,
  };
}

function makePR(overrides: Partial<PRInfo> = {}): PRInfo {
  return {
    number: 42,
    url: "https://github.com/org/repo/pull/42",
    title: "Fix things",
    owner: "org",
    repo: "repo",
    branch: "feat/test",
    baseBranch: "main",
    isDraft: false,
    ...overrides,
  };
}

beforeEach(() => {
  tmpDir = join(tmpdir(), `ao-test-lifecycle-${randomUUID()}`);
  mkdirSync(tmpDir, { recursive: true });

  // Create a temporary config file
  configPath = join(tmpDir, "agent-orchestrator.yaml");
  writeFileSync(configPath, "projects: {}\n");

  mockRuntime = {
    name: "mock",
    create: vi.fn(),
    destroy: vi.fn(),
    sendMessage: vi.fn().mockResolvedValue(undefined),
    getOutput: vi.fn().mockResolvedValue("$ some terminal output\n"),
    isAlive: vi.fn().mockResolvedValue(true),
  };

  mockAgent = {
    name: "mock-agent",
    processName: "mock",
    getLaunchCommand: vi.fn(),
    getEnvironment: vi.fn(),
    detectActivity: vi.fn().mockReturnValue("active" as ActivityState),
    getActivityState: vi.fn().mockResolvedValue({ state: "active" as ActivityState }),
    isProcessRunning: vi.fn().mockResolvedValue(true),
    getSessionInfo: vi.fn().mockResolvedValue(null),
  };

  mockRegistry = {
    register: vi.fn(),
    get: vi.fn().mockImplementation((slot: string) => {
      if (slot === "runtime") return mockRuntime;
      if (slot === "agent") return mockAgent;
      return null;
    }),
    list: vi.fn().mockReturnValue([]),
    loadBuiltins: vi.fn(),
    loadFromConfig: vi.fn(),
  };

  mockSessionManager = {
    spawn: vi.fn(),
    spawnOrchestrator: vi.fn(),
    restore: vi.fn(),
    list: vi.fn().mockResolvedValue([]),
    get: vi.fn().mockResolvedValue(null),
    kill: vi.fn().mockResolvedValue(undefined),
    cleanup: vi.fn(),
    send: vi.fn().mockResolvedValue(undefined),
  };

  config = {
    configPath,
    port: 3000,
    defaults: {
      runtime: "mock",
      agent: "mock-agent",
      workspace: "mock-ws",
      notifiers: ["desktop"],
    },
    projects: {
      "my-app": {
        name: "My App",
        repo: "org/my-app",
        path: join(tmpDir, "my-app"),
        defaultBranch: "main",
        sessionPrefix: "app",
        scm: { plugin: "github" },
      },
    },
    notifiers: {},
    notificationRouting: {
      urgent: ["desktop"],
      action: ["desktop"],
      warning: [],
      info: [],
    },
    reactions: {},
    readyThresholdMs: 300_000,
  };

  // Calculate sessions directory
  sessionsDir = getSessionsDir(configPath, join(tmpDir, "my-app"));
  mkdirSync(sessionsDir, { recursive: true });
});

afterEach(() => {
  // Clean up hash-based directories in ~/.agent-orchestrator
  const projectBaseDir = getProjectBaseDir(configPath, join(tmpDir, "my-app"));
  if (existsSync(projectBaseDir)) {
    rmSync(projectBaseDir, { recursive: true, force: true });
  }

  // Clean up tmpDir
  rmSync(tmpDir, { recursive: true, force: true });
});

describe("start / stop", () => {
  it("starts and stops the polling loop", () => {
    const lm = createLifecycleManager({
      config,
      registry: mockRegistry,
      sessionManager: mockSessionManager,
    });

    lm.start(60_000);
    // Should not throw on double start
    lm.start(60_000);
    lm.stop();
    // Should not throw on double stop
    lm.stop();
  });
});

describe("check (single session)", () => {
  it("detects transition from spawning to working", async () => {
    const session = makeSession({ status: "spawning" });
    vi.mocked(mockSessionManager.get).mockResolvedValue(session);

    // Write metadata so updateMetadata works
    writeMetadata(sessionsDir, "app-1", {
      worktree: "/tmp",
      branch: "main",
      status: "spawning",
      project: "my-app",
    });

    const lm = createLifecycleManager({
      config,
      registry: mockRegistry,
      sessionManager: mockSessionManager,
    });

    await lm.check("app-1");

    expect(lm.getStates().get("app-1")).toBe("working");

    // Metadata should be updated
    const meta = readMetadataRaw(sessionsDir, "app-1");
    expect(meta!["status"]).toBe("working");
  });

  it("detects killed state when runtime is dead", async () => {
    vi.mocked(mockRuntime.isAlive).mockResolvedValue(false);

    const session = makeSession({ status: "working" });
    vi.mocked(mockSessionManager.get).mockResolvedValue(session);

    writeMetadata(sessionsDir, "app-1", {
      worktree: "/tmp",
      branch: "main",
      status: "working",
      project: "my-app",
    });

    const lm = createLifecycleManager({
      config,
      registry: mockRegistry,
      sessionManager: mockSessionManager,
    });

    await lm.check("app-1");

    expect(lm.getStates().get("app-1")).toBe("killed");
  });

  it("detects killed state when getActivityState returns exited", async () => {
    vi.mocked(mockAgent.getActivityState).mockResolvedValue({ state: "exited" });

    const session = makeSession({ status: "working" });
    vi.mocked(mockSessionManager.get).mockResolvedValue(session);

    writeMetadata(sessionsDir, "app-1", {
      worktree: "/tmp",
      branch: "main",
      status: "working",
      project: "my-app",
    });

    const lm = createLifecycleManager({
      config,
      registry: mockRegistry,
      sessionManager: mockSessionManager,
    });

    await lm.check("app-1");

    expect(lm.getStates().get("app-1")).toBe("killed");
  });

  it("detects killed state when agent process exits (idle terminal + dead process)", async () => {
    // getActivityState returns null to trigger the terminal-output fallback path
    vi.mocked(mockAgent.getActivityState).mockResolvedValue(null);
    vi.mocked(mockAgent.detectActivity).mockReturnValue("idle");
    vi.mocked(mockAgent.isProcessRunning).mockResolvedValue(false);

    const session = makeSession({ status: "working" });
    vi.mocked(mockSessionManager.get).mockResolvedValue(session);

    writeMetadata(sessionsDir, "app-1", {
      worktree: "/tmp",
      branch: "main",
      status: "working",
      project: "my-app",
    });

    const lm = createLifecycleManager({
      config,
      registry: mockRegistry,
      sessionManager: mockSessionManager,
    });

    await lm.check("app-1");

    expect(lm.getStates().get("app-1")).toBe("killed");
  });

  it("detects killed state when agent process exits (active terminal + dead process)", async () => {
    // Stub agents (codex, aider, opencode) return "active" for any non-empty
    // terminal output, including the shell prompt after the agent exits.
    // getActivityState returns null to trigger the terminal-output fallback path.
    vi.mocked(mockAgent.getActivityState).mockResolvedValue(null);
    vi.mocked(mockAgent.detectActivity).mockReturnValue("active");
    vi.mocked(mockAgent.isProcessRunning).mockResolvedValue(false);

    const session = makeSession({ status: "working" });
    vi.mocked(mockSessionManager.get).mockResolvedValue(session);

    writeMetadata(sessionsDir, "app-1", {
      worktree: "/tmp",
      branch: "main",
      status: "working",
      project: "my-app",
    });

    const lm = createLifecycleManager({
      config,
      registry: mockRegistry,
      sessionManager: mockSessionManager,
    });

    await lm.check("app-1");

    expect(lm.getStates().get("app-1")).toBe("killed");
  });

  it("stays working when agent is idle but process is still running", async () => {
    // getActivityState returns null to trigger the terminal-output fallback path
    vi.mocked(mockAgent.getActivityState).mockResolvedValue(null);
    vi.mocked(mockAgent.detectActivity).mockReturnValue("idle");
    vi.mocked(mockAgent.isProcessRunning).mockResolvedValue(true);

    const session = makeSession({ status: "working" });
    vi.mocked(mockSessionManager.get).mockResolvedValue(session);

    writeMetadata(sessionsDir, "app-1", {
      worktree: "/tmp",
      branch: "main",
      status: "working",
      project: "my-app",
    });

    const lm = createLifecycleManager({
      config,
      registry: mockRegistry,
      sessionManager: mockSessionManager,
    });

    await lm.check("app-1");

    expect(lm.getStates().get("app-1")).toBe("working");
  });

  it("detects needs_input from agent", async () => {
    // getActivityState returns null to trigger the terminal-output fallback path
    vi.mocked(mockAgent.getActivityState).mockResolvedValue(null);
    vi.mocked(mockAgent.detectActivity).mockReturnValue("waiting_input");

    const session = makeSession({ status: "working" });
    vi.mocked(mockSessionManager.get).mockResolvedValue(session);

    writeMetadata(sessionsDir, "app-1", {
      worktree: "/tmp",
      branch: "main",
      status: "working",
      project: "my-app",
    });

    const lm = createLifecycleManager({
      config,
      registry: mockRegistry,
      sessionManager: mockSessionManager,
    });

    await lm.check("app-1");

    expect(lm.getStates().get("app-1")).toBe("needs_input");
  });

  it("preserves stuck state when detectActivity throws", async () => {
    // Make getActivityState null so the fallback detectActivity path is reached,
    // then make detectActivity throw to exercise the catch block.
    vi.mocked(mockAgent.getActivityState).mockResolvedValue(null);
    vi.mocked(mockAgent.detectActivity).mockImplementation(() => {
      throw new Error("probe failed");
    });

    const session = makeSession({ status: "stuck" });
    vi.mocked(mockSessionManager.get).mockResolvedValue(session);

    writeMetadata(sessionsDir, "app-1", {
      worktree: "/tmp",
      branch: "main",
      status: "stuck",
      project: "my-app",
    });

    const lm = createLifecycleManager({
      config,
      registry: mockRegistry,
      sessionManager: mockSessionManager,
    });

    await lm.check("app-1");

    // Should preserve "stuck" — NOT coerce to "working"
    expect(lm.getStates().get("app-1")).toBe("stuck");
  });

  it("preserves needs_input state when detectActivity throws", async () => {
    // Make getActivityState null so the fallback detectActivity path is reached,
    // then make detectActivity throw to exercise the catch block.
    vi.mocked(mockAgent.getActivityState).mockResolvedValue(null);
    vi.mocked(mockAgent.detectActivity).mockImplementation(() => {
      throw new Error("probe failed");
    });

    const session = makeSession({ status: "needs_input" });
    vi.mocked(mockSessionManager.get).mockResolvedValue(session);

    writeMetadata(sessionsDir, "app-1", {
      worktree: "/tmp",
      branch: "main",
      status: "needs_input",
      project: "my-app",
    });

    const lm = createLifecycleManager({
      config,
      registry: mockRegistry,
      sessionManager: mockSessionManager,
    });

    await lm.check("app-1");

    // Should preserve "needs_input" — NOT coerce to "working"
    expect(lm.getStates().get("app-1")).toBe("needs_input");
  });

  it("preserves stuck state when getOutput throws", async () => {
    // getActivityState must return null to trigger the fallback path where getOutput is called
    vi.mocked(mockAgent.getActivityState).mockResolvedValue(null);
    vi.mocked(mockRuntime.getOutput).mockRejectedValue(new Error("tmux error"));

    const session = makeSession({ status: "stuck" });
    vi.mocked(mockSessionManager.get).mockResolvedValue(session);

    writeMetadata(sessionsDir, "app-1", {
      worktree: "/tmp",
      branch: "main",
      status: "stuck",
      project: "my-app",
    });

    const lm = createLifecycleManager({
      config,
      registry: mockRegistry,
      sessionManager: mockSessionManager,
    });

    await lm.check("app-1");

    // getOutput failure should hit the catch block and preserve "stuck"
    expect(lm.getStates().get("app-1")).toBe("stuck");
  });

  it("detects PR states from SCM", async () => {
    const mockSCM: SCM = {
      name: "mock-scm",
      detectPR: vi.fn(),
      getPRState: vi.fn().mockResolvedValue("open"),
      mergePR: vi.fn(),
      closePR: vi.fn(),
      getCIChecks: vi.fn(),
      getCISummary: vi.fn().mockResolvedValue("failing"),
      getReviews: vi.fn(),
      getReviewDecision: vi.fn().mockResolvedValue("none"),
      getPendingComments: vi.fn(),
      getAutomatedComments: vi.fn(),
      getMergeability: vi.fn(),
    };

    const registryWithSCM: PluginRegistry = {
      ...mockRegistry,
      get: vi.fn().mockImplementation((slot: string) => {
        if (slot === "runtime") return mockRuntime;
        if (slot === "agent") return mockAgent;
        if (slot === "scm") return mockSCM;
        return null;
      }),
    };

    const session = makeSession({ status: "pr_open", pr: makePR() });
    vi.mocked(mockSessionManager.get).mockResolvedValue(session);

    writeMetadata(sessionsDir, "app-1", {
      worktree: "/tmp",
      branch: "main",
      status: "pr_open",
      project: "my-app",
    });

    const lm = createLifecycleManager({
      config,
      registry: registryWithSCM,
      sessionManager: mockSessionManager,
    });

    await lm.check("app-1");

    expect(lm.getStates().get("app-1")).toBe("ci_failed");
  });

  it("detects merged PR", async () => {
    const mockSCM: SCM = {
      name: "mock-scm",
      detectPR: vi.fn(),
      getPRState: vi.fn().mockResolvedValue("merged"),
      mergePR: vi.fn(),
      closePR: vi.fn(),
      getCIChecks: vi.fn(),
      getCISummary: vi.fn(),
      getReviews: vi.fn(),
      getReviewDecision: vi.fn(),
      getPendingComments: vi.fn(),
      getAutomatedComments: vi.fn(),
      getMergeability: vi.fn(),
    };

    const registryWithSCM: PluginRegistry = {
      ...mockRegistry,
      get: vi.fn().mockImplementation((slot: string) => {
        if (slot === "runtime") return mockRuntime;
        if (slot === "agent") return mockAgent;
        if (slot === "scm") return mockSCM;
        return null;
      }),
    };

    const session = makeSession({ status: "approved", pr: makePR() });
    vi.mocked(mockSessionManager.get).mockResolvedValue(session);

    writeMetadata(sessionsDir, "app-1", {
      worktree: "/tmp",
      branch: "main",
      status: "approved",
      project: "my-app",
    });

    const lm = createLifecycleManager({
      config,
      registry: registryWithSCM,
      sessionManager: mockSessionManager,
    });

    await lm.check("app-1");

    expect(lm.getStates().get("app-1")).toBe("merged");
  });

  it("detects mergeable when approved + CI green", async () => {
    const mockSCM: SCM = {
      name: "mock-scm",
      detectPR: vi.fn(),
      getPRState: vi.fn().mockResolvedValue("open"),
      mergePR: vi.fn(),
      closePR: vi.fn(),
      getCIChecks: vi.fn(),
      getCISummary: vi.fn().mockResolvedValue("passing"),
      getReviews: vi.fn(),
      getReviewDecision: vi.fn().mockResolvedValue("approved"),
      getPendingComments: vi.fn(),
      getAutomatedComments: vi.fn(),
      getMergeability: vi.fn().mockResolvedValue({
        mergeable: true,
        ciPassing: true,
        approved: true,
        noConflicts: true,
        blockers: [],
      }),
    };

    const registryWithSCM: PluginRegistry = {
      ...mockRegistry,
      get: vi.fn().mockImplementation((slot: string) => {
        if (slot === "runtime") return mockRuntime;
        if (slot === "agent") return mockAgent;
        if (slot === "scm") return mockSCM;
        return null;
      }),
    };

    const session = makeSession({ status: "pr_open", pr: makePR() });
    vi.mocked(mockSessionManager.get).mockResolvedValue(session);

    writeMetadata(sessionsDir, "app-1", {
      worktree: "/tmp",
      branch: "main",
      status: "pr_open",
      project: "my-app",
    });

    const lm = createLifecycleManager({
      config,
      registry: registryWithSCM,
      sessionManager: mockSessionManager,
    });

    await lm.check("app-1");

    expect(lm.getStates().get("app-1")).toBe("mergeable");
  });

  it("throws for nonexistent session", async () => {
    vi.mocked(mockSessionManager.get).mockResolvedValue(null);

    const lm = createLifecycleManager({
      config,
      registry: mockRegistry,
      sessionManager: mockSessionManager,
    });

    await expect(lm.check("nonexistent")).rejects.toThrow("not found");
  });

  it("does not change state when status is unchanged", async () => {
    const session = makeSession({ status: "working" });
    vi.mocked(mockSessionManager.get).mockResolvedValue(session);

    writeMetadata(sessionsDir, "app-1", {
      worktree: "/tmp",
      branch: "main",
      status: "working",
      project: "my-app",
    });

    const lm = createLifecycleManager({
      config,
      registry: mockRegistry,
      sessionManager: mockSessionManager,
    });

    await lm.check("app-1");
    expect(lm.getStates().get("app-1")).toBe("working");

    // Second check — status remains working, no transition
    await lm.check("app-1");
    expect(lm.getStates().get("app-1")).toBe("working");
  });
});

describe("reactions", () => {
  it("triggers send-to-agent reaction on CI failure", async () => {
    config.reactions = {
      "ci-failed": {
        auto: true,
        action: "send-to-agent",
        message: "CI is failing. Fix it.",
        retries: 2,
        escalateAfter: 2,
      },
    };

    const mockSCM: SCM = {
      name: "mock-scm",
      detectPR: vi.fn(),
      getPRState: vi.fn().mockResolvedValue("open"),
      mergePR: vi.fn(),
      closePR: vi.fn(),
      getCIChecks: vi.fn(),
      getCISummary: vi.fn().mockResolvedValue("failing"),
      getReviews: vi.fn(),
      getReviewDecision: vi.fn().mockResolvedValue("none"),
      getPendingComments: vi.fn(),
      getAutomatedComments: vi.fn(),
      getMergeability: vi.fn(),
    };

    const registryWithSCM: PluginRegistry = {
      ...mockRegistry,
      get: vi.fn().mockImplementation((slot: string) => {
        if (slot === "runtime") return mockRuntime;
        if (slot === "agent") return mockAgent;
        if (slot === "scm") return mockSCM;
        return null;
      }),
    };

    const session = makeSession({ status: "pr_open", pr: makePR() });
    vi.mocked(mockSessionManager.get).mockResolvedValue(session);

    writeMetadata(sessionsDir, "app-1", {
      worktree: "/tmp",
      branch: "main",
      status: "pr_open",
      project: "my-app",
    });

    const lm = createLifecycleManager({
      config,
      registry: registryWithSCM,
      sessionManager: mockSessionManager,
    });

    await lm.check("app-1");

    expect(mockSessionManager.send).toHaveBeenCalledWith("app-1", "CI is failing. Fix it.");
  });

  it("does not trigger reaction when auto=false", async () => {
    config.reactions = {
      "ci-failed": {
        auto: false,
        action: "send-to-agent",
        message: "CI is failing.",
      },
    };

    const mockSCM: SCM = {
      name: "mock-scm",
      detectPR: vi.fn(),
      getPRState: vi.fn().mockResolvedValue("open"),
      mergePR: vi.fn(),
      closePR: vi.fn(),
      getCIChecks: vi.fn(),
      getCISummary: vi.fn().mockResolvedValue("failing"),
      getReviews: vi.fn(),
      getReviewDecision: vi.fn().mockResolvedValue("none"),
      getPendingComments: vi.fn(),
      getAutomatedComments: vi.fn(),
      getMergeability: vi.fn(),
    };

    const registryWithSCM: PluginRegistry = {
      ...mockRegistry,
      get: vi.fn().mockImplementation((slot: string) => {
        if (slot === "runtime") return mockRuntime;
        if (slot === "agent") return mockAgent;
        if (slot === "scm") return mockSCM;
        return null;
      }),
    };

    const session = makeSession({ status: "pr_open", pr: makePR() });
    vi.mocked(mockSessionManager.get).mockResolvedValue(session);

    writeMetadata(sessionsDir, "app-1", {
      worktree: "/tmp",
      branch: "main",
      status: "pr_open",
      project: "my-app",
    });

    const lm = createLifecycleManager({
      config,
      registry: registryWithSCM,
      sessionManager: mockSessionManager,
    });

    await lm.check("app-1");

    expect(mockSessionManager.send).not.toHaveBeenCalled();
  });
  it("suppresses immediate notification when send-to-agent reaction handles the event", async () => {
    const mockNotifier: Notifier = {
      name: "mock-notifier",
      notify: vi.fn().mockResolvedValue(undefined),
    };

    const mockSCM: SCM = {
      name: "mock-scm",
      detectPR: vi.fn(),
      getPRState: vi.fn().mockResolvedValue("open"),
      mergePR: vi.fn(),
      closePR: vi.fn(),
      getCIChecks: vi.fn(),
      getCISummary: vi.fn().mockResolvedValue("failing"),
      getReviews: vi.fn(),
      getReviewDecision: vi.fn(),
      getPendingComments: vi.fn(),
      getAutomatedComments: vi.fn(),
      getMergeability: vi.fn(),
    };

    const registryWithNotifier: PluginRegistry = {
      ...mockRegistry,
      get: vi.fn().mockImplementation((slot: string, name: string) => {
        if (slot === "runtime") return mockRuntime;
        if (slot === "agent") return mockAgent;
        if (slot === "scm") return mockSCM;
        if (slot === "notifier" && name === "desktop") return mockNotifier;
        return null;
      }),
    };

    // Session transitions from pr_open → ci_failed, which maps to ci-failed reaction
    const session = makeSession({ status: "pr_open", pr: makePR() });
    vi.mocked(mockSessionManager.get).mockResolvedValue(session);
    vi.mocked(mockSessionManager.send).mockResolvedValue(undefined);

    writeMetadata(sessionsDir, "app-1", {
      worktree: "/tmp",
      branch: "main",
      status: "pr_open",
      project: "my-app",
    });

    // Configure send-to-agent reaction for ci-failed with retries
    const configWithReaction = {
      ...config,
      reactions: {
        "ci-failed": {
          auto: true,
          action: "send-to-agent" as const,
          message: "Fix CI",
          retries: 3,
          escalateAfter: 3,
        },
      },
    };

    const lm = createLifecycleManager({
      config: configWithReaction,
      registry: registryWithNotifier,
      sessionManager: mockSessionManager,
    });

    await lm.check("app-1");

    expect(lm.getStates().get("app-1")).toBe("ci_failed");
    // send-to-agent reaction should have been executed
    expect(mockSessionManager.send).toHaveBeenCalledWith("app-1", "Fix CI");
    // Notifier should NOT have been called — the reaction is handling it
    expect(mockNotifier.notify).not.toHaveBeenCalled();
  });

  it("notifies humans on significant transitions without reaction config", async () => {
    const mockNotifier: Notifier = {
      name: "mock-notifier",
      notify: vi.fn().mockResolvedValue(undefined),
    };

    const mockSCM: SCM = {
      name: "mock-scm",
      detectPR: vi.fn(),
      getPRState: vi.fn().mockResolvedValue("merged"),
      mergePR: vi.fn(),
      closePR: vi.fn(),
      getCIChecks: vi.fn(),
      getCISummary: vi.fn(),
      getReviews: vi.fn(),
      getReviewDecision: vi.fn(),
      getPendingComments: vi.fn(),
      getAutomatedComments: vi.fn(),
      getMergeability: vi.fn(),
    };

    const registryWithNotifier: PluginRegistry = {
      ...mockRegistry,
      get: vi.fn().mockImplementation((slot: string, name: string) => {
        if (slot === "runtime") return mockRuntime;
        if (slot === "agent") return mockAgent;
        if (slot === "scm") return mockSCM;
        if (slot === "notifier" && name === "desktop") return mockNotifier;
        return null;
      }),
    };

    // merge.completed has "action" priority but NO reaction key mapping,
    // so it must reach notifyHuman directly
    const session = makeSession({ status: "approved", pr: makePR() });
    vi.mocked(mockSessionManager.get).mockResolvedValue(session);

    writeMetadata(sessionsDir, "app-1", {
      worktree: "/tmp",
      branch: "main",
      status: "approved",
      project: "my-app",
    });

    const lm = createLifecycleManager({
      config,
      registry: registryWithNotifier,
      sessionManager: mockSessionManager,
    });

    await lm.check("app-1");

    expect(lm.getStates().get("app-1")).toBe("merged");
    expect(mockNotifier.notify).toHaveBeenCalled();
    expect(mockNotifier.notify).toHaveBeenCalledWith(
      expect.objectContaining({ type: "merge.completed" }),
    );
  });
});

describe("tracker.story_done", () => {
  function makeTrackerConfig(): OrchestratorConfig {
    return {
      ...config,
      // Route info-priority events to desktop so tracker.story_done notifications are delivered
      notificationRouting: {
        ...config.notificationRouting,
        info: ["desktop"],
      },
      projects: {
        "my-app": {
          ...config.projects["my-app"]!,
          tracker: { plugin: "bmad" },
        },
      },
    };
  }

  function makeTrackerSCM(): SCM {
    return {
      name: "mock-scm",
      detectPR: vi.fn(),
      getPRState: vi.fn().mockResolvedValue("merged"),
      mergePR: vi.fn(),
      closePR: vi.fn(),
      getCIChecks: vi.fn(),
      getCISummary: vi.fn(),
      getReviews: vi.fn(),
      getReviewDecision: vi.fn(),
      getPendingComments: vi.fn(),
      getAutomatedComments: vi.fn(),
      getMergeability: vi.fn(),
    };
  }

  it("emits tracker.story_done event when project session merges", async () => {
    const mockNotifier: Notifier = {
      name: "mock-notifier",
      notify: vi.fn().mockResolvedValue(undefined),
    };

    const mockSCM = makeTrackerSCM();
    const bmadConfig = makeTrackerConfig();

    const mockTracker = {
      name: "bmad",
      getIssue: vi.fn().mockResolvedValue({
        id: "STORY-1",
        title: "Test Story",
        description: "",
        url: "https://example.com/story-1",
        state: "open" as const,
        labels: [],
      }),
      isCompleted: vi.fn(),
      issueUrl: vi.fn(),
      branchName: vi.fn(),
      generatePrompt: vi.fn(),
    };

    const registryWithBmad: PluginRegistry = {
      ...mockRegistry,
      get: vi.fn().mockImplementation((slot: string, name: string) => {
        if (slot === "runtime") return mockRuntime;
        if (slot === "agent") return mockAgent;
        if (slot === "scm") return mockSCM;
        if (slot === "tracker" && name === "bmad") return mockTracker;
        if (slot === "notifier" && name === "desktop") return mockNotifier;
        return null;
      }),
    };

    const session = makeSession({
      status: "approved",
      pr: makePR(),
      issueId: "STORY-1",
    });
    vi.mocked(mockSessionManager.get).mockResolvedValue(session);

    writeMetadata(sessionsDir, "app-1", {
      worktree: "/tmp",
      branch: "main",
      status: "approved",
      project: "my-app",
    });

    const lm = createLifecycleManager({
      config: bmadConfig,
      registry: registryWithBmad,
      sessionManager: mockSessionManager,
    });

    await lm.check("app-1");

    expect(lm.getStates().get("app-1")).toBe("merged");
    expect(mockNotifier.notify).toHaveBeenCalledWith(
      expect.objectContaining({ type: "tracker.story_done" }),
    );
  });

  it("event data includes identifier and epicId when epic exists", async () => {
    const mockNotifier: Notifier = {
      name: "mock-notifier",
      notify: vi.fn().mockResolvedValue(undefined),
    };

    const mockSCM = makeTrackerSCM();
    const bmadConfig = makeTrackerConfig();

    const mockTracker = {
      name: "bmad",
      getIssue: vi.fn().mockResolvedValue({
        id: "STORY-2",
        title: "Story with Epic",
        description: "",
        url: "https://example.com/story-2",
        state: "open" as const,
        labels: ["epic-42"],
      }),
      isCompleted: vi.fn(),
      issueUrl: vi.fn(),
      branchName: vi.fn(),
      generatePrompt: vi.fn(),
    };

    const registryWithBmad: PluginRegistry = {
      ...mockRegistry,
      get: vi.fn().mockImplementation((slot: string, name: string) => {
        if (slot === "runtime") return mockRuntime;
        if (slot === "agent") return mockAgent;
        if (slot === "scm") return mockSCM;
        if (slot === "tracker" && name === "bmad") return mockTracker;
        if (slot === "notifier" && name === "desktop") return mockNotifier;
        return null;
      }),
    };

    const session = makeSession({
      status: "approved",
      pr: makePR(),
      issueId: "STORY-2",
    });
    vi.mocked(mockSessionManager.get).mockResolvedValue(session);

    writeMetadata(sessionsDir, "app-1", {
      worktree: "/tmp",
      branch: "main",
      status: "approved",
      project: "my-app",
    });

    const lm = createLifecycleManager({
      config: bmadConfig,
      registry: registryWithBmad,
      sessionManager: mockSessionManager,
    });

    await lm.check("app-1");

    expect(mockNotifier.notify).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "tracker.story_done",
        data: expect.objectContaining({
          identifier: "STORY-2",
          epicId: "epic-42",
        }),
      }),
    );
  });

  it("does not emit tracker.story_done when tracker plugin is not registered", async () => {
    const mockNotifier: Notifier = {
      name: "mock-notifier",
      notify: vi.fn().mockResolvedValue(undefined),
    };

    const mockSCM = makeTrackerSCM();

    // Tracker configured but plugin not registered in registry
    const nonBmadConfig: OrchestratorConfig = {
      ...config,
      projects: {
        "my-app": {
          ...config.projects["my-app"]!,
          tracker: { plugin: "github" },
        },
      },
    };

    const registryWithSCM: PluginRegistry = {
      ...mockRegistry,
      get: vi.fn().mockImplementation((slot: string, name: string) => {
        if (slot === "runtime") return mockRuntime;
        if (slot === "agent") return mockAgent;
        if (slot === "scm") return mockSCM;
        if (slot === "notifier" && name === "desktop") return mockNotifier;
        return null;
      }),
    };

    const session = makeSession({
      status: "approved",
      pr: makePR(),
      issueId: "GH-99",
    });
    vi.mocked(mockSessionManager.get).mockResolvedValue(session);

    writeMetadata(sessionsDir, "app-1", {
      worktree: "/tmp",
      branch: "main",
      status: "approved",
      project: "my-app",
    });

    const lm = createLifecycleManager({
      config: nonBmadConfig,
      registry: registryWithSCM,
      sessionManager: mockSessionManager,
    });

    await lm.check("app-1");

    expect(lm.getStates().get("app-1")).toBe("merged");
    const bmadCall = vi
      .mocked(mockNotifier.notify)
      .mock.calls.find((call) => call[0].type === "tracker.story_done");
    expect(bmadCall).toBeUndefined();
  });

  it("emits tracker.story_done without epicId when tracker.getIssue throws", async () => {
    const mockNotifier: Notifier = {
      name: "mock-notifier",
      notify: vi.fn().mockResolvedValue(undefined),
    };

    const mockSCM = makeTrackerSCM();
    const bmadConfig = makeTrackerConfig();

    const mockTracker = {
      name: "bmad",
      getIssue: vi.fn().mockRejectedValue(new Error("tracker unavailable")),
      isCompleted: vi.fn(),
      issueUrl: vi.fn(),
      branchName: vi.fn(),
      generatePrompt: vi.fn(),
    };

    const registryWithBmad: PluginRegistry = {
      ...mockRegistry,
      get: vi.fn().mockImplementation((slot: string, name: string) => {
        if (slot === "runtime") return mockRuntime;
        if (slot === "agent") return mockAgent;
        if (slot === "scm") return mockSCM;
        if (slot === "tracker" && name === "bmad") return mockTracker;
        if (slot === "notifier" && name === "desktop") return mockNotifier;
        return null;
      }),
    };

    const session = makeSession({
      status: "approved",
      pr: makePR(),
      issueId: "STORY-3",
    });
    vi.mocked(mockSessionManager.get).mockResolvedValue(session);

    writeMetadata(sessionsDir, "app-1", {
      worktree: "/tmp",
      branch: "main",
      status: "approved",
      project: "my-app",
    });

    const lm = createLifecycleManager({
      config: bmadConfig,
      registry: registryWithBmad,
      sessionManager: mockSessionManager,
    });

    await lm.check("app-1");

    expect(lm.getStates().get("app-1")).toBe("merged");
    expect(mockNotifier.notify).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "tracker.story_done",
        data: expect.objectContaining({ identifier: "STORY-3" }),
      }),
    );
    const notifyCall = vi
      .mocked(mockNotifier.notify)
      .mock.calls.find((call) => call[0].type === "tracker.story_done");
    expect(notifyCall?.[0].data["epicId"]).toBeUndefined();
  });

  it("eventToReactionKey maps tracker.story_done to tracker-story-done via reaction config", async () => {
    // Verify the reaction key mapping by configuring a tracker-story-done reaction
    // and confirming it gets executed when the event fires.
    const mockSCM = makeTrackerSCM();
    const bmadConfig: OrchestratorConfig = {
      ...makeTrackerConfig(),
      reactions: {
        "tracker-story-done": {
          auto: true,
          action: "notify",
          priority: "action",
        },
      },
    };

    const mockNotifier: Notifier = {
      name: "mock-notifier",
      notify: vi.fn().mockResolvedValue(undefined),
    };

    const mockTracker = {
      name: "bmad",
      getIssue: vi.fn().mockResolvedValue({
        id: "STORY-4",
        title: "Reaction test story",
        description: "",
        url: "https://example.com/story-4",
        state: "open" as const,
        labels: [],
      }),
      isCompleted: vi.fn(),
      issueUrl: vi.fn(),
      branchName: vi.fn(),
      generatePrompt: vi.fn(),
    };

    const registryWithBmad: PluginRegistry = {
      ...mockRegistry,
      get: vi.fn().mockImplementation((slot: string, name: string) => {
        if (slot === "runtime") return mockRuntime;
        if (slot === "agent") return mockAgent;
        if (slot === "scm") return mockSCM;
        if (slot === "tracker" && name === "bmad") return mockTracker;
        if (slot === "notifier" && name === "desktop") return mockNotifier;
        return null;
      }),
    };

    const session = makeSession({
      status: "approved",
      pr: makePR(),
      issueId: "STORY-4",
    });
    vi.mocked(mockSessionManager.get).mockResolvedValue(session);

    writeMetadata(sessionsDir, "app-1", {
      worktree: "/tmp",
      branch: "main",
      status: "approved",
      project: "my-app",
    });

    const lm = createLifecycleManager({
      config: bmadConfig,
      registry: registryWithBmad,
      sessionManager: mockSessionManager,
    });

    await lm.check("app-1");

    // The tracker-story-done reaction (notify action) should have triggered notifyHuman
    expect(mockNotifier.notify).toHaveBeenCalledWith(
      expect.objectContaining({ type: "reaction.triggered" }),
    );
  });

  it("does not execute tracker-story-done reaction when auto=false and action is send-to-agent", async () => {
    const mockSCM = makeTrackerSCM();
    const bmadConfig: OrchestratorConfig = {
      ...makeTrackerConfig(),
      reactions: {
        "tracker-story-done": {
          auto: false,
          action: "send-to-agent",
          priority: "action",
        },
      },
    };

    const mockNotifier: Notifier = {
      name: "mock-notifier",
      notify: vi.fn().mockResolvedValue(undefined),
    };

    const mockTracker = {
      name: "bmad",
      getIssue: vi.fn().mockResolvedValue({
        id: "STORY-5",
        title: "Auto-false test story",
        description: "",
        url: "https://example.com/story-5",
        state: "open" as const,
        labels: [],
      }),
      isCompleted: vi.fn(),
      issueUrl: vi.fn(),
      branchName: vi.fn(),
      generatePrompt: vi.fn(),
    };

    const registryWithBmad: PluginRegistry = {
      ...mockRegistry,
      get: vi.fn().mockImplementation((slot: string, name: string) => {
        if (slot === "runtime") return mockRuntime;
        if (slot === "agent") return mockAgent;
        if (slot === "scm") return mockSCM;
        if (slot === "tracker" && name === "bmad") return mockTracker;
        if (slot === "notifier" && name === "desktop") return mockNotifier;
        return null;
      }),
    };

    const session = makeSession({
      status: "approved",
      pr: makePR(),
      issueId: "STORY-5",
    });
    vi.mocked(mockSessionManager.get).mockResolvedValue(session);

    writeMetadata(sessionsDir, "app-1", {
      worktree: "/tmp",
      branch: "main",
      status: "approved",
      project: "my-app",
    });

    const lm = createLifecycleManager({
      config: bmadConfig,
      registry: registryWithBmad,
      sessionManager: mockSessionManager,
    });

    await lm.check("app-1");

    // With auto=false and action=send-to-agent, the reaction should NOT execute
    // Instead, the human should be notified directly
    const notifyCalls = vi.mocked(mockNotifier.notify).mock.calls;
    const reactionCall = notifyCalls.find(
      (call: [OrchestratorEvent]) => call[0].type === "reaction.triggered",
    );
    expect(reactionCall).toBeUndefined();

    // Should have a direct notification instead
    const storyDoneCall = notifyCalls.find(
      (call: [OrchestratorEvent]) => call[0].type === "tracker.story_done",
    );
    expect(storyDoneCall).toBeDefined();
  });
});

describe("tracker.sprint_complete", () => {
  function makeTrackerConfig(): OrchestratorConfig {
    return {
      ...config,
      notificationRouting: {
        ...config.notificationRouting,
        action: ["desktop"],
      },
      projects: {
        "my-app": {
          ...config.projects["my-app"]!,
          tracker: { plugin: "bmad" },
        },
      },
    };
  }

  function makeTrackerSCM(): SCM {
    return {
      name: "mock-scm",
      detectPR: vi.fn(),
      getPRState: vi.fn().mockResolvedValue("open"),
      mergePR: vi.fn(),
      closePR: vi.fn(),
      getCIChecks: vi.fn(),
      getCISummary: vi.fn(),
      getReviews: vi.fn(),
      getReviewDecision: vi.fn(),
      getPendingComments: vi.fn(),
      getAutomatedComments: vi.fn(),
      getMergeability: vi.fn(),
    };
  }

  function makeSprintTracker(
    issues: Array<{ id: string; state: "open" | "closed" | "cancelled" }>,
  ): Tracker {
    return {
      name: "bmad",
      getIssue: vi.fn(),
      isCompleted: vi.fn(),
      issueUrl: vi.fn().mockReturnValue(""),
      branchName: vi.fn().mockReturnValue(""),
      generatePrompt: vi.fn(),
      listIssues: vi.fn().mockResolvedValue(
        issues.map((i) => ({
          id: i.id,
          title: `Story ${i.id}`,
          description: "",
          url: `https://example.com/${i.id}`,
          state: i.state,
          labels: [],
        })),
      ),
    };
  }

  it("emits tracker.sprint_complete when all stories are closed", async () => {
    const mockNotifier: Notifier = {
      name: "mock-notifier",
      notify: vi.fn().mockResolvedValue(undefined),
    };

    const bmadConfig = makeTrackerConfig();
    const mockSCM = makeTrackerSCM();
    const tracker = makeSprintTracker([
      { id: "S-1", state: "closed" },
      { id: "S-2", state: "closed" },
    ]);

    const registryWithBmad: PluginRegistry = {
      ...mockRegistry,
      get: vi.fn().mockImplementation((slot: string, name: string) => {
        if (slot === "runtime") return mockRuntime;
        if (slot === "agent") return mockAgent;
        if (slot === "scm") return mockSCM;
        if (slot === "tracker" && name === "bmad") return tracker;
        if (slot === "notifier" && name === "desktop") return mockNotifier;
        return null;
      }),
    };

    // No active sessions so pollAll doesn't attempt session checks
    vi.mocked(mockSessionManager.list).mockResolvedValue([]);

    const lm = createLifecycleManager({
      config: bmadConfig,
      registry: registryWithBmad,
      sessionManager: mockSessionManager,
    });

    lm.start(60_000);

    try {
      await vi.waitFor(() => {
        expect(mockNotifier.notify).toHaveBeenCalledWith(
          expect.objectContaining({ type: "tracker.sprint_complete" }),
        );
      });
    } finally {
      lm.stop();
    }
  });

  it("does not re-emit on second poll cycle (transition guard)", async () => {
    vi.useFakeTimers();

    const mockNotifier: Notifier = {
      name: "mock-notifier",
      notify: vi.fn().mockResolvedValue(undefined),
    };

    const bmadConfig = makeTrackerConfig();
    const mockSCM = makeTrackerSCM();
    const tracker = makeSprintTracker([{ id: "S-1", state: "closed" }]);

    const registryWithBmad: PluginRegistry = {
      ...mockRegistry,
      get: vi.fn().mockImplementation((slot: string, name: string) => {
        if (slot === "runtime") return mockRuntime;
        if (slot === "agent") return mockAgent;
        if (slot === "scm") return mockSCM;
        if (slot === "tracker" && name === "bmad") return tracker;
        if (slot === "notifier" && name === "desktop") return mockNotifier;
        return null;
      }),
    };

    vi.mocked(mockSessionManager.list).mockResolvedValue([]);

    const lm = createLifecycleManager({
      config: bmadConfig,
      registry: registryWithBmad,
      sessionManager: mockSessionManager,
    });

    lm.start(60_000);

    // Let initial pollAll() run
    await vi.advanceTimersByTimeAsync(0);
    // Flush any microtasks
    await vi.advanceTimersByTimeAsync(1);

    // Advance past a second poll interval
    await vi.advanceTimersByTimeAsync(60_000);
    await vi.advanceTimersByTimeAsync(1);

    lm.stop();
    vi.useRealTimers();

    const sprintCalls = vi
      .mocked(mockNotifier.notify)
      .mock.calls.filter((call) => call[0].type === "tracker.sprint_complete");
    expect(sprintCalls).toHaveLength(1);
  });

  it("does not emit when some stories are still open", async () => {
    const mockNotifier: Notifier = {
      name: "mock-notifier",
      notify: vi.fn().mockResolvedValue(undefined),
    };

    const bmadConfig = makeTrackerConfig();
    const mockSCM = makeTrackerSCM();
    const tracker = makeSprintTracker([
      { id: "S-1", state: "closed" },
      { id: "S-2", state: "open" },
    ]);

    const registryWithBmad: PluginRegistry = {
      ...mockRegistry,
      get: vi.fn().mockImplementation((slot: string, name: string) => {
        if (slot === "runtime") return mockRuntime;
        if (slot === "agent") return mockAgent;
        if (slot === "scm") return mockSCM;
        if (slot === "tracker" && name === "bmad") return tracker;
        if (slot === "notifier" && name === "desktop") return mockNotifier;
        return null;
      }),
    };

    vi.mocked(mockSessionManager.list).mockResolvedValue([]);

    const lm = createLifecycleManager({
      config: bmadConfig,
      registry: registryWithBmad,
      sessionManager: mockSessionManager,
    });

    lm.start(60_000);

    try {
      // Give pollAll time to run
      await vi.waitFor(() => {
        expect(tracker.listIssues).toHaveBeenCalled();
      });

      const sprintCalls = vi
        .mocked(mockNotifier.notify)
        .mock.calls.filter((call) => call[0].type === "tracker.sprint_complete");
      expect(sprintCalls).toHaveLength(0);
    } finally {
      lm.stop();
    }
  });

  it("does not emit for projects without tracker configured", async () => {
    const mockNotifier: Notifier = {
      name: "mock-notifier",
      notify: vi.fn().mockResolvedValue(undefined),
    };

    // No tracker configured for this project
    const noTrackerConfig: OrchestratorConfig = {
      ...config,
      notificationRouting: {
        ...config.notificationRouting,
        action: ["desktop"],
      },
      projects: {
        "my-app": {
          ...config.projects["my-app"]!,
          tracker: undefined,
        },
      },
    };

    const registryWithNotifier: PluginRegistry = {
      ...mockRegistry,
      get: vi.fn().mockImplementation((slot: string, name: string) => {
        if (slot === "runtime") return mockRuntime;
        if (slot === "agent") return mockAgent;
        if (slot === "notifier" && name === "desktop") return mockNotifier;
        return null;
      }),
    };

    vi.mocked(mockSessionManager.list).mockResolvedValue([]);

    const lm = createLifecycleManager({
      config: noTrackerConfig,
      registry: registryWithNotifier,
      sessionManager: mockSessionManager,
    });

    lm.start(60_000);

    try {
      await vi.waitFor(() => {
        expect(mockSessionManager.list).toHaveBeenCalled();
      });

      const sprintCalls = vi
        .mocked(mockNotifier.notify)
        .mock.calls.filter((call) => call[0].type === "tracker.sprint_complete");
      expect(sprintCalls).toHaveLength(0);
    } finally {
      lm.stop();
    }
  });

  it("emits tracker.sprint_complete when all stories are cancelled", async () => {
    const mockNotifier: Notifier = {
      name: "mock-notifier",
      notify: vi.fn().mockResolvedValue(undefined),
    };

    const bmadConfig = makeTrackerConfig();
    const mockSCM = makeTrackerSCM();
    const tracker = makeSprintTracker([
      { id: "S-1", state: "cancelled" },
      { id: "S-2", state: "cancelled" },
    ]);

    const registryWithBmad: PluginRegistry = {
      ...mockRegistry,
      get: vi.fn().mockImplementation((slot: string, name: string) => {
        if (slot === "runtime") return mockRuntime;
        if (slot === "agent") return mockAgent;
        if (slot === "scm") return mockSCM;
        if (slot === "tracker" && name === "bmad") return tracker;
        if (slot === "notifier" && name === "desktop") return mockNotifier;
        return null;
      }),
    };

    vi.mocked(mockSessionManager.list).mockResolvedValue([]);

    const lm = createLifecycleManager({
      config: bmadConfig,
      registry: registryWithBmad,
      sessionManager: mockSessionManager,
    });

    lm.start(60_000);

    try {
      await vi.waitFor(() => {
        expect(mockNotifier.notify).toHaveBeenCalledWith(
          expect.objectContaining({ type: "tracker.sprint_complete" }),
        );
      });
    } finally {
      lm.stop();
    }
  });

  it("emits tracker.sprint_complete for mixed closed and cancelled", async () => {
    const mockNotifier: Notifier = {
      name: "mock-notifier",
      notify: vi.fn().mockResolvedValue(undefined),
    };

    const bmadConfig = makeTrackerConfig();
    const mockSCM = makeTrackerSCM();
    const tracker = makeSprintTracker([
      { id: "S-1", state: "closed" },
      { id: "S-2", state: "cancelled" },
    ]);

    const registryWithBmad: PluginRegistry = {
      ...mockRegistry,
      get: vi.fn().mockImplementation((slot: string, name: string) => {
        if (slot === "runtime") return mockRuntime;
        if (slot === "agent") return mockAgent;
        if (slot === "scm") return mockSCM;
        if (slot === "tracker" && name === "bmad") return tracker;
        if (slot === "notifier" && name === "desktop") return mockNotifier;
        return null;
      }),
    };

    vi.mocked(mockSessionManager.list).mockResolvedValue([]);

    const lm = createLifecycleManager({
      config: bmadConfig,
      registry: registryWithBmad,
      sessionManager: mockSessionManager,
    });

    lm.start(60_000);

    try {
      await vi.waitFor(() => {
        expect(mockNotifier.notify).toHaveBeenCalledWith(
          expect.objectContaining({ type: "tracker.sprint_complete" }),
        );
      });
    } finally {
      lm.stop();
    }
  });

  it("does not emit for empty issue list", async () => {
    const mockNotifier: Notifier = {
      name: "mock-notifier",
      notify: vi.fn().mockResolvedValue(undefined),
    };

    const bmadConfig = makeTrackerConfig();
    const mockSCM = makeTrackerSCM();
    const tracker = makeSprintTracker([]);

    const registryWithBmad: PluginRegistry = {
      ...mockRegistry,
      get: vi.fn().mockImplementation((slot: string, name: string) => {
        if (slot === "runtime") return mockRuntime;
        if (slot === "agent") return mockAgent;
        if (slot === "scm") return mockSCM;
        if (slot === "tracker" && name === "bmad") return tracker;
        if (slot === "notifier" && name === "desktop") return mockNotifier;
        return null;
      }),
    };

    vi.mocked(mockSessionManager.list).mockResolvedValue([]);

    const lm = createLifecycleManager({
      config: bmadConfig,
      registry: registryWithBmad,
      sessionManager: mockSessionManager,
    });

    lm.start(60_000);

    try {
      await vi.waitFor(() => {
        expect(tracker.listIssues).toHaveBeenCalled();
      });

      const sprintCalls = vi
        .mocked(mockNotifier.notify)
        .mock.calls.filter((call) => call[0].type === "tracker.sprint_complete");
      expect(sprintCalls).toHaveLength(0);
    } finally {
      lm.stop();
    }
  });

  it("still notifies when reaction is configured with auto:false", async () => {
    const mockNotifier: Notifier = {
      name: "mock-notifier",
      notify: vi.fn().mockResolvedValue(undefined),
    };

    const bmadConfig: OrchestratorConfig = {
      ...makeTrackerConfig(),
      reactions: {
        "tracker-sprint-complete": {
          auto: false,
          action: "send-to-agent" as const,
          message: "Sprint complete",
        },
      },
    };
    const mockSCM = makeTrackerSCM();
    const tracker = makeSprintTracker([
      { id: "S-1", state: "closed" },
      { id: "S-2", state: "closed" },
    ]);

    const registryWithBmad: PluginRegistry = {
      ...mockRegistry,
      get: vi.fn().mockImplementation((slot: string, name: string) => {
        if (slot === "runtime") return mockRuntime;
        if (slot === "agent") return mockAgent;
        if (slot === "scm") return mockSCM;
        if (slot === "tracker" && name === "bmad") return tracker;
        if (slot === "notifier" && name === "desktop") return mockNotifier;
        return null;
      }),
    };

    vi.mocked(mockSessionManager.list).mockResolvedValue([]);

    const lm = createLifecycleManager({
      config: bmadConfig,
      registry: registryWithBmad,
      sessionManager: mockSessionManager,
    });

    lm.start(60_000);

    try {
      // Even with auto:false reaction, notifyHuman should still be called as fallback
      await vi.waitFor(() => {
        expect(mockNotifier.notify).toHaveBeenCalledWith(
          expect.objectContaining({ type: "tracker.sprint_complete" }),
        );
      });
    } finally {
      lm.stop();
    }
  });

  it("gracefully handles listIssues throwing", async () => {
    const mockNotifier: Notifier = {
      name: "mock-notifier",
      notify: vi.fn().mockResolvedValue(undefined),
    };

    const bmadConfig = makeTrackerConfig();
    const mockSCM = makeTrackerSCM();
    const tracker: Tracker = {
      name: "bmad",
      getIssue: vi.fn(),
      isCompleted: vi.fn(),
      issueUrl: vi.fn().mockReturnValue(""),
      branchName: vi.fn().mockReturnValue(""),
      generatePrompt: vi.fn(),
      listIssues: vi.fn().mockRejectedValue(new Error("network error")),
    };

    const registryWithBmad: PluginRegistry = {
      ...mockRegistry,
      get: vi.fn().mockImplementation((slot: string, name: string) => {
        if (slot === "runtime") return mockRuntime;
        if (slot === "agent") return mockAgent;
        if (slot === "scm") return mockSCM;
        if (slot === "tracker" && name === "bmad") return tracker;
        if (slot === "notifier" && name === "desktop") return mockNotifier;
        return null;
      }),
    };

    vi.mocked(mockSessionManager.list).mockResolvedValue([]);

    const lm = createLifecycleManager({
      config: bmadConfig,
      registry: registryWithBmad,
      sessionManager: mockSessionManager,
    });

    lm.start(60_000);

    try {
      await vi.waitFor(() => {
        expect(tracker.listIssues).toHaveBeenCalled();
      });

      // No crash, no sprint_complete event
      const sprintCalls = vi
        .mocked(mockNotifier.notify)
        .mock.calls.filter((call) => call[0].type === "tracker.sprint_complete");
      expect(sprintCalls).toHaveLength(0);
    } finally {
      lm.stop();
    }
  });
});

describe("getStates", () => {
  it("returns copy of states map", async () => {
    const session = makeSession({ status: "spawning" });
    vi.mocked(mockSessionManager.get).mockResolvedValue(session);

    writeMetadata(sessionsDir, "app-1", {
      worktree: "/tmp",
      branch: "main",
      status: "spawning",
      project: "my-app",
    });

    const lm = createLifecycleManager({
      config,
      registry: mockRegistry,
      sessionManager: mockSessionManager,
    });

    await lm.check("app-1");

    const states = lm.getStates();
    expect(states.get("app-1")).toBe("working");

    // Modifying returned map shouldn't affect internal state
    states.set("app-1", "killed");
    expect(lm.getStates().get("app-1")).toBe("working");
  });
});
