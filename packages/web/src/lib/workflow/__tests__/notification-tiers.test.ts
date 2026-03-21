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
