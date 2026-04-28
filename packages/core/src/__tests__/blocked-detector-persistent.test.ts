/**
 * Blocked Agent Detector — Persistent Session Extension Tests
 * Story 61-5, AC #3.
 *
 * Tests that persistent sessions get timeout extensions instead of being
 * blocked immediately, up to persistentMaxExtensions times.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  createBlockedAgentDetector,
  type BlockedAgentDetector,
  type EventBus,
  type AgentRegistry,
  type SessionManager,
  type AgentAssignment,
  type Session,
  type SessionId,
  type CleanupResult,
  type RuntimeHandle,
} from "../index.js";

// Mock EventBus
const mockEventBus = {
  name: "mock-eventbus",
  isConnected: () => true,
  isDegraded: () => false,
  publish: vi.fn(async (_event: unknown) => {}),
  subscribe: vi.fn(async () => () => {}),
  getQueueSize: () => 0,
  close: vi.fn(async () => {}),
} satisfies EventBus;

// Mock AgentRegistry
const mockRegistry = {
  getByAgent: vi.fn(),
  list: vi.fn((): AgentAssignment[] => []),
  getByStory: vi.fn((): AgentAssignment | null => null),
  findActiveByStory: vi.fn((): AgentAssignment | null => null),
  register: vi.fn(),
  remove: vi.fn(),
  getZombies: vi.fn((): AgentAssignment[] => []),
  reload: vi.fn(),
  getRetryCount: vi.fn((): number => 0),
  incrementRetry: vi.fn(),
  getRetryHistory: vi.fn(
    (): { attempts: number; lastRetryAt: Date; previousAgents: string[] } | null => null,
  ),
  updateStatus: vi.fn(),
} satisfies AgentRegistry;

// Mock SessionManager — returns metadata with ao:executionMode
const mockSessionManager = {
  list: vi.fn(async (): Promise<Session[]> => []),
  get: vi.fn(),
  spawn: vi.fn(
    async (): Promise<Session> => ({
      id: "test-session" as SessionId,
      projectId: "test-project",
      workspacePath: "/tmp/test",
      status: "spawning",
      branch: "main",
      activity: null,
      issueId: null,
      pr: null,
      runtimeHandle: "test-handle" as unknown as RuntimeHandle | null,
      agentInfo: null,
      createdAt: new Date(),
      lastActivityAt: new Date(),
      metadata: {} as Record<string, string>,
    }),
  ),
  spawnOrchestrator: vi.fn(
    async (): Promise<Session> => ({
      id: "test-orchestrator" as SessionId,
      projectId: "test-project",
      workspacePath: "/tmp/test",
      status: "spawning",
      branch: "main",
      activity: null,
      issueId: null,
      pr: null,
      runtimeHandle: "test-handle" as unknown as RuntimeHandle | null,
      agentInfo: null,
      createdAt: new Date(),
      lastActivityAt: new Date(),
      metadata: {} as Record<string, string>,
    }),
  ),
  restore: vi.fn(
    async (): Promise<Session> => ({
      id: "test-restore" as SessionId,
      projectId: "test-project",
      workspacePath: "/tmp/test",
      status: "spawning",
      branch: "main",
      activity: null,
      issueId: null,
      pr: null,
      runtimeHandle: "test-handle" as unknown as RuntimeHandle | null,
      agentInfo: null,
      createdAt: new Date(),
      lastActivityAt: new Date(),
      metadata: {} as Record<string, string>,
    }),
  ),
  kill: vi.fn(async (): Promise<void> => {}),
  cleanup: vi.fn(async (): Promise<CleanupResult> => ({ killed: [], skipped: [], errors: [] })),
  send: vi.fn(async (): Promise<void> => {}),
  runPreCompactHooks: vi.fn(async (): Promise<void> => {}),
  runPostCompactHooks: vi.fn(async (): Promise<string> => ""),
} satisfies SessionManager;

describe("BlockedAgentDetector — Persistent Session Extensions (Story 61-5)", () => {
  let detector: BlockedAgentDetector;
  const mockDeps = {
    eventBus: mockEventBus,
    registry: mockRegistry,
    sessionManager: mockSessionManager,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();

    // Default: session metadata returns persistent execution mode
    mockSessionManager.get.mockResolvedValue({
      id: "persistent-agent" as SessionId,
      projectId: "test-project",
      workspacePath: "/tmp/test",
      status: "spawning",
      branch: "main",
      activity: null,
      issueId: null,
      pr: null,
      runtimeHandle: "test-handle" as unknown,
      agentInfo: null,
      createdAt: new Date(),
      lastActivityAt: new Date(),
      metadata: { "ao:executionMode": "persistent" },
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("extends timeout for persistent sessions instead of blocking", async () => {
    detector = createBlockedAgentDetector({
      ...mockDeps,
      config: {
        defaultTimeout: 60_000,
        checkInterval: 50,
        persistentMaxExtensions: 3,
      },
    });

    // Track activity at time 0
    await detector.trackActivity("persistent-agent");

    // Advance past the base timeout (60s) — persistent gets 3x = 180s base
    vi.advanceTimersByTime(200_000);

    // First check — should extend, not block
    await detector.checkBlocked();
    const status = detector.getAgentStatus("persistent-agent");
    expect(status?.isBlocked).toBe(false);
    expect(status?.persistentExtensions).toBe(1);
  });

  it("grants multiple extensions up to persistentMaxExtensions", async () => {
    detector = createBlockedAgentDetector({
      ...mockDeps,
      config: {
        defaultTimeout: 60_000,
        checkInterval: 50,
        persistentMaxExtensions: 2,
      },
    });

    await detector.trackActivity("persistent-agent");

    // First timeout — extension 1
    vi.advanceTimersByTime(200_000);
    await detector.checkBlocked();
    expect(detector.getAgentStatus("persistent-agent")?.persistentExtensions).toBe(1);
    expect(detector.getAgentStatus("persistent-agent")?.isBlocked).toBe(false);

    // Second timeout — extension 2
    vi.advanceTimersByTime(200_000);
    await detector.checkBlocked();
    expect(detector.getAgentStatus("persistent-agent")?.persistentExtensions).toBe(2);
    expect(detector.getAgentStatus("persistent-agent")?.isBlocked).toBe(false);
  });

  it("marks blocked after max extensions exhausted", async () => {
    detector = createBlockedAgentDetector({
      ...mockDeps,
      config: {
        defaultTimeout: 60_000,
        checkInterval: 50,
        persistentMaxExtensions: 1,
      },
    });

    await detector.trackActivity("persistent-agent");

    // First timeout — extension 1 (max)
    vi.advanceTimersByTime(200_000);
    await detector.checkBlocked();
    expect(detector.getAgentStatus("persistent-agent")?.isBlocked).toBe(false);

    // Second timeout — extensions exhausted, should block
    vi.advanceTimersByTime(200_000);
    await detector.checkBlocked();
    expect(detector.getAgentStatus("persistent-agent")?.isBlocked).toBe(true);
    expect(mockEventBus.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "agent.blocked",
      }),
    );
  });

  it("does not extend for non-persistent sessions", async () => {
    // Session is standard mode
    mockSessionManager.get.mockResolvedValue({
      id: "standard-agent" as SessionId,
      projectId: "test-project",
      workspacePath: "/tmp/test",
      status: "spawning",
      branch: "main",
      activity: null,
      issueId: null,
      pr: null,
      runtimeHandle: "test-handle" as unknown,
      agentInfo: null,
      createdAt: new Date(),
      lastActivityAt: new Date(),
      metadata: { "ao:executionMode": "standard" },
    });

    detector = createBlockedAgentDetector({
      ...mockDeps,
      config: {
        defaultTimeout: 60_000,
        checkInterval: 50,
        persistentMaxExtensions: 3,
      },
    });

    await detector.trackActivity("standard-agent");

    // Advance past timeout
    vi.advanceTimersByTime(70_000);
    await detector.checkBlocked();

    // Should be blocked immediately — no extensions for standard mode
    expect(detector.getAgentStatus("standard-agent")?.isBlocked).toBe(true);
    expect(detector.getAgentStatus("standard-agent")?.persistentExtensions).toBeUndefined();
  });

  it("uses default persistentMaxExtensions (3) when not configured", async () => {
    detector = createBlockedAgentDetector({
      ...mockDeps,
      config: {
        defaultTimeout: 60_000,
        checkInterval: 50,
        // persistentMaxExtensions not set — should default to 3
      },
    });

    await detector.trackActivity("persistent-agent");

    // Grant 3 extensions
    for (let i = 0; i < 3; i++) {
      vi.advanceTimersByTime(200_000);
      await detector.checkBlocked();
      expect(detector.getAgentStatus("persistent-agent")?.isBlocked).toBe(false);
    }

    // 4th timeout — extensions exhausted (3 is the default max)
    vi.advanceTimersByTime(200_000);
    await detector.checkBlocked();
    expect(detector.getAgentStatus("persistent-agent")?.isBlocked).toBe(true);
  });
});
