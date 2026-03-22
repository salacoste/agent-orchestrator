/**
 * Sprint forecaster tests (Story 43.2).
 */
import { describe, expect, it } from "vitest";
import { computeForecast } from "../sprint-forecaster.js";
import type { SessionLearning } from "../types.js";

function makeLearning(overrides: Partial<SessionLearning> = {}): SessionLearning {
  return {
    sessionId: "s-1",
    agentId: "a-1",
    storyId: "1-1",
    projectId: "proj",
    outcome: "completed",
    durationMs: 3_600_000, // 1 hour
    retryCount: 0,
    filesModified: [],
    testsAdded: 3,
    errorCategories: [],
    domainTags: ["typescript"],
    completedAt: "2026-03-22T00:00:00Z",
    capturedAt: "2026-03-22T00:00:00Z",
    ...overrides,
  };
}

describe("computeForecast", () => {
  it("returns zero durations for empty backlog", () => {
    const forecast = computeForecast([], []);

    expect(forecast.backlogCount).toBe(0);
    expect(forecast.p50Ms).toBe(0);
    expect(forecast.confidence).toBe("high");
  });

  it("computes forecast with sufficient historical data", () => {
    const learnings = Array.from({ length: 10 }, (_, i) =>
      makeLearning({ sessionId: `s-${i}`, durationMs: 3_600_000 + i * 100_000 }),
    );

    const forecast = computeForecast(
      [{ storyId: "backlog-1" }, { storyId: "backlog-2" }],
      learnings,
    );

    expect(forecast.backlogCount).toBe(2);
    expect(forecast.sampleCount).toBe(10);
    expect(forecast.confidence).toBe("medium"); // 10 records
    expect(forecast.p50Ms).toBeGreaterThan(0);
    expect(forecast.p80Ms).toBeGreaterThan(forecast.p50Ms);
    expect(forecast.p95Ms).toBeGreaterThan(forecast.p80Ms);
  });

  it("maintains P50 < P80 < P95 ordering invariant", () => {
    const learnings = Array.from({ length: 25 }, (_, i) =>
      makeLearning({ sessionId: `s-${i}`, durationMs: 1_000_000 + i * 50_000 }),
    );

    const forecast = computeForecast(
      [{ storyId: "s-1" }, { storyId: "s-2" }, { storyId: "s-3" }],
      learnings,
    );

    expect(forecast.p50Ms).toBeLessThanOrEqual(forecast.p80Ms);
    expect(forecast.p80Ms).toBeLessThanOrEqual(forecast.p95Ms);
  });

  it("uses domain matching when tags available", () => {
    const learnings = [
      makeLearning({ sessionId: "s-1", durationMs: 1_000_000, domainTags: ["frontend"] }),
      makeLearning({ sessionId: "s-2", durationMs: 2_000_000, domainTags: ["frontend"] }),
      makeLearning({ sessionId: "s-3", durationMs: 3_000_000, domainTags: ["frontend"] }),
      makeLearning({ sessionId: "s-4", durationMs: 10_000_000, domainTags: ["backend"] }),
      makeLearning({ sessionId: "s-5", durationMs: 10_000_000, domainTags: ["backend"] }),
    ];

    const frontendForecast = computeForecast(
      [{ storyId: "fe-1", domainTags: ["frontend"] }],
      learnings,
    );

    const backendForecast = computeForecast(
      [{ storyId: "be-1", domainTags: ["backend"] }],
      learnings,
    );

    // Frontend stories should estimate shorter than backend
    expect(frontendForecast.p50Ms).toBeLessThan(backendForecast.p50Ms);
  });

  it("falls back to default duration with <5 records", () => {
    const learnings = [makeLearning({ sessionId: "s-1", durationMs: 1_000_000 })];
    const defaultMs = 7_200_000; // 2 hours

    const forecast = computeForecast([{ storyId: "backlog-1" }], learnings, defaultMs);

    expect(forecast.confidence).toBe("insufficient");
    // Should still compute — uses the single available sample
    expect(forecast.p50Ms).toBeGreaterThan(0);
  });

  it("uses default duration when no completed sessions exist", () => {
    const learnings = [makeLearning({ sessionId: "s-1", outcome: "failed", durationMs: 500_000 })];
    const defaultMs = 3_600_000;

    const forecast = computeForecast([{ storyId: "backlog-1" }], learnings, defaultMs);

    expect(forecast.p50Ms).toBe(defaultMs);
  });

  it("returns confidence levels at threshold boundaries", () => {
    const make = (n: number) =>
      Array.from({ length: n }, (_, i) => makeLearning({ sessionId: `s-${i}` }));

    expect(computeForecast([{ storyId: "s" }], make(4)).confidence).toBe("insufficient");
    expect(computeForecast([{ storyId: "s" }], make(5)).confidence).toBe("low");
    expect(computeForecast([{ storyId: "s" }], make(10)).confidence).toBe("medium");
    expect(computeForecast([{ storyId: "s" }], make(20)).confidence).toBe("high");
  });

  it("includes ISO date strings for completion estimates", () => {
    const learnings = Array.from({ length: 10 }, (_, i) => makeLearning({ sessionId: `s-${i}` }));

    const forecast = computeForecast([{ storyId: "s-1" }], learnings);

    expect(forecast.p50Date).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(forecast.p80Date).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(forecast.p95Date).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});
