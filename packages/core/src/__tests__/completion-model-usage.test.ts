/**
 * Integration tests for Story 58.5: captureModelUsage in completion/failure handlers.
 *
 * Verifies that:
 * - Completion handler records model usage from session metadata
 * - Failure handler records model usage from session metadata
 * - Falls back to singleton when no registry aggregator registered
 * - Uses registered aggregator when available
 * - Zero-value usage when cost metadata is malformed
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createCompletionHandler, createFailureHandler } from "../completion-handlers.js";
import type { AgentRegistry, AgentAssignment, AgentStatus } from "../types.js";
import { registerModelUsageAggregator, clearServiceRegistry } from "../service-registry.js";
import { createModelUsageAggregator } from "../model-usage.js";

// Mock tmux log capture
vi.mock("../log-capture.js", () => ({
  captureTmuxSessionLogs: vi.fn().mockResolvedValue(undefined),
  getLogFilePath: vi.fn(() => "/tmp/mock-log.txt"),
  storeLogPathInMetadata: vi.fn().mockResolvedValue(undefined),
}));

// Mock session learning (not relevant for these tests)
vi.mock("../session-learning.js", () => ({
  captureSessionLearning: vi.fn().mockResolvedValue({
    sessionId: "mock",
    outcome: "success",
    learnings: [],
  }),
}));

function createTempProject(): { dir: string; configPath: string; sessionsDir: string } {
  const dir = mkdtempSync(join(tmpdir(), "ao-model-usage-integ-"));
  mkdirSync(join(dir, ".audit"), { recursive: true });

  writeFileSync(
    join(dir, "sprint-status.yaml"),
    "development_status:\n  test-story: in-progress\n",
    "utf-8",
  );

  const configPath = join(dir, "agent-orchestrator.yaml");
  writeFileSync(configPath, "# mock config\n", "utf-8");

  // Create sessions dir with metadata for agent-1
  const sessionsDir = join(dir, "sessions");
  mkdirSync(sessionsDir, { recursive: true });

  return { dir, configPath, sessionsDir };
}

function writeSessionMetadata(
  sessionsDir: string,
  sessionId: string,
  metadata: Record<string, string>,
): void {
  const content = Object.entries(metadata)
    .map(([k, v]) => `${k} = ${v}`)
    .join("\n");
  writeFileSync(join(sessionsDir, sessionId), content, "utf-8");
}

function createMockRegistry(): AgentRegistry {
  const assignments = new Map<string, AgentAssignment>();
  return {
    getByAgent: (id: string) => assignments.get(id) ?? null,
    list: () => Array.from(assignments.values()),
    getByStory: (storyId: string) => {
      for (const a of assignments.values()) {
        if (a.storyId === storyId) return a;
      }
      return null;
    },
    findActiveByStory: (storyId: string) => {
      for (const a of assignments.values()) {
        if (a.storyId === storyId && a.status === "active") return a;
      }
      return null;
    },
    register: (a: AgentAssignment) => assignments.set(a.agentId, a),
    remove: (id: string) => assignments.delete(id),
    updateStatus: (id: string, status: AgentStatus) => {
      const a = assignments.get(id);
      if (a) a.status = status;
    },
    getZombies: () => [],
    reload: async () => {},
    getRetryCount: () => 0,
    incrementRetry: () => {},
    getRetryHistory: () => null,
  };
}

describe("captureModelUsage in completion handlers (Story 58.5)", () => {
  let tmp: ReturnType<typeof createTempProject>;

  beforeEach(() => {
    vi.clearAllMocks();
    clearServiceRegistry();
    tmp = createTempProject();
  });

  afterEach(() => {
    clearServiceRegistry();
    rmSync(tmp.dir, { recursive: true, force: true });
  });

  it("records model usage on agent completion", async () => {
    const registry = createMockRegistry();
    registry.register({
      agentId: "agent-1",
      storyId: "test-story",
      assignedAt: new Date(),
      status: "active",
      contextHash: "abc",
    });

    // Write session metadata with cost data
    writeSessionMetadata(tmp.sessionsDir, "agent-1", {
      "ao:modelTier": "high",
      "ao:model": "claude-opus-4-6",
      project: "my-project",
      cost: JSON.stringify({
        inputTokens: 5000,
        outputTokens: 1000,
        estimatedCostUsd: 0.5,
      }),
    });

    // Register a persistent aggregator
    const aggregator = createModelUsageAggregator();
    registerModelUsageAggregator(aggregator);

    const handler = createCompletionHandler(
      registry,
      tmp.dir,
      tmp.configPath,
      join(tmp.dir, ".audit"),
      undefined,
      tmp.sessionsDir,
    );

    await handler({
      agentId: "agent-1",
      storyId: "test-story",
      exitCode: 0,
      completedAt: new Date("2026-04-12T12:00:00Z"),
      duration: 5000,
    });

    // Verify usage was recorded
    const usage = aggregator.getBySession("agent-1");
    expect(usage.sessionCount).toBe(1);
    expect(usage.totalInputTokens).toBe(5000);
    expect(usage.totalOutputTokens).toBe(1000);
    expect(usage.totalCostUsd).toBe(0.5);

    // Verify audit log entry
    const auditFile = join(tmp.dir, ".audit", "agent-lifecycle.jsonl");
    const content = readFileSync(auditFile, "utf-8");
    const modelUsageLine = content.split("\n").find((l: string) => l.includes("model_usage"));
    expect(modelUsageLine).toBeDefined();
    const parsed = JSON.parse(modelUsageLine!);
    expect(parsed.model_tier).toBe("high");
    expect(parsed.model).toBe("claude-opus-4-6");
    expect(parsed.input_tokens).toBe(5000);
  });

  it("records model usage on agent failure", async () => {
    const registry = createMockRegistry();
    registry.register({
      agentId: "agent-2",
      storyId: "test-story",
      assignedAt: new Date(),
      status: "active",
      contextHash: "abc",
    });

    writeSessionMetadata(tmp.sessionsDir, "agent-2", {
      "ao:modelTier": "medium",
      "ao:model": "sonnet",
      project: "my-project",
      cost: JSON.stringify({
        inputTokens: 2000,
        outputTokens: 400,
        estimatedCostUsd: 0.1,
      }),
    });

    const aggregator = createModelUsageAggregator();
    registerModelUsageAggregator(aggregator);

    const handler = createFailureHandler(
      registry,
      tmp.dir,
      tmp.configPath,
      join(tmp.dir, ".audit"),
      undefined,
      tmp.sessionsDir,
    );

    await handler({
      agentId: "agent-2",
      storyId: "test-story",
      exitCode: 1,
      failedAt: new Date("2026-04-12T12:00:00Z"),
      duration: 3000,
      reason: "failed",
    });

    const usage = aggregator.getBySession("agent-2");
    expect(usage.sessionCount).toBe(1);
    expect(usage.totalInputTokens).toBe(2000);
    expect(usage.totalOutputTokens).toBe(400);
  });

  it("handles malformed cost JSON with zero values", async () => {
    const registry = createMockRegistry();
    registry.register({
      agentId: "agent-3",
      storyId: "test-story",
      assignedAt: new Date(),
      status: "active",
      contextHash: "abc",
    });

    writeSessionMetadata(tmp.sessionsDir, "agent-3", {
      "ao:modelTier": "low",
      "ao:model": "haiku",
      project: "my-project",
      cost: "not-valid-json",
    });

    const aggregator = createModelUsageAggregator();
    registerModelUsageAggregator(aggregator);

    const handler = createCompletionHandler(
      registry,
      tmp.dir,
      tmp.configPath,
      join(tmp.dir, ".audit"),
      undefined,
      tmp.sessionsDir,
    );

    await handler({
      agentId: "agent-3",
      storyId: "test-story",
      exitCode: 0,
      completedAt: new Date(),
      duration: 1000,
    });

    const usage = aggregator.getBySession("agent-3");
    expect(usage.sessionCount).toBe(1);
    expect(usage.totalInputTokens).toBe(0);
    expect(usage.totalOutputTokens).toBe(0);
    expect(usage.totalCostUsd).toBe(0);
  });

  it("falls back to singleton when no registered aggregator", async () => {
    const registry = createMockRegistry();
    registry.register({
      agentId: "agent-4",
      storyId: "test-story",
      assignedAt: new Date(),
      status: "active",
      contextHash: "abc",
    });

    writeSessionMetadata(tmp.sessionsDir, "agent-4", {
      "ao:modelTier": "medium",
      "ao:model": "sonnet",
      project: "my-project",
      cost: JSON.stringify({ inputTokens: 100, outputTokens: 50, estimatedCostUsd: 0.01 }),
    });

    // No registerModelUsageAggregator call — falls back to singleton
    const handler = createCompletionHandler(
      registry,
      tmp.dir,
      tmp.configPath,
      join(tmp.dir, ".audit"),
      undefined,
      tmp.sessionsDir,
    );

    // Should not throw
    await handler({
      agentId: "agent-4",
      storyId: "test-story",
      exitCode: 0,
      completedAt: new Date(),
      duration: 1000,
    });

    // Verify audit log still written (from captureModelUsage)
    const auditFile = join(tmp.dir, ".audit", "agent-lifecycle.jsonl");
    const content = readFileSync(auditFile, "utf-8");
    const modelUsageLine = content.split("\n").find((l: string) => l.includes("model_usage"));
    expect(modelUsageLine).toBeDefined();
  });
});
