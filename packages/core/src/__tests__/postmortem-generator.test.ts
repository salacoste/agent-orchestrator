/**
 * Post-mortem generator tests (Story 45.3).
 */
import { describe, expect, it } from "vitest";
import { generatePostMortem } from "../postmortem-generator.js";
import type { SessionLearning } from "../types.js";

function makeLearning(overrides: Partial<SessionLearning> = {}): SessionLearning {
  return {
    sessionId: "session-1",
    agentId: "agent-1",
    storyId: "1-1-auth",
    projectId: "test-project",
    outcome: "failed",
    durationMs: 60000,
    retryCount: 0,
    filesModified: ["src/index.ts"],
    testsAdded: 0,
    errorCategories: ["exit_code_1"],
    domainTags: ["backend"],
    completedAt: "2026-03-22T10:00:00Z",
    capturedAt: "2026-03-22T10:00:01Z",
    ...overrides,
  };
}

describe("generatePostMortem", () => {
  it("returns no-failures report for empty input", () => {
    const report = generatePostMortem([]);

    expect(report.hasFailures).toBe(false);
    expect(report.summary.totalFailures).toBe(0);
    expect(report.timeline).toHaveLength(0);
    expect(report.markdown).toContain("No failures to analyze");
  });

  it("returns no-failures report for all-successful sessions", () => {
    const report = generatePostMortem([makeLearning({ outcome: "completed" })]);

    expect(report.hasFailures).toBe(false);
  });

  it("generates report with failure summary", () => {
    const sessions = [
      makeLearning({ outcome: "failed", storyId: "1-1" }),
      makeLearning({ outcome: "blocked", storyId: "1-2" }),
      makeLearning({ outcome: "abandoned", storyId: "1-3" }),
    ];
    const report = generatePostMortem(sessions);

    expect(report.hasFailures).toBe(true);
    expect(report.summary.totalFailures).toBe(1);
    expect(report.summary.totalBlocked).toBe(1);
    expect(report.summary.totalAbandoned).toBe(1);
    expect(report.summary.uniqueStories).toBe(3);
  });

  it("builds chronological timeline", () => {
    const sessions = [
      makeLearning({ completedAt: "2026-03-22T12:00:00Z", storyId: "1-2" }),
      makeLearning({ completedAt: "2026-03-22T10:00:00Z", storyId: "1-1" }),
    ];
    const report = generatePostMortem(sessions);

    expect(report.timeline).toHaveLength(2);
    expect(report.timeline[0].storyId).toBe("1-1"); // Earlier first
    expect(report.timeline[1].storyId).toBe("1-2");
  });

  it("groups error categories with counts", () => {
    const sessions = [
      makeLearning({ errorCategories: ["timeout", "exit_code_1"], storyId: "1-1" }),
      makeLearning({ errorCategories: ["timeout"], storyId: "1-2" }),
      makeLearning({ errorCategories: ["parse_error"], storyId: "1-3" }),
    ];
    const report = generatePostMortem(sessions);

    expect(report.errorBreakdown.length).toBeGreaterThanOrEqual(2);
    const timeout = report.errorBreakdown.find((e) => e.category === "timeout");
    expect(timeout?.count).toBe(2);
    expect(timeout?.affectedStories).toContain("1-1");
    expect(timeout?.affectedStories).toContain("1-2");
  });

  it("sorts error breakdown by count descending", () => {
    const sessions = [
      makeLearning({ errorCategories: ["rare_error"], storyId: "1-1" }),
      makeLearning({ errorCategories: ["common_error"], storyId: "1-2" }),
      makeLearning({ errorCategories: ["common_error"], storyId: "1-3" }),
    ];
    const report = generatePostMortem(sessions);

    expect(report.errorBreakdown[0].category).toBe("common_error");
    expect(report.errorBreakdown[0].count).toBe(2);
  });

  it("collects unique affected files", () => {
    const sessions = [
      makeLearning({ filesModified: ["src/a.ts", "src/b.ts"] }),
      makeLearning({ filesModified: ["src/b.ts", "src/c.ts"] }),
    ];
    const report = generatePostMortem(sessions);

    expect(report.affectedFiles).toHaveLength(3);
    expect(report.affectedFiles).toContain("src/a.ts");
    expect(report.affectedFiles).toContain("src/b.ts");
    expect(report.affectedFiles).toContain("src/c.ts");
  });

  it("generates recommendations from detected patterns", () => {
    // detectPatterns needs 3+ occurrences for a pattern
    const sessions = [
      makeLearning({
        errorCategories: ["timeout"],
        storyId: "1-1",
        completedAt: "2026-03-22T10:00:00Z",
      }),
      makeLearning({
        errorCategories: ["timeout"],
        storyId: "1-2",
        completedAt: "2026-03-22T11:00:00Z",
      }),
      makeLearning({
        errorCategories: ["timeout"],
        storyId: "1-3",
        completedAt: "2026-03-22T12:00:00Z",
      }),
    ];
    const report = generatePostMortem(sessions);

    expect(report.recommendations.length).toBeGreaterThan(0);
  });

  it("generates fallback recommendations when no patterns detected", () => {
    const sessions = [makeLearning({ errorCategories: ["unique_error_1"] })];
    const report = generatePostMortem(sessions);

    // Only 1 failure — below pattern threshold, should get fallback
    expect(report.recommendations.length).toBeGreaterThan(0);
    expect(report.recommendations[0]).toContain("Review error logs");
  });

  it("computes time range from session timestamps", () => {
    const sessions = [
      makeLearning({ completedAt: "2026-03-22T14:00:00Z" }),
      makeLearning({ completedAt: "2026-03-22T09:00:00Z" }),
    ];
    const report = generatePostMortem(sessions);

    expect(report.summary.timeRange?.earliest).toBe("2026-03-22T09:00:00Z");
    expect(report.summary.timeRange?.latest).toBe("2026-03-22T14:00:00Z");
  });

  it("generates valid markdown with all sections", () => {
    const sessions = [
      makeLearning({ errorCategories: ["timeout"], storyId: "1-1", filesModified: ["src/a.ts"] }),
    ];
    const report = generatePostMortem(sessions);

    expect(report.markdown).toContain("# Post-Mortem Report");
    expect(report.markdown).toContain("## Summary");
    expect(report.markdown).toContain("**Failures:** 1");
    expect(report.markdown).toContain("## Timeline");
    expect(report.markdown).toContain("1-1 (failed)");
    expect(report.markdown).toContain("## Error Categories");
    expect(report.markdown).toContain("## Affected Files");
    expect(report.markdown).toContain("`src/a.ts`");
  });

  it("includes generatedAt timestamp", () => {
    const report = generatePostMortem([makeLearning()]);

    expect(report.generatedAt).toBeTruthy();
    expect(new Date(report.generatedAt).getTime()).toBeGreaterThan(0);
  });
});
