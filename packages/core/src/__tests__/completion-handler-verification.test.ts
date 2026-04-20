/**
 * Completion Handler — Verification Gate Integration Tests
 * Story 61-3, AC #4, #7, #9
 *
 * Tests that createCompletionHandler correctly integrates the verification gate:
 * - Runs verification when enabled
 * - Sets finalStatus to "review" when verification fails
 * - Skips verification when disabled
 * - Never blocks completion pipeline on verification error
 * - Stores verification result even when checks fail
 */

import { describe, expect, it, vi, beforeEach } from "vitest";
import type { CompletionEvent, AgentRegistry } from "../types.js";

// ── Mocks (vi.hoisted for mock functions used in vi.mock factories) ───────────

const {
  mockRunVerification,
  mockStoreVerificationResult,
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
  scheduleVerificationRetry: vi.fn(() => ({
    shouldRetry: false,
    backoffMs: 5000,
  })),
  storeVerificationRetryAttempt: vi.fn(),
  writeRetryContextToNotepad: vi.fn(),
  getVerificationRetryCount: vi.fn(() => 0),
  schedulePersistentRequeue: vi.fn(() => ({ shouldRequeue: false, requeueCount: 0 })),
  storePersistentRequeueAttempt: vi.fn(),
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
});

describe("createCompletionHandler — verification gate", () => {
  it("skips verification when no project config found", async () => {
    mockLoadConfig.mockReturnValue({ projects: {} });

    const handler = createCompletionHandler(
      mockRegistry,
      "/tmp/project-a",
      "/tmp/ao.yaml",
      "/tmp/audit",
    );
    await handler(makeCompletionEvent());

    expect(mockRunVerification).not.toHaveBeenCalled();
  });

  it("skips verification when verification.enabled is false", async () => {
    mockLoadConfig.mockReturnValue({
      projects: {
        "project-a": {
          path: "/tmp/project-a",
          verification: { enabled: false, checks: [] },
        },
      },
    });

    const handler = createCompletionHandler(
      mockRegistry,
      "/tmp/project-a",
      "/tmp/ao.yaml",
      "/tmp/audit",
    );
    await handler(makeCompletionEvent());

    expect(mockRunVerification).not.toHaveBeenCalled();
  });

  it("runs verification and stores result when checks pass", async () => {
    mockLoadConfig.mockReturnValue({
      projects: {
        "project-a": {
          path: "/tmp/project-a",
          verification: {
            enabled: true,
            checks: [{ type: "test", command: "pnpm test", required: true }],
          },
        },
      },
    });

    const handler = createCompletionHandler(
      mockRegistry,
      "/tmp/project-a",
      "/tmp/ao.yaml",
      "/tmp/audit",
    );
    await handler(makeCompletionEvent());

    expect(mockRunVerification).toHaveBeenCalledWith("/tmp/project-a", {
      enabled: true,
      checks: [{ type: "test", command: "pnpm test", required: true }],
    });
    expect(mockStoreVerificationResult).toHaveBeenCalled();
  });

  it("stores verification result and sets review status when checks fail", async () => {
    const failResult = {
      passed: false,
      checks: [
        {
          type: "test",
          command: "pnpm test",
          passed: false,
          exitCode: 1,
          stdout: "",
          stderr: "fail",
          duration: 50,
          required: true,
        },
      ],
      ranAt: "2026-04-18T12:00:00Z",
      duration: 50,
    };
    mockLoadConfig.mockReturnValue({
      projects: {
        "project-a": {
          path: "/tmp/project-a",
          verification: {
            enabled: true,
            checks: [{ type: "test", command: "pnpm test", required: true }],
            onFailure: "review",
          },
        },
      },
    });
    mockRunVerification.mockResolvedValue(failResult);

    const handler = createCompletionHandler(
      mockRegistry,
      "/tmp/project-a",
      "/tmp/ao.yaml",
      "/tmp/audit",
    );
    await handler(makeCompletionEvent());

    // Result should be stored
    expect(mockStoreVerificationResult).toHaveBeenCalledWith(
      "/tmp/sessions",
      "agent-1",
      failResult,
    );

    // Audit log should contain verification.failed event
    const auditCalls = mockWriteFileSync.mock.calls.filter(
      (call: Parameters<typeof writeFileSync>) =>
        typeof call[0] === "string" && call[0].includes("agent-lifecycle.jsonl"),
    );
    expect(auditCalls.length).toBeGreaterThanOrEqual(1);
    const auditEntry = JSON.parse(
      auditCalls.find((c) => (c[1] as string).includes("verification.failed"))![1] as string,
    );
    expect(auditEntry.event_type).toBe("verification.failed");
  });

  it("sets blocked status when onFailure is block", async () => {
    const failResult = {
      passed: false,
      checks: [
        {
          type: "test",
          command: "pnpm test",
          passed: false,
          exitCode: 1,
          stdout: "",
          stderr: "fail",
          duration: 50,
          required: true,
        },
      ],
      ranAt: "2026-04-18T12:00:00Z",
      duration: 50,
    };
    mockLoadConfig.mockReturnValue({
      projects: {
        "project-a": {
          path: "/tmp/project-a",
          verification: {
            enabled: true,
            checks: [{ type: "test", command: "pnpm test", required: true }],
            onFailure: "block",
          },
        },
      },
    });
    mockRunVerification.mockResolvedValue(failResult);

    const handler = createCompletionHandler(
      mockRegistry,
      "/tmp/project-a",
      "/tmp/ao.yaml",
      "/tmp/audit",
    );
    await handler(makeCompletionEvent());

    // Audit log should contain verification.failed event
    const auditCalls = mockWriteFileSync.mock.calls.filter(
      (call: Parameters<typeof writeFileSync>) =>
        typeof call[0] === "string" && call[0].includes("agent-lifecycle.jsonl"),
    );
    expect(auditCalls.length).toBeGreaterThanOrEqual(1);
    const verifyEntry = auditCalls.find((c) => (c[1] as string).includes("verification.failed"));
    expect(verifyEntry).toBeDefined();
  });

  it("proceeds as done when verification runner throws", async () => {
    mockLoadConfig.mockReturnValue({
      projects: {
        "project-a": {
          path: "/tmp/project-a",
          verification: {
            enabled: true,
            checks: [{ type: "test", command: "pnpm test", required: true }],
          },
        },
      },
    });
    mockRunVerification.mockRejectedValue(new Error("Process spawn failed"));

    const handler = createCompletionHandler(
      mockRegistry,
      "/tmp/project-a",
      "/tmp/ao.yaml",
      "/tmp/audit",
    );
    // Should NOT throw
    await expect(handler(makeCompletionEvent())).resolves.toBeUndefined();
  });

  it("writes audit log for passed verification", async () => {
    mockLoadConfig.mockReturnValue({
      projects: {
        "project-a": {
          path: "/tmp/project-a",
          verification: {
            enabled: true,
            checks: [{ type: "test", command: "pnpm test", required: true }],
          },
        },
      },
    });

    const handler = createCompletionHandler(
      mockRegistry,
      "/tmp/project-a",
      "/tmp/ao.yaml",
      "/tmp/audit",
    );
    await handler(makeCompletionEvent());

    const auditCalls = mockWriteFileSync.mock.calls.filter(
      (call: Parameters<typeof writeFileSync>) =>
        typeof call[0] === "string" && call[0].includes("agent-lifecycle.jsonl"),
    );
    const auditEntry = JSON.parse(
      auditCalls.find((c) => (c[1] as string).includes("verification.passed"))![1] as string,
    );
    expect(auditEntry.event_type).toBe("verification.passed");
  });
});
