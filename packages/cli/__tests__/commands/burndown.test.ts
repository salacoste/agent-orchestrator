/**
 * Burndown Command & Chart Renderer Tests
 */

import { describe, it, expect } from "vitest";
import { renderBurndownChart } from "../../src/lib/chart.js";
import type { BurndownResult, BurndownData } from "@composio/ao-core";

function makeResult(overrides: Partial<BurndownResult> = {}): BurndownResult {
  return {
    totalStories: 10,
    completedStories: 4,
    remainingStories: 6,
    completionPercentage: 40,
    sprintStart: "2026-03-15",
    sprintEnd: "2026-03-25",
    dailyData: [
      { date: "2026-03-15", remaining: 10, completed: 0, idealRemaining: 10 },
      { date: "2026-03-16", remaining: 9, completed: 1, idealRemaining: 8 },
      { date: "2026-03-17", remaining: 7, completed: 3, idealRemaining: 6 },
      { date: "2026-03-18", remaining: 6, completed: 4, idealRemaining: 4 },
      { date: "2026-03-19", remaining: 6, completed: 4, idealRemaining: 2 },
    ],
    currentPace: "behind",
    lastUpdated: "2026-03-18T12:00:00Z",
    ...overrides,
  };
}

describe("renderBurndownChart", () => {
  it("renders chart with known data", () => {
    const result = makeResult();
    const lines = renderBurndownChart(result, 80);

    expect(lines.length).toBeGreaterThan(5);
    // Should have legend
    const joined = lines.join("\n");
    expect(joined).toContain("Actual");
    expect(joined).toContain("Ideal");
    expect(joined).toContain("Days");
  });

  it("returns message for empty daily data", () => {
    const result = makeResult({ dailyData: [] });
    const lines = renderBurndownChart(result, 80);

    expect(lines).toHaveLength(1);
    expect(lines[0]).toContain("No burndown data");
  });

  it("returns message for zero stories", () => {
    const result = makeResult({
      totalStories: 0,
      dailyData: [{ date: "2026-03-15", remaining: 0, completed: 0, idealRemaining: 0 }],
    });
    const lines = renderBurndownChart(result, 80);

    expect(lines).toHaveLength(1);
    expect(lines[0]).toContain("No stories");
  });

  it("scales to narrow terminal (60 cols)", () => {
    const result = makeResult();
    const lines = renderBurndownChart(result, 60);

    // Should still render without crashing
    expect(lines.length).toBeGreaterThan(3);
    // Lines should be reasonable length
    for (const line of lines) {
      expect(line.length).toBeLessThanOrEqual(80);
    }
  });

  it("scales to wide terminal (200 cols)", () => {
    const result = makeResult();
    const lines = renderBurndownChart(result, 200);

    expect(lines.length).toBeGreaterThan(3);
  });

  it("handles single day of data", () => {
    const result = makeResult({
      dailyData: [{ date: "2026-03-15", remaining: 10, completed: 0, idealRemaining: 10 }],
    });
    const lines = renderBurndownChart(result, 80);

    expect(lines.length).toBeGreaterThan(3);
  });
});

describe("burndown command registration", () => {
  it("should export registerBurndown function", async () => {
    const { registerBurndown } = await import("../../src/commands/burndown.js");
    expect(typeof registerBurndown).toBe("function");
  });
});

describe("burndown data shape", () => {
  it("BurndownResult has all required fields", () => {
    const result = makeResult();

    expect(result.totalStories).toBe(10);
    expect(result.completedStories).toBe(4);
    expect(result.remainingStories).toBe(6);
    expect(result.completionPercentage).toBe(40);
    expect(result.currentPace).toBe("behind");
    expect(result.dailyData).toHaveLength(5);
    expect(result.sprintStart).toBe("2026-03-15");
    expect(result.sprintEnd).toBe("2026-03-25");
  });

  it("BurndownData has date, remaining, completed, idealRemaining", () => {
    const data: BurndownData = {
      date: "2026-03-15",
      remaining: 10,
      completed: 0,
      idealRemaining: 10,
    };

    expect(data.date).toBeDefined();
    expect(data.remaining).toBeDefined();
    expect(data.completed).toBeDefined();
    expect(data.idealRemaining).toBeDefined();
  });

  it("optional points fields are supported", () => {
    const result = makeResult({
      totalPoints: 50,
      completedPoints: 20,
      remainingPoints: 30,
    });

    expect(result.totalPoints).toBe(50);
    expect(result.completedPoints).toBe(20);
    expect(result.remainingPoints).toBe(30);
  });
});
