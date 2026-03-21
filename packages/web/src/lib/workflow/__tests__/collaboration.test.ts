import { beforeEach, describe, expect, it } from "vitest";

import {
  _resetCollaboration,
  claimItem,
  getAllClaims,
  getAllPresence,
  getClaimForItem,
  getDecisionLog,
  getPresenceForPage,
  getRecentDecisions,
  isItemClaimed,
  logDecision,
  removePresence,
  unclaimItem,
  updatePresence,
} from "../collaboration";

beforeEach(() => {
  _resetCollaboration();
});

describe("Team Presence (Story 27.1)", () => {
  it("tracks user presence on a page", () => {
    updatePresence({
      userId: "u1",
      displayName: "R2d2",
      currentPage: "/workflow",
      lastSeenAt: "now",
    });
    expect(getPresenceForPage("/workflow")).toHaveLength(1);
    expect(getPresenceForPage("/fleet")).toHaveLength(0);
  });

  it("returns all presence", () => {
    updatePresence({
      userId: "u1",
      displayName: "R2d2",
      currentPage: "/workflow",
      lastSeenAt: "now",
    });
    updatePresence({ userId: "u2", displayName: "Alex", currentPage: "/fleet", lastSeenAt: "now" });
    expect(getAllPresence()).toHaveLength(2);
  });

  it("removes presence", () => {
    updatePresence({
      userId: "u1",
      displayName: "R2d2",
      currentPage: "/workflow",
      lastSeenAt: "now",
    });
    removePresence("u1");
    expect(getAllPresence()).toHaveLength(0);
  });
});

describe("Review Claim System (Story 27.2)", () => {
  it("claims an item", () => {
    const claim = claimItem("pr-42", "R2d2", "Review PR #42");
    expect(claim.claimedBy).toBe("R2d2");
    expect(isItemClaimed("pr-42")).toBe(true);
  });

  it("gets claim for item", () => {
    claimItem("pr-42", "R2d2", "Review PR #42");
    expect(getClaimForItem("pr-42")?.claimedBy).toBe("R2d2");
    expect(getClaimForItem("pr-99")).toBeNull();
  });

  it("unclaims an item", () => {
    claimItem("pr-42", "R2d2", "Review PR #42");
    unclaimItem("pr-42");
    expect(isItemClaimed("pr-42")).toBe(false);
  });

  it("lists all claims", () => {
    claimItem("pr-42", "R2d2", "Review PR #42");
    claimItem("pr-43", "Alex", "Review PR #43");
    expect(getAllClaims()).toHaveLength(2);
  });
});

describe("Decision Log (Story 27.3)", () => {
  it("logs a decision", () => {
    const d = logDecision({
      who: "R2d2",
      what: "Approved architecture",
      why: "Meets requirements",
    });
    expect(d.id).toContain("decision");
    expect(d.who).toBe("R2d2");
  });

  it("returns full log", () => {
    logDecision({ who: "R2d2", what: "Approved", why: "Good" });
    logDecision({ who: "Alex", what: "Descoped", why: "Scope creep" });
    expect(getDecisionLog()).toHaveLength(2);
  });

  it("returns recent decisions", () => {
    logDecision({ who: "R2d2", what: "D1", why: "R1" });
    logDecision({ who: "R2d2", what: "D2", why: "R2" });
    logDecision({ who: "R2d2", what: "D3", why: "R3" });
    expect(getRecentDecisions(2)).toHaveLength(2);
    expect(getRecentDecisions(2)[0].what).toBe("D2");
  });
});
