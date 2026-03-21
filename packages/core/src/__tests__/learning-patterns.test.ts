/**
 * Learning Patterns Tests (Story 12.2)
 */

import { describe, it, expect } from "vitest";
import { detectPatterns } from "../learning-patterns.js";
import type { SessionLearning } from "../types.js";

function makeLearning(overrides: Partial<SessionLearning> = {}): SessionLearning {
  return {
    sessionId: "ao-1",
    agentId: "ao-1",
    storyId: "1-1-test",
    projectId: "proj",
    outcome: "failed",
    durationMs: 60000,
    retryCount: 0,
    filesModified: [],
    testsAdded: 0,
    errorCategories: ["ECONNREFUSED"],
    domainTags: ["backend"],
    completedAt: new Date().toISOString(),
    capturedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe("detectPatterns", () => {
  it("detects pattern with 3+ same error category", () => {
    const learnings = [
      makeLearning({ storyId: "s1", errorCategories: ["timeout"] }),
      makeLearning({ storyId: "s2", errorCategories: ["timeout"] }),
      makeLearning({ storyId: "s3", errorCategories: ["timeout"] }),
    ];

    const patterns = detectPatterns(learnings);

    expect(patterns).toHaveLength(1);
    expect(patterns[0].category).toBe("timeout");
    expect(patterns[0].occurrenceCount).toBe(3);
    expect(patterns[0].affectedStories).toContain("s1");
    expect(patterns[0].affectedStories).toContain("s3");
    expect(patterns[0].suggestedAction).toContain("network");
  });

  it("ignores categories with fewer than 3 occurrences", () => {
    const learnings = [
      makeLearning({ errorCategories: ["rare_error"] }),
      makeLearning({ errorCategories: ["rare_error"] }),
    ];

    const patterns = detectPatterns(learnings);
    expect(patterns).toEqual([]);
  });

  it("sorts by count descending", () => {
    const learnings = [
      ...Array.from({ length: 3 }, () => makeLearning({ errorCategories: ["minor"] })),
      ...Array.from({ length: 5 }, () => makeLearning({ errorCategories: ["major"] })),
      ...Array.from({ length: 4 }, () => makeLearning({ errorCategories: ["medium"] })),
    ];

    const patterns = detectPatterns(learnings);

    expect(patterns).toHaveLength(3);
    expect(patterns[0].category).toBe("major");
    expect(patterns[0].occurrenceCount).toBe(5);
    expect(patterns[1].category).toBe("medium");
    expect(patterns[1].occurrenceCount).toBe(4);
    expect(patterns[2].category).toBe("minor");
    expect(patterns[2].occurrenceCount).toBe(3);
  });

  it("returns empty for no failures", () => {
    const learnings = [makeLearning({ outcome: "completed", errorCategories: ["none"] })];
    expect(detectPatterns(learnings)).toEqual([]);
  });

  it("returns empty for empty input", () => {
    expect(detectPatterns([])).toEqual([]);
  });

  it("deduplicates affected stories", () => {
    const learnings = [
      makeLearning({ storyId: "s1", errorCategories: ["err"] }),
      makeLearning({ storyId: "s1", errorCategories: ["err"] }),
      makeLearning({ storyId: "s1", errorCategories: ["err"] }),
    ];

    const patterns = detectPatterns(learnings);
    expect(patterns[0].affectedStories).toHaveLength(1);
    expect(patterns[0].affectedStories[0]).toBe("s1");
  });

  it("tracks lastOccurrence as newest capturedAt", () => {
    const learnings = [
      makeLearning({ errorCategories: ["err"], capturedAt: "2026-03-15T10:00:00Z" }),
      makeLearning({ errorCategories: ["err"], capturedAt: "2026-03-18T10:00:00Z" }),
      makeLearning({ errorCategories: ["err"], capturedAt: "2026-03-16T10:00:00Z" }),
    ];

    const patterns = detectPatterns(learnings);
    expect(patterns[0].lastOccurrence).toBe("2026-03-18T10:00:00Z");
  });
});
