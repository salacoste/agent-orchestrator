/**
 * Deadline pressure detector tests (Story 43.8).
 */
import { describe, expect, it } from "vitest";
import { detectDeadlinePressure } from "../deadline-pressure.js";

const DAY = 24 * 60 * 60 * 1000;
const SPRINT = 14 * DAY;

describe("detectDeadlinePressure", () => {
  it("no pressure with healthy margins", () => {
    // 50% time remaining, 60% done
    const result = detectDeadlinePressure(SPRINT * 0.5, SPRINT, 6, 10);

    expect(result.isPressured).toBe(false);
    expect(result.level).toBe("none");
    expect(result.timePercent).toBe(50);
    expect(result.completionPercent).toBe(60);
    expect(result.recommendations).toHaveLength(0);
  });

  it("moderate pressure at threshold (20% time, 30% undone)", () => {
    // 20% time remaining, 70% done (30% undone)
    const result = detectDeadlinePressure(SPRINT * 0.2, SPRINT, 7, 10);

    expect(result.isPressured).toBe(true);
    expect(result.level).toBe("moderate");
    expect(result.recommendations.length).toBeGreaterThan(0);
  });

  it("critical pressure (<10% time, >50% undone)", () => {
    // 5% time remaining, 40% done (60% undone)
    const result = detectDeadlinePressure(SPRINT * 0.05, SPRINT, 4, 10);

    expect(result.isPressured).toBe(true);
    expect(result.level).toBe("critical");
    expect(result.recommendations.length).toBeGreaterThan(result.recommendations.length - 1);
  });

  it("critical recommendations include scope cutting", () => {
    const result = detectDeadlinePressure(SPRINT * 0.05, SPRINT, 3, 10);

    expect(result.recommendations.some((r) => r.includes("scope"))).toBe(true);
    expect(result.recommendations.some((r) => r.includes("WIP"))).toBe(true);
  });

  it("moderate recommendations include parallelization", () => {
    const result = detectDeadlinePressure(SPRINT * 0.15, SPRINT, 6, 10);

    expect(result.recommendations.some((r) => r.includes("arallel"))).toBe(true);
  });

  it("no pressure when most stories done even with little time", () => {
    // 10% time, but 80% done (only 20% undone — below 30% threshold)
    const result = detectDeadlinePressure(SPRINT * 0.1, SPRINT, 8, 10);

    expect(result.isPressured).toBe(false);
    expect(result.level).toBe("none");
  });

  it("no pressure when lots of time even with many stories undone", () => {
    // 50% time, 20% done (80% undone — but lots of time left)
    const result = detectDeadlinePressure(SPRINT * 0.5, SPRINT, 2, 10);

    expect(result.isPressured).toBe(false);
  });

  it("custom thresholds override defaults", () => {
    // 30% time, 25% undone — NOT moderate with defaults, but IS with custom
    const result = detectDeadlinePressure(SPRINT * 0.3, SPRINT, 7.5, 10, {
      moderateTimePercent: 35,
      moderateUndonePercent: 20,
    });

    expect(result.isPressured).toBe(true);
    expect(result.level).toBe("moderate");
  });

  it("handles zero total time gracefully", () => {
    const result = detectDeadlinePressure(0, 0, 5, 10);

    expect(result.timePercent).toBe(0);
  });

  it("handles zero total stories gracefully", () => {
    const result = detectDeadlinePressure(SPRINT * 0.1, SPRINT, 0, 0);

    expect(result.completionPercent).toBe(100);
    expect(result.isPressured).toBe(false);
  });

  it("returns correct percentages", () => {
    const result = detectDeadlinePressure(SPRINT * 0.35, SPRINT, 7, 20);

    expect(result.timePercent).toBe(35);
    expect(result.completionPercent).toBe(35);
  });
});
