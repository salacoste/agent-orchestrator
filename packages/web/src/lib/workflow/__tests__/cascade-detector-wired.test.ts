/**
 * Wired cascade detector tests (Story 39.3).
 */
import { describe, expect, it, beforeEach } from "vitest";
import { createWiredCascadeDetector } from "../cascade-detector-wired";

describe("createWiredCascadeDetector", () => {
  let detector: ReturnType<typeof createWiredCascadeDetector>;

  beforeEach(() => {
    detector = createWiredCascadeDetector({ threshold: 3, windowMs: 60_000 });
  });

  it("records failures from session snapshots with blocked status", () => {
    detector.processSnapshot([
      { id: "agent-1", status: "blocked" },
      { id: "agent-2", status: "working" },
    ]);

    const status = detector.getStatus();
    expect(status.failureCount).toBe(1);
    expect(status.triggered).toBe(false);
  });

  it("records failures from ci_failed status", () => {
    detector.processSnapshot([{ id: "agent-1", status: "ci_failed" }]);

    expect(detector.getStatus().failureCount).toBe(1);
  });

  it("triggers cascade after threshold failures", () => {
    const triggered = detector.processSnapshot([
      { id: "agent-1", status: "blocked" },
      { id: "agent-2", status: "blocked" },
      { id: "agent-3", status: "ci_failed" },
    ]);

    expect(triggered).toBe(true);
    const status = detector.getStatus();
    expect(status.triggered).toBe(true);
    expect(status.paused).toBe(true);
    expect(status.failureCount).toBe(3);
  });

  it("deduplicates — same agent not counted twice across snapshots", () => {
    detector.processSnapshot([{ id: "agent-1", status: "blocked" }]);
    detector.processSnapshot([{ id: "agent-1", status: "blocked" }]); // Same agent, still blocked

    expect(detector.getStatus().failureCount).toBe(1);
  });

  it("re-counts agent that recovered and failed again", () => {
    detector.processSnapshot([{ id: "agent-1", status: "blocked" }]);
    expect(detector.getStatus().failureCount).toBe(1);

    // Agent recovers
    detector.processSnapshot([{ id: "agent-1", status: "working" }]);

    // Agent fails again
    detector.processSnapshot([{ id: "agent-1", status: "blocked" }]);
    expect(detector.getStatus().failureCount).toBe(2);
  });

  it("ignores non-failure statuses", () => {
    detector.processSnapshot([
      { id: "agent-1", status: "working" },
      { id: "agent-2", status: "spawning" },
      { id: "agent-3", status: "pr_open" },
      { id: "agent-4", status: "merged" },
    ]);

    expect(detector.getStatus().failureCount).toBe(0);
  });

  it("resume clears seen failures and detector state", () => {
    detector.processSnapshot([
      { id: "agent-1", status: "blocked" },
      { id: "agent-2", status: "blocked" },
      { id: "agent-3", status: "blocked" },
    ]);
    expect(detector.getStatus().paused).toBe(true);

    detector.resume();

    expect(detector.getStatus().paused).toBe(false);
    expect(detector.getStatus().failureCount).toBe(0);

    // Same agents can be re-counted after resume
    detector.processSnapshot([{ id: "agent-1", status: "blocked" }]);
    expect(detector.getStatus().failureCount).toBe(1);
  });

  it("reset clears all state", () => {
    detector.processSnapshot([{ id: "agent-1", status: "blocked" }]);
    detector.reset();

    expect(detector.getStatus().failureCount).toBe(0);

    // Re-process same agent — should count again
    detector.processSnapshot([{ id: "agent-1", status: "blocked" }]);
    expect(detector.getStatus().failureCount).toBe(1);
  });

  it("returns false when cascade not triggered", () => {
    const triggered = detector.processSnapshot([{ id: "agent-1", status: "blocked" }]);
    expect(triggered).toBe(false);
  });

  it("handles empty snapshot", () => {
    const triggered = detector.processSnapshot([]);
    expect(triggered).toBe(false);
    expect(detector.getStatus().failureCount).toBe(0);
  });
});
