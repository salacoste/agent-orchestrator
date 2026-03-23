/**
 * Sprint health score tests (Story 44.4).
 */
import { describe, expect, it } from "vitest";
import { computeSprintHealth, getHealthColor } from "../cost-tracker";

describe("computeSprintHealth", () => {
  it("returns perfect score when all done and no issues", () => {
    const health = computeSprintHealth(10, 10, 0, 0, 0, 0);

    expect(health.score).toBe(100);
    expect(health.color).toBe("green");
    expect(health.components.completion).toBe(1);
    expect(health.components.blockers).toBe(1);
    expect(health.components.failures).toBe(1);
    expect(health.components.cost).toBe(1);
  });

  it("returns low score with many blockers and failures", () => {
    // 20% done, 5 blockers out of 10, 50% failure rate, over budget
    const health = computeSprintHealth(2, 10, 5, 0.5, 200, 100);

    expect(health.score).toBeLessThan(40);
    expect(health.color).toBe("red");
  });

  it("returns amber score for moderate health", () => {
    // 50% done, 1 blocker, 10% failure, on budget
    const health = computeSprintHealth(5, 10, 1, 0.1, 50, 100);

    expect(health.score).toBeGreaterThanOrEqual(40);
    expect(health.score).toBeLessThanOrEqual(70);
    expect(health.color).toBe("amber");
  });

  it("weights completion at 0.4 (highest weight)", () => {
    const lowCompletion = computeSprintHealth(1, 10, 0, 0, 0, 0);
    const highCompletion = computeSprintHealth(9, 10, 0, 0, 0, 0);

    // High completion should score significantly higher
    expect(highCompletion.score - lowCompletion.score).toBeGreaterThan(20);
  });

  it("clamps score to 0-100 range", () => {
    const health = computeSprintHealth(10, 10, 0, 0, 0, 0);
    expect(health.score).toBeLessThanOrEqual(100);
    expect(health.score).toBeGreaterThanOrEqual(0);

    const worst = computeSprintHealth(0, 10, 10, 1, 999, 100);
    expect(worst.score).toBeGreaterThanOrEqual(0);
  });

  it("handles zero total stories gracefully", () => {
    const health = computeSprintHealth(0, 0, 0, 0, 0, 0);
    expect(health.score).toBeGreaterThanOrEqual(0);
  });

  it("returns component breakdown", () => {
    const health = computeSprintHealth(5, 10, 2, 0.3, 80, 100);

    expect(health.components.completion).toBeCloseTo(0.5, 2);
    expect(health.components.blockers).toBeCloseTo(0.8, 2);
    expect(health.components.failures).toBeCloseTo(0.7, 2);
    expect(health.components.cost).toBeCloseTo(0.2, 2);
  });
});

describe("getHealthColor", () => {
  it("returns green for score > 70", () => {
    expect(getHealthColor(71)).toBe("green");
    expect(getHealthColor(100)).toBe("green");
  });

  it("returns amber for score 40-70", () => {
    expect(getHealthColor(40)).toBe("amber");
    expect(getHealthColor(70)).toBe("amber");
    expect(getHealthColor(55)).toBe("amber");
  });

  it("returns red for score < 40", () => {
    expect(getHealthColor(39)).toBe("red");
    expect(getHealthColor(0)).toBe("red");
  });
});
