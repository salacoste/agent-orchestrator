/**
 * Conflict wizard tests (Story 47.4).
 */
import { describe, expect, it } from "vitest";
import { analyzeConflict, suggestMerge, getResolutionOptions } from "../conflict-wizard.js";

describe("analyzeConflict", () => {
  it("detects no conflict when versions are identical", () => {
    const result = analyzeConflict("line1\nline2", "line1\nline2", "line1\nline2");

    expect(result.hasConflict).toBe(false);
    expect(result.linesChangedA).toBe(0);
    expect(result.linesChangedB).toBe(0);
    expect(result.summary).toContain("identical");
  });

  it("detects non-overlapping changes", () => {
    const base = "line1\nline2\nline3";
    const a = "CHANGED\nline2\nline3";
    const b = "line1\nline2\nMODIFIED";

    const result = analyzeConflict(base, a, b);

    expect(result.hasConflict).toBe(false);
    expect(result.overlapping).toBe(false);
    expect(result.linesChangedA).toBe(1);
    expect(result.linesChangedB).toBe(1);
    expect(result.summary).toContain("different regions");
  });

  it("detects overlapping conflict", () => {
    const base = "line1\nline2\nline3";
    const a = "line1\nCHANGED_A\nline3";
    const b = "line1\nCHANGED_B\nline3";

    const result = analyzeConflict(base, a, b);

    expect(result.hasConflict).toBe(true);
    expect(result.overlapping).toBe(true);
    expect(result.summary).toContain("Conflict detected");
  });

  it("handles different line counts", () => {
    const base = "a\nb";
    const a = "a\nb\nc\nd"; // Added lines
    const b = "a"; // Removed line

    const result = analyzeConflict(base, a, b);

    expect(result.baseLines).toBe(2);
    expect(result.linesChangedA).toBeGreaterThan(0);
    expect(result.linesChangedB).toBeGreaterThan(0);
  });

  it("handles empty strings", () => {
    const result = analyzeConflict("", "", "");
    expect(result.hasConflict).toBe(false);
    expect(result.linesChangedA).toBe(0);
  });

  it("counts multiple changed lines", () => {
    const base = "a\nb\nc\nd\ne";
    const a = "X\nY\nc\nd\ne";
    const b = "a\nb\nc\nZ\nW";

    const result = analyzeConflict(base, a, b);

    expect(result.linesChangedA).toBe(2);
    expect(result.linesChangedB).toBe(2);
    expect(result.hasConflict).toBe(false); // No overlap
  });
});

describe("suggestMerge", () => {
  const analysis = {
    hasConflict: true,
    baseLines: 10,
    linesChangedA: 3,
    linesChangedB: 2,
    overlapping: true,
    summary: "Conflict",
  };

  it("returns null without API key", () => {
    expect(suggestMerge(analysis)).toBeNull();
    expect(suggestMerge(analysis, undefined)).toBeNull();
    expect(suggestMerge(analysis, "")).toBeNull();
  });

  it("returns stub suggestion with API key", () => {
    const result = suggestMerge(analysis, "sk-test-key");

    expect(result).not.toBeNull();
    expect(result?.confidence).toBe(0);
    expect(result?.explanation).toContain("future");
  });
});

describe("getResolutionOptions", () => {
  it("includes accept-ai when suggestion available and conflict exists", () => {
    const analysis = {
      hasConflict: true,
      baseLines: 5,
      linesChangedA: 1,
      linesChangedB: 1,
      overlapping: true,
      summary: "",
    };
    const options = getResolutionOptions(analysis, true);

    expect(options[0]).toBe("accept-ai");
    expect(options).toContain("choose-a");
    expect(options).toContain("choose-b");
    expect(options).toContain("custom");
  });

  it("excludes accept-ai when no suggestion", () => {
    const analysis = {
      hasConflict: true,
      baseLines: 5,
      linesChangedA: 1,
      linesChangedB: 1,
      overlapping: true,
      summary: "",
    };
    const options = getResolutionOptions(analysis, false);

    expect(options).not.toContain("accept-ai");
  });

  it("excludes accept-ai when no conflict", () => {
    const analysis = {
      hasConflict: false,
      baseLines: 5,
      linesChangedA: 1,
      linesChangedB: 0,
      overlapping: false,
      summary: "",
    };
    const options = getResolutionOptions(analysis, true);

    expect(options).not.toContain("accept-ai");
  });

  it("always includes choose-a, choose-b, custom", () => {
    const analysis = {
      hasConflict: false,
      baseLines: 0,
      linesChangedA: 0,
      linesChangedB: 0,
      overlapping: false,
      summary: "",
    };
    const options = getResolutionOptions(analysis, false);

    expect(options).toEqual(["choose-a", "choose-b", "custom"]);
  });
});
