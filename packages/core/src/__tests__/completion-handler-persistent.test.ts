/**
 * Completion Handler — Persistent Re-queue Integration Tests
 * Story 61-5, AC #1-8.
 *
 * Tests that createCompletionHandler correctly integrates persistent re-queue:
 * - Re-queues persistent sessions when verification fails and auto-retry exhausted
 * - Writes retry context to notepad on persistent re-queue
 * - Falls through to review/blocked when persistent re-queue exhausted
 * - Skips persistent re-queue when onFailure is "block"
 */

import { describe, expect, it, vi, beforeEach } from "vitest";
import type { CompletionEvent, AgentRegistry } from "../types.js";

// ── Mocks ─────────────────────────────────────────────────────────────────────

const {
  mockRunVerification,
  mockStoreVerificationResult,
  mockScheduleVerificationRetry,
  mockStoreVerificationRetryAttempt,
  mockWriteRetryContextToNotepad,
  mockGetVerificationRetryCount,
  mockSchedulePersistentRequeue,
  mockStorePersistentRequeueAttempt,
  mockLoadConfig,
  mockCaptureTmuxSessionLogs,
  mockStoreLogPathInMetadata,
  mockGetLogFilePath,
  mockReadMetadataRaw,
  mockGetLearningStore,
  mockGetModelUsageAggregator,
} = vi.hoisted(() => ({
  mockRunVerification: vi.fn(),
  mockStoreVerificationResult: vi.fn(),
  mockScheduleVerificationRetry: vi.fn(),
  mockStoreVerificationRetryAttempt: vi.fn(),
  mockWriteRetryContextToNotepad: vi.fn(),
  mockGetVerificationRetryCount: vi.fn(() => 0),
  mockSchedulePersistentRequeue: vi.fn(() => ({ shouldRequeue: false, requeueCount: 0 })),
  mockStorePersistentRequeueAttempt: vi.fn(),
  mockLoadConfig: vi.fn(),
  mockCaptureTmuxSessionLogs: vi.fn(),
  mockStoreLogPathInMetadata: vi.fn(),
  mockGetLogFilePath: vi.fn(() => "/tmp/log.txt"),
  mockReadMetadataRaw: vi.fn(() => ({ worktree: "/tmp/wt" })),
  mockGetLearningStore: vi.fn(() => null),
  mockGetModelUsageAggregator: vi.fn(() => null),
}));

vi.mock("../verification/index.js", () => ({
  runVerification: mockRunVerification,
  storeVerificationResult: mockStoreVerificationResult,
  scheduleVerificationRetry: mockScheduleVerificationRetry,
  storeVerificationRetryAttempt: mockStoreVerificationRetryAttempt,
  writeRetryContextToNotepad: mockWriteRetryContextToNotepad,
  getVerificationRetryCount: mockGetVerificationRetryCount,
  schedulePersistentRequeue: mockSchedulePersistentRequeue,
  storePersistentRequeueAttempt: mockStorePersistentRequeueAttempt,
}));

vi.mock("../config.js", () => ({
  loadConfig: mockLoadConfig,
}));

vi.mock("../log-capture.js", () => ({
  captureTmuxSessionLogs: mockCaptureTmuxSessionLogs,
  getLogFilePath: mockGetLogFilePath,
  storeLogPathInMetadata: mockStoreLogPathInMetadata,
}));

vi.mock("../metadata.js", () => ({
  getSessionsDir: vi.fn(() => "/tmp/sessions"),
  readMetadataRaw: mockReadMetadataRaw,
  updateMetadata: vi.fn(),
}));

vi.mock("../service-registry.js", () => ({
  getLearningStore: mockGetLearningStore,
  getModelUsageAggregator: mockGetModelUsageAggregator,
}));

vi.mock("../session-learning.js", () => ({
  captureSessionLearning: vi.fn(),
}));

vi.mock("../memory-bridge.js", () => ({
  extractAndBridgeMemory: vi.fn(),
}));

vi.mock("../model-usage.js", () => ({
  modelUsageAggregator: { recordUsage: vi.fn() },
  validateModelTier: vi.fn(() => "standard"),
}));

vi.mock("node:fs", () => ({
  readFileSync: vi.fn(),
  writeFileSync: vi.fn(),
  existsSync: vi.fn(() => false),
  mkdirSync: vi.fn(),
  renameSync: vi.fn(),
  unlinkSync: vi.fn(),
}));

vi.mock("yaml", () => ({
  parse: vi.fn(),
  stringify: vi.fn(),
}));

import { createCompletionHandler } from "../completion-handlers.js";
import { writeFileSync } from "node:fs";

const mockWriteFileSync = vi.mocked(writeFileSync);

function makeCompletionEvent(overrides?: Partial<CompletionEvent>): CompletionEvent {
  return {
    type: "agent.completed",
    agentId: "agent-1",
    storyId: "story-1",
    completedAt: new Date("2026-04-18T12:00:00Z"),
    exitCode: 0,
    duration: 5000,
    ...overrides,
  };
}

const mockRegistry: AgentRegistry = {
  add: vi.fn(),
  remove: vi.fn(),
  getByAgent: vi.fn(() => ({
    agentId: "agent-1",
    storyId: "story-1",
    projectId: "project-a",
  })),
  getByStory: vi.fn(),
  list: vi.fn(() => []),
  getRetryCount: vi.fn(() => 0),
  clear: vi.fn(),
};

const VERIFICATION_CONFIG = {
  enabled: true,
  checks: [{ type: "test", command: "pnpm test", required: true }],
  onFailure: "review" as const,
  persistent: { persistentMaxRetries: 5, persistentMaxExtensions: 3 },
};

const FAILED_RESULT = {
  passed: false,
  checks: [
    {
      type: "test",
      command: "pnpm test",
      passed: false,
      exitCode: 1,
      stdout: "",
      stderr: "FAIL",
      duration: 100,
      required: true,
    },
  ],
  ranAt: "2026-04-18T12:00:00Z",
  duration: 100,
};

beforeEach(() => {
  vi.clearAllMocks();
  mockLoadConfig.mockReturnValue({ projects: {} });
  mockRunVerification.mockResolvedValue({
    passed: true,
    checks: [],
    ranAt: "2026-04-18T12:00:00Z",
    duration: 100,
  });
  mockStoreVerificationResult.mockResolvedValue(undefined);
  mockCaptureTmuxSessionLogs.mockResolvedValue(undefined);
  mockStoreLogPathInMetadata.mockResolvedValue(undefined);
  mockScheduleVerificationRetry.mockReturnValue({
    shouldRetry: false,
    backoffMs: 5000,
  });
  mockSchedulePersistentRequeue.mockReturnValue({
    shouldRequeue: false,
    requeueCount: 0,
  });
});

describe("createCompletionHandler — persistent re-queue", () => {
  it("re-queues persistent session when auto-retry exhausted", async () => {
    mockLoadConfig.mockReturnValue({
      projects: {
        "project-a": {
          path: "/tmp/project-a",
          verification: VERIFICATION_CONFIG,
        },
      },
    });
    mockRunVerification.mockResolvedValue(FAILED_RESULT);
    mockSchedulePersistentRequeue.mockReturnValue({
      shouldRequeue: true,
      requeueCount: 2,
    });

    const handler = createCompletionHandler(
      mockRegistry,
      "/tmp/project-a",
      "/tmp/ao.yaml",
      "/tmp/audit",
    );
    await handler(makeCompletionEvent());

    // Should check persistent re-queue
    expect(mockSchedulePersistentRequeue).toHaveBeenCalledWith(
      "/tmp/sessions",
      "agent-1",
      VERIFICATION_CONFIG,
    );

    // Should store the re-queue attempt
    expect(mockStorePersistentRequeueAttempt).toHaveBeenCalledWith("/tmp/sessions", "agent-1");

    // Should write retry context with attempt number 3 (requeueCount + 1)
    expect(mockWriteRetryContextToNotepad).toHaveBeenCalledWith(
      "/tmp/wt",
      FAILED_RESULT,
      3, // requeueCount(2) + 1
    );

    // Audit log should have persistent_requeue
    const auditCalls = mockWriteFileSync.mock.calls.filter(
      (call: Parameters<typeof writeFileSync>) =>
        typeof call[0] === "string" && call[0].includes("agent-lifecycle.jsonl"),
    );
    const requeueEntry = auditCalls.find((c) =>
      (c[1] as string).includes("verification.persistent_requeue"),
    );
    expect(requeueEntry).toBeDefined();
  });

  it("falls through to review when persistent re-queue exhausted", async () => {
    mockLoadConfig.mockReturnValue({
      projects: {
        "project-a": {
          path: "/tmp/project-a",
          verification: VERIFICATION_CONFIG,
        },
      },
    });
    mockRunVerification.mockResolvedValue(FAILED_RESULT);
    // Auto-retry exhausted
    mockScheduleVerificationRetry.mockReturnValue({
      shouldRetry: false,
      backoffMs: 5000,
    });
    // Persistent re-queue also exhausted
    mockSchedulePersistentRequeue.mockReturnValue({
      shouldRequeue: false,
      requeueCount: 5,
    });

    const handler = createCompletionHandler(
      mockRegistry,
      "/tmp/project-a",
      "/tmp/ao.yaml",
      "/tmp/audit",
    );
    await handler(makeCompletionEvent());

    // Should NOT store persistent re-queue attempt
    expect(mockStorePersistentRequeueAttempt).not.toHaveBeenCalled();

    // Audit should have retry_exhausted (not persistent_requeue)
    const auditCalls = mockWriteFileSync.mock.calls.filter(
      (call: Parameters<typeof writeFileSync>) =>
        typeof call[0] === "string" && call[0].includes("agent-lifecycle.jsonl"),
    );
    const exhaustedEntry = auditCalls.find((c) =>
      (c[1] as string).includes("verification.retry_exhausted"),
    );
    expect(exhaustedEntry).toBeDefined();
  });

  it("skips persistent re-queue when onFailure is block", async () => {
    const blockConfig = { ...VERIFICATION_CONFIG, onFailure: "block" as const };
    mockLoadConfig.mockReturnValue({
      projects: {
        "project-a": {
          path: "/tmp/project-a",
          verification: blockConfig,
        },
      },
    });
    mockRunVerification.mockResolvedValue(FAILED_RESULT);
    // schedulePersistentRequeue respects block mode internally
    mockSchedulePersistentRequeue.mockReturnValue({
      shouldRequeue: false,
      requeueCount: 0,
    });

    const handler = createCompletionHandler(
      mockRegistry,
      "/tmp/project-a",
      "/tmp/ao.yaml",
      "/tmp/audit",
    );
    await handler(makeCompletionEvent());

    // Should still call schedulePersistentRequeue (it handles the block check)
    expect(mockSchedulePersistentRequeue).toHaveBeenCalledWith(
      "/tmp/sessions",
      "agent-1",
      blockConfig,
    );
    // But no re-queue attempt should be stored
    expect(mockStorePersistentRequeueAttempt).not.toHaveBeenCalled();
  });

  it("auto-retry takes priority over persistent re-queue", async () => {
    mockLoadConfig.mockReturnValue({
      projects: {
        "project-a": {
          path: "/tmp/project-a",
          verification: VERIFICATION_CONFIG,
        },
      },
    });
    mockRunVerification.mockResolvedValue(FAILED_RESULT);
    // Auto-retry says "yes, retry"
    mockScheduleVerificationRetry.mockReturnValue({
      shouldRetry: true,
      backoffMs: 5000,
    });

    const handler = createCompletionHandler(
      mockRegistry,
      "/tmp/project-a",
      "/tmp/ao.yaml",
      "/tmp/audit",
    );
    await handler(makeCompletionEvent());

    // Should use auto-retry path, NOT persistent re-queue
    expect(mockStoreVerificationRetryAttempt).toHaveBeenCalled();
    expect(mockSchedulePersistentRequeue).not.toHaveBeenCalled();
    expect(mockStorePersistentRequeueAttempt).not.toHaveBeenCalled();
  });
});
