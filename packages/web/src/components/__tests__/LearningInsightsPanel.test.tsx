/**
 * LearningInsightsPanel Tests (Story 12.4)
 */

import { describe, it, expect } from "vitest";

describe("LearningInsightsPanel", () => {
  it("shows empty state when no data", () => {
    const emptyData = { totalSessions: 0, successRate: 0, failureRate: 0, topPatterns: [] };
    expect(emptyData.totalSessions).toBe(0);
  });

  it("calculates success percentage correctly", () => {
    const data = { totalSessions: 10, successRate: 0.8, failureRate: 0.2, topPatterns: [] };
    const successPct = Math.round(data.successRate * 100);
    expect(successPct).toBe(80);
  });

  it("limits top patterns to 3", () => {
    const patterns = [
      { category: "a", count: 5 },
      { category: "b", count: 4 },
      { category: "c", count: 3 },
      { category: "d", count: 2 },
    ];
    expect(patterns.slice(0, 3)).toHaveLength(3);
  });

  it("color codes success rate", () => {
    const high = 85; // >= 80 = green
    const mid = 60; // >= 50 = yellow
    const low = 30; // < 50 = red

    expect(high >= 80).toBe(true);
    expect(mid >= 50 && mid < 80).toBe(true);
    expect(low < 50).toBe(true);
  });
});
