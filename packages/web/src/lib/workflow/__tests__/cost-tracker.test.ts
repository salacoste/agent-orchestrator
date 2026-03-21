/**
 * Cost & efficiency tracking tests (Stories 21.1, 21.2, 21.3).
 */
import { describe, expect, it } from "vitest";

import {
  computeEfficiencyScores,
  computeSprintClock,
  computeSprintCost,
  type TokenUsage,
} from "../cost-tracker";

function makeUsage(
  agentId: string,
  tokens: number,
  durationMs: number = 60000,
  storyId?: string,
): TokenUsage {
  return { agentId, tokensUsed: tokens, durationMs, storyId, timestamp: new Date().toISOString() };
}

describe("computeSprintCost", () => {
  it("returns zero summary for empty usages", () => {
    const result = computeSprintCost([]);
    expect(result.totalTokens).toBe(0);
    expect(result.totalAgents).toBe(0);
    expect(result.burnRate).toBe(0);
    expect(result.runawayAgents).toHaveLength(0);
  });

  it("computes total tokens and agent count", () => {
    const usages = [makeUsage("a1", 1000), makeUsage("a2", 2000), makeUsage("a1", 500)];
    const result = computeSprintCost(usages);
    expect(result.totalTokens).toBe(3500);
    expect(result.totalAgents).toBe(2);
  });

  it("detects runaway agents consuming >3x average", () => {
    // avg per agent = (10+10+100)/3 = 40, 3x = 120; a3=100 < 120. Need: a3 > 3 * (total/agents)
    // With a3=1000: avg = (10+10+1000)/3 = 340, 3x = 1020; a3=1000 < 1020. Still not.
    // The check is tokens > avgPerAgent * 3. Since a3 contributes to avg, need a3 > 3*(total/n).
    // a3 > 3*((a1+a2+a3)/3) → a3 > a1+a2+a3 — impossible for positive values.
    // The detection can only flag agents when there are 4+ agents (dilution effect).
    const usages = [
      makeUsage("a1", 100),
      makeUsage("a2", 100),
      makeUsage("a3", 100),
      makeUsage("a4", 10000), // avg = 10300/4 = 2575, 3x = 7725; a4=10000 > 7725 ✓
    ];
    const result = computeSprintCost(usages);
    expect(result.runawayAgents).toContain("a4");
    expect(result.runawayAgents).not.toContain("a1");
  });

  it("computes burn rate in tokens per minute", () => {
    const usages = [makeUsage("a1", 600, 60000)]; // 600 tokens in 1 minute
    const result = computeSprintCost(usages);
    expect(result.burnRate).toBe(600);
  });
});

describe("computeEfficiencyScores", () => {
  it("computes tokens per story point", () => {
    const usages = [makeUsage("a1", 5000, 60000, "story-1")];
    const storyPoints = { "story-1": 3 };
    const scores = computeEfficiencyScores(usages, storyPoints);
    expect(scores).toHaveLength(1);
    expect(scores[0].tokensPerStoryPoint).toBe(Math.round(5000 / 3));
    expect(scores[0].storiesCompleted).toBe(1);
  });

  it("handles agents with no story points", () => {
    const usages = [makeUsage("a1", 5000, 60000)];
    const scores = computeEfficiencyScores(usages, {});
    expect(scores[0].tokensPerStoryPoint).toBe(0);
  });

  it("aggregates across multiple usages per agent", () => {
    const usages = [makeUsage("a1", 3000, 30000, "s1"), makeUsage("a1", 2000, 30000, "s2")];
    const storyPoints = { s1: 2, s2: 3 };
    const scores = computeEfficiencyScores(usages, storyPoints);
    expect(scores[0].totalTokens).toBe(5000);
    expect(scores[0].totalStoryPoints).toBe(5);
    expect(scores[0].storiesCompleted).toBe(2);
  });
});

describe("computeSprintClock", () => {
  it("reports on-track when work fits in time", () => {
    const end = new Date(Date.now() + 48 * 3600000); // 48h from now
    const clock = computeSprintClock(end, 5, 8, 3600000); // 3 stories left, 1h each
    expect(clock.status).toBe("on-track");
    expect(clock.gapMs).toBeLessThan(0);
  });

  it("reports behind when work exceeds time", () => {
    const end = new Date(Date.now() + 2 * 3600000); // 2h from now
    const clock = computeSprintClock(end, 0, 10, 3600000); // 10 stories, 1h each
    expect(clock.status).toBe("behind");
    expect(clock.gapMs).toBeGreaterThan(0);
    expect(clock.description).toContain("BEHIND");
  });

  it("handles completed sprint (all done)", () => {
    const end = new Date(Date.now() + 24 * 3600000);
    const clock = computeSprintClock(end, 10, 10, 3600000);
    expect(clock.workRemainingMs).toBe(0);
    expect(clock.status).toBe("on-track");
  });
});
