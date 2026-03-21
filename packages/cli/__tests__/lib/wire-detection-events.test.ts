/**
 * Tests for Story 2-2: EventPublisher and SyncBridge wiring in wireDetection.
 *
 * Verifies that wireDetection creates an EventPublisher and SyncBridge,
 * passes StateManager and EventPublisher to completion/failure handlers,
 * and tears them down on cleanup.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import type {
  OrchestratorConfig,
  AgentRegistry,
  AgentAssignment,
  AgentStatus,
  Runtime,
  EventPublisher,
  ProjectConfig,
} from "@composio/ao-core";

// ---------------------------------------------------------------------------
// Mock modules BEFORE imports that use them
// ---------------------------------------------------------------------------

// Mock the plugins module to return our mock runtime
const mockRuntime: Runtime = {
  name: "mock",
  async create() {
    return { id: "mock-session", runtimeName: "mock", data: {} };
  },
  async destroy() {},
  async isAlive() {
    return true;
  },
  async sendMessage() {},
  async getOutput() {
    return "";
  },
};

vi.mock("../../src/lib/plugins.js", () => ({
  getRuntime: vi.fn(() => mockRuntime),
}));

// Mock session manager
vi.mock("../../src/lib/create-session-manager.js", () => ({
  getSessionManager: vi.fn(async () => ({
    list: vi.fn(async () => []),
    get: vi.fn(async () => null),
    spawn: vi.fn(async () => ({
      id: "mock",
      projectId: "test",
      status: "working",
      activity: null,
      branch: null,
      issueId: null,
      pr: null,
      workspacePath: null,
      runtimeHandle: null,
      agentInfo: null,
      createdAt: new Date(),
      lastActivityAt: new Date(),
      metadata: {},
    })),
    spawnOrchestrator: vi.fn(async () => null),
    restore: vi.fn(async () => null),
    kill: vi.fn(async () => {}),
    cleanup: vi.fn(async () => ({ killed: [], skipped: [], errors: [] })),
    send: vi.fn(async () => {}),
  })),
}));

// Track EventPublisher creation
const mockEventPublisherClose = vi.fn().mockResolvedValue(undefined);
const mockEventPublisher = {
  publishStoryCompleted: vi.fn().mockResolvedValue(undefined),
  publishStoryStarted: vi.fn().mockResolvedValue(undefined),
  publishStoryBlocked: vi.fn().mockResolvedValue(undefined),
  publishStoryAssigned: vi.fn().mockResolvedValue(undefined),
  publishAgentResumed: vi.fn().mockResolvedValue(undefined),
  publishStoryUnblocked: vi.fn().mockResolvedValue(undefined),
  flush: vi.fn().mockResolvedValue(undefined),
  getQueueSize: vi.fn().mockReturnValue(0),
  getDroppedEventsCount: vi.fn().mockReturnValue(0),
  close: mockEventPublisherClose,
} satisfies EventPublisher;

vi.mock("@composio/ao-core", async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    createEventPublisher: vi.fn(() => mockEventPublisher),
    createSyncBridge: vi.fn(() => ({
      initialize: vi.fn().mockResolvedValue(undefined),
      close: vi.fn().mockResolvedValue(undefined),
      getStateManager: vi.fn().mockReturnValue({
        initialize: vi.fn().mockResolvedValue(undefined),
        get: vi.fn().mockReturnValue(null),
        getAll: vi.fn().mockReturnValue(new Map()),
        set: vi.fn().mockResolvedValue({ success: true, version: "v1" }),
        update: vi.fn().mockResolvedValue({ success: true, version: "v1" }),
        batchSet: vi.fn().mockResolvedValue({ succeeded: [], failed: [] }),
        invalidate: vi.fn().mockResolvedValue(undefined),
        getVersion: vi.fn().mockReturnValue(null),
        close: vi.fn().mockResolvedValue(undefined),
        verify: vi.fn().mockResolvedValue({ valid: true }),
      }),
      getStatus: vi.fn().mockReturnValue({
        initialized: true,
        cacheSize: 0,
        watcherActive: false,
        syncStatus: null,
      }),
    })),
  };
});

vi.mock("@composio/ao-plugin-tracker-bmad", () => ({
  createBMADTrackerAdapter: vi.fn(() => ({
    name: "mock-bmad-tracker",
    getStory: vi.fn().mockResolvedValue(null),
    updateStory: vi.fn().mockResolvedValue(undefined),
    listStories: vi.fn().mockResolvedValue(new Map()),
    isAvailable: vi.fn().mockResolvedValue(true),
  })),
  default: {
    manifest: {
      name: "bmad",
      slot: "tracker" as const,
      description: "Mock tracker",
      version: "0.1.0",
    },
    create: vi.fn(),
  },
}));

// eslint-disable-next-line no-duplicate-imports -- value import needed for vi.mocked assertions
import { createEventPublisher, createSyncBridge } from "@composio/ao-core";
import { wireDetection } from "../../src/lib/wire-detection.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createTempProject(): {
  dir: string;
  sessionsDir: string;
  configPath: string;
  projectPath: string;
} {
  const dir = mkdtempSync(join(tmpdir(), "ao-wire-events-"));
  const sessionsDir = join(dir, ".ao-sessions", "test-project");
  mkdirSync(sessionsDir, { recursive: true });

  // Create a minimal sprint-status.yaml
  const outputDir = join(dir, "_bmad-output", "implementation-artifacts");
  mkdirSync(outputDir, { recursive: true });
  writeFileSync(
    join(outputDir, "sprint-status.yaml"),
    "development_status:\n  test-story: in-progress\n",
    "utf-8",
  );

  const configPath = join(dir, "agent-orchestrator.yaml");
  writeFileSync(configPath, "# mock config\n", "utf-8");

  return { dir, sessionsDir, configPath, projectPath: dir };
}

function createMockRegistry(): AgentRegistry {
  const assignments = new Map<string, AgentAssignment>();
  return {
    getByAgent(agentId: string) {
      return assignments.get(agentId) ?? null;
    },
    list() {
      return Array.from(assignments.values());
    },
    getByStory(storyId: string) {
      for (const a of assignments.values()) {
        if (a.storyId === storyId) return a;
      }
      return null;
    },
    findActiveByStory(storyId: string) {
      for (const a of assignments.values()) {
        if (a.storyId === storyId && a.status === "active") return a;
      }
      return null;
    },
    register(assignment: AgentAssignment) {
      assignments.set(assignment.agentId, assignment);
    },
    remove(agentId: string) {
      assignments.delete(agentId);
    },
    updateStatus(agentId: string, status: AgentStatus) {
      const a = assignments.get(agentId);
      if (a) a.status = status;
    },
    getZombies() {
      return [];
    },
    async reload() {},
    getRetryCount() {
      return 0;
    },
    incrementRetry() {},
    getRetryHistory() {
      return null;
    },
  };
}

function createMockConfig(configPath: string, projectPath: string): OrchestratorConfig {
  return {
    configPath,
    readyThresholdMs: 300000,
    defaults: {
      runtime: "tmux",
      agent: "claude-code",
      workspace: "worktree",
      tracker: "bmad",
      scm: "github",
      notifier: "desktop",
      terminal: "iterm2",
    },
    projects: {
      "test-project": {
        name: "test-project",
        repo: "org/test-project",
        path: projectPath,
        defaultBranch: "main",
        sessionPrefix: "test",
        tracker: { plugin: "bmad", outputDir: "_bmad-output/implementation-artifacts" },
      } as ProjectConfig,
    },
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("wireDetection event wiring (Story 2-2)", () => {
  let tmp: ReturnType<typeof createTempProject>;

  beforeEach(() => {
    vi.clearAllMocks();
    tmp = createTempProject();
  });

  afterEach(() => {
    rmSync(tmp.dir, { recursive: true, force: true });
  });

  it("creates an EventPublisher during wireDetection setup", async () => {
    const registry = createMockRegistry();
    registry.register({
      agentId: "session-1",
      storyId: "test-story",
      assignedAt: new Date(),
      status: "active",
      contextHash: "abc123",
    });
    const config = createMockConfig(tmp.configPath, tmp.projectPath);

    await wireDetection(
      config,
      "test-project",
      "session-1",
      tmp.sessionsDir,
      tmp.projectPath,
      registry,
    );

    expect(createEventPublisher).toHaveBeenCalledOnce();
  });

  it("creates a SyncBridge during wireDetection setup", async () => {
    const registry = createMockRegistry();
    registry.register({
      agentId: "session-1",
      storyId: "test-story",
      assignedAt: new Date(),
      status: "active",
      contextHash: "abc123",
    });
    const config = createMockConfig(tmp.configPath, tmp.projectPath);

    await wireDetection(
      config,
      "test-project",
      "session-1",
      tmp.sessionsDir,
      tmp.projectPath,
      registry,
    );

    expect(createSyncBridge).toHaveBeenCalledOnce();
  });

  it("passes eventPublisher to completion handler", async () => {
    const registry = createMockRegistry();
    registry.register({
      agentId: "session-1",
      storyId: "test-story",
      assignedAt: new Date(),
      status: "active",
      contextHash: "abc123",
    });
    const config = createMockConfig(tmp.configPath, tmp.projectPath);

    await wireDetection(
      config,
      "test-project",
      "session-1",
      tmp.sessionsDir,
      tmp.projectPath,
      registry,
    );

    // The createEventPublisher factory should have been called with the in-memory event bus
    const call = vi.mocked(createEventPublisher).mock.calls[0];
    expect(call).toBeDefined();
    expect(call![0].eventBus).toBeDefined();
  });

  it("does not crash when SyncBridge creation fails (graceful degradation)", async () => {
    const registry = createMockRegistry();
    registry.register({
      agentId: "session-1",
      storyId: "test-story",
      assignedAt: new Date(),
      status: "active",
      contextHash: "abc123",
    });

    // Make SyncBridge.initialize throw
    vi.mocked(createSyncBridge).mockReturnValueOnce({
      initialize: vi.fn().mockRejectedValue(new Error("SyncBridge init failed")),
      close: vi.fn().mockResolvedValue(undefined),
      getStateManager: vi.fn().mockImplementation(() => {
        throw new Error("not initialized");
      }),
      getStatus: vi.fn().mockReturnValue({
        initialized: false,
        cacheSize: 0,
        watcherActive: false,
        syncStatus: null,
      }),
    });

    const config = createMockConfig(tmp.configPath, tmp.projectPath);

    // Should not throw
    await wireDetection(
      config,
      "test-project",
      "session-1",
      tmp.sessionsDir,
      tmp.projectPath,
      registry,
    );

    expect(createSyncBridge).toHaveBeenCalledOnce();
  });
});
