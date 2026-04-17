/**
 * Unit tests for optimization feedback store.
 * Covers recordOptimizationFeedback, getOptimizationFeedback,
 * getDismissalRate, and MAX_FEEDBACK_ENTRIES cap.
 */
import { describe, it, expect, beforeEach } from "vitest";
import {
  recordOptimizationFeedback,
  getOptimizationFeedback,
  getDismissalRate,
  _resetOptimizationFeedback,
} from "../optimization-feedback.js";

beforeEach(() => {
  _resetOptimizationFeedback();
});

describe("optimization-feedback", () => {
  describe("recordOptimizationFeedback", () => {
    it("stores a feedback entry", () => {
      recordOptimizationFeedback({
        suggestionId: "s1",
        category: "agent-rebalancing",
        action: "accepted",
        timestamp: 1000,
      });
      const entries = getOptimizationFeedback();
      expect(entries).toHaveLength(1);
      expect(entries[0].suggestionId).toBe("s1");
      expect(entries[0].action).toBe("accepted");
    });

    it("stores multiple entries in order", () => {
      recordOptimizationFeedback({
        suggestionId: "s1",
        category: "wip-adjustment",
        action: "accepted",
        timestamp: 1000,
      });
      recordOptimizationFeedback({
        suggestionId: "s2",
        category: "capacity-scaling",
        action: "dismissed",
        timestamp: 2000,
      });
      const entries = getOptimizationFeedback();
      expect(entries).toHaveLength(2);
      expect(entries[0].suggestionId).toBe("s1");
      expect(entries[1].suggestionId).toBe("s2");
    });
  });

  describe("getOptimizationFeedback", () => {
    it("returns all entries when no filter", () => {
      recordOptimizationFeedback({
        suggestionId: "s1",
        category: "agent-rebalancing",
        action: "accepted",
        timestamp: 1000,
      });
      recordOptimizationFeedback({
        suggestionId: "s2",
        category: "wip-adjustment",
        action: "dismissed",
        timestamp: 2000,
      });
      expect(getOptimizationFeedback()).toHaveLength(2);
    });

    it("filters by suggestionId", () => {
      recordOptimizationFeedback({
        suggestionId: "s1",
        category: "agent-rebalancing",
        action: "accepted",
        timestamp: 1000,
      });
      recordOptimizationFeedback({
        suggestionId: "s2",
        category: "wip-adjustment",
        action: "dismissed",
        timestamp: 2000,
      });
      const filtered = getOptimizationFeedback("s1");
      expect(filtered).toHaveLength(1);
      expect(filtered[0].suggestionId).toBe("s1");
    });

    it("returns empty for unknown suggestionId", () => {
      recordOptimizationFeedback({
        suggestionId: "s1",
        category: "agent-rebalancing",
        action: "accepted",
        timestamp: 1000,
      });
      expect(getOptimizationFeedback("unknown")).toHaveLength(0);
    });

    it("returns empty for empty store", () => {
      expect(getOptimizationFeedback()).toEqual([]);
    });
  });

  describe("getDismissalRate", () => {
    it("returns 0 for category with no feedback", () => {
      expect(getDismissalRate("agent-rebalancing")).toBe(0);
    });

    it("computes correct dismissal rate", () => {
      recordOptimizationFeedback({
        suggestionId: "s1",
        category: "wip-adjustment",
        action: "accepted",
        timestamp: 1000,
      });
      recordOptimizationFeedback({
        suggestionId: "s2",
        category: "wip-adjustment",
        action: "dismissed",
        timestamp: 2000,
      });
      recordOptimizationFeedback({
        suggestionId: "s3",
        category: "wip-adjustment",
        action: "dismissed",
        timestamp: 3000,
      });
      expect(getDismissalRate("wip-adjustment")).toBeCloseTo(2 / 3);
    });

    it("isolates by category", () => {
      recordOptimizationFeedback({
        suggestionId: "s1",
        category: "agent-rebalancing",
        action: "dismissed",
        timestamp: 1000,
      });
      recordOptimizationFeedback({
        suggestionId: "s2",
        category: "wip-adjustment",
        action: "accepted",
        timestamp: 2000,
      });
      expect(getDismissalRate("agent-rebalancing")).toBe(1);
      expect(getDismissalRate("wip-adjustment")).toBe(0);
    });
  });

  describe("MAX_FEEDBACK_ENTRIES cap", () => {
    it("caps at 1000 entries, removing oldest", () => {
      for (let i = 0; i < 1010; i++) {
        recordOptimizationFeedback({
          suggestionId: `s-${i}`,
          category: "capacity-scaling",
          action: "accepted",
          timestamp: i,
        });
      }
      const entries = getOptimizationFeedback();
      expect(entries).toHaveLength(1000);
      // Oldest 10 entries (0-9) should be removed
      expect(entries[0].suggestionId).toBe("s-10");
      // Newest should be last
      expect(entries[999].suggestionId).toBe("s-1009");
    });
  });

  describe("_resetOptimizationFeedback", () => {
    it("clears all entries", () => {
      recordOptimizationFeedback({
        suggestionId: "s1",
        category: "agent-rebalancing",
        action: "accepted",
        timestamp: 1000,
      });
      _resetOptimizationFeedback();
      expect(getOptimizationFeedback()).toEqual([]);
    });
  });
});
