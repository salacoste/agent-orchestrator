/**
 * Assignment Scorer Tests (Story 13.1)
 */

import { describe, it, expect, afterEach } from "vitest";
import {
  scoreAffinity,
  registerAssignmentScorer,
  clearAssignmentScorers,
} from "../assignment-scorer.js";
import type { SessionLearning } from "../types.js";

function makeLearning(overrides: Partial<SessionLearning> = {}): SessionLearning {
  return {
    sessionId: "ao-1",
    agentId: "ao-1",
    storyId: "s1",
    projectId: "proj",
    outcome: "completed",
    durationMs: 60000,
    retryCount: 0,
    filesModified: [],
    testsAdded: 0,
    errorCategories: [],
    domainTags: ["backend"],
    completedAt: new Date().toISOString(),
    capturedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe("scoreAffinity", () => {
  afterEach(() => {
    clearAssignmentScorers();
  });

  it("returns 0.5 for agent with no history", () => {
    const result = scoreAffinity("ao-new", ["frontend"], []);
    expect(result.score).toBe(0.5);
    expect(result.agentId).toBe("ao-new");
  });

  it("scores higher for agent with matching domain + high success rate", () => {
    const learnings = [
      makeLearning({ outcome: "completed", domainTags: ["frontend"] }),
      makeLearning({ outcome: "completed", domainTags: ["frontend"] }),
      makeLearning({ outcome: "completed", domainTags: ["frontend"] }),
    ];

    const result = scoreAffinity("ao-frontend", ["frontend"], learnings);
    expect(result.score).toBeGreaterThan(0.7);
    expect(result.successRate).toBe(1.0);
    expect(result.domainMatch).toBe(1.0);
  });

  it("scores lower for agent with failures than perfect agent", () => {
    const failingLearnings = [
      makeLearning({ outcome: "failed" }),
      makeLearning({ outcome: "failed" }),
      makeLearning({ outcome: "completed" }),
    ];
    const perfectLearnings = [
      makeLearning({ outcome: "completed" }),
      makeLearning({ outcome: "completed" }),
      makeLearning({ outcome: "completed" }),
    ];

    const failingScore = scoreAffinity("ao-failing", ["backend"], failingLearnings);
    const perfectScore = scoreAffinity("ao-perfect", ["backend"], perfectLearnings);

    expect(failingScore.successRate).toBeCloseTo(0.333, 2);
    expect(failingScore.score).toBeLessThan(perfectScore.score);
  });

  it("penalizes high retry counts", () => {
    const noRetries = [makeLearning({ retryCount: 0 }), makeLearning({ retryCount: 0 })];
    const highRetries = [makeLearning({ retryCount: 5 }), makeLearning({ retryCount: 5 })];

    const scoreNoRetry = scoreAffinity("ao-1", [], noRetries);
    const scoreHighRetry = scoreAffinity("ao-2", [], highRetries);

    expect(scoreNoRetry.retryPenalty).toBeLessThan(scoreHighRetry.retryPenalty);
  });

  it("uses custom scorer when registered", () => {
    registerAssignmentScorer(() => 0.99);

    const result = scoreAffinity("ao-custom", ["frontend"], [makeLearning()]);
    expect(result.score).toBe(0.99);
  });

  it("resets to default after clearAssignmentScorers", () => {
    registerAssignmentScorer(() => 0.99);
    clearAssignmentScorers();

    const result = scoreAffinity("ao-1", [], []);
    expect(result.score).toBe(0.5); // Default neutral
  });

  it("score is clamped between 0 and 1", () => {
    const learnings = [
      makeLearning({ outcome: "completed", domainTags: ["frontend"] }),
      makeLearning({ outcome: "completed", domainTags: ["frontend"] }),
    ];

    const result = scoreAffinity("ao-1", ["frontend"], learnings);
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(1);
  });
});
