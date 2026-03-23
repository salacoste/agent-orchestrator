/**
 * Time travel state reconstruction tests (Story 45.2).
 */
import { describe, expect, it } from "vitest";
import { reconstructState, type AuditEvent } from "../time-travel";

function evt(
  eventType: string,
  timestamp: string,
  metadata: Record<string, unknown> = {},
): AuditEvent {
  return { eventId: `e-${Date.now()}`, eventType, timestamp, metadata };
}

const EVENTS: AuditEvent[] = [
  evt("story.started", "2026-03-22T09:00:00Z", { storyId: "1-1-auth", agentId: "agent-A" }),
  evt("story.started", "2026-03-22T09:30:00Z", { storyId: "1-2-api", agentId: "agent-B" }),
  evt("story.blocked", "2026-03-22T10:00:00Z", { storyId: "1-1-auth" }),
  evt("story.unblocked", "2026-03-22T11:00:00Z", { storyId: "1-1-auth" }),
  evt("story.completed", "2026-03-22T12:00:00Z", { storyId: "1-1-auth" }),
  evt("story.completed", "2026-03-22T14:00:00Z", { storyId: "1-2-api" }),
];

describe("reconstructState", () => {
  it("reconstructs state at a point in time", () => {
    const state = reconstructState(EVENTS, "2026-03-22T10:30:00Z");

    expect(state.activeStories["1-1-auth"]).toBe("blocked");
    expect(state.activeStories["1-2-api"]).toBe("in-progress");
    expect(state.blockers).toContain("1-1-auth");
    expect(state.activeAgents).toContain("agent-A");
    expect(state.activeAgents).toContain("agent-B");
    expect(state.eventsProcessed).toBe(3);
  });

  it("shows unblocked state after unblock event", () => {
    const state = reconstructState(EVENTS, "2026-03-22T11:30:00Z");

    expect(state.activeStories["1-1-auth"]).toBe("in-progress");
    expect(state.blockers).not.toContain("1-1-auth");
    expect(state.eventsProcessed).toBe(4);
  });

  it("shows completed state at end with no active agents", () => {
    const state = reconstructState(EVENTS, "2026-03-22T15:00:00Z");

    expect(state.activeStories["1-1-auth"]).toBe("done");
    expect(state.activeStories["1-2-api"]).toBe("done");
    expect(state.blockers).toHaveLength(0);
    expect(state.activeAgents).toHaveLength(0); // All stories done → no active agents
    expect(state.eventsProcessed).toBe(6);
  });

  it("returns empty state for timestamp before all events", () => {
    const state = reconstructState(EVENTS, "2026-03-21T00:00:00Z");

    expect(Object.keys(state.activeStories)).toHaveLength(0);
    expect(state.activeAgents).toHaveLength(0);
    expect(state.blockers).toHaveLength(0);
    expect(state.lastEventAt).toBeNull();
    expect(state.eventsProcessed).toBe(0);
  });

  it("handles empty events array", () => {
    const state = reconstructState([], "2026-03-22T12:00:00Z");

    expect(Object.keys(state.activeStories)).toHaveLength(0);
    expect(state.eventsProcessed).toBe(0);
    expect(state.lastEventAt).toBeNull();
  });

  it("processes exactly events at boundary timestamp", () => {
    // Target exactly at story.blocked timestamp
    const state = reconstructState(EVENTS, "2026-03-22T10:00:00Z");

    expect(state.activeStories["1-1-auth"]).toBe("blocked");
    expect(state.eventsProcessed).toBe(3);
  });

  it("tracks agent IDs from story.assigned events", () => {
    const events = [
      evt("story.assigned", "2026-03-22T09:00:00Z", { storyId: "2-1", agentId: "agent-C" }),
    ];
    const state = reconstructState(events, "2026-03-22T10:00:00Z");

    expect(state.activeAgents).toContain("agent-C");
  });

  it("tracks agent IDs from agent.resumed events", () => {
    const events = [
      evt("agent.resumed", "2026-03-22T09:00:00Z", { storyId: "2-1", agentId: "agent-D" }),
    ];
    const state = reconstructState(events, "2026-03-22T10:00:00Z");

    expect(state.activeAgents).toContain("agent-D");
  });

  it("removes blocker on story.completed", () => {
    const events = [
      evt("story.started", "2026-03-22T09:00:00Z", { storyId: "3-1" }),
      evt("story.blocked", "2026-03-22T10:00:00Z", { storyId: "3-1" }),
      evt("story.completed", "2026-03-22T11:00:00Z", { storyId: "3-1" }),
    ];
    const state = reconstructState(events, "2026-03-22T12:00:00Z");

    expect(state.blockers).toHaveLength(0);
    expect(state.activeStories["3-1"]).toBe("done");
  });

  it("skips events with missing metadata gracefully", () => {
    const events = [
      evt("story.started", "2026-03-22T09:00:00Z", {}), // no storyId
      evt("unknown.event", "2026-03-22T10:00:00Z", {}),
    ];
    const state = reconstructState(events, "2026-03-22T12:00:00Z");

    expect(Object.keys(state.activeStories)).toHaveLength(0);
    expect(state.eventsProcessed).toBe(2);
  });

  it("records lastEventAt timestamp", () => {
    const state = reconstructState(EVENTS, "2026-03-22T10:30:00Z");

    expect(state.lastEventAt).toBe("2026-03-22T10:00:00Z");
  });

  it("removes agent from activeAgents when their story completes", () => {
    const events = [
      evt("story.started", "2026-03-22T09:00:00Z", { storyId: "1-1", agentId: "agent-X" }),
      evt("story.started", "2026-03-22T09:30:00Z", { storyId: "1-2", agentId: "agent-Y" }),
      evt("story.completed", "2026-03-22T10:00:00Z", { storyId: "1-1" }),
    ];
    const state = reconstructState(events, "2026-03-22T11:00:00Z");

    // agent-X's story completed — should be removed
    expect(state.activeAgents).not.toContain("agent-X");
    // agent-Y's story is still in progress — should remain
    expect(state.activeAgents).toContain("agent-Y");
  });

  it("keeps agent if assigned to a different active story after completion", () => {
    const events = [
      evt("story.started", "2026-03-22T09:00:00Z", { storyId: "1-1", agentId: "agent-Z" }),
      evt("story.completed", "2026-03-22T10:00:00Z", { storyId: "1-1" }),
      evt("story.started", "2026-03-22T11:00:00Z", { storyId: "1-2", agentId: "agent-Z" }),
    ];
    const state = reconstructState(events, "2026-03-22T12:00:00Z");

    // agent-Z was re-assigned to 1-2 after 1-1 completed
    expect(state.activeAgents).toContain("agent-Z");
  });
});
