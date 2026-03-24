/**
 * Pre-flight check tests (Story 47.6).
 */
import { describe, expect, it } from "vitest";
import { preFlightCheck } from "../pre-flight-check.js";
import type { SessionLearning } from "../types.js";

function makeLearning(overrides: Partial<SessionLearning> = {}): SessionLearning {
  return {
    sessionId: "s-1",
    agentId: "a-1",
    storyId: "1-1",
    projectId: "proj",
    outcome: "completed",
    durationMs: 60000,
    retryCount: 0,
    filesModified: [],
    testsAdded: 0,
    errorCategories: [],
    domainTags: ["backend"],
    completedAt: "2026-03-24T10:00:00Z",
    capturedAt: "2026-03-24T10:00:01Z",
    ...overrides,
  };
}

describe("preFlightCheck", () => {
  it("returns optimistic default with no matching history", () => {
    const result = preFlightCheck(["frontend"], 3, []);

    expect(result.successRate).toBe(0.8);
    expect(result.matchingSessionCount).toBe(0);
    expect(result.riskFactors.some((r) => r.name === "Domain novelty")).toBe(true);
    expect(result.advisory).toContain("80%");
  });

  it("computes success rate from matching sessions", () => {
    const learnings = [
      makeLearning({ outcome: "completed", domainTags: ["backend"] }),
      makeLearning({ outcome: "completed", domainTags: ["backend"] }),
      makeLearning({ outcome: "failed", domainTags: ["backend"] }),
      makeLearning({ outcome: "completed", domainTags: ["frontend"] }), // No match
    ];

    const result = preFlightCheck(["backend"], 3, learnings);

    // 2 completed / 3 matching = 0.67
    expect(result.successRate).toBeCloseTo(0.67, 1);
    expect(result.matchingSessionCount).toBe(3);
  });

  it("computes estimated duration from completed sessions", () => {
    const learnings = [
      makeLearning({ outcome: "completed", durationMs: 60000, domainTags: ["api"] }),
      makeLearning({ outcome: "completed", durationMs: 120000, domainTags: ["api"] }),
      makeLearning({ outcome: "failed", durationMs: 30000, domainTags: ["api"] }),
    ];

    const result = preFlightCheck(["api"], 3, learnings);

    // Average of completed only: (60000 + 120000) / 2 = 90000
    expect(result.estimatedDurationMs).toBe(90000);
  });

  it("detects high complexity risk", () => {
    const result = preFlightCheck(["backend"], 10, [makeLearning()]);

    const risk = result.riskFactors.find((r) => r.name === "High complexity");
    expect(risk).toBeDefined();
    expect(risk?.severity).toBe("medium");
    expect(risk?.description).toContain("10");
  });

  it("does not flag complexity for low AC count", () => {
    const result = preFlightCheck(["backend"], 5, [makeLearning()]);

    expect(result.riskFactors.find((r) => r.name === "High complexity")).toBeUndefined();
  });

  it("detects recent failures risk", () => {
    const learnings = [
      makeLearning({ outcome: "failed", domainTags: ["db"] }),
      makeLearning({ outcome: "failed", domainTags: ["db"] }),
      makeLearning({ outcome: "failed", domainTags: ["db"] }),
      makeLearning({ outcome: "completed", domainTags: ["db"] }),
    ];

    const result = preFlightCheck(["db"], 3, learnings);

    // 3/4 = 75% failure rate > 40%
    const risk = result.riskFactors.find((r) => r.name === "Recent failures");
    expect(risk).toBeDefined();
    expect(risk?.severity).toBe("high");
  });

  it("detects low sample risk", () => {
    const learnings = [makeLearning({ domainTags: ["niche"] })];
    const result = preFlightCheck(["niche"], 3, learnings);

    const risk = result.riskFactors.find((r) => r.name === "Low sample");
    expect(risk).toBeDefined();
    expect(risk?.severity).toBe("low");
  });

  it("advisory warns on high-risk factors", () => {
    const result = preFlightCheck(["unknown"], 3, []);

    expect(result.advisory).toContain("Caution");
  });

  it("advisory says good to go for high success rate", () => {
    const learnings = Array.from({ length: 5 }, () =>
      makeLearning({ outcome: "completed", domainTags: ["safe"] }),
    );
    const result = preFlightCheck(["safe"], 3, learnings);

    expect(result.advisory).toContain("Good to go");
    expect(result.successRate).toBe(1);
  });

  it("matches on overlapping domain tags", () => {
    const learnings = [
      makeLearning({ domainTags: ["backend", "api"] }),
      makeLearning({ domainTags: ["frontend"] }),
    ];

    const result = preFlightCheck(["api"], 3, learnings);

    expect(result.matchingSessionCount).toBe(1);
  });

  it("is advisory only — never returns blocking signal", () => {
    const result = preFlightCheck(["unknown"], 20, []);

    // Even worst case: high risk, no data — still just advisory text
    expect(result.advisory).toBeTruthy();
    expect(result.successRate).toBeGreaterThan(0);
  });
});
