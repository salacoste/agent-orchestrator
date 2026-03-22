/**
 * Agent ownership store tests (Story 42.2).
 */
import { describe, expect, it, beforeEach } from "vitest";
import {
  assignOwner,
  removeOwner,
  getOwner,
  getAgentsByOwner,
  getAllOwners,
  subscribeCollaborationChanges,
  _resetCollaboration,
  type CollaborationEvent,
} from "../collaboration";

beforeEach(() => {
  _resetCollaboration();
});

describe("Agent ownership store", () => {
  it("assignOwner creates owner assignment", () => {
    const result = assignOwner("agent-1", "Alice");

    expect(result.agentId).toBe("agent-1");
    expect(result.owner).toBe("Alice");
    expect(result.assignedAt).toBeDefined();
  });

  it("getOwner returns assignment for agent", () => {
    assignOwner("agent-1", "Alice");

    expect(getOwner("agent-1")).toMatchObject({ owner: "Alice" });
  });

  it("getOwner returns null for unassigned agent", () => {
    expect(getOwner("agent-99")).toBeNull();
  });

  it("removeOwner clears assignment", () => {
    assignOwner("agent-1", "Alice");
    removeOwner("agent-1");

    expect(getOwner("agent-1")).toBeNull();
  });

  it("getAgentsByOwner filters by owner name", () => {
    assignOwner("agent-1", "Alice");
    assignOwner("agent-2", "Bob");
    assignOwner("agent-3", "Alice");

    const aliceAgents = getAgentsByOwner("Alice");
    expect(aliceAgents).toHaveLength(2);
    expect(aliceAgents.map((a) => a.agentId)).toEqual(["agent-1", "agent-3"]);
  });

  it("getAllOwners returns all assignments", () => {
    assignOwner("agent-1", "Alice");
    assignOwner("agent-2", "Bob");

    expect(getAllOwners()).toHaveLength(2);
  });

  it("assignOwner overwrites previous assignment", () => {
    assignOwner("agent-1", "Alice");
    assignOwner("agent-1", "Bob");

    expect(getOwner("agent-1")?.owner).toBe("Bob");
    expect(getAllOwners()).toHaveLength(1);
  });

  it("emits collaboration events on assign", () => {
    const events: CollaborationEvent[] = [];
    subscribeCollaborationChanges((e) => events.push(e));

    assignOwner("agent-1", "Alice");

    expect(events).toHaveLength(1);
    expect(events[0].type).toBe("ownership");
    if (events[0].type === "ownership") {
      expect(events[0].action).toBe("assign");
    }
  });

  it("emits collaboration events on remove", () => {
    assignOwner("agent-1", "Alice");

    const events: CollaborationEvent[] = [];
    subscribeCollaborationChanges((e) => events.push(e));

    removeOwner("agent-1");

    expect(events).toHaveLength(1);
    expect(events[0].type).toBe("ownership");
  });

  it("_resetCollaboration clears owners", () => {
    assignOwner("agent-1", "Alice");
    _resetCollaboration();

    expect(getAllOwners()).toHaveLength(0);
  });
});
