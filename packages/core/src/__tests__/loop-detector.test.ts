/**
 * Loop detector tests (Story 43.5).
 */
import { describe, expect, it, beforeEach } from "vitest";
import { createLoopDetector, type LoopDetector } from "../loop-detector.js";

let detector: LoopDetector;

beforeEach(() => {
  detector = createLoopDetector(3);
});

describe("createLoopDetector", () => {
  it("returns false below threshold", () => {
    expect(detector.recordRestart("agent-1", "story-1")).toBe(false);
    expect(detector.recordRestart("agent-1", "story-1")).toBe(false);
  });

  it("returns true at threshold", () => {
    detector.recordRestart("agent-1", "story-1");
    detector.recordRestart("agent-1", "story-1");
    expect(detector.recordRestart("agent-1", "story-1")).toBe(true);
  });

  it("returns true above threshold", () => {
    for (let i = 0; i < 3; i++) detector.recordRestart("agent-1", "story-1");
    expect(detector.recordRestart("agent-1", "story-1")).toBe(true);
  });

  it("tracks agents independently", () => {
    detector.recordRestart("agent-1", "story-1");
    detector.recordRestart("agent-1", "story-1");
    detector.recordRestart("agent-2", "story-2");

    expect(detector.getStatus("agent-1")?.restartCount).toBe(2);
    expect(detector.getStatus("agent-2")?.restartCount).toBe(1);
  });

  it("tracks same agent on different stories independently", () => {
    detector.recordRestart("agent-1", "story-1");
    detector.recordRestart("agent-1", "story-1");
    detector.recordRestart("agent-1", "story-2");

    // agent-1:story-1 has 2 restarts, agent-1:story-2 has 1
    // getStatus returns first found — story-1
    const status = detector.getStatus("agent-1");
    expect(status?.restartCount).toBe(2);
    expect(status?.isLooping).toBe(false);
  });

  it("getStatus returns null for unknown agent", () => {
    expect(detector.getStatus("unknown")).toBeNull();
  });

  it("getStatus shows isLooping correctly", () => {
    for (let i = 0; i < 3; i++) detector.recordRestart("agent-1", "story-1");

    const status = detector.getStatus("agent-1");
    expect(status?.isLooping).toBe(true);
    expect(status?.restartCount).toBe(3);
    expect(status?.threshold).toBe(3);
  });

  it("reset clears restart count", () => {
    detector.recordRestart("agent-1", "story-1");
    detector.recordRestart("agent-1", "story-1");
    detector.reset("agent-1");

    expect(detector.getStatus("agent-1")).toBeNull();

    // Can restart again without loop detection
    expect(detector.recordRestart("agent-1", "story-1")).toBe(false);
  });

  it("getLoopingAgents returns only looping agents", () => {
    for (let i = 0; i < 3; i++) detector.recordRestart("agent-1", "story-1");
    detector.recordRestart("agent-2", "story-2"); // Not looping

    const looping = detector.getLoopingAgents();
    expect(looping).toHaveLength(1);
    expect(looping[0].agentId).toBe("agent-1");
  });

  it("works with custom threshold", () => {
    const custom = createLoopDetector(5);

    for (let i = 0; i < 4; i++) custom.recordRestart("a", "s");
    expect(custom.getStatus("a")?.isLooping).toBe(false);

    custom.recordRestart("a", "s");
    expect(custom.getStatus("a")?.isLooping).toBe(true);
  });
});
