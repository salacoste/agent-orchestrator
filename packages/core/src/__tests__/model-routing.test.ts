/**
 * Unit tests for Story 58.4: Model Routing Service.
 * Covers: resolveTier heuristics, explicit override, defaultTier fallback,
 *         tierToModel, failure tracking, auto-escalation, escalation ceiling.
 * AC: #8
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  createModelRoutingService,
  classifyStoryComplexity,
  type ModelRoutingService,
} from "../model-routing.js";
import type { OrchestratorConfig, ProjectConfig } from "../types.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeConfig(modelTiers?: Record<string, string>): OrchestratorConfig {
  return {
    projects: {},
    sessionEnhancement: modelTiers ? { provider: "omc", config: { modelTiers } } : undefined,
  } as unknown as OrchestratorConfig;
}

function makeProject(modelTiers?: Record<string, string>): ProjectConfig {
  return {
    path: "/tmp/test",
    name: "test",
    sessionEnhancement: modelTiers ? { modelTiers } : undefined,
  } as unknown as ProjectConfig;
}

// ---------------------------------------------------------------------------
// AC #2 — Story complexity classification (keyword heuristics)
// ---------------------------------------------------------------------------

describe("classifyStoryComplexity()", () => {
  it("classifies LOW tier keywords", () => {
    for (const kw of [
      "explore",
      "search",
      "format",
      "lint",
      "find",
      "list",
      "scan",
      "audit",
      "check",
      "validate",
      "verify",
    ]) {
      expect(classifyStoryComplexity(`58-4-${kw}-something`)).toBe("low");
    }
  });

  it("classifies HIGH tier keywords", () => {
    for (const kw of [
      "architect",
      "design",
      "debug",
      "debugger",
      "fix",
      "investigate",
      "troubleshoot",
      "refactor",
      "migrate",
    ]) {
      expect(classifyStoryComplexity(`58-4-${kw}-something`)).toBe("high");
    }
  });

  it("returns null for non-matching story keys", () => {
    expect(classifyStoryComplexity("58-4-model-routing-service")).toBeNull();
    expect(classifyStoryComplexity("49-3-project-drill-down-navigation")).toBeNull();
    expect(classifyStoryComplexity("7-1-fleet-monitoring-matrix")).toBeNull();
  });

  it("is case-insensitive", () => {
    expect(classifyStoryComplexity("58-4-EXPLORE-data")).toBe("low");
    expect(classifyStoryComplexity("58-4-ARCHITECT-system")).toBe("high");
  });

  it("does not match substrings across hyphen boundaries", () => {
    // "fix" should NOT match "prefix" or "suffix"
    expect(classifyStoryComplexity("10-1-prefix-setup")).toBeNull();
    // "find" should NOT match "finding"
    expect(classifyStoryComplexity("10-1-finding-report")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// AC #1 + #2 — resolveTier() with heuristics, override, default
// ---------------------------------------------------------------------------

describe("resolveTier()", () => {
  let service: ModelRoutingService;

  beforeEach(() => {
    service = createModelRoutingService();
  });

  it("returns MEDIUM when no heuristics match and no overrides", () => {
    expect(service.resolveTier({ storyKey: "58-4-model-routing-service" })).toBe("medium");
  });

  it("returns LOW for LOW tier keywords", () => {
    expect(service.resolveTier({ storyKey: "10-1-lint-fix-rules" })).toBe("low");
  });

  it("returns HIGH for HIGH tier keywords", () => {
    expect(service.resolveTier({ storyKey: "12-1-debug-complex-issue" })).toBe("high");
  });

  it("explicit override takes absolute precedence over heuristics", () => {
    expect(
      service.resolveTier({
        storyKey: "10-1-lint-fix-rules",
        explicitTier: "high",
      }),
    ).toBe("high");
  });

  it("explicit override takes precedence over defaultTier", () => {
    expect(
      service.resolveTier({
        storyKey: "58-4-model-routing-service",
        explicitTier: "low",
        defaultTier: "high",
      }),
    ).toBe("low");
  });

  it("defaultTier is used when heuristics don't match", () => {
    expect(
      service.resolveTier({
        storyKey: "58-4-model-routing-service",
        defaultTier: "low",
      }),
    ).toBe("low");
  });

  it("heuristics beat defaultTier", () => {
    // "debug" matches HIGH, defaultTier is LOW → heuristics win
    expect(
      service.resolveTier({
        storyKey: "58-4-debug-issue",
        defaultTier: "low",
      }),
    ).toBe("high");
  });
});

// ---------------------------------------------------------------------------
// AC #3 — tierToModel()
// ---------------------------------------------------------------------------

describe("tierToModel()", () => {
  let service: ModelRoutingService;

  beforeEach(() => {
    service = createModelRoutingService();
  });

  it("maps tiers using DEFAULT_MODEL_TIERS when no config override", () => {
    const config = makeConfig();
    const project = makeProject();

    expect(service.tierToModel("low", config, project)).toBe("haiku");
    expect(service.tierToModel("medium", config, project)).toBe("sonnet");
    expect(service.tierToModel("high", config, project)).toBe("opus");
  });

  it("uses project-level model tier overrides", () => {
    const config = makeConfig();
    const project = makeProject({
      low: "claude-haiku-4-5",
      medium: "claude-sonnet-4-6",
      high: "claude-opus-4-6",
    });

    expect(service.tierToModel("low", config, project)).toBe("claude-haiku-4-5");
    expect(service.tierToModel("medium", config, project)).toBe("claude-sonnet-4-6");
    expect(service.tierToModel("high", config, project)).toBe("claude-opus-4-6");
  });
});

// ---------------------------------------------------------------------------
// AC #4 — Failure tracking and auto-escalation
// ---------------------------------------------------------------------------

describe("failure tracking", () => {
  let service: ModelRoutingService;

  beforeEach(() => {
    service = createModelRoutingService();
  });

  it("recordFailure returns incremented count", () => {
    expect(service.recordFailure("sess-1", "low")).toBe(1);
    expect(service.recordFailure("sess-1", "low")).toBe(2);
    expect(service.recordFailure("sess-1", "low")).toBe(3);
  });

  it("getFailureCount returns 0 for unknown session", () => {
    expect(service.getFailureCount("unknown")).toBe(0);
  });

  it("getFailureCount returns current count", () => {
    service.recordFailure("sess-1", "low");
    service.recordFailure("sess-1", "low");
    expect(service.getFailureCount("sess-1")).toBe(2);
  });

  it("resetFailures clears the counter", () => {
    service.recordFailure("sess-1", "low");
    service.recordFailure("sess-1", "low");
    service.resetFailures("sess-1");
    expect(service.getFailureCount("sess-1")).toBe(0);
  });

  it("resetFailures on unknown session is a no-op", () => {
    service.resetFailures("nonexistent");
    expect(service.getFailureCount("nonexistent")).toBe(0);
  });

  it("recording failures for a different tier resets counter", () => {
    service.recordFailure("sess-1", "low");
    service.recordFailure("sess-1", "low");
    // Switch tier — counter resets
    expect(service.recordFailure("sess-1", "medium")).toBe(1);
  });
});

describe("auto-escalation", () => {
  let service: ModelRoutingService;

  beforeEach(() => {
    service = createModelRoutingService();
  });

  it("escalates from LOW to MEDIUM after 2 failures", () => {
    service.recordFailure("sess-1", "low");
    service.recordFailure("sess-1", "low");

    // Story key "lint" matches LOW, but escalation bumps to MEDIUM
    const tier = service.resolveTier({
      storyKey: "10-1-lint-rules",
      sessionId: "sess-1",
    });
    expect(tier).toBe("medium");
  });

  it("escalates from MEDIUM to HIGH after 2 failures", () => {
    service.recordFailure("sess-1", "medium");
    service.recordFailure("sess-1", "medium");

    // No keyword match → MEDIUM, but escalation bumps to HIGH
    const tier = service.resolveTier({
      storyKey: "58-4-model-routing-service",
      sessionId: "sess-1",
    });
    expect(tier).toBe("high");
  });

  it("does not escalate beyond HIGH", () => {
    service.recordFailure("sess-1", "high");
    service.recordFailure("sess-1", "high");

    // "debug" matches HIGH → already at max, stays HIGH
    const tier = service.resolveTier({
      storyKey: "58-4-debug-issue",
      sessionId: "sess-1",
    });
    expect(tier).toBe("high");
  });

  it("explicit override beats auto-escalation", () => {
    service.recordFailure("sess-1", "low");
    service.recordFailure("sess-1", "low");

    const tier = service.resolveTier({
      storyKey: "10-1-lint-rules",
      sessionId: "sess-1",
      explicitTier: "low",
    });
    expect(tier).toBe("low");
  });

  it("escalation resets when tier changes (failure recorded at new tier)", () => {
    service.recordFailure("sess-1", "low");
    service.recordFailure("sess-1", "low");
    // Switch to medium failures
    service.recordFailure("sess-1", "medium");

    // Only 1 failure at medium — no escalation yet
    const tier = service.resolveTier({
      storyKey: "58-4-model-routing-service",
      sessionId: "sess-1",
    });
    expect(tier).toBe("medium"); // not escalated
  });

  it("escalation returns max of heuristic vs escalated tier", () => {
    // Failures at LOW → escalation would return MEDIUM
    service.recordFailure("sess-1", "low");
    service.recordFailure("sess-1", "low");

    // But story "debug" heuristically resolves to HIGH
    // Escalated = MEDIUM, Heuristic = HIGH → should return HIGH (max)
    const tier = service.resolveTier({
      storyKey: "58-4-debug-issue",
      sessionId: "sess-1",
    });
    expect(tier).toBe("high");
  });
});

// ---------------------------------------------------------------------------
// AC #8 — Factory isolation (each factory creates independent state)
// ---------------------------------------------------------------------------

describe("factory isolation", () => {
  it("each factory instance has independent failure tracking", () => {
    const svc1 = createModelRoutingService();
    const svc2 = createModelRoutingService();

    svc1.recordFailure("sess-1", "low");
    svc1.recordFailure("sess-1", "low");

    // svc2 should not see svc1's failures
    expect(svc2.getFailureCount("sess-1")).toBe(0);

    // svc1 should escalate
    expect(svc1.resolveTier({ storyKey: "10-1-lint-rules", sessionId: "sess-1" })).toBe("medium");

    // svc2 should not escalate
    expect(svc2.resolveTier({ storyKey: "10-1-lint-rules", sessionId: "sess-1" })).toBe("low");
  });
});
