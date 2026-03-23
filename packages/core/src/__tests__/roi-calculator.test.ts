/**
 * ROI calculator tests (Story 45.4).
 */
import { describe, expect, it } from "vitest";
import { calculateROI, DEFAULT_ROI_CONFIG } from "../roi-calculator.js";

describe("calculateROI", () => {
  it("calculates ROI with default rates", () => {
    const roi = calculateROI(10, 500_000);

    expect(roi.storiesCompleted).toBe(10);
    expect(roi.totalTokens).toBe(500_000);
    // 500K × $15/1M = $7.50
    expect(roi.totalCostUsd).toBe(7.5);
    // 10 stories × 4h = 40h
    expect(roi.humanHoursSaved).toBe(40);
    // 40h × $75/h = $3000
    expect(roi.humanCostEquivalent).toBe(3000);
    // $7.50 / 10 stories = $0.75
    expect(roi.costPerStory).toBe(0.75);
    // $3000 / $7.50 = 400x
    expect(roi.efficiencyRatio).toBe(400);
  });

  it("returns empty ROI for zero stories", () => {
    const roi = calculateROI(0, 100_000);

    expect(roi.totalCostUsd).toBe(0);
    expect(roi.humanHoursSaved).toBe(0);
    expect(roi.efficiencyRatio).toBe(0);
    expect(roi.breakdown).toContain("No completed stories");
  });

  it("returns empty ROI for zero tokens", () => {
    const roi = calculateROI(5, 0);

    expect(roi.totalCostUsd).toBe(0);
    expect(roi.efficiencyRatio).toBe(0);
    expect(roi.breakdown).toContain("No completed stories");
  });

  it("uses custom rates when provided", () => {
    const roi = calculateROI(5, 1_000_000, {
      hoursPerStory: 8,
      hourlyRate: 100,
      pricePerMillionTokens: 3,
    });

    // 1M × $3/1M = $3.00
    expect(roi.totalCostUsd).toBe(3);
    // 5 × 8h = 40h
    expect(roi.humanHoursSaved).toBe(40);
    // 40h × $100 = $4000
    expect(roi.humanCostEquivalent).toBe(4000);
    // $3 / 5 = $0.60
    expect(roi.costPerStory).toBe(0.6);
  });

  it("generates transparent breakdown string", () => {
    const roi = calculateROI(12, 300_000);

    expect(roi.breakdown).toContain("12 stories completed");
    expect(roi.breakdown).toContain("300K tokens");
    expect(roi.breakdown).toContain("$15/1M");
    expect(roi.breakdown).toContain("12 stories × 4h × $75/h");
    expect(roi.breakdown).toContain("efficiency");
  });

  it("includes default config values", () => {
    expect(DEFAULT_ROI_CONFIG.hoursPerStory).toBe(4);
    expect(DEFAULT_ROI_CONFIG.hourlyRate).toBe(75);
    expect(DEFAULT_ROI_CONFIG.pricePerMillionTokens).toBe(15);
  });

  it("rounds USD values to 2 decimal places", () => {
    // 333333 × $15/1M = $4.999995 → $5.00
    const roi = calculateROI(1, 333_333);

    expect(roi.totalCostUsd).toBe(5);
    expect(roi.costPerStory).toBe(5);
  });

  it("rounds efficiency ratio to 1 decimal place", () => {
    const roi = calculateROI(1, 1_000_000, { pricePerMillionTokens: 7 });

    // humanCost = 1 × 4 × 75 = 300, agentCost = 7, ratio = 42.857...
    expect(roi.efficiencyRatio).toBe(42.9);
  });

  it("handles partial config override", () => {
    const roi = calculateROI(5, 500_000, { hourlyRate: 150 });

    // Uses custom hourlyRate but default hoursPerStory and pricePerMillionTokens
    expect(roi.humanCostEquivalent).toBe(5 * 4 * 150); // 3000
    expect(roi.totalCostUsd).toBe(7.5); // default token price
  });
});
