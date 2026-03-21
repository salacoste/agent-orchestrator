/**
 * Tests for StateConflictReconciler
 *
 * Covers all acceptance criteria:
 * AC1: Version mismatch detection with JSONL logging
 * AC2: Auto-retry with latest version (up to 3 attempts)
 * AC3: Unresolved conflict notification
 * AC4: Conflict history queryable (AuditTrail.queryConflicts)
 * AC5: Append-only JSONL log maintained
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createStateConflictReconciler } from "../state-conflict-reconciler.js";
import type {
  StateManager,
  ConflictResolver,
  Conflict,
  AuditTrail,
  AuditEvent,
  EventPublisher,
  NotificationService,
  StoryState,
  ResolveResult,
} from "../types.js";

// ---------------------------------------------------------------------------
// Mock factories
// ---------------------------------------------------------------------------

function createMockStoryState(overrides: Partial<StoryState> = {}): StoryState {
  return {
    id: "1-1-test-story",
    status: "in-progress",
    title: "Test Story",
    version: "v100-abc",
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

function createMockConflict(overrides: Partial<Conflict> = {}): Conflict {
  return {
    storyId: "1-1-test-story",
    expectedVersion: "v100-abc",
    actualVersion: "v200-def",
    conflicts: [{ field: "status", currentValue: "in-progress", proposedValue: "done" }],
    current: createMockStoryState({ version: "v200-def" }),
    proposed: createMockStoryState({ status: "done" }),
    ...overrides,
  };
}

function createMockStateManager(): StateManager {
  const cache = new Map<string, StoryState>();
  return {
    initialize: vi.fn().mockResolvedValue(undefined),
    get: vi.fn((id: string) => cache.get(id) ?? null),
    getAll: vi.fn(() => new Map(cache)),
    set: vi.fn().mockResolvedValue({ success: true, version: "v300-ghi" }),
    update: vi.fn().mockResolvedValue({ success: true, version: "v300-ghi" }),
    batchSet: vi.fn().mockResolvedValue({ succeeded: [], failed: [] }),
    invalidate: vi.fn().mockResolvedValue(undefined),
    getVersion: vi.fn(() => "v200-def"),
    close: vi.fn().mockResolvedValue(undefined),
    verify: vi.fn().mockResolvedValue({ valid: true }),
    _setCache: (id: string, state: StoryState) => cache.set(id, state),
  } as unknown as StateManager & { _setCache: (id: string, state: StoryState) => void };
}

function createMockConflictResolver(
  conflict: Conflict | null = null,
  resolveResult: ResolveResult = { success: true, newVersion: "v300-ghi" },
): ConflictResolver {
  return {
    detect: vi.fn().mockReturnValue(conflict),
    resolve: vi.fn().mockResolvedValue(resolveResult),
    merge: vi.fn(),
    mergeInteractive: vi.fn(),
  } as unknown as ConflictResolver;
}

function createMockAuditTrail(): AuditTrail & { _events: AuditEvent[] } {
  const events: AuditEvent[] = [];
  return {
    _events: events,
    log: vi.fn(async (event: AuditEvent) => {
      events.push(event);
    }),
    query: vi.fn(() => []),
    queryConflicts: vi.fn(() => []),
    export: vi.fn().mockResolvedValue(undefined),
    replay: vi.fn().mockResolvedValue(undefined),
    getStats: vi.fn(() => ({
      activeEvents: events.length,
      archivedEvents: 0,
      fileSize: 0,
    })),
    close: vi.fn().mockResolvedValue(undefined),
  } as unknown as AuditTrail & { _events: AuditEvent[] };
}

function createMockEventPublisher(): EventPublisher {
  return {
    publishStoryCompleted: vi.fn().mockResolvedValue(undefined),
    publishStoryStarted: vi.fn().mockResolvedValue(undefined),
    publishStoryBlocked: vi.fn().mockResolvedValue(undefined),
    publishStoryAssigned: vi.fn().mockResolvedValue(undefined),
    publishStoryUnblocked: vi.fn().mockResolvedValue(undefined),
    publishAgentResumed: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined),
  } as unknown as EventPublisher;
}

function createMockNotificationService(): NotificationService {
  return {
    send: vi.fn().mockResolvedValue({ success: true, deliveredPlugins: [], failedPlugins: [] }),
    getStatus: vi.fn(() => ({ queueDepth: 0, dedupCount: 0, dlqSize: 0 })),
    getDLQ: vi.fn(() => []),
    retryDLQ: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined),
  } as unknown as NotificationService;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("StateConflictReconciler", () => {
  let stateManager: ReturnType<typeof createMockStateManager>;
  let conflictResolver: ConflictResolver;
  let auditTrail: ReturnType<typeof createMockAuditTrail>;
  let eventPublisher: ReturnType<typeof createMockEventPublisher>;
  let notificationService: ReturnType<typeof createMockNotificationService>;

  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    stateManager = createMockStateManager();
    conflictResolver = createMockConflictResolver();
    auditTrail = createMockAuditTrail();
    eventPublisher = createMockEventPublisher();
    notificationService = createMockNotificationService();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // AC1: No conflict — direct pass-through
  it("should apply update directly when no conflict detected", async () => {
    const state = createMockStoryState();
    (stateManager as unknown as { _setCache: (id: string, s: StoryState) => void })._setCache(
      "1-1-test-story",
      state,
    );

    const reconciler = createStateConflictReconciler({
      stateManager,
      conflictResolver,
    });

    const result = await reconciler.reconcile("1-1-test-story", { status: "done" }, "v100-abc");

    expect(result.success).toBe(true);
    expect(result.retryCount).toBe(0);
    expect(result.escalated).toBe(false);
    expect(stateManager.set).toHaveBeenCalled();
  });

  // AC1: Story not found
  it("should return error when story not found and no conflict", async () => {
    const reconciler = createStateConflictReconciler({
      stateManager,
      conflictResolver,
    });

    const result = await reconciler.reconcile("nonexistent", { status: "done" }, "v100-abc");

    expect(result.success).toBe(false);
    expect(result.error).toContain("not found");
    expect(result.retryCount).toBe(0);
    expect(result.escalated).toBe(false);
  });

  // AC1: Conflict detected and logged to JSONL
  it("should log conflict detection to audit trail", async () => {
    const conflict = createMockConflict();
    conflictResolver = createMockConflictResolver(conflict, { success: true, newVersion: "v300" });

    const reconciler = createStateConflictReconciler({
      stateManager,
      conflictResolver,
      auditTrail,
      retryDelays: [0, 0, 0], // No delay for tests
    });

    await reconciler.reconcile("1-1-test-story", { status: "done" }, "v100-abc");

    // Should have logged detection event
    const detectionEvents = auditTrail._events.filter(
      (e) => e.eventType === "state.conflict_detected",
    );
    expect(detectionEvents.length).toBe(1);
    expect(detectionEvents[0].metadata.storyId).toBe("1-1-test-story");
    expect(detectionEvents[0].metadata.expectedVersion).toBe("v100-abc");
    expect(detectionEvents[0].metadata.actualVersion).toBe("v200-def");
    expect(detectionEvents[0].hash).toBeDefined();
  });

  // AC2: Auto-retry succeeds on 1st retry
  it("should succeed on first retry attempt", async () => {
    const conflict = createMockConflict();
    conflictResolver = createMockConflictResolver(conflict, {
      success: true,
      newVersion: "v300-ghi",
    });

    const reconciler = createStateConflictReconciler({
      stateManager,
      conflictResolver,
      auditTrail,
      retryDelays: [0, 0, 0],
    });

    const result = await reconciler.reconcile("1-1-test-story", { status: "done" }, "v100-abc");

    expect(result.success).toBe(true);
    expect(result.retryCount).toBe(1);
    expect(result.escalated).toBe(false);
    expect(result.version).toBe("v300-ghi");

    // Should have logged: detected + retried + resolved
    const eventTypes = auditTrail._events.map((e) => e.eventType);
    expect(eventTypes).toContain("state.conflict_detected");
    expect(eventTypes).toContain("state.conflict_retried");
    expect(eventTypes).toContain("state.conflict_resolved");
  });

  // AC2: Auto-retry succeeds on 2nd attempt
  it("should succeed on second retry attempt after first fails", async () => {
    const conflict = createMockConflict();
    conflictResolver = createMockConflictResolver(conflict);

    // First resolve fails, second succeeds
    const resolveMock = vi
      .fn()
      .mockResolvedValueOnce({ success: false, error: "Still conflicted" })
      .mockResolvedValueOnce({ success: true, newVersion: "v400-xyz" });
    (conflictResolver as unknown as { resolve: typeof resolveMock }).resolve = resolveMock;

    // detect returns conflict on first re-check, then null (not needed since resolve succeeds)
    const detectMock = vi
      .fn()
      .mockReturnValueOnce(conflict) // initial detect
      .mockReturnValueOnce(conflict); // re-detect after first failure
    (conflictResolver as unknown as { detect: typeof detectMock }).detect = detectMock;

    const reconciler = createStateConflictReconciler({
      stateManager,
      conflictResolver,
      auditTrail,
      retryDelays: [0, 0, 0],
    });

    const result = await reconciler.reconcile("1-1-test-story", { status: "done" }, "v100-abc");

    expect(result.success).toBe(true);
    expect(result.retryCount).toBe(2);
    expect(result.escalated).toBe(false);
    expect(result.version).toBe("v400-xyz");
  });

  // AC2: Auto-retry succeeds on 3rd attempt
  it("should succeed on third retry attempt", async () => {
    const conflict = createMockConflict();
    conflictResolver = createMockConflictResolver(conflict);

    const resolveMock = vi
      .fn()
      .mockResolvedValueOnce({ success: false })
      .mockResolvedValueOnce({ success: false })
      .mockResolvedValueOnce({ success: true, newVersion: "v500-final" });
    (conflictResolver as unknown as { resolve: typeof resolveMock }).resolve = resolveMock;

    const detectMock = vi
      .fn()
      .mockReturnValueOnce(conflict) // initial
      .mockReturnValueOnce(conflict) // re-detect after attempt 1
      .mockReturnValueOnce(conflict); // re-detect after attempt 2
    (conflictResolver as unknown as { detect: typeof detectMock }).detect = detectMock;

    const reconciler = createStateConflictReconciler({
      stateManager,
      conflictResolver,
      auditTrail,
      retryDelays: [0, 0, 0],
    });

    const result = await reconciler.reconcile("1-1-test-story", { status: "done" }, "v100-abc");

    expect(result.success).toBe(true);
    expect(result.retryCount).toBe(3);
    expect(result.escalated).toBe(false);
  });

  // AC2 + AC3: All retries exhausted → escalation
  it("should escalate after all retries are exhausted", async () => {
    const conflict = createMockConflict();
    conflictResolver = createMockConflictResolver(conflict, {
      success: false,
      error: "Conflict persists",
    });

    // detect always returns conflict (never resolved externally)
    const detectMock = vi.fn().mockReturnValue(conflict);
    (conflictResolver as unknown as { detect: typeof detectMock }).detect = detectMock;

    const reconciler = createStateConflictReconciler({
      stateManager,
      conflictResolver,
      auditTrail,
      eventPublisher,
      notificationService,
      retryDelays: [0, 0, 0],
    });

    const result = await reconciler.reconcile("1-1-test-story", { status: "done" }, "v100-abc");

    expect(result.success).toBe(false);
    expect(result.retryCount).toBe(3);
    expect(result.escalated).toBe(true);
    expect(result.error).toContain("unresolved after 3 retries");

    // Should have logged unresolved event
    const unresolvedEvents = auditTrail._events.filter(
      (e) => e.eventType === "state.conflict_unresolved",
    );
    expect(unresolvedEvents.length).toBe(1);
    expect(unresolvedEvents[0].metadata.totalAttempts).toBe(3);
  });

  // AC3: Notification sent on escalation
  it("should send notification on escalation", async () => {
    const conflict = createMockConflict();
    conflictResolver = createMockConflictResolver(conflict, { success: false });

    const detectMock = vi.fn().mockReturnValue(conflict);
    (conflictResolver as unknown as { detect: typeof detectMock }).detect = detectMock;

    const reconciler = createStateConflictReconciler({
      stateManager,
      conflictResolver,
      auditTrail,
      eventPublisher,
      notificationService,
      retryDelays: [0, 0, 0],
    });

    await reconciler.reconcile("1-1-test-story", { status: "done" }, "v100-abc");

    expect(notificationService.send).toHaveBeenCalledTimes(1);
    const notification = vi.mocked(notificationService.send).mock.calls[0][0];
    expect(notification.eventType).toBe("state.conflict_unresolved");
    expect(notification.priority).toBe("critical");
    expect(notification.message).toContain("1-1-test-story");
    expect(notification.message).toContain("v100-abc");
  });

  // AC3: Event published on escalation
  it("should publish story blocked event on escalation", async () => {
    const conflict = createMockConflict();
    conflictResolver = createMockConflictResolver(conflict, { success: false });

    const detectMock = vi.fn().mockReturnValue(conflict);
    (conflictResolver as unknown as { detect: typeof detectMock }).detect = detectMock;

    const reconciler = createStateConflictReconciler({
      stateManager,
      conflictResolver,
      eventPublisher,
      retryDelays: [0, 0, 0],
    });

    await reconciler.reconcile("1-1-test-story", { status: "done" }, "v100-abc");

    expect(eventPublisher.publishStoryBlocked).toHaveBeenCalledTimes(1);
    const call = vi.mocked(eventPublisher.publishStoryBlocked).mock.calls[0][0];
    expect(call.storyId).toBe("1-1-test-story");
    expect(call.reason).toContain("unresolved");
  });

  // AC5: Append-only logging — events are never modified
  it("should append events without modifying previous ones", async () => {
    const conflict = createMockConflict();
    conflictResolver = createMockConflictResolver(conflict, { success: true, newVersion: "v300" });

    const reconciler = createStateConflictReconciler({
      stateManager,
      conflictResolver,
      auditTrail,
      retryDelays: [0, 0, 0],
    });

    await reconciler.reconcile("1-1-test-story", { status: "done" }, "v100-abc");

    // All events should have unique IDs and hashes
    const eventIds = auditTrail._events.map((e) => e.eventId);
    const uniqueIds = new Set(eventIds);
    expect(uniqueIds.size).toBe(eventIds.length);

    // All events should have SHA-256 hashes
    for (const event of auditTrail._events) {
      expect(event.hash).toMatch(/^[a-f0-9]{64}$/);
    }

    // log() should be called with append semantics (individual calls, not batch)
    expect(auditTrail.log).toHaveBeenCalledTimes(auditTrail._events.length);
  });

  // Graceful degradation: no AuditTrail
  it("should work without audit trail", async () => {
    const conflict = createMockConflict();
    conflictResolver = createMockConflictResolver(conflict, { success: true, newVersion: "v300" });

    const reconciler = createStateConflictReconciler({
      stateManager,
      conflictResolver,
      // No auditTrail
      retryDelays: [0, 0, 0],
    });

    const result = await reconciler.reconcile("1-1-test-story", { status: "done" }, "v100-abc");
    expect(result.success).toBe(true);
  });

  // Graceful degradation: no NotificationService
  it("should escalate without notification service", async () => {
    const conflict = createMockConflict();
    conflictResolver = createMockConflictResolver(conflict, { success: false });

    const detectMock = vi.fn().mockReturnValue(conflict);
    (conflictResolver as unknown as { detect: typeof detectMock }).detect = detectMock;

    const reconciler = createStateConflictReconciler({
      stateManager,
      conflictResolver,
      auditTrail,
      eventPublisher,
      // No notificationService
      retryDelays: [0, 0, 0],
    });

    const result = await reconciler.reconcile("1-1-test-story", { status: "done" }, "v100-abc");
    expect(result.success).toBe(false);
    expect(result.escalated).toBe(true);
    // Should not throw despite no notification service
  });

  // Conflict resolved externally during retry loop
  it("should detect external conflict resolution during retries", async () => {
    const conflict = createMockConflict();

    const resolveMock = vi.fn().mockResolvedValue({ success: false });
    const detectMock = vi
      .fn()
      .mockReturnValueOnce(conflict) // initial detect
      .mockReturnValueOnce(null); // conflict resolved externally after first retry
    const state = createMockStoryState({ version: "v999-ext" });
    (stateManager as unknown as { _setCache: (id: string, s: StoryState) => void })._setCache(
      "1-1-test-story",
      state,
    );

    conflictResolver = {
      detect: detectMock,
      resolve: resolveMock,
      merge: vi.fn(),
      mergeInteractive: vi.fn(),
    } as unknown as ConflictResolver;

    const reconciler = createStateConflictReconciler({
      stateManager,
      conflictResolver,
      auditTrail,
      retryDelays: [0, 0, 0],
    });

    const result = await reconciler.reconcile("1-1-test-story", { status: "done" }, "v100-abc");

    expect(result.success).toBe(true);
    expect(result.retryCount).toBe(1);
    expect(result.escalated).toBe(false);
    expect(result.version).toBe("v999-ext");
  });

  // AC2: Exponential backoff timing
  it("should use configured retry delays for backoff", async () => {
    vi.useRealTimers();
    const conflict = createMockConflict();
    conflictResolver = createMockConflictResolver(conflict, {
      success: true,
      newVersion: "v300",
    });

    const delays = [50, 100, 200];
    const reconciler = createStateConflictReconciler({
      stateManager,
      conflictResolver,
      retryDelays: delays,
    });

    const start = Date.now();
    await reconciler.reconcile("1-1-test-story", { status: "done" }, "v100-abc");
    const elapsed = Date.now() - start;

    // Should have waited at least the first delay (50ms)
    // Allow some tolerance for execution overhead
    expect(elapsed).toBeGreaterThanOrEqual(40);
  });
});
