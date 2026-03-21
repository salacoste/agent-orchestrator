/**
 * Tests for completion/blocked detection wiring (Story 1.3, Tasks 3-5)
 *
 * Validates that:
 * - Completion handler updates registry and sprint status
 * - Failure handler updates registry and sprint status
 * - Blocked detection triggers registry status updates
 * - Agent resume after blocked detection restores "active" status
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  createAgentCompletionDetector,
  createBlockedAgentDetector,
  createCompletionHandler,
  createFailureHandler,
  type AgentRegistry,
  type AgentAssignment,
  type AgentStatus,
  type EventBus,
  type EventBusEvent,
  type EventSubscriber,
  type Runtime,
  type SessionManager,
  type Session,
  type SessionId,
  type CleanupResult,
} from "../index.js";
import type { StateManager } from "../types.js";

// Helper: create temp directory with sprint-status.yaml
function createTempProject(): { dir: string; storyDir: string; configPath: string } {
  const dir = mkdtempSync(join(tmpdir(), "ao-completion-test-"));
  const storyDir = join(dir, "stories");
  mkdirSync(storyDir, { recursive: true });

  writeFileSync(
    join(storyDir, "sprint-status.yaml"),
    [
      "project: test-project",
      "development_status:",
      "  1-1-first-story: done",
      "  1-2-second-story: in-progress",
      "  1-3-third-story: backlog",
      "dependencies:",
      "  1-3-third-story:",
      "    - 1-2-second-story",
      "",
    ].join("\n"),
    "utf-8",
  );

  const configPath = join(dir, "agent-orchestrator.yaml");
  writeFileSync(configPath, "# mock config\n", "utf-8");

  // Create sessions dir for metadata
  const sessionsDir = join(dir, ".ao-sessions", "test-project");
  mkdirSync(sessionsDir, { recursive: true });

  return { dir, storyDir, configPath };
}

function createMockRegistry(): AgentRegistry & {
  _assignments: Map<string, AgentAssignment>;
  _statusUpdates: Array<{ agentId: string; status: AgentStatus }>;
} {
  const assignments = new Map<string, AgentAssignment>();
  const statusUpdates: Array<{ agentId: string; status: AgentStatus }> = [];

  return {
    _assignments: assignments,
    _statusUpdates: statusUpdates,
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
      statusUpdates.push({ agentId, status });
      const assignment = assignments.get(agentId);
      if (assignment) {
        assignment.status = status;
      }
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

function createMockRuntime(alive = true): Runtime {
  return {
    name: "mock",
    async create() {
      return { id: "mock-session", runtimeName: "mock", data: {} };
    },
    async destroy() {},
    async isAlive() {
      return alive;
    },
    async sendMessage() {},
    async getOutput() {
      return "";
    },
  };
}

function createInMemoryEventBus(): EventBus & { _events: EventBusEvent[] } {
  const subscribers: EventSubscriber[] = [];
  const events: EventBusEvent[] = [];
  return {
    name: "test-in-memory",
    _events: events,
    async publish(event) {
      const fullEvent: EventBusEvent = {
        eventId: `test-${Date.now()}`,
        timestamp: new Date().toISOString(),
        ...event,
      };
      events.push(fullEvent);
      for (const sub of subscribers) {
        sub(fullEvent);
      }
    },
    async subscribe(callback) {
      subscribers.push(callback);
      return () => {
        const idx = subscribers.indexOf(callback);
        if (idx >= 0) subscribers.splice(idx, 1);
      };
    },
    isConnected: () => true,
    isDegraded: () => false,
    getQueueSize: () => 0,
    async close() {
      subscribers.length = 0;
    },
  };
}

function createMockSessionManager(): SessionManager {
  const mockSession: Session = {
    id: "mock-session" as SessionId,
    projectId: "test-project",
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
  };
  return {
    list: vi.fn(async (): Promise<Session[]> => []),
    get: vi.fn(async (): Promise<Session | null> => null),
    spawn: vi.fn(async () => mockSession),
    spawnOrchestrator: vi.fn(async () => mockSession),
    restore: vi.fn(async () => mockSession),
    kill: vi.fn(async () => {}),
    cleanup: vi.fn(async (): Promise<CleanupResult> => ({ killed: [], skipped: [], errors: [] })),
    send: vi.fn(async () => {}),
  };
}

describe("Completion Handler (Task 6.7)", () => {
  let tmpProject: ReturnType<typeof createTempProject>;

  beforeEach(() => {
    tmpProject = createTempProject();
  });

  afterEach(() => {
    rmSync(tmpProject.dir, { recursive: true, force: true });
  });

  it("updates sprint status to 'done' on completion", async () => {
    const registry = createMockRegistry();
    registry.register({
      agentId: "agent-1",
      storyId: "1-2-second-story",
      assignedAt: new Date(),
      status: "active",
      contextHash: "hash1",
    });

    const handler = createCompletionHandler(
      registry,
      tmpProject.storyDir,
      tmpProject.configPath,
      join(tmpProject.dir, ".audit"),
    );

    await handler({
      agentId: "agent-1",
      storyId: "1-2-second-story",
      exitCode: 0,
      duration: 60000,
      completedAt: new Date(),
    });

    // Sprint status should be updated to "done"
    const yaml = readFileSync(join(tmpProject.storyDir, "sprint-status.yaml"), "utf-8");
    expect(yaml).toContain("1-2-second-story: done");
  });

  it("removes agent from registry on completion", async () => {
    const registry = createMockRegistry();
    registry.register({
      agentId: "agent-1",
      storyId: "1-2-second-story",
      assignedAt: new Date(),
      status: "active",
      contextHash: "hash1",
    });

    const handler = createCompletionHandler(
      registry,
      tmpProject.storyDir,
      tmpProject.configPath,
      join(tmpProject.dir, ".audit"),
    );

    await handler({
      agentId: "agent-1",
      storyId: "1-2-second-story",
      exitCode: 0,
      duration: 60000,
      completedAt: new Date(),
    });

    // Agent should be removed from registry
    expect(registry.getByAgent("agent-1")).toBeNull();
  });

  it("unblocks dependent stories when all deps are done", async () => {
    const registry = createMockRegistry();
    registry.register({
      agentId: "agent-1",
      storyId: "1-2-second-story",
      assignedAt: new Date(),
      status: "active",
      contextHash: "hash1",
    });

    const handler = createCompletionHandler(
      registry,
      tmpProject.storyDir,
      tmpProject.configPath,
      join(tmpProject.dir, ".audit"),
    );

    await handler({
      agentId: "agent-1",
      storyId: "1-2-second-story",
      exitCode: 0,
      duration: 60000,
      completedAt: new Date(),
    });

    // 1-3-third-story depends on 1-2-second-story. Since 1-1-first-story is already done
    // and 1-2-second-story just completed, 1-3-third-story should be unblocked
    const yaml = readFileSync(join(tmpProject.storyDir, "sprint-status.yaml"), "utf-8");
    expect(yaml).toContain("1-3-third-story: ready-for-dev");
  });
});

describe("Failure Handler (Task 6.8)", () => {
  let tmpProject: ReturnType<typeof createTempProject>;

  beforeEach(() => {
    tmpProject = createTempProject();
  });

  afterEach(() => {
    rmSync(tmpProject.dir, { recursive: true, force: true });
  });

  it("updates sprint status to 'blocked' on failure", async () => {
    const registry = createMockRegistry();
    registry.register({
      agentId: "agent-1",
      storyId: "1-2-second-story",
      assignedAt: new Date(),
      status: "active",
      contextHash: "hash1",
    });

    const handler = createFailureHandler(
      registry,
      tmpProject.storyDir,
      tmpProject.configPath,
      join(tmpProject.dir, ".audit"),
    );

    await handler({
      agentId: "agent-1",
      storyId: "1-2-second-story",
      reason: "failed",
      failedAt: new Date(),
      duration: 30000,
      exitCode: 1,
    });

    // Sprint status should be updated to "blocked"
    const yaml = readFileSync(join(tmpProject.storyDir, "sprint-status.yaml"), "utf-8");
    expect(yaml).toContain("1-2-second-story: blocked");
  });

  it("removes agent from registry on failure", async () => {
    const registry = createMockRegistry();
    registry.register({
      agentId: "agent-1",
      storyId: "1-2-second-story",
      assignedAt: new Date(),
      status: "active",
      contextHash: "hash1",
    });

    const handler = createFailureHandler(
      registry,
      tmpProject.storyDir,
      tmpProject.configPath,
      join(tmpProject.dir, ".audit"),
    );

    await handler({
      agentId: "agent-1",
      storyId: "1-2-second-story",
      reason: "crashed",
      failedAt: new Date(),
      duration: 30000,
    });

    expect(registry.getByAgent("agent-1")).toBeNull();
  });

  it("does not update sprint status on 'disconnected' reason", async () => {
    const registry = createMockRegistry();
    registry.register({
      agentId: "agent-1",
      storyId: "1-2-second-story",
      assignedAt: new Date(),
      status: "active",
      contextHash: "hash1",
    });

    const handler = createFailureHandler(
      registry,
      tmpProject.storyDir,
      tmpProject.configPath,
      join(tmpProject.dir, ".audit"),
    );

    await handler({
      agentId: "agent-1",
      storyId: "1-2-second-story",
      reason: "disconnected",
      failedAt: new Date(),
      duration: 30000,
    });

    // Sprint status should NOT be changed for disconnected (manual termination)
    const yaml = readFileSync(join(tmpProject.storyDir, "sprint-status.yaml"), "utf-8");
    expect(yaml).toContain("1-2-second-story: in-progress");
  });
});

describe("Blocked Detection (Task 6.9, 6.10)", () => {
  let tmpProject: ReturnType<typeof createTempProject>;

  beforeEach(() => {
    tmpProject = createTempProject();
    vi.useFakeTimers();
  });

  afterEach(() => {
    rmSync(tmpProject.dir, { recursive: true, force: true });
    vi.useRealTimers();
  });

  it("publishes agent.blocked event after inactivity timeout", async () => {
    const eventBus = createInMemoryEventBus();
    const registry = createMockRegistry();
    registry.register({
      agentId: "claude-agent-1",
      storyId: "1-2-second-story",
      assignedAt: new Date(),
      status: "active",
      contextHash: "hash1",
    });

    const detector = createBlockedAgentDetector({
      eventBus,
      registry,
      sessionManager: createMockSessionManager(),
    });

    await detector.trackActivity("claude-agent-1");

    // Advance past the default 10-minute timeout and manually trigger check
    vi.advanceTimersByTime(11 * 60 * 1000);
    await detector.checkBlocked();

    // Should have published an agent.blocked event
    const blockedEvents = eventBus._events.filter((e) => e.eventType === "agent.blocked");
    expect(blockedEvents.length).toBe(1);
    expect(blockedEvents[0].metadata["agentId"]).toBe("claude-agent-1");

    await detector.close();
  });

  it("publishes agent.resumed event when activity resumes after blocked", async () => {
    const eventBus = createInMemoryEventBus();
    const registry = createMockRegistry();
    registry.register({
      agentId: "claude-agent-1",
      storyId: "1-2-second-story",
      assignedAt: new Date(),
      status: "active",
      contextHash: "hash1",
    });

    const detector = createBlockedAgentDetector({
      eventBus,
      registry,
      sessionManager: createMockSessionManager(),
    });

    await detector.trackActivity("claude-agent-1");

    // Advance past timeout and trigger blocked
    vi.advanceTimersByTime(11 * 60 * 1000);
    await detector.checkBlocked();

    // Resume activity
    await detector.trackActivity("claude-agent-1");

    // Should have published agent.resumed event
    const resumedEvents = eventBus._events.filter((e) => e.eventType === "agent.resumed");
    expect(resumedEvents.length).toBe(1);
    expect(resumedEvents[0].metadata["agentId"]).toBe("claude-agent-1");

    await detector.close();
  });

  it("respects agent-type-specific timeouts", async () => {
    const eventBus = createInMemoryEventBus();
    const registry = createMockRegistry();

    const detector = createBlockedAgentDetector({
      eventBus,
      registry,
      sessionManager: createMockSessionManager(),
      config: {
        checkInterval: 1000,
        agentTypeTimeouts: {
          codex: 3000, // 3s for codex (shorter)
        },
      },
    });

    // Track a codex agent
    await detector.trackActivity("codex-agent-1");
    detector.startDetection();

    // Advance past codex timeout (3s) but not default (10min)
    await vi.advanceTimersByTimeAsync(4000);

    const blockedEvents = eventBus._events.filter((e) => e.eventType === "agent.blocked");
    expect(blockedEvents.length).toBe(1);
    expect(blockedEvents[0].metadata["agentId"]).toBe("codex-agent-1");

    await detector.close();
  });
});

describe("Completion Detector Integration (Task 6.6)", () => {
  it("calls completion handler when agent process exits", async () => {
    // Create a runtime that reports the session as dead
    const runtime = createMockRuntime(false);
    const registry = createMockRegistry();
    registry.register({
      agentId: "agent-1",
      storyId: "1-2-test",
      assignedAt: new Date(),
      status: "active",
      contextHash: "hash1",
    });

    const detector = createAgentCompletionDetector({
      runtime,
      registry,
      config: { pollInterval: 50, timeout: 60000 },
    });

    const completionEvents: Array<{ agentId: string; storyId: string }> = [];
    detector.onCompletion(async (event) => {
      completionEvents.push({ agentId: event.agentId, storyId: event.storyId });
    });

    await detector.monitor("agent-1");

    // Wait for the polling to detect the dead session
    await new Promise((resolve) => setTimeout(resolve, 200));

    expect(completionEvents.length).toBe(1);
    expect(completionEvents[0].agentId).toBe("agent-1");
    expect(completionEvents[0].storyId).toBe("1-2-test");

    await detector.unmonitor("agent-1");
  });

  it("calls failure handler on timeout", async () => {
    // Create a runtime that always reports alive
    const runtime = createMockRuntime(true);
    const registry = createMockRegistry();
    registry.register({
      agentId: "agent-1",
      storyId: "1-2-test",
      assignedAt: new Date(Date.now() - 100000), // started 100s ago
      status: "active",
      contextHash: "hash1",
    });

    const detector = createAgentCompletionDetector({
      runtime,
      registry,
      config: { pollInterval: 50, timeout: 100 }, // Very short timeout for test
    });

    const failureEvents: Array<{ agentId: string; reason: string }> = [];
    detector.onFailure(async (event) => {
      failureEvents.push({ agentId: event.agentId, reason: event.reason });
    });

    await detector.monitor("agent-1");

    // Wait for the polling to detect timeout
    await new Promise((resolve) => setTimeout(resolve, 200));

    expect(failureEvents.length).toBe(1);
    expect(failureEvents[0].agentId).toBe("agent-1");
    expect(failureEvents[0].reason).toBe("timed_out");

    await detector.unmonitor("agent-1");
  });
});

describe("Completion Handler with StateManager (Story 2-1)", () => {
  let tmpProject: ReturnType<typeof createTempProject>;

  beforeEach(() => {
    tmpProject = createTempProject();
  });

  afterEach(() => {
    rmSync(tmpProject.dir, { recursive: true, force: true });
  });

  function makeMockStateManager(): StateManager {
    return {
      initialize: vi.fn().mockResolvedValue(undefined),
      get: vi.fn().mockReturnValue(null),
      getAll: vi.fn().mockReturnValue(new Map()),
      set: vi.fn().mockResolvedValue({ success: true, version: "v2" }),
      update: vi.fn().mockResolvedValue({ success: true, version: "v2" }),
      batchSet: vi.fn().mockResolvedValue({ succeeded: [], failed: [] }),
      invalidate: vi.fn().mockResolvedValue(undefined),
      getVersion: vi.fn().mockReturnValue("v1"),
      close: vi.fn().mockResolvedValue(undefined),
      verify: vi.fn().mockResolvedValue({ valid: true }),
    };
  }

  it("passes StateManager to updateSprintStatus when provided", async () => {
    const registry = createMockRegistry();
    registry.register({
      agentId: "agent-1",
      storyId: "1-2-second-story",
      assignedAt: new Date(),
      status: "active",
      contextHash: "hash1",
    });

    const sm = makeMockStateManager();
    const handler = createCompletionHandler(
      registry,
      tmpProject.storyDir,
      tmpProject.configPath,
      join(tmpProject.dir, ".audit"),
      undefined,
      undefined,
      sm,
    );

    await handler({
      agentId: "agent-1",
      storyId: "1-2-second-story",
      exitCode: 0,
      duration: 60000,
      completedAt: new Date(),
    });

    // StateManager.update should have been called with "done"
    expect(sm.update).toHaveBeenCalledWith("1-2-second-story", { status: "done" }, "v1");
  });

  it("failure handler passes StateManager when provided", async () => {
    const registry = createMockRegistry();
    registry.register({
      agentId: "agent-1",
      storyId: "1-2-second-story",
      assignedAt: new Date(),
      status: "active",
      contextHash: "hash1",
    });

    const sm = makeMockStateManager();
    const handler = createFailureHandler(
      registry,
      tmpProject.storyDir,
      tmpProject.configPath,
      join(tmpProject.dir, ".audit"),
      undefined,
      undefined,
      sm,
    );

    await handler({
      agentId: "agent-1",
      storyId: "1-2-second-story",
      reason: "crashed",
      failedAt: new Date(),
      duration: 30000,
    });

    // StateManager.update should have been called with "blocked"
    expect(sm.update).toHaveBeenCalledWith("1-2-second-story", { status: "blocked" }, "v1");
  });
});
