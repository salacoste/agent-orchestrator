import { describe, expect, it } from "vitest";

import { analyzeFailures, detectCrossSprintPatterns } from "../compound-learning";

describe("detectCrossSprintPatterns", () => {
  it("detects patterns with 3+ occurrences", () => {
    const patterns = detectCrossSprintPatterns(["type-error", "type-error", "type-error", "lint"]);
    expect(patterns).toHaveLength(1);
    expect(patterns[0].frequency).toBe(3);
  });

  it("returns empty for no patterns", () => {
    expect(detectCrossSprintPatterns(["a", "b", "c"])).toHaveLength(0);
  });

  it("sorts by frequency descending", () => {
    const patterns = detectCrossSprintPatterns(["a", "a", "a", "b", "b", "b", "b", "b"]);
    expect(patterns[0].frequency).toBe(5);
  });
});

describe("analyzeFailures", () => {
  it("groups failures by category", () => {
    const result = analyzeFailures([
      { category: "type-error", file: "types.ts" },
      { category: "type-error", file: "config.ts" },
      { category: "lint", file: "index.ts" },
    ]);
    expect(result[0].category).toBe("type-error");
    expect(result[0].count).toBe(2);
    expect(result[0].percentage).toBe(67);
  });

  it("includes guidance", () => {
    const result = analyzeFailures([{ category: "test-failure" }]);
    expect(result[0].guidance).toBeTruthy();
  });
});
