/**
 * Scope creep detector tests (Story 43.6).
 */
import { describe, expect, it } from "vitest";
import { computeHistoricalAverages, checkScopeCreep } from "../scope-creep-detector.js";
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
    filesModified: ["a.ts", "b.ts", "c.ts"],
    testsAdded: 3,
    errorCategories: [],
    domainTags: ["typescript"],
    completedAt: "2026-03-22T00:00:00Z",
    capturedAt: "2026-03-22T00:00:00Z",
    ...overrides,
  };
}

describe("computeHistoricalAverages", () => {
  it("computes averages from completed sessions", () => {
    const learnings = [
      makeLearning({ filesModified: ["a.ts", "b.ts"] }),
      makeLearning({ filesModified: ["c.ts", "d.ts", "e.ts", "f.ts"] }),
    ];

    const avg = computeHistoricalAverages(learnings);

    expect(avg.avgFilesPerStory).toBe(3); // (2+4)/2 = 3.0
    expect(avg.avgTokensPerStory).toBeGreaterThan(0);
    expect(avg.sampleCount).toBe(2);
  });

  it("excludes failed sessions from averages", () => {
    const learnings = [
      makeLearning({ outcome: "completed", filesModified: ["a.ts"] }),
      makeLearning({ outcome: "failed", filesModified: ["a.ts", "b.ts", "c.ts", "d.ts", "e.ts"] }),
    ];

    const avg = computeHistoricalAverages(learnings);

    expect(avg.sampleCount).toBe(1);
    expect(avg.avgFilesPerStory).toBe(1);
  });

  it("returns zeros for empty learning store", () => {
    const avg = computeHistoricalAverages([]);

    expect(avg.avgTokensPerStory).toBe(0);
    expect(avg.avgFilesPerStory).toBe(0);
    expect(avg.sampleCount).toBe(0);
  });
});

describe("checkScopeCreep", () => {
  const averages = { avgTokensPerStory: 50_000, avgFilesPerStory: 5, sampleCount: 10 };

  it("returns empty for usage below threshold", () => {
    const warnings = checkScopeCreep(
      { agentId: "a-1", storyId: "s-1", tokensUsed: 60_000, filesModified: 4 },
      averages,
    );

    expect(warnings).toHaveLength(0);
  });

  it("detects token scope creep at 2x threshold", () => {
    const warnings = checkScopeCreep(
      { agentId: "a-1", storyId: "s-1", tokensUsed: 110_000, filesModified: 3 },
      averages,
    );

    expect(warnings).toHaveLength(1);
    expect(warnings[0].metric).toBe("tokens");
    expect(warnings[0].current).toBe(110_000);
    expect(warnings[0].average).toBe(50_000);
  });

  it("detects file scope creep at 2x threshold", () => {
    const warnings = checkScopeCreep(
      { agentId: "a-1", storyId: "s-1", tokensUsed: 30_000, filesModified: 12 },
      averages,
    );

    expect(warnings).toHaveLength(1);
    expect(warnings[0].metric).toBe("files");
    expect(warnings[0].current).toBe(12);
  });

  it("detects both token and file scope creep", () => {
    const warnings = checkScopeCreep(
      { agentId: "a-1", storyId: "s-1", tokensUsed: 150_000, filesModified: 15 },
      averages,
    );

    expect(warnings).toHaveLength(2);
    expect(warnings.map((w) => w.metric).sort()).toEqual(["files", "tokens"]);
  });

  it("respects custom multiplier", () => {
    // At 3x multiplier, 110K tokens (2.2x) should NOT trigger
    const warnings = checkScopeCreep(
      { agentId: "a-1", storyId: "s-1", tokensUsed: 110_000, filesModified: 3 },
      averages,
      3,
    );

    expect(warnings).toHaveLength(0);

    // But 160K (3.2x) should
    const warnings2 = checkScopeCreep(
      { agentId: "a-1", storyId: "s-1", tokensUsed: 160_000, filesModified: 3 },
      averages,
      3,
    );

    expect(warnings2).toHaveLength(1);
  });

  it("returns empty when no historical data", () => {
    const warnings = checkScopeCreep(
      { agentId: "a-1", storyId: "s-1", tokensUsed: 999_999, filesModified: 100 },
      { avgTokensPerStory: 0, avgFilesPerStory: 0, sampleCount: 0 },
    );

    expect(warnings).toHaveLength(0);
  });

  it("includes suggestion text in warnings", () => {
    const warnings = checkScopeCreep(
      { agentId: "a-1", storyId: "s-1", tokensUsed: 110_000, filesModified: 3 },
      averages,
    );

    expect(warnings[0].suggestion).toContain("exceeds");
    expect(warnings[0].suggestion).toContain("2x");
  });
});
