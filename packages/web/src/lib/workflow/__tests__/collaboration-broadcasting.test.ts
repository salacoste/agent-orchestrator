/**
 * Collaboration broadcasting tests (Story 39.1).
 *
 * Verifies subscribers receive events when collaboration state changes.
 */
import { describe, expect, it, beforeEach } from "vitest";
import {
  updatePresence,
  removePresence,
  claimItem,
  unclaimItem,
  logDecision,
  subscribeCollaborationChanges,
  _resetCollaboration,
  type CollaborationEvent,
} from "../collaboration";

beforeEach(() => {
  _resetCollaboration();
});

describe("subscribeCollaborationChanges", () => {
  it("subscriber receives presence update events", () => {
    const events: CollaborationEvent[] = [];
    subscribeCollaborationChanges((e) => events.push(e));

    updatePresence({
      userId: "user-1",
      displayName: "Alice",
      currentPage: "/dashboard",
      lastSeenAt: "2026-03-22T00:00:00Z",
    });

    expect(events).toHaveLength(1);
    expect(events[0].type).toBe("presence");
    expect(events[0].action).toBe("update");
    expect(events[0].data).toMatchObject({ userId: "user-1", displayName: "Alice" });
  });

  it("subscriber receives presence remove events", () => {
    // Populate the map first (no subscriber yet, so this notification goes nowhere)
    updatePresence({
      userId: "user-1",
      displayName: "Alice",
      currentPage: "/dashboard",
      lastSeenAt: "2026-03-22T00:00:00Z",
    });

    const events: CollaborationEvent[] = [];
    subscribeCollaborationChanges((e) => events.push(e));

    removePresence("user-1");

    expect(events).toHaveLength(1);
    expect(events[0].type).toBe("presence");
    expect(events[0].action).toBe("remove");
  });

  it("does not emit remove event for unknown user", () => {
    const events: CollaborationEvent[] = [];
    subscribeCollaborationChanges((e) => events.push(e));

    removePresence("nonexistent");

    expect(events).toHaveLength(0);
  });

  it("subscriber receives claim events", () => {
    const events: CollaborationEvent[] = [];
    subscribeCollaborationChanges((e) => events.push(e));

    claimItem("pr-42", "user-1", "Review PR #42");

    expect(events).toHaveLength(1);
    expect(events[0].type).toBe("claim");
    expect(events[0].action).toBe("claim");
    expect(events[0].data).toMatchObject({ itemId: "pr-42", claimedBy: "user-1" });
  });

  it("subscriber receives unclaim events", () => {
    claimItem("pr-42", "user-1", "Review PR #42");

    const events: CollaborationEvent[] = [];
    subscribeCollaborationChanges((e) => events.push(e));

    unclaimItem("pr-42");

    expect(events).toHaveLength(1);
    expect(events[0].type).toBe("claim");
    expect(events[0].action).toBe("unclaim");
  });

  it("does not emit unclaim event for unclaimed item", () => {
    const events: CollaborationEvent[] = [];
    subscribeCollaborationChanges((e) => events.push(e));

    unclaimItem("nonexistent");

    expect(events).toHaveLength(0);
  });

  it("subscriber receives decision events", () => {
    const events: CollaborationEvent[] = [];
    subscribeCollaborationChanges((e) => events.push(e));

    logDecision({ who: "Alice", what: "Use React", why: "Team familiarity" });

    expect(events).toHaveLength(1);
    expect(events[0].type).toBe("decision");
    expect(events[0].action).toBe("log");
    expect(events[0].data).toMatchObject({ who: "Alice", what: "Use React" });
  });

  it("unsubscribe stops notifications", () => {
    const events: CollaborationEvent[] = [];
    const unsub = subscribeCollaborationChanges((e) => events.push(e));

    updatePresence({
      userId: "user-1",
      displayName: "Alice",
      currentPage: "/",
      lastSeenAt: "2026-03-22T00:00:00Z",
    });
    expect(events).toHaveLength(1);

    unsub();

    updatePresence({
      userId: "user-2",
      displayName: "Bob",
      currentPage: "/",
      lastSeenAt: "2026-03-22T00:00:00Z",
    });
    expect(events).toHaveLength(1); // No new event after unsubscribe
  });

  it("multiple subscribers all receive events", () => {
    const events1: CollaborationEvent[] = [];
    const events2: CollaborationEvent[] = [];
    subscribeCollaborationChanges((e) => events1.push(e));
    subscribeCollaborationChanges((e) => events2.push(e));

    logDecision({ who: "Alice", what: "Deploy", why: "Ready" });

    expect(events1).toHaveLength(1);
    expect(events2).toHaveLength(1);
  });

  it("subscriber errors do not affect other subscribers", () => {
    const events: CollaborationEvent[] = [];
    subscribeCollaborationChanges(() => {
      throw new Error("bad subscriber");
    });
    subscribeCollaborationChanges((e) => events.push(e));

    logDecision({ who: "Alice", what: "Deploy", why: "Ready" });

    expect(events).toHaveLength(1); // Second subscriber still receives event
  });

  it("_resetCollaboration clears subscribers", () => {
    const events: CollaborationEvent[] = [];
    subscribeCollaborationChanges((e) => events.push(e));

    _resetCollaboration();

    updatePresence({
      userId: "user-1",
      displayName: "Alice",
      currentPage: "/",
      lastSeenAt: "2026-03-22T00:00:00Z",
    });
    expect(events).toHaveLength(0); // Subscriber was cleared
  });

  it("events include timestamps", () => {
    const events: CollaborationEvent[] = [];
    subscribeCollaborationChanges((e) => events.push(e));

    const before = new Date().toISOString();
    logDecision({ who: "Alice", what: "Deploy", why: "Ready" });
    const after = new Date().toISOString();

    expect(events[0].timestamp).toBeDefined();
    expect(events[0].timestamp >= before).toBe(true);
    expect(events[0].timestamp <= after).toBe(true);
  });
});
