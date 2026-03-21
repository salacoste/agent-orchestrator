/**
 * FleetMatrix Component Tests
 */

import { describe, it, expect } from "vitest";
import { formatDuration, formatTimeAgo, getStatusInfo } from "../../lib/format";

describe("FleetMatrix helpers", () => {
  describe("formatDuration", () => {
    it("formats minutes only for short durations", () => {
      const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
      expect(formatDuration(fiveMinAgo)).toBe("5m");
    });

    it("formats hours and minutes for longer durations", () => {
      const twoHoursAgo = new Date(Date.now() - 150 * 60 * 1000).toISOString();
      expect(formatDuration(twoHoursAgo)).toBe("2h 30m");
    });

    it("returns 0m for future dates", () => {
      const future = new Date(Date.now() + 60000).toISOString();
      expect(formatDuration(future)).toBe("0m");
    });
  });

  describe("formatTimeAgo", () => {
    it("formats seconds for very recent", () => {
      const tenSecsAgo = new Date(Date.now() - 10_000).toISOString();
      expect(formatTimeAgo(tenSecsAgo)).toMatch(/\d+s ago/);
    });

    it("formats minutes", () => {
      const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
      expect(formatTimeAgo(fiveMinAgo)).toBe("5m ago");
    });

    it("formats hours", () => {
      const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString();
      expect(formatTimeAgo(threeHoursAgo)).toBe("3h ago");
    });

    it("formats days", () => {
      const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
      expect(formatTimeAgo(twoDaysAgo)).toBe("2d ago");
    });
  });

  describe("getStatusInfo", () => {
    it("returns green for active", () => {
      const info = getStatusInfo("active");
      expect(info.emoji).toBe("🟢");
      expect(info.label).toBe("active");
      expect(info.color).toContain("green");
    });

    it("returns yellow for idle", () => {
      const info = getStatusInfo("idle");
      expect(info.emoji).toBe("🟡");
      expect(info.label).toBe("idle");
    });

    it("returns red for blocked", () => {
      const info = getStatusInfo("blocked");
      expect(info.emoji).toBe("🔴");
      expect(info.label).toBe("blocked");
    });

    it("returns gray for exited", () => {
      const info = getStatusInfo("exited");
      expect(info.emoji).toBe("⚫");
      expect(info.label).toBe("exited");
    });

    it("defaults to active for null", () => {
      const info = getStatusInfo(null);
      expect(info.emoji).toBe("🟢");
      expect(info.label).toBe("active");
    });

    it("returns orange for waiting_input", () => {
      const info = getStatusInfo("waiting_input");
      expect(info.emoji).toBe("🟠");
      expect(info.label).toBe("waiting");
    });
  });
});
