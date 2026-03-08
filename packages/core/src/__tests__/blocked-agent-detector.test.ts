/**
 * Tests for BlockedAgentDetector service
 */

import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import {
  createBlockedAgentDetector,
  type BlockedAgentDetector,
  type BlockedAgentDetectorConfig,
  type EventBus,
  type AgentRegistry,
  type SessionManager,
  type AgentAssignment,
  type AgentStatus,
  type Session,
  type SessionId,
  type CleanupResult,
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
  getByAgent: vi.fn((): AgentAssignment | null => ({
    agentId: "test-agent",
    storyId: "1-1-test-story",
    assignedAt: new Date(),
    status: "working" as AgentStatus,
    contextHash: "",
  })),
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
} satisfies AgentRegistry;

// Mock SessionManager
const mockSessionManager = {
  list: vi.fn(async (): Promise<Session[]> => []),
  get: vi.fn(async (): Promise<Session | null> => null),
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
      runtimeHandle: "test-handle" as any,
      agentInfo: null,
      createdAt: new Date(),
      lastActivityAt: new Date(),
      metadata: {} as any,
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
      runtimeHandle: "test-handle" as any,
      agentInfo: null,
      createdAt: new Date(),
      lastActivityAt: new Date(),
      metadata: {} as any,
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
      runtimeHandle: "test-handle" as any,
      agentInfo: null,
      createdAt: new Date(),
      lastActivityAt: new Date(),
      metadata: {} as any,
    }),
  ),
  kill: vi.fn(async (): Promise<void> => {}),
  cleanup: vi.fn(async (): Promise<CleanupResult> => ({ killed: [], skipped: [], errors: [] })),
  send: vi.fn(async (): Promise<void> => {}),
} satisfies SessionManager;

describe("BlockedAgentDetector", () => {
  let detector: BlockedAgentDetector;
  const mockDeps = {
    eventBus: mockEventBus,
    registry: mockRegistry,
    sessionManager: mockSessionManager,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("initialization", () => {
    it("creates detector with default config", () => {
      const createDetector = () => createBlockedAgentDetector(mockDeps);
      expect(createDetector).not.toThrow();
    });

    it("creates detector with custom config", () => {
      const config: Partial<BlockedAgentDetectorConfig> = {
        checkInterval: 60000, // 1 minute
        defaultTimeout: 300000, // 5 minutes
      };
      const createDetector = () =>
        createBlockedAgentDetector({
          ...mockDeps,
          config,
        });
      expect(createDetector).not.toThrow();
    });

    it("validates timeout range", () => {
      const config: Partial<BlockedAgentDetectorConfig> = {
        defaultTimeout: 30000, // 30s - below minimum
      };
      expect(() => createBlockedAgentDetector({ ...mockDeps, config })).toThrow(
        "between 1 and 60 minutes",
      );
    });
  });

  describe("activity tracking", () => {
    beforeEach(() => {
      detector = createBlockedAgentDetector(mockDeps);
    });

    it("tracks last activity timestamp", async () => {
      await detector.trackActivity("ao-story-001");

      const status = detector.getAgentStatus("ao-story-001");
      expect(status?.lastActivity).toBeDefined();
      expect(status?.isBlocked).toBe(false);
    });

    it("resumes agent when activity resumes after being blocked", async () => {
      await detector.trackActivity("ao-story-001");

      // Mark as blocked
      vi.advanceTimersByTime(11 * 60 * 1000); // 11 minutes later
      await detector.checkBlocked();

      expect(mockEventBus.publish).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: "agent.blocked",
        }),
      );

      // Resume activity
      await detector.trackActivity("ao-story-001");

      expect(mockEventBus.publish).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: "agent.resumed",
        }),
      );
    });
  });

  describe("blocked detection", () => {
    beforeEach(() => {
      detector = createBlockedAgentDetector(mockDeps);
    });

    it("does not mark agent as blocked before timeout", async () => {
      await detector.trackActivity("ao-story-001");

      vi.advanceTimersByTime(9 * 60 * 1000); // 9 minutes
      await detector.checkBlocked();

      expect(mockEventBus.publish).not.toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: "agent.blocked",
        }),
      );
    });

    it("marks agent as blocked after default timeout (10m)", async () => {
      await detector.trackActivity("ao-story-001");

      vi.advanceTimersByTime(11 * 60 * 1000); // 11 minutes
      await detector.checkBlocked();

      expect(mockEventBus.publish).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: "agent.blocked",
          metadata: expect.objectContaining({
            agentId: "ao-story-001",
            inactiveDuration: expect.any(Number),
          }),
        }),
      );
    });

    it("marks agent as blocked after custom timeout", async () => {
      const customDetector = createBlockedAgentDetector({
        ...mockDeps,
        config: { defaultTimeout: 5 * 60 * 1000 }, // 5 minutes
      });

      await customDetector.trackActivity("ao-story-001");

      vi.advanceTimersByTime(6 * 60 * 1000); // 6 minutes
      await customDetector.checkBlocked();

      expect(mockEventBus.publish).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: "agent.blocked",
        }),
      );
    });
  });

  describe("pause functionality", () => {
    beforeEach(() => {
      detector = createBlockedAgentDetector(mockDeps);
    });

    it("pauses agent to suppress blocked detection", async () => {
      await detector.trackActivity("ao-story-001");
      detector.pause("ao-story-001");

      vi.advanceTimersByTime(15 * 60 * 1000); // 15 minutes
      await detector.checkBlocked();

      expect(mockEventBus.publish).not.toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: "agent.blocked",
        }),
      );
    });

    it("resumes paused agent on activity", async () => {
      await detector.trackActivity("ao-story-001");
      detector.pause("ao-story-001");

      vi.advanceTimersByTime(15 * 60 * 1000);
      await detector.trackActivity("ao-story-001");

      const status = detector.getAgentStatus("ao-story-001");
      expect(status?.isPaused).toBe(false);
    });
  });

  describe("agent-type specific timeouts", () => {
    it("uses claude-code timeout (10m) by default", async () => {
      const detector = createBlockedAgentDetector(mockDeps);
      await detector.trackActivity("ao-story-001");

      vi.advanceTimersByTime(11 * 60 * 1000);
      await detector.checkBlocked();

      expect(mockEventBus.publish).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: "agent.blocked",
        }),
      );
    });

    it("uses codex timeout (5m) for codex agents", async () => {
      const detector = createBlockedAgentDetector({
        ...mockDeps,
        config: {
          agentTypeTimeouts: {
            codex: 5 * 60 * 1000,
          },
        },
      });

      await detector.trackActivity("codex-agent-001");

      vi.advanceTimersByTime(6 * 60 * 1000);
      await detector.checkBlocked();

      expect(mockEventBus.publish).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: "agent.blocked",
        }),
      );
    });

    it("uses aider timeout (15m) for aider agents", async () => {
      const detector = createBlockedAgentDetector({
        ...mockDeps,
        config: {
          agentTypeTimeouts: {
            aider: 15 * 60 * 1000,
          },
        },
      });

      await detector.trackActivity("aider-agent-001");

      vi.advanceTimersByTime(16 * 60 * 1000);
      await detector.checkBlocked();

      expect(mockEventBus.publish).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: "agent.blocked",
        }),
      );
    });
  });

  describe("cleanup", () => {
    it("clears all timers on close", async () => {
      const detector = createBlockedAgentDetector(mockDeps);
      await detector.trackActivity("ao-story-001");

      await detector.close();

      vi.advanceTimersByTime(15 * 60 * 1000);
      await detector.checkBlocked();

      expect(mockEventBus.publish).not.toHaveBeenCalled();
    });
  });
});
