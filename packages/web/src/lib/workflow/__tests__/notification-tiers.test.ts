import { describe, expect, it } from "vitest";

import { classifyNotificationTier, getTierStyle } from "../notification-tiers";

describe("classifyNotificationTier", () => {
  it("classifies agent.blocked as tier 1", () => {
    expect(classifyNotificationTier("agent.blocked")).toBe(1);
  });

  it("classifies conflict.detected as tier 1", () => {
    expect(classifyNotificationTier("conflict.detected")).toBe(1);
  });

  it("classifies pr.ready as tier 2", () => {
    expect(classifyNotificationTier("pr.ready")).toBe(2);
  });

  it("classifies story.completed as tier 3", () => {
    expect(classifyNotificationTier("story.completed")).toBe(3);
  });

  it("defaults unknown events to tier 3", () => {
    expect(classifyNotificationTier("unknown.event")).toBe(3);
  });

  it("classifies risk.score.critical as tier 1", () => {
    expect(classifyNotificationTier("risk.score.critical")).toBe(1);
  });

  it("classifies risk.emerging-detected as tier 2", () => {
    expect(classifyNotificationTier("risk.emerging-detected")).toBe(2);
  });

  it("classifies risk.score.warning as tier 2", () => {
    expect(classifyNotificationTier("risk.score.warning")).toBe(2);
  });

  // Utilization event tier tests (Story 56.6 Task 9)
  it("classifies utilization.over as tier 1", () => {
    expect(classifyNotificationTier("utilization.over")).toBe(1);
  });

  it("classifies utilization.over-capacity as tier 1 (matches utilization.over pattern)", () => {
    expect(classifyNotificationTier("utilization.over-capacity")).toBe(1);
  });

  it("classifies utilization.under as tier 2", () => {
    expect(classifyNotificationTier("utilization.under")).toBe(2);
  });

  it("classifies utilization.trend.declining as tier 2", () => {
    expect(classifyNotificationTier("utilization.trend.declining")).toBe(2);
  });

  it("classifies utilization.snapshot as tier 3", () => {
    expect(classifyNotificationTier("utilization.snapshot")).toBe(3);
  });

  // Optimization event tier tests (Story 56.7)
  it("classifies optimization.critical as tier 1", () => {
    expect(classifyNotificationTier("optimization.critical")).toBe(1);
  });

  it("classifies optimization.available as tier 2", () => {
    expect(classifyNotificationTier("optimization.available")).toBe(2);
  });

  // Optimization scenario event tier test (Story 56.8)
  it("classifies optimization.scenario as tier 2", () => {
    expect(classifyNotificationTier("optimization.scenario")).toBe(2);
  });

  // Optimization underutilized event tier test (Story 56.9)
  it("classifies optimization.underutilized as tier 2", () => {
    expect(classifyNotificationTier("optimization.underutilized")).toBe(2);
  });
});

describe("getTierStyle", () => {
  it("tier 1 is red alert", () => {
    const style = getTierStyle(1);
    expect(style.color).toBe("red");
    expect(style.display).toBe("alert");
  });

  it("tier 2 is amber badge", () => {
    const style = getTierStyle(2);
    expect(style.color).toBe("amber");
    expect(style.display).toBe("badge");
  });

  it("tier 3 is green toast", () => {
    const style = getTierStyle(3);
    expect(style.color).toBe("green");
    expect(style.display).toBe("toast");
  });
});
