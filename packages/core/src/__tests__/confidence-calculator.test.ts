/**
 * Confidence calculator tests (Story 45.6).
 */
import { describe, expect, it } from "vitest";
import {
  calculateConfidence,
  computeConfidenceScore,
  scoreToLevel,
  type ConfidenceInput,
} from "../confidence-calculator.js";

function makeInput(overrides: Partial<ConfidenceInput> = {}): ConfidenceInput {
  return {
    retryCount: 0,
    errorCategories: [],
    filesModified: ["src/index.ts"],
    ...overrides,
  };
}

describe("computeConfidenceScore", () => {
  it("returns 100 for clean session", () => {
    const { score } = computeConfidenceScore(makeInput());
    expect(score).toBe(100);
  });

  it("penalizes retries at 20 per retry", () => {
    const { score, reasons } = computeConfidenceScore(makeInput({ retryCount: 2 }));
    expect(score).toBe(60); // 100 - 2×20
    expect(reasons[0]).toContain("2 retries");
  });

  it("penalizes error categories at 15 each", () => {
    const { score } = computeConfidenceScore(
      makeInput({ errorCategories: ["timeout", "exit_code_1"] }),
    );
    expect(score).toBe(70); // 100 - 2×15
  });

  it("penalizes high file count", () => {
    const files = Array.from({ length: 12 }, (_, i) => `src/file-${i}.ts`);
    const { score, reasons } = computeConfidenceScore(makeInput({ filesModified: files }));
    expect(score).toBe(95); // 100 - 5
    expect(reasons.some((r) => r.includes("12 files"))).toBe(true);
  });

  it("does not penalize for 10 or fewer files", () => {
    const files = Array.from({ length: 10 }, (_, i) => `src/file-${i}.ts`);
    const { score } = computeConfidenceScore(makeInput({ filesModified: files }));
    expect(score).toBe(100);
  });

  it("clamps score to 0 minimum", () => {
    const { score } = computeConfidenceScore(makeInput({ retryCount: 10 }));
    expect(score).toBe(0); // 100 - 10×20 = -100, clamped to 0
  });

  it("combines all penalties", () => {
    const files = Array.from({ length: 15 }, (_, i) => `src/${i}.ts`);
    const { score } = computeConfidenceScore(
      makeInput({ retryCount: 1, errorCategories: ["timeout"], filesModified: files }),
    );
    // 100 - 20 - 15 - 5 = 60
    expect(score).toBe(60);
  });

  it("reports no-issue reason for clean session", () => {
    const { reasons } = computeConfidenceScore(makeInput());
    expect(reasons[0]).toContain("No retries or errors");
  });
});

describe("scoreToLevel", () => {
  it("returns high for score >= 70", () => {
    expect(scoreToLevel(100)).toBe("high");
    expect(scoreToLevel(70)).toBe("high");
  });

  it("returns medium for score 40-69", () => {
    expect(scoreToLevel(69)).toBe("medium");
    expect(scoreToLevel(40)).toBe("medium");
  });

  it("returns low for score < 40", () => {
    expect(scoreToLevel(39)).toBe("low");
    expect(scoreToLevel(0)).toBe("low");
  });
});

describe("calculateConfidence", () => {
  it("returns empty for no files", () => {
    expect(calculateConfidence(makeInput({ filesModified: [] }))).toEqual([]);
  });

  it("returns high confidence for clean session", () => {
    const result = calculateConfidence(makeInput({ filesModified: ["a.ts", "b.ts"] }));

    expect(result).toHaveLength(2);
    expect(result[0].confidence).toBe("high");
    expect(result[0].score).toBe(100);
  });

  it("returns medium confidence for moderate issues", () => {
    const result = calculateConfidence(
      makeInput({ retryCount: 1, errorCategories: ["timeout"], filesModified: ["a.ts"] }),
    );

    // 100 - 20 - 15 = 65 → medium
    expect(result[0].confidence).toBe("medium");
    expect(result[0].score).toBe(65);
  });

  it("returns low confidence for many retries", () => {
    const result = calculateConfidence(makeInput({ retryCount: 3, filesModified: ["a.ts"] }));

    // 100 - 60 = 40 → medium (boundary)
    expect(result[0].confidence).toBe("medium");

    // 4 retries → 100 - 80 = 20 → low
    const result2 = calculateConfidence(makeInput({ retryCount: 4, filesModified: ["a.ts"] }));
    expect(result2[0].confidence).toBe("low");
  });

  it("sorts files alphabetically", () => {
    const result = calculateConfidence(makeInput({ filesModified: ["z.ts", "a.ts", "m.ts"] }));

    expect(result.map((r) => r.file)).toEqual(["a.ts", "m.ts", "z.ts"]);
  });

  it("all files share same confidence score", () => {
    const result = calculateConfidence(
      makeInput({ retryCount: 1, filesModified: ["a.ts", "b.ts", "c.ts"] }),
    );

    const scores = new Set(result.map((r) => r.score));
    expect(scores.size).toBe(1); // All same score
  });

  it("includes reasons in each file result", () => {
    const result = calculateConfidence(makeInput({ retryCount: 2, filesModified: ["a.ts"] }));

    expect(result[0].reasons.length).toBeGreaterThan(0);
    expect(result[0].reasons[0]).toContain("retries");
  });
});
