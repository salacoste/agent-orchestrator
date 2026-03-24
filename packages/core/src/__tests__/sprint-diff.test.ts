/**
 * Sprint diff tests (Story 45.8).
 */
import { describe, expect, it } from "vitest";
import { computeSprintDiff } from "../sprint-diff.js";
import type { SessionLearning } from "../types.js";

function makeSession(overrides: Partial<SessionLearning> = {}): SessionLearning {
  return {
    sessionId: "s-1",
    agentId: "a-1",
    storyId: "1-1",
    projectId: "proj",
    outcome: "completed",
    durationMs: 60000,
    retryCount: 0,
    filesModified: ["src/a.ts"],
    testsAdded: 1,
    errorCategories: [],
    domainTags: ["backend"],
    completedAt: "2026-03-22T10:00:00Z",
    capturedAt: "2026-03-22T10:00:01Z",
    ...overrides,
  };
}

describe("computeSprintDiff", () => {
  it("compares two periods with data", () => {
    const periodA = [
      makeSession({ durationMs: 100000 }),
      makeSession({ outcome: "failed", durationMs: 50000, errorCategories: ["timeout"] }),
    ];
    const periodB = [
      makeSession({ durationMs: 60000 }),
      makeSession({ durationMs: 40000 }),
      makeSession({ durationMs: 50000 }),
    ];

    const diff = computeSprintDiff(periodA, periodB);

    // Period A: 1 completed, Period B: 3 completed → improved
    expect(diff.storiesCompleted.periodA).toBe(1);
    expect(diff.storiesCompleted.periodB).toBe(3);
    expect(diff.storiesCompleted.direction).toBe("improved");
  });

  it("detects improved failure rate", () => {
    const periodA = [makeSession({ outcome: "completed" }), makeSession({ outcome: "failed" })];
    const periodB = [makeSession({ outcome: "completed" }), makeSession({ outcome: "completed" })];

    const diff = computeSprintDiff(periodA, periodB);

    // A: 50% failure → B: 0% failure → improved
    expect(diff.failureRate.periodA).toBe(0.5);
    expect(diff.failureRate.periodB).toBe(0);
    expect(diff.failureRate.direction).toBe("improved");
  });

  it("detects regressed duration", () => {
    const periodA = [makeSession({ durationMs: 30000 })];
    const periodB = [makeSession({ durationMs: 90000 })];

    const diff = computeSprintDiff(periodA, periodB);

    // B is slower → regressed
    expect(diff.avgDurationMs.direction).toBe("regressed");
  });

  it("detects unchanged with small difference", () => {
    const periodA = [makeSession({ durationMs: 100000 })];
    const periodB = [makeSession({ durationMs: 103000 })]; // 3% change — within 5% threshold

    const diff = computeSprintDiff(periodA, periodB);

    expect(diff.avgDurationMs.direction).toBe("unchanged");
  });

  it("handles empty period A", () => {
    const periodB = [makeSession()];

    const diff = computeSprintDiff([], periodB);

    expect(diff.storiesCompleted.periodA).toBe(0);
    expect(diff.storiesCompleted.periodB).toBe(1);
    expect(diff.storiesCompleted.direction).toBe("improved");
  });

  it("handles empty period B", () => {
    const periodA = [makeSession()];

    const diff = computeSprintDiff(periodA, []);

    expect(diff.storiesCompleted.periodA).toBe(1);
    expect(diff.storiesCompleted.periodB).toBe(0);
    expect(diff.storiesCompleted.direction).toBe("regressed");
  });

  it("handles both periods empty", () => {
    const diff = computeSprintDiff([], []);

    expect(diff.storiesCompleted.direction).toBe("unchanged");
    expect(diff.avgDurationMs.direction).toBe("unchanged");
    expect(diff.failureRate.direction).toBe("unchanged");
  });

  it("collects top error categories per period", () => {
    const periodA = [
      makeSession({ outcome: "failed", errorCategories: ["timeout", "parse"] }),
      makeSession({ outcome: "failed", errorCategories: ["timeout"] }),
    ];
    const periodB = [makeSession({ outcome: "failed", errorCategories: ["permission"] })];

    const diff = computeSprintDiff(periodA, periodB);

    expect(diff.topErrorsA[0]).toBe("timeout"); // 2 occurrences — top
    expect(diff.topErrorsA).toContain("parse");
    expect(diff.topErrorsB).toContain("permission");
  });

  it("limits top errors to 5", () => {
    const errors = Array.from({ length: 8 }, (_, i) => `error-${i}`);
    const sessions = errors.map((e) => makeSession({ outcome: "failed", errorCategories: [e] }));

    const diff = computeSprintDiff(sessions, []);

    expect(diff.topErrorsA.length).toBeLessThanOrEqual(5);
  });

  it("rounds failure rate to 3 decimal places", () => {
    const periodA = [
      makeSession({ outcome: "completed" }),
      makeSession({ outcome: "completed" }),
      makeSession({ outcome: "failed" }),
    ];

    const diff = computeSprintDiff(periodA, []);

    // 1/3 = 0.333... → 0.333
    expect(diff.failureRate.periodA).toBe(0.333);
  });
});
