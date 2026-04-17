/**
 * Forecast diff — compares two Monte Carlo forecast results to detect
 * significant prediction changes. Used for automatic forecast update notifications.
 */

const MS_PER_DAY = 24 * 60 * 60 * 1000;

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface ForecastDiff {
  /** Day shift for P50 (positive = later, negative = earlier) */
  p50Shift: number;
  /** Day shift for P80 */
  p80Shift: number;
  /** Day shift for P95 */
  p95Shift: number;
  /** Whether the P50 shift exceeds the significance threshold (>2 days) */
  significantChange: boolean;
  /** Direction of the P50 shift */
  direction: "later" | "earlier" | "unchanged";
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function daysBetween(dateStrA: string, dateStrB: string): number {
  const a = new Date(dateStrA);
  const b = new Date(dateStrB);
  return Math.round((b.getTime() - a.getTime()) / MS_PER_DAY);
}

// ---------------------------------------------------------------------------
// Public export
// ---------------------------------------------------------------------------

/**
 * Compute the diff between two Monte Carlo forecast results.
 * Returns the day shift for each percentile and whether the change is significant.
 * significantChange is true when Math.abs(p50Shift) > 2 (strictly greater than).
 */
export function computeForecastDiff(
  previous: { p50: string; p80: string; p95: string },
  current: { p50: string; p80: string; p95: string },
): ForecastDiff {
  const p50Shift = daysBetween(previous.p50, current.p50);
  const p80Shift = daysBetween(previous.p80, current.p80);
  const p95Shift = daysBetween(previous.p95, current.p95);

  const significantChange = Math.abs(p50Shift) > 2;
  const direction: ForecastDiff["direction"] =
    p50Shift > 0 ? "later" : p50Shift < 0 ? "earlier" : "unchanged";

  return { p50Shift, p80Shift, p95Shift, significantChange, direction };
}
