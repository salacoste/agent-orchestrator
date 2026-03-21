import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdirSync, rmSync, writeFileSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";
import { createSessionManager } from "../session-manager.js";
import {
  writeMetadata,
  readMetadataRaw,
  readArchivedMetadataRaw,
  updateMetadata,
} from "../metadata.js";
import { getSessionsDir, getProjectBaseDir } from "../paths.js";
import type {
  OrchestratorConfig,
  PluginRegistry,
  Runtime,
  Agent,
  Workspace,
  RuntimeHandle,
} from "../types.js";

let tmpDir: string;
let configPath: string;
let sessionsDir: string;
let projectPath: string;
let mockRuntime: Runtime;
let mockAgent: Agent;
let mockWorkspace: Workspace;
let mockRegistry: PluginRegistry;
let config: OrchestratorConfig;

function makeHandle(id: string): RuntimeHandle {
  return { id, runtimeName: "mock", data: {} };
}

beforeEach(() => {
  tmpDir = join(tmpdir(), `ao-test-kill-story-${randomUUID()}`);
  mkdirSync(tmpDir, { recursive: true });

  projectPath = join(tmpDir, "my-app");
  mkdirSync(projectPath, { recursive: true });

  configPath = join(tmpDir, "agent-orchestrator.yaml");
  writeFileSync(configPath, "projects: {}\n");

  mockRuntime = {
    name: "mock",
    create: vi.fn().mockResolvedValue(makeHandle("rt-1")),
    destroy: vi.fn().mockResolvedValue(undefined),
    sendMessage: vi.fn().mockResolvedValue(undefined),
    getOutput: vi.fn().mockResolvedValue(""),
    isAlive: vi.fn().mockResolvedValue(true),
  };

  mockAgent = {
    name: "mock-agent",
    processName: "mock",
    getLaunchCommand: vi.fn().mockReturnValue("mock-agent --start"),
    getEnvironment: vi.fn().mockReturnValue({}),
    detectActivity: vi.fn().mockReturnValue("active"),
    getActivityState: vi.fn().mockResolvedValue({ state: "active" }),
    isProcessRunning: vi.fn().mockResolvedValue(true),
    getSessionInfo: vi.fn().mockResolvedValue(null),
  };

  mockWorkspace = {
    name: "mock-ws",
    create: vi.fn().mockResolvedValue({
      path: "/tmp/mock-ws/app-1",
      branch: "feat/TEST-1",
      sessionId: "app-1",
      projectId: "my-app",
    }),
    destroy: vi.fn().mockResolvedValue(undefined),
    list: vi.fn().mockResolvedValue([]),
  };

  mockRegistry = {
    register: vi.fn(),
    get: vi.fn().mockImplementation((slot: string) => {
      if (slot === "runtime") return mockRuntime;
      if (slot === "agent") return mockAgent;
      if (slot === "workspace") return mockWorkspace;
      return null;
    }),
    list: vi.fn().mockReturnValue([]),
    loadBuiltins: vi.fn().mockResolvedValue(undefined),
    loadFromConfig: vi.fn().mockResolvedValue(undefined),
    shutdown: vi.fn().mockResolvedValue(true),
    shutdownAll: vi.fn().mockResolvedValue(undefined),
    reload: vi.fn().mockResolvedValue(true),
    getPluginState: vi.fn().mockReturnValue(null),
    isRegistered: vi.fn().mockReturnValue(false),
  };

  config = {
    configPath,
    port: 5000,
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
        path: projectPath,
        defaultBranch: "main",
        sessionPrefix: "app",
        scm: { plugin: "github" },
        tracker: { plugin: "github" },
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

  sessionsDir = getSessionsDir(configPath, projectPath);
  mkdirSync(sessionsDir, { recursive: true });
});

afterEach(() => {
  const projectBaseDir = getProjectBaseDir(configPath, projectPath);
  if (existsSync(projectBaseDir)) {
    rmSync(projectBaseDir, { recursive: true, force: true });
  }
  rmSync(tmpDir, { recursive: true, force: true });
});

describe("kill — story cleanup integration", () => {
  it("updates sprint status to 'blocked' when killing a story-assigned session", async () => {
    // Arrange: Create session with storyId + sprint-status.yaml with in-progress
    const storyDir = join(projectPath, "_bmad-output/implementation-artifacts");
    mkdirSync(storyDir, { recursive: true });
    writeFileSync(
      join(storyDir, "sprint-status.yaml"),
      `generated: 2026-03-10
project: my-app
development_status:
  epic-1: in-progress
  1-5-my-story: in-progress
`,
      "utf-8",
    );

    writeMetadata(sessionsDir, "app-1", {
      worktree: "/tmp/ws",
      branch: "main",
      status: "working",
      project: "my-app",
      runtimeHandle: JSON.stringify(makeHandle("rt-1")),
    });
    // storyId is not part of SessionMetadata — written via updateMetadata by agent registry
    updateMetadata(sessionsDir, "app-1", { storyId: "1-5-my-story" });

    const sm = createSessionManager({ config, registry: mockRegistry });
    await sm.kill("app-1");

    // Assert: sprint-status.yaml should now show "blocked"
    const content = readFileSync(join(storyDir, "sprint-status.yaml"), "utf-8");
    expect(content).toContain("1-5-my-story: blocked");
  });

  it("stores disconnected reason in metadata before archiving", async () => {
    // Arrange: Session with storyId
    writeMetadata(sessionsDir, "app-2", {
      worktree: "/tmp/ws",
      branch: "main",
      status: "working",
      project: "my-app",
      runtimeHandle: JSON.stringify(makeHandle("rt-2")),
    });
    updateMetadata(sessionsDir, "app-2", { storyId: "1-6-another-story" });

    // Read metadata before kill to verify storyId is present
    const preMeta = readMetadataRaw(sessionsDir, "app-2");
    expect(preMeta?.["storyId"]).toBe("1-6-another-story");

    const sm = createSessionManager({ config, registry: mockRegistry });
    await sm.kill("app-2");

    // After kill, metadata is archived. Check the archived version.
    const archivedRaw = readArchivedMetadataRaw(sessionsDir, "app-2");
    // The failureReason and agentStatus should be set before archiving
    expect(archivedRaw?.["failureReason"]).toBe("disconnected");
    expect(archivedRaw?.["agentStatus"]).toBe("disconnected");
  });

  it("does NOT touch sprint status for non-story sessions", async () => {
    // Arrange: Session without storyId + sprint-status.yaml
    const storyDir = join(projectPath, "_bmad-output/implementation-artifacts");
    mkdirSync(storyDir, { recursive: true });
    writeFileSync(
      join(storyDir, "sprint-status.yaml"),
      `generated: 2026-03-10
project: my-app
development_status:
  1-5-my-story: in-progress
`,
      "utf-8",
    );

    writeMetadata(sessionsDir, "app-3", {
      worktree: "/tmp/ws",
      branch: "main",
      status: "working",
      project: "my-app",
      // No storyId — regular spawn without --story
      runtimeHandle: JSON.stringify(makeHandle("rt-3")),
    });

    const sm = createSessionManager({ config, registry: mockRegistry });
    await sm.kill("app-3");

    // Assert: sprint-status.yaml should be unchanged
    const content = readFileSync(join(storyDir, "sprint-status.yaml"), "utf-8");
    expect(content).toContain("1-5-my-story: in-progress");
    expect(content).not.toContain("blocked");
  });

  it("does NOT change story status to 'blocked' when story is already 'done'", async () => {
    // Arrange: Session with storyId + sprint-status.yaml with "done"
    const storyDir = join(projectPath, "_bmad-output/implementation-artifacts");
    mkdirSync(storyDir, { recursive: true });
    writeFileSync(
      join(storyDir, "sprint-status.yaml"),
      `generated: 2026-03-10
project: my-app
development_status:
  epic-1: in-progress
  1-5-my-story: done
`,
      "utf-8",
    );

    writeMetadata(sessionsDir, "app-4", {
      worktree: "/tmp/ws",
      branch: "main",
      status: "working",
      project: "my-app",
      runtimeHandle: JSON.stringify(makeHandle("rt-4")),
    });
    updateMetadata(sessionsDir, "app-4", { storyId: "1-5-my-story" });

    const sm = createSessionManager({ config, registry: mockRegistry });
    await sm.kill("app-4");

    // Assert: sprint-status.yaml should still show "done" (not "blocked")
    const content = readFileSync(join(storyDir, "sprint-status.yaml"), "utf-8");
    expect(content).toContain("1-5-my-story: done");
    expect(content).not.toContain("1-5-my-story: blocked");
  });
});
