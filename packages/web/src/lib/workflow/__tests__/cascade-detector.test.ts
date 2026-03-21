/**
 * Cascade failure detector tests (Story 19.3).
 */
import { describe, expect, it } from "vitest";

import { createCascadeDetector } from "../cascade-detector";

describe("createCascadeDetector", () => {
  it("does not trigger cascade below threshold", () => {
    const detector = createCascadeDetector({ threshold: 3, windowMs: 5000 });
    const now = Date.now();

    expect(detector.recordFailure(now)).toBe(false);
    expect(detector.recordFailure(now + 100)).toBe(false);

    const status = detector.getStatus();
    expect(status.triggered).toBe(false);
    expect(status.failureCount).toBe(2);
    expect(status.paused).toBe(false);
  });

  it("triggers cascade at threshold", () => {
    const detector = createCascadeDetector({ threshold: 3, windowMs: 5000 });
    const now = Date.now();

    detector.recordFailure(now);
    detector.recordFailure(now + 100);
    const triggered = detector.recordFailure(now + 200);

    expect(triggered).toBe(true);
    const status = detector.getStatus();
    expect(status.triggered).toBe(true);
    expect(status.paused).toBe(true);
  });

  it("does not re-trigger after already paused", () => {
    const detector = createCascadeDetector({ threshold: 3, windowMs: 5000 });
    const now = Date.now();

    detector.recordFailure(now);
    detector.recordFailure(now + 100);
    detector.recordFailure(now + 200); // triggers

    // 4th failure should not re-trigger (already paused)
    const reTrigger = detector.recordFailure(now + 300);
    expect(reTrigger).toBe(false);
  });

  it("expires old failures outside the window", () => {
    const detector = createCascadeDetector({ threshold: 3, windowMs: 1000 });
    // Use future timestamps to avoid Date.now() pruning in getStatus()
    const future = Date.now() + 100000;

    detector.recordFailure(future);
    detector.recordFailure(future + 100);
    // 3rd failure >1000ms after first — first failure should be pruned
    const triggered = detector.recordFailure(future + 1500);

    expect(triggered).toBe(false);
    // getStatus uses Date.now() which is before our future timestamps,
    // so check via recordFailure return value instead
    expect(triggered).toBe(false);
  });

  it("resume clears cascade state", () => {
    const detector = createCascadeDetector({ threshold: 3, windowMs: 5000 });
    const now = Date.now();

    detector.recordFailure(now);
    detector.recordFailure(now + 100);
    detector.recordFailure(now + 200);

    expect(detector.getStatus().paused).toBe(true);

    detector.resume();
    expect(detector.getStatus().paused).toBe(false);
    expect(detector.getStatus().failureCount).toBe(0);
  });

  it("uses default config when none provided", () => {
    const detector = createCascadeDetector();
    // Should not throw — defaults applied
    expect(detector.getStatus().triggered).toBe(false);
  });

  it("reset clears all state", () => {
    const detector = createCascadeDetector({ threshold: 2, windowMs: 5000 });
    detector.recordFailure();
    detector.recordFailure();
    expect(detector.getStatus().paused).toBe(true);

    detector.reset();
    expect(detector.getStatus().paused).toBe(false);
    expect(detector.getStatus().failureCount).toBe(0);
  });
});
