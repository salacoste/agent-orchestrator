/**
 * Recommendation feedback tracking tests (Story 18.5).
 */
import { beforeEach, describe, expect, it } from "vitest";

import {
  _resetFeedback,
  getFeedbackHistory,
  isOverDismissed,
  recordFeedback,
} from "../recommendation-feedback";

beforeEach(() => {
  _resetFeedback();
});

describe("recordFeedback", () => {
  it("records an accepted feedback entry", () => {
    recordFeedback({
      phase: "planning",
      tier: 1,
      action: "accepted",
      timestamp: "2026-03-21T00:00:00Z",
    });

    const history = getFeedbackHistory();
    expect(history).toHaveLength(1);
    expect(history[0].action).toBe("accepted");
    expect(history[0].phase).toBe("planning");
  });

  it("records a dismissed feedback entry", () => {
    recordFeedback({
      phase: "solutioning",
      tier: 2,
      action: "dismissed",
      timestamp: "2026-03-21T00:00:00Z",
    });

    expect(getFeedbackHistory()).toHaveLength(1);
    expect(getFeedbackHistory()[0].action).toBe("dismissed");
  });

  it("accumulates multiple entries", () => {
    recordFeedback({ phase: "planning", tier: 1, action: "accepted", timestamp: "t1" });
    recordFeedback({ phase: "planning", tier: 1, action: "dismissed", timestamp: "t2" });
    recordFeedback({ phase: "solutioning", tier: 2, action: "accepted", timestamp: "t3" });

    expect(getFeedbackHistory()).toHaveLength(3);
  });
});

describe("isOverDismissed", () => {
  it("returns false with fewer than 3 entries", () => {
    recordFeedback({ phase: "planning", tier: 1, action: "dismissed", timestamp: "t1" });
    recordFeedback({ phase: "planning", tier: 1, action: "dismissed", timestamp: "t2" });

    expect(isOverDismissed("planning")).toBe(false);
  });

  it("returns true when last 3 entries for a phase are all dismissed", () => {
    recordFeedback({ phase: "planning", tier: 1, action: "dismissed", timestamp: "t1" });
    recordFeedback({ phase: "planning", tier: 1, action: "dismissed", timestamp: "t2" });
    recordFeedback({ phase: "planning", tier: 1, action: "dismissed", timestamp: "t3" });

    expect(isOverDismissed("planning")).toBe(true);
  });

  it("returns false when last 3 include an accept", () => {
    recordFeedback({ phase: "planning", tier: 1, action: "dismissed", timestamp: "t1" });
    recordFeedback({ phase: "planning", tier: 1, action: "accepted", timestamp: "t2" });
    recordFeedback({ phase: "planning", tier: 1, action: "dismissed", timestamp: "t3" });

    expect(isOverDismissed("planning")).toBe(false);
  });

  it("only considers entries for the specified phase", () => {
    recordFeedback({ phase: "planning", tier: 1, action: "dismissed", timestamp: "t1" });
    recordFeedback({ phase: "solutioning", tier: 2, action: "dismissed", timestamp: "t2" });
    recordFeedback({ phase: "planning", tier: 1, action: "dismissed", timestamp: "t3" });
    recordFeedback({ phase: "planning", tier: 1, action: "dismissed", timestamp: "t4" });

    expect(isOverDismissed("planning")).toBe(true);
    expect(isOverDismissed("solutioning")).toBe(false);
  });

  it("returns false for unknown phase", () => {
    expect(isOverDismissed("nonexistent")).toBe(false);
  });
});

describe("_resetFeedback", () => {
  it("clears all history", () => {
    recordFeedback({ phase: "planning", tier: 1, action: "accepted", timestamp: "t1" });
    expect(getFeedbackHistory()).toHaveLength(1);

    _resetFeedback();
    expect(getFeedbackHistory()).toHaveLength(0);
  });
});
