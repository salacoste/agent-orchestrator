import { describe, expect, it } from "vitest";

import { calculateStreak, detectFlowState, shouldCelebrate } from "../developer-psychology";

describe("detectFlowState", () => {
  it("returns true for rapid decisions", () => {
    const now = Date.now();
    expect(detectFlowState([now - 30000, now - 20000, now - 10000])).toBe(true);
  });

  it("returns false for slow decisions", () => {
    const now = Date.now();
    expect(detectFlowState([now - 300000, now - 200000, now - 100000])).toBe(false);
  });

  it("returns false for too few decisions", () => {
    expect(detectFlowState([Date.now()])).toBe(false);
  });
});

describe("shouldCelebrate", () => {
  it("celebrates story completion", () => {
    const event = shouldCelebrate({ type: "story.completed", storiesDone: 5, storiesTotal: 10 });
    expect(event?.type).toBe("story-merged");
    expect(event?.message).toContain("5/10");
  });

  it("celebrates sprint completion", () => {
    const event = shouldCelebrate({ type: "sprint.complete" });
    expect(event?.type).toBe("sprint-complete");
  });

  it("returns null for unknown events", () => {
    expect(shouldCelebrate({ type: "unknown" })).toBeNull();
  });
});

describe("calculateStreak", () => {
  it("returns 0 for empty dates", () => {
    expect(calculateStreak([]).currentStreak).toBe(0);
  });

  it("detects milestone at 5 days", () => {
    const today = new Date();
    const dates = Array.from({ length: 5 }, (_, i) => {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      return d.toISOString();
    });
    const info = calculateStreak(dates);
    expect(info.currentStreak).toBe(5);
    expect(info.isMilestone).toBe(true);
    expect(info.milestoneMessage).toBe("5-day streak!");
  });
});
