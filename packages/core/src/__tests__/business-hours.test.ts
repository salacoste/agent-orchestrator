/**
 * Business hours tests (Story 43.7).
 */
import { describe, expect, it } from "vitest";
import { isWithinBusinessHours } from "../business-hours.js";

describe("isWithinBusinessHours", () => {
  const config = { start: "09:00", end: "18:00", timezone: "UTC" };

  it("returns true within business hours", () => {
    const noon = new Date("2026-03-23T12:00:00Z");
    expect(isWithinBusinessHours(config, noon)).toBe(true);
  });

  it("returns true at start time", () => {
    const nineAm = new Date("2026-03-23T09:00:00Z");
    expect(isWithinBusinessHours(config, nineAm)).toBe(true);
  });

  it("returns false at end time", () => {
    const sixPm = new Date("2026-03-23T18:00:00Z");
    expect(isWithinBusinessHours(config, sixPm)).toBe(false);
  });

  it("returns false before business hours", () => {
    const early = new Date("2026-03-23T07:30:00Z");
    expect(isWithinBusinessHours(config, early)).toBe(false);
  });

  it("returns false after business hours", () => {
    const late = new Date("2026-03-23T21:00:00Z");
    expect(isWithinBusinessHours(config, late)).toBe(false);
  });

  it("returns true when no config (24/7 mode)", () => {
    const midnight = new Date("2026-03-23T03:00:00Z");
    expect(isWithinBusinessHours(undefined, midnight)).toBe(true);
  });

  it("handles overnight hours (start > end)", () => {
    const overnight = { start: "22:00", end: "06:00", timezone: "UTC" };

    // 23:00 is within overnight hours
    expect(isWithinBusinessHours(overnight, new Date("2026-03-23T23:00:00Z"))).toBe(true);

    // 03:00 is within overnight hours
    expect(isWithinBusinessHours(overnight, new Date("2026-03-23T03:00:00Z"))).toBe(true);

    // 12:00 is outside overnight hours
    expect(isWithinBusinessHours(overnight, new Date("2026-03-23T12:00:00Z"))).toBe(false);
  });

  it("returns true for invalid time format (fail open)", () => {
    const invalid = { start: "invalid", end: "18:00" };
    expect(isWithinBusinessHours(invalid, new Date())).toBe(true);
  });

  it("handles midnight boundary", () => {
    const midnight = new Date("2026-03-23T00:00:00Z");
    expect(isWithinBusinessHours(config, midnight)).toBe(false);
  });
});
