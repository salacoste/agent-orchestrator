/**
 * Completion Handler — Verification Retry Integration Tests
 * Story 61-4, AC #2-5, #7-8.
 *
 * Tests that createCompletionHandler correctly integrates retry logic:
 * - Schedules retry when verification fails and under retry limit
 * - Writes retry context to notepad
 * - Records retry attempt in metadata
 * - Falls through to review/blocked when retries exhausted
 * - Skips retry when onFailure is "block"
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

vi.mock("../verification-gate.js", () => ({
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

// Import after mocks
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
});

describe("createCompletionHandler — verification retry", () => {
  it("schedules retry when verification fails and under limit", async () => {
    mockLoadConfig.mockReturnValue({
      projects: {
        "project-a": {
          path: "/tmp/project-a",
          verification: VERIFICATION_CONFIG,
        },
      },
    });
    mockRunVerification.mockResolvedValue(FAILED_RESULT);
    mockScheduleVerificationRetry.mockReturnValue({
      shouldRetry: true,
      backoffMs: 5000,
    });
    mockGetVerificationRetryCount.mockReturnValue(0);

    const handler = createCompletionHandler(
      mockRegistry,
      "/tmp/project-a",
      "/tmp/ao.yaml",
      "/tmp/audit",
    );
    await handler(makeCompletionEvent());

    // Should schedule retry
    expect(mockScheduleVerificationRetry).toHaveBeenCalledWith(
      "/tmp/sessions",
      "agent-1",
      VERIFICATION_CONFIG,
      0, // preloadedRetryCount
    );
    expect(mockStoreVerificationRetryAttempt).toHaveBeenCalledWith(
      "/tmp/sessions",
      "agent-1",
      expect.objectContaining({ attempt: 1 }),
    );
    expect(mockWriteRetryContextToNotepad).toHaveBeenCalledWith("/tmp/wt", FAILED_RESULT, 1);

    // Audit log should have retry_scheduled
    const auditCalls = mockWriteFileSync.mock.calls.filter(
      (call: Parameters<typeof writeFileSync>) =>
        typeof call[0] === "string" && call[0].includes("agent-lifecycle.jsonl"),
    );
    const retryEntry = auditCalls.find((c) =>
      (c[1] as string).includes("verification.retry_scheduled"),
    );
    expect(retryEntry).toBeDefined();
  });

  it("writes retry_exhausted audit when retries exhausted", async () => {
    mockLoadConfig.mockReturnValue({
      projects: {
        "project-a": {
          path: "/tmp/project-a",
          verification: VERIFICATION_CONFIG,
        },
      },
    });
    mockRunVerification.mockResolvedValue(FAILED_RESULT);
    mockScheduleVerificationRetry.mockReturnValue({
      shouldRetry: false,
      backoffMs: 5000,
    });

    const handler = createCompletionHandler(
      mockRegistry,
      "/tmp/project-a",
      "/tmp/ao.yaml",
      "/tmp/audit",
    );
    await handler(makeCompletionEvent());

    // Should NOT schedule retry
    expect(mockStoreVerificationRetryAttempt).not.toHaveBeenCalled();
    expect(mockWriteRetryContextToNotepad).not.toHaveBeenCalled();

    // Audit log should have retry_exhausted
    const auditCalls = mockWriteFileSync.mock.calls.filter(
      (call: Parameters<typeof writeFileSync>) =>
        typeof call[0] === "string" && call[0].includes("agent-lifecycle.jsonl"),
    );
    const exhaustedEntry = auditCalls.find((c) =>
      (c[1] as string).includes("verification.retry_exhausted"),
    );
    expect(exhaustedEntry).toBeDefined();
  });

  it("skips retry when onFailure is block", async () => {
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
    mockScheduleVerificationRetry.mockReturnValue({
      shouldRetry: false,
      backoffMs: 5000,
    });

    const handler = createCompletionHandler(
      mockRegistry,
      "/tmp/project-a",
      "/tmp/ao.yaml",
      "/tmp/audit",
    );
    await handler(makeCompletionEvent());

    // scheduleVerificationRetry should be called — it handles the block check
    expect(mockScheduleVerificationRetry).toHaveBeenCalledWith(
      "/tmp/sessions",
      "agent-1",
      blockConfig,
      0, // preloadedRetryCount
    );
    // But no retry attempt should be stored
    expect(mockStoreVerificationRetryAttempt).not.toHaveBeenCalled();
  });

  it("uses correct attempt number for second retry", async () => {
    mockLoadConfig.mockReturnValue({
      projects: {
        "project-a": {
          path: "/tmp/project-a",
          verification: VERIFICATION_CONFIG,
        },
      },
    });
    mockRunVerification.mockResolvedValue(FAILED_RESULT);
    mockScheduleVerificationRetry.mockReturnValue({
      shouldRetry: true,
      backoffMs: 5000,
    });
    mockGetVerificationRetryCount.mockReturnValue(1); // Already had 1 retry

    const handler = createCompletionHandler(
      mockRegistry,
      "/tmp/project-a",
      "/tmp/ao.yaml",
      "/tmp/audit",
    );
    await handler(makeCompletionEvent());

    // Should use attempt number = count + 1 = 2
    expect(mockStoreVerificationRetryAttempt).toHaveBeenCalledWith(
      "/tmp/sessions",
      "agent-1",
      expect.objectContaining({ attempt: 2 }),
    );
    expect(mockWriteRetryContextToNotepad).toHaveBeenCalledWith("/tmp/wt", FAILED_RESULT, 2);
  });

  it("still stores verification result even when retrying", async () => {
    mockLoadConfig.mockReturnValue({
      projects: {
        "project-a": {
          path: "/tmp/project-a",
          verification: VERIFICATION_CONFIG,
        },
      },
    });
    mockRunVerification.mockResolvedValue(FAILED_RESULT);
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

    // Verification result should still be stored
    expect(mockStoreVerificationResult).toHaveBeenCalledWith(
      "/tmp/sessions",
      "agent-1",
      FAILED_RESULT,
    );
  });
});
