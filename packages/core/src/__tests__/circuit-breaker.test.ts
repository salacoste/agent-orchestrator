/**
 * Tests for CircuitBreaker with state machine
 */

import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { createCircuitBreaker, type CircuitBreaker, type CircuitBreakerConfig } from "../index.js";

describe("CircuitBreaker", () => {
  let circuitBreaker: CircuitBreaker;
  let mockDate: Date;

  beforeEach(() => {
    // Mock Date.now() for deterministic tests
    mockDate = new Date("2024-01-01T00:00:00.000Z");
    vi.spyOn(Date, "now").mockReturnValue(mockDate.getTime());

    circuitBreaker = createCircuitBreaker({
      config: {
        failureThreshold: 5,
        openDurationMs: 30000,
      },
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("initialization", () => {
    it("creates circuit breaker with default config", () => {
      const cb = createCircuitBreaker({});
      expect(cb).toBeDefined();
      expect(cb.getState()).toBe("closed");
    });

    it("creates circuit breaker with custom config", () => {
      const config: Partial<CircuitBreakerConfig> = {
        failureThreshold: 3,
        openDurationMs: 60000,
      };
      const cb = createCircuitBreaker({ config });
      expect(cb).toBeDefined();
      expect(cb.getState()).toBe("closed");
    });

    it("starts in CLOSED state", () => {
      expect(circuitBreaker.getState()).toBe("closed");
    });
  });

  describe("CLOSED state", () => {
    it("remains CLOSED below failure threshold", () => {
      for (let i = 0; i < 4; i++) {
        circuitBreaker.recordFailure();
      }
      expect(circuitBreaker.getState()).toBe("closed");
    });

    it("transitions to OPEN after failure threshold (5 failures)", () => {
      for (let i = 0; i < 5; i++) {
        circuitBreaker.recordFailure();
      }
      expect(circuitBreaker.getState()).toBe("open");
    });

    it("resets failure count on success", () => {
      for (let i = 0; i < 4; i++) {
        circuitBreaker.recordFailure();
      }
      circuitBreaker.recordSuccess();
      for (let i = 0; i < 4; i++) {
        circuitBreaker.recordFailure();
      }
      expect(circuitBreaker.getState()).toBe("closed");
    });

    it("allows operations when CLOSED", () => {
      expect(circuitBreaker.allowRequest()).toBe(true);
    });
  });

  describe("OPEN state", () => {
    beforeEach(() => {
      // Transition to OPEN
      for (let i = 0; i < 5; i++) {
        circuitBreaker.recordFailure();
      }
    });

    it("rejects operations when OPEN", () => {
      expect(circuitBreaker.allowRequest()).toBe(false);
    });

    it("remains OPEN for openDurationMs (30s)", () => {
      expect(circuitBreaker.getState()).toBe("open");

      // Advance time by 29 seconds
      mockDate = new Date("2024-01-01T00:00:29.000Z");
      vi.spyOn(Date, "now").mockReturnValue(mockDate.getTime());

      expect(circuitBreaker.getState()).toBe("open");
    });

    it("transitions to HALF-OPEN after openDurationMs", () => {
      expect(circuitBreaker.getState()).toBe("open");

      // Advance time by 30 seconds
      mockDate = new Date("2024-01-01T00:00:30.000Z");
      vi.spyOn(Date, "now").mockReturnValue(mockDate.getTime());

      expect(circuitBreaker.getState()).toBe("half-open");
    });

    it("does not reset failure count while OPEN", () => {
      expect(circuitBreaker.getState()).toBe("open");
      // Recording failures while OPEN should not affect state
      circuitBreaker.recordFailure();
      circuitBreaker.recordFailure();
      expect(circuitBreaker.getState()).toBe("open");
    });
  });

  describe("HALF-OPEN state", () => {
    beforeEach(() => {
      // Transition to OPEN
      for (let i = 0; i < 5; i++) {
        circuitBreaker.recordFailure();
      }
      // Advance time to transition to HALF-OPEN
      mockDate = new Date("2024-01-01T00:00:30.000Z");
      vi.spyOn(Date, "now").mockReturnValue(mockDate.getTime());
      expect(circuitBreaker.getState()).toBe("half-open");
    });

    it("allows operations when HALF-OPEN", () => {
      expect(circuitBreaker.allowRequest()).toBe(true);
    });

    it("transitions to CLOSED on success", () => {
      circuitBreaker.recordSuccess();
      expect(circuitBreaker.getState()).toBe("closed");
    });

    it("transitions back to OPEN on failure", () => {
      circuitBreaker.recordFailure();
      expect(circuitBreaker.getState()).toBe("open");
    });

    it("resets failure count when transitioning to CLOSED", () => {
      circuitBreaker.recordSuccess();
      expect(circuitBreaker.getState()).toBe("closed");
      // Should require 5 failures again to open
      for (let i = 0; i < 4; i++) {
        circuitBreaker.recordFailure();
      }
      expect(circuitBreaker.getState()).toBe("closed");
    });
  });

  describe("statistics", () => {
    it("tracks failure count", () => {
      for (let i = 0; i < 3; i++) {
        circuitBreaker.recordFailure();
      }
      expect(circuitBreaker.getFailureCount()).toBe(3);
    });

    it("tracks last failure time", () => {
      const expectedTime = new Date("2024-01-01T00:00:00.000Z").getTime();
      circuitBreaker.recordFailure();
      expect(circuitBreaker.getLastFailureTime()).toBe(expectedTime);
    });

    it("tracks opened at time", () => {
      for (let i = 0; i < 5; i++) {
        circuitBreaker.recordFailure();
      }
      const openedAt = circuitBreaker.getOpenedAt();
      expect(openedAt).toBeDefined();
      expect(openedAt).toBe(new Date("2024-01-01T00:00:00.000Z").getTime());
    });
  });

  describe("reset", () => {
    it("resets to CLOSED state", () => {
      // Transition to OPEN
      for (let i = 0; i < 5; i++) {
        circuitBreaker.recordFailure();
      }
      expect(circuitBreaker.getState()).toBe("open");

      circuitBreaker.reset();
      expect(circuitBreaker.getState()).toBe("closed");
    });

    it("clears failure count", () => {
      for (let i = 0; i < 3; i++) {
        circuitBreaker.recordFailure();
      }
      expect(circuitBreaker.getFailureCount()).toBe(3);

      circuitBreaker.reset();
      expect(circuitBreaker.getFailureCount()).toBe(0);
    });

    it("clears opened at time", () => {
      // Transition to OPEN
      for (let i = 0; i < 5; i++) {
        circuitBreaker.recordFailure();
      }
      expect(circuitBreaker.getOpenedAt()).toBeDefined();

      circuitBreaker.reset();
      expect(circuitBreaker.getOpenedAt()).toBeUndefined();
    });
  });
});
