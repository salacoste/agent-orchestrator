/**
 * Unit tests for Story 58.5: Model Usage Tracking.
 * Covers: ModelUsageEvent construction, recordUsage, aggregation queries,
 *         getBySession/getByStory/getByProject/getBySprint, getSummary,
 *         JSONL persistence, zero-value fallback, factory isolation,
 *         startup load from disk, validateModelTier.
 * AC: #8
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  createModelUsageAggregator,
  validateModelTier,
  type ModelUsageAggregator,
} from "../model-usage.js";
import type { ModelUsageEvent, ModelTier } from "../types.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeEvent(overrides?: {
  sessionId?: string;
  storyId?: string;
  projectId?: string;
  modelTier?: ModelTier;
  model?: string;
  inputTokens?: number;
  outputTokens?: number;
  estimatedCostUsd?: number;
  timestamp?: string;
}): ModelUsageEvent {
  return {
    sessionId: overrides?.sessionId ?? "sess-1",
    storyId: overrides?.storyId ?? "58-5-model-usage-tracking",
    projectId: overrides?.projectId ?? "test-project",
    modelTier: overrides?.modelTier ?? ("medium" as ModelTier),
    model: overrides?.model ?? "sonnet",
    inputTokens: overrides?.inputTokens ?? 1000,
    outputTokens: overrides?.outputTokens ?? 200,
    estimatedCostUsd: overrides?.estimatedCostUsd ?? 0.05,
    timestamp: overrides?.timestamp ?? new Date().toISOString(),
  };
}

function makeTmpDir(): string {
  return mkdtempSync(join(tmpdir(), "ao-model-usage-test-"));
}

/** Poll for a file to exist and have non-empty content, up to 2 seconds. */
async function waitForFile(filePath: string, maxMs = 2000): Promise<void> {
  const start = Date.now();
  while (true) {
    if (existsSync(filePath)) {
      try {
        const content = readFileSync(filePath, "utf-8").trim();
        if (content.length > 0) return;
      } catch {
        // File not readable yet — retry
      }
    }
    if (Date.now() - start > maxMs) {
      throw new Error(`File not found or empty within ${maxMs}ms: ${filePath}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
}

// ---------------------------------------------------------------------------
// AC #1, #4 — recordUsage() and basic aggregation
// ---------------------------------------------------------------------------

describe("recordUsage()", () => {
  let service: ModelUsageAggregator;

  beforeEach(() => {
    service = createModelUsageAggregator();
  });

  it("stores an event and makes it queryable", () => {
    const event = makeEvent();
    service.recordUsage(event);
    const result = service.getBySession("sess-1");
    expect(result.sessionCount).toBe(1);
    expect(result.totalInputTokens).toBe(1000);
    expect(result.totalOutputTokens).toBe(200);
    expect(result.totalCostUsd).toBe(0.05);
  });

  it("stores multiple events for the same session", () => {
    service.recordUsage(makeEvent());
    service.recordUsage(makeEvent({ inputTokens: 500, outputTokens: 100 }));
    const result = service.getBySession("sess-1");
    expect(result.sessionCount).toBe(2);
    expect(result.totalInputTokens).toBe(1500);
    expect(result.totalOutputTokens).toBe(300);
  });
});

// ---------------------------------------------------------------------------
// AC #4 — getBySession()
// ---------------------------------------------------------------------------

describe("getBySession()", () => {
  let service: ModelUsageAggregator;

  beforeEach(() => {
    service = createModelUsageAggregator();
  });

  it("returns empty aggregate for unknown session", () => {
    const result = service.getBySession("nonexistent");
    expect(result.totalInputTokens).toBe(0);
    expect(result.totalOutputTokens).toBe(0);
    expect(result.totalCostUsd).toBe(0);
    expect(result.sessionCount).toBe(0);
  });

  it("returns correct aggregate for known session", () => {
    service.recordUsage(makeEvent({ sessionId: "sess-1", inputTokens: 500 }));
    service.recordUsage(makeEvent({ sessionId: "sess-2", inputTokens: 300 }));
    service.recordUsage(makeEvent({ sessionId: "sess-1", inputTokens: 200 }));

    const result = service.getBySession("sess-1");
    expect(result.sessionCount).toBe(2);
    expect(result.totalInputTokens).toBe(700);
  });
});

// ---------------------------------------------------------------------------
// AC #4 — getByStory()
// ---------------------------------------------------------------------------

describe("getByStory()", () => {
  let service: ModelUsageAggregator;

  beforeEach(() => {
    service = createModelUsageAggregator();
  });

  it("aggregates events across sessions for the same story", () => {
    service.recordUsage(makeEvent({ sessionId: "sess-1", storyId: "58-5-foo", inputTokens: 1000 }));
    service.recordUsage(makeEvent({ sessionId: "sess-2", storyId: "58-5-foo", inputTokens: 500 }));
    service.recordUsage(makeEvent({ sessionId: "sess-3", storyId: "58-6-bar", inputTokens: 200 }));

    const result = service.getByStory("58-5-foo");
    expect(result.sessionCount).toBe(2);
    expect(result.totalInputTokens).toBe(1500);
  });

  it("returns empty for unknown story", () => {
    const result = service.getByStory("nonexistent");
    expect(result.sessionCount).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// AC #4 — getByProject()
// ---------------------------------------------------------------------------

describe("getByProject()", () => {
  let service: ModelUsageAggregator;

  beforeEach(() => {
    service = createModelUsageAggregator();
  });

  it("aggregates events for a project", () => {
    service.recordUsage(makeEvent({ projectId: "proj-a", inputTokens: 1000 }));
    service.recordUsage(makeEvent({ projectId: "proj-a", inputTokens: 500 }));
    service.recordUsage(makeEvent({ projectId: "proj-b", inputTokens: 200 }));

    const result = service.getByProject("proj-a");
    expect(result.sessionCount).toBe(2);
    expect(result.totalInputTokens).toBe(1500);
  });

  it("returns empty for unknown project", () => {
    expect(service.getByProject("nonexistent").sessionCount).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// AC #4 — getBySprint()
// ---------------------------------------------------------------------------

describe("getBySprint()", () => {
  let tmpDir: string;
  let service: ModelUsageAggregator;

  beforeEach(() => {
    tmpDir = makeTmpDir();
    service = createModelUsageAggregator();
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("reads sprint-status.yaml and aggregates matching stories", async () => {
    // Create a sprint-status.yaml with two stories
    const sprintYaml = `
development_status:
  story-a: done
  story-b: in-progress
  story-c: done
`;
    writeFileSync(join(tmpDir, "sprint-status.yaml"), sprintYaml, "utf-8");

    service.recordUsage(makeEvent({ storyId: "story-a", inputTokens: 1000 }));
    service.recordUsage(makeEvent({ storyId: "story-b", inputTokens: 500 }));
    service.recordUsage(makeEvent({ storyId: "story-c", inputTokens: 300 }));
    service.recordUsage(makeEvent({ storyId: "story-d", inputTokens: 999 }));

    const result = await service.getBySprint(tmpDir);
    expect(result.sessionCount).toBe(3);
    expect(result.totalInputTokens).toBe(1800);
  });

  it("returns empty when sprint-status.yaml not found", async () => {
    service.recordUsage(makeEvent({ storyId: "story-a", inputTokens: 1000 }));
    const result = await service.getBySprint("/nonexistent/path");
    expect(result.sessionCount).toBe(0);
    expect(result.totalInputTokens).toBe(0);
  });

  it("returns empty when sprint-status.yaml has no development_status", async () => {
    writeFileSync(join(tmpDir, "sprint-status.yaml"), "project: test\n", "utf-8");
    service.recordUsage(makeEvent({ storyId: "story-a", inputTokens: 1000 }));
    const result = await service.getBySprint(tmpDir);
    expect(result.sessionCount).toBe(0);
  });

  it("excludes epic and retrospective keys from sprint aggregation", async () => {
    const sprintYaml = `
development_status:
  story-a: done
  epic-1: done
  epic-2-retrospective: done
  story-b: in-progress
`;
    writeFileSync(join(tmpDir, "sprint-status.yaml"), sprintYaml, "utf-8");

    service.recordUsage(makeEvent({ storyId: "story-a", inputTokens: 1000 }));
    service.recordUsage(makeEvent({ storyId: "epic-1", inputTokens: 500 }));
    service.recordUsage(makeEvent({ storyId: "epic-2-retrospective", inputTokens: 300 }));
    service.recordUsage(makeEvent({ storyId: "story-b", inputTokens: 200 }));

    const result = await service.getBySprint(tmpDir);
    // Only story-a and story-b should be included (epics and retrospectives excluded)
    expect(result.sessionCount).toBe(2);
    expect(result.totalInputTokens).toBe(1200);
  });
});

// ---------------------------------------------------------------------------
// AC #4 — getSummary()
// ---------------------------------------------------------------------------

describe("getSummary()", () => {
  let service: ModelUsageAggregator;

  beforeEach(() => {
    service = createModelUsageAggregator();
  });

  it("returns zero totals when no events", () => {
    const summary = service.getSummary();
    expect(summary.totalTokens).toBe(0);
    expect(summary.totalCost).toBe(0);
    expect(summary.byTier.low.sessions).toBe(0);
    expect(summary.byTier.medium.sessions).toBe(0);
    expect(summary.byTier.high.sessions).toBe(0);
  });

  it("computes correct totals and per-tier breakdown", () => {
    service.recordUsage(
      makeEvent({
        sessionId: "s1",
        modelTier: "low",
        inputTokens: 100,
        outputTokens: 50,
        estimatedCostUsd: 0.01,
      }),
    );
    service.recordUsage(
      makeEvent({
        sessionId: "s2",
        modelTier: "low",
        inputTokens: 200,
        outputTokens: 50,
        estimatedCostUsd: 0.02,
      }),
    );
    service.recordUsage(
      makeEvent({
        sessionId: "s3",
        modelTier: "high",
        inputTokens: 5000,
        outputTokens: 1000,
        estimatedCostUsd: 0.5,
      }),
    );

    const summary = service.getSummary();
    // Total: 100+50 + 200+50 + 5000+1000 = 6400
    expect(summary.totalTokens).toBe(6400);
    expect(summary.totalCost).toBeCloseTo(0.53);

    // Low tier: 2 sessions, 400 tokens, $0.03
    expect(summary.byTier.low.sessions).toBe(2);
    expect(summary.byTier.low.tokens).toBe(400);
    expect(summary.byTier.low.cost).toBeCloseTo(0.03);

    // High tier: 1 session, 6000 tokens, $0.50
    expect(summary.byTier.high.sessions).toBe(1);
    expect(summary.byTier.high.tokens).toBe(6000);
    expect(summary.byTier.high.cost).toBeCloseTo(0.5);

    // Medium: none
    expect(summary.byTier.medium.sessions).toBe(0);
  });

  it("deduplicates sessions within same tier", () => {
    // Same session recorded twice at same tier should count as 1 session
    service.recordUsage(
      makeEvent({ sessionId: "s1", modelTier: "low", inputTokens: 100, outputTokens: 50 }),
    );
    service.recordUsage(
      makeEvent({ sessionId: "s1", modelTier: "low", inputTokens: 200, outputTokens: 50 }),
    );

    const summary = service.getSummary();
    expect(summary.byTier.low.sessions).toBe(1);
    // (100+50) + (200+50) = 400 total tokens
    expect(summary.byTier.low.tokens).toBe(400);
  });

  it("skips events with invalid modelTier", () => {
    service.recordUsage(
      makeEvent({
        sessionId: "s1",
        modelTier: "low" as ModelTier,
        inputTokens: 100,
        outputTokens: 50,
      }),
    );
    // Manually push an event with invalid tier (bypassing type system)
    const serviceAny = service as unknown as {
      recordUsage: (e: ModelUsageEvent & { modelTier: string }) => void;
    };
    serviceAny.recordUsage({
      sessionId: "s2",
      storyId: "58-5-model-usage-tracking",
      projectId: "test-project",
      modelTier: "invalid-tier" as unknown as ModelTier,
      model: "sonnet",
      inputTokens: 500,
      outputTokens: 100,
      estimatedCostUsd: 0.05,
      timestamp: new Date().toISOString(),
    });

    const summary = service.getSummary();
    // Only the valid event should be counted
    expect(summary.totalTokens).toBe(150);
    expect(summary.byTier.low.sessions).toBe(1);
    expect(summary.byTier.low.tokens).toBe(150);
  });
});

// ---------------------------------------------------------------------------
// AC #5 — JSONL persistence
// ---------------------------------------------------------------------------

describe("JSONL persistence", () => {
  let tmpDir: string;
  let service: ModelUsageAggregator;

  beforeEach(() => {
    tmpDir = makeTmpDir();
    service = createModelUsageAggregator(tmpDir);
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("creates JSONL file on first recordUsage()", async () => {
    service.recordUsage(makeEvent());
    const jsonlPath = join(tmpDir, "audit", "model-usage.jsonl");
    await waitForFile(jsonlPath);

    const content = readFileSync(jsonlPath, "utf-8").trim();
    const parsed = JSON.parse(content) as ModelUsageEvent;
    expect(parsed.sessionId).toBe("sess-1");
    expect(parsed.modelTier).toBe("medium");
  });

  it("appends multiple events to JSONL", async () => {
    service.recordUsage(makeEvent({ sessionId: "s1" }));
    service.recordUsage(makeEvent({ sessionId: "s2" }));
    const jsonlPath = join(tmpDir, "audit", "model-usage.jsonl");
    await waitForFile(jsonlPath);

    const lines = readFileSync(jsonlPath, "utf-8").trim().split("\n");
    expect(lines).toHaveLength(2);
  });

  it("loads events from existing JSONL on startup", () => {
    // Pre-create a JSONL file with events
    const auditDir = join(tmpDir, "audit");
    mkdirSync(auditDir, { recursive: true });
    const jsonlPath = join(auditDir, "model-usage.jsonl");
    const existingEvents = [
      makeEvent({ sessionId: "existing-1", storyId: "story-x", inputTokens: 500 }),
      makeEvent({ sessionId: "existing-2", storyId: "story-y", inputTokens: 300 }),
    ];
    writeFileSync(
      jsonlPath,
      existingEvents.map((e) => JSON.stringify(e)).join("\n") + "\n",
      "utf-8",
    );

    // Create a new aggregator pointing to the same dir — should load existing events
    const loaded = createModelUsageAggregator(tmpDir);
    const result = loaded.getBySession("existing-1");
    expect(result.sessionCount).toBe(1);
    expect(result.totalInputTokens).toBe(500);

    const byStory = loaded.getByStory("story-y");
    expect(byStory.sessionCount).toBe(1);
    expect(byStory.totalInputTokens).toBe(300);

    // Summary should reflect loaded events
    // existing-1: 500+200=700, existing-2: 300+200=500 → total=1200
    const summary = loaded.getSummary();
    expect(summary.totalTokens).toBe(1200);
  });

  it("handles malformed JSONL lines gracefully", () => {
    const auditDir = join(tmpDir, "audit");
    mkdirSync(auditDir, { recursive: true });
    const jsonlPath = join(auditDir, "model-usage.jsonl");
    writeFileSync(
      jsonlPath,
      "not-valid-json\n" +
        JSON.stringify(makeEvent({ sessionId: "valid-1", inputTokens: 100 })) +
        "\n" +
        "\n",
      "utf-8",
    );

    const loaded = createModelUsageAggregator(tmpDir);
    const result = loaded.getBySession("valid-1");
    expect(result.sessionCount).toBe(1);
    expect(result.totalInputTokens).toBe(100);
  });
});

// ---------------------------------------------------------------------------
// AC #3 — Missing cost data logs zero-values
// ---------------------------------------------------------------------------

describe("zero-value fallback", () => {
  let service: ModelUsageAggregator;

  beforeEach(() => {
    service = createModelUsageAggregator();
  });

  it("records event with zero tokens when cost data unavailable", () => {
    const event = makeEvent({
      inputTokens: 0,
      outputTokens: 0,
      estimatedCostUsd: 0,
    });
    service.recordUsage(event);

    const result = service.getBySession("sess-1");
    expect(result.sessionCount).toBe(1);
    expect(result.totalInputTokens).toBe(0);
    expect(result.totalOutputTokens).toBe(0);
    expect(result.totalCostUsd).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// AC #8 — Factory isolation
// ---------------------------------------------------------------------------

describe("factory isolation", () => {
  it("each factory instance has independent event store", () => {
    const svc1 = createModelUsageAggregator();
    const svc2 = createModelUsageAggregator();

    svc1.recordUsage(makeEvent({ sessionId: "s1", inputTokens: 1000 }));

    expect(svc1.getBySession("s1").sessionCount).toBe(1);
    expect(svc2.getBySession("s1").sessionCount).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// validateModelTier
// ---------------------------------------------------------------------------

describe("validateModelTier()", () => {
  it("returns valid tiers unchanged", () => {
    expect(validateModelTier("low")).toBe("low");
    expect(validateModelTier("medium")).toBe("medium");
    expect(validateModelTier("high")).toBe("high");
  });

  it("falls back to medium for invalid values", () => {
    expect(validateModelTier("super")).toBe("medium");
    expect(validateModelTier("")).toBe("medium");
    expect(validateModelTier(undefined)).toBe("medium");
  });
});
