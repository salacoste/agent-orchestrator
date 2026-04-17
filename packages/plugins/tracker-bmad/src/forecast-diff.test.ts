import { describe, it, expect } from "vitest";
import { computeForecastDiff } from "./forecast-diff.js";

const PREV = { p50: "2026-04-10", p80: "2026-04-15", p95: "2026-04-20" };

describe("computeForecastDiff", () => {
  it("detects a 3-day later shift as significant", () => {
    const current = { p50: "2026-04-13", p80: "2026-04-18", p95: "2026-04-23" };
    const diff = computeForecastDiff(PREV, current);

    expect(diff.p50Shift).toBe(3);
    expect(diff.p80Shift).toBe(3);
    expect(diff.p95Shift).toBe(3);
    expect(diff.significantChange).toBe(true);
    expect(diff.direction).toBe("later");
  });

  it("detects a 1-day shift as not significant", () => {
    const current = { p50: "2026-04-11", p80: "2026-04-16", p95: "2026-04-21" };
    const diff = computeForecastDiff(PREV, current);

    expect(diff.p50Shift).toBe(1);
    expect(diff.significantChange).toBe(false);
    expect(diff.direction).toBe("later");
  });

  it("detects an earlier shift", () => {
    const current = { p50: "2026-04-05", p80: "2026-04-10", p95: "2026-04-15" };
    const diff = computeForecastDiff(PREV, current);

    expect(diff.p50Shift).toBe(-5);
    expect(diff.significantChange).toBe(true);
    expect(diff.direction).toBe("earlier");
  });

  it("handles identical forecasts as unchanged", () => {
    const diff = computeForecastDiff(PREV, PREV);

    expect(diff.p50Shift).toBe(0);
    expect(diff.p80Shift).toBe(0);
    expect(diff.p95Shift).toBe(0);
    expect(diff.significantChange).toBe(false);
    expect(diff.direction).toBe("unchanged");
  });

  it("handles exact threshold boundary — 2 days is not significant (>2 required)", () => {
    const current = { p50: "2026-04-12", p80: "2026-04-17", p95: "2026-04-22" };
    const diff = computeForecastDiff(PREV, current);

    expect(diff.p50Shift).toBe(2);
    expect(diff.significantChange).toBe(false); // strictly >2, so 2 is not significant
    expect(diff.direction).toBe("later");
  });
});
