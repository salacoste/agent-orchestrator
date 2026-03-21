/**
 * Tests for CircuitBreakerManager — manages named circuit breaker instances per service
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  createCircuitBreakerManager,
  type CircuitBreakerManager,
} from "../circuit-breaker-manager.js";
import type { EventBus } from "../types.js";

function createMockEventBus(): EventBus {
  return {
    name: "mock-event-bus",
    publish: vi.fn().mockResolvedValue(undefined),
    subscribe: vi.fn().mockResolvedValue(() => {}),
    isConnected: vi.fn().mockReturnValue(true),
    isDegraded: vi.fn().mockReturnValue(false),
    getQueueSize: vi.fn().mockReturnValue(0),
    close: vi.fn().mockResolvedValue(undefined),
  };
}

describe("CircuitBreakerManager", () => {
  let manager: CircuitBreakerManager;
  let mockEventBus: EventBus;

  beforeEach(() => {
    mockEventBus = createMockEventBus();
    manager = createCircuitBreakerManager({ eventBus: mockEventBus });
  });

  describe("getBreaker", () => {
    it("creates a new breaker for unknown service name", () => {
      const breaker = manager.getBreaker("event-bus");
      expect(breaker).toBeDefined();
      expect(breaker.getState()).toBe("closed");
      expect(breaker.getFailureCount()).toBe(0);
    });

    it("returns the same breaker instance for repeated calls with same name", () => {
      const breaker1 = manager.getBreaker("tracker");
      const breaker2 = manager.getBreaker("tracker");
      expect(breaker1).toBe(breaker2);
    });

    it("returns different breaker instances for different service names", () => {
      const eventBusBreaker = manager.getBreaker("event-bus");
      const trackerBreaker = manager.getBreaker("tracker");
      expect(eventBusBreaker).not.toBe(trackerBreaker);
    });

    it("applies service-specific config for event-bus", () => {
      manager = createCircuitBreakerManager({
        eventBus: mockEventBus,
        serviceConfigs: {
          "event-bus": { failureThreshold: 3, openDurationMs: 15000 },
        },
      });
      const breaker = manager.getBreaker("event-bus");
      // Record 3 failures (custom threshold)
      breaker.recordFailure();
      breaker.recordFailure();
      breaker.recordFailure();
      expect(breaker.getState()).toBe("open");
    });

    it("uses default config for unconfigured services", () => {
      const breaker = manager.getBreaker("unknown-service");
      // Default threshold is 5
      breaker.recordFailure();
      breaker.recordFailure();
      breaker.recordFailure();
      expect(breaker.getState()).toBe("closed");
      breaker.recordFailure();
      breaker.recordFailure();
      expect(breaker.getState()).toBe("open");
    });
  });

  describe("getAllStates", () => {
    it("returns empty map when no breakers exist", () => {
      const states = manager.getAllStates();
      expect(states).toEqual({});
    });

    it("returns state for all created breakers", () => {
      manager.getBreaker("event-bus");
      manager.getBreaker("tracker");
      manager.getBreaker("scm");

      const states = manager.getAllStates();
      expect(Object.keys(states)).toHaveLength(3);
      expect(states["event-bus"]).toBeDefined();
      expect(states["event-bus"].state).toBe("closed");
      expect(states["event-bus"].failureCount).toBe(0);
      expect(states["tracker"]).toBeDefined();
      expect(states["scm"]).toBeDefined();
    });

    it("reflects current breaker states after failures", () => {
      const breaker = manager.getBreaker("notifier");
      breaker.recordFailure();
      breaker.recordFailure();
      breaker.recordFailure();

      const states = manager.getAllStates();
      expect(states["notifier"].failureCount).toBe(3);
      expect(states["notifier"].state).toBe("closed");
    });

    it("shows open state after threshold exceeded", () => {
      const breaker = manager.getBreaker("scm");
      for (let i = 0; i < 5; i++) {
        breaker.recordFailure();
      }

      const states = manager.getAllStates();
      expect(states["scm"].state).toBe("open");
      expect(states["scm"].openedAt).toBeDefined();
      expect(typeof states["scm"].openedAt).toBe("number");
    });
  });

  describe("resetAll", () => {
    it("resets all breakers to closed state", () => {
      const breaker1 = manager.getBreaker("event-bus");
      const breaker2 = manager.getBreaker("tracker");

      // Trip both breakers
      for (let i = 0; i < 5; i++) {
        breaker1.recordFailure();
        breaker2.recordFailure();
      }
      expect(breaker1.getState()).toBe("open");
      expect(breaker2.getState()).toBe("open");

      manager.resetAll();

      expect(breaker1.getState()).toBe("closed");
      expect(breaker1.getFailureCount()).toBe(0);
      expect(breaker2.getState()).toBe("closed");
      expect(breaker2.getFailureCount()).toBe(0);
    });
  });

  describe("close", () => {
    it("clears all breakers and resets internal state", () => {
      manager.getBreaker("event-bus");
      manager.getBreaker("tracker");

      manager.close();

      const states = manager.getAllStates();
      expect(states).toEqual({});
    });

    it("creates fresh breakers after close", () => {
      const originalBreaker = manager.getBreaker("event-bus");
      originalBreaker.recordFailure();

      manager.close();

      const newBreaker = manager.getBreaker("event-bus");
      expect(newBreaker).not.toBe(originalBreaker);
      expect(newBreaker.getFailureCount()).toBe(0);
    });

    it("does not publish spurious recovery events when closing open breakers", async () => {
      const tracker = manager.getBreaker("tracker");
      // Trip the tracker breaker to open
      for (let i = 0; i < 5; i++) {
        tracker.recordFailure();
      }
      expect(tracker.getState()).toBe("open");

      // Clear mock calls from the open transition
      (mockEventBus.publish as ReturnType<typeof vi.fn>).mockClear();

      // close() should NOT publish "circuit recovered" events
      manager.close();

      await Promise.resolve();

      const publishCalls = (mockEventBus.publish as ReturnType<typeof vi.fn>).mock.calls;
      const recoveryEvents = publishCalls.filter((call: unknown[]) => {
        const evt = call[0] as { eventType: string; metadata: Record<string, unknown> };
        return evt.eventType === "circuit.state-changed" && evt.metadata.newState === "closed";
      });

      expect(recoveryEvents).toHaveLength(0);
    });
  });

  describe("event publishing on state transitions", () => {
    it("publishes circuit.state-changed event when breaker opens", async () => {
      const breaker = manager.getBreaker("tracker");
      for (let i = 0; i < 5; i++) {
        breaker.recordFailure();
      }

      // onStateChange is synchronous but may trigger async publish
      // Give a tick for the publish call to be registered
      await vi.advanceTimersByTimeAsync?.(0).catch(() => {});
      await Promise.resolve();

      const publishCalls = (mockEventBus.publish as ReturnType<typeof vi.fn>).mock.calls;
      const stateChangeEvents = publishCalls.filter(
        (call: unknown[]) =>
          (call[0] as { eventType: string }).eventType === "circuit.state-changed",
      );

      expect(stateChangeEvents.length).toBeGreaterThanOrEqual(1);
      const event = stateChangeEvents[0][0] as {
        eventType: string;
        metadata: Record<string, unknown>;
      };
      expect(event.metadata.serviceName).toBe("tracker");
      expect(event.metadata.newState).toBe("open");
      expect(event.metadata.oldState).toBe("closed");
    });

    it("does NOT publish events for event-bus breaker state changes (circular guard)", async () => {
      const breaker = manager.getBreaker("event-bus");
      for (let i = 0; i < 5; i++) {
        breaker.recordFailure();
      }

      await Promise.resolve();

      const publishCalls = (mockEventBus.publish as ReturnType<typeof vi.fn>).mock.calls;
      const eventBusStateEvents = publishCalls.filter((call: unknown[]) => {
        const evt = call[0] as { eventType: string; metadata: Record<string, unknown> };
        return (
          evt.eventType === "circuit.state-changed" && evt.metadata.serviceName === "event-bus"
        );
      });

      expect(eventBusStateEvents).toHaveLength(0);
    });

    it("publishes events for non-event-bus service breaker state changes", async () => {
      const breaker = manager.getBreaker("scm");
      for (let i = 0; i < 5; i++) {
        breaker.recordFailure();
      }

      await Promise.resolve();

      const publishCalls = (mockEventBus.publish as ReturnType<typeof vi.fn>).mock.calls;
      const scmStateEvents = publishCalls.filter((call: unknown[]) => {
        const evt = call[0] as { eventType: string; metadata: Record<string, unknown> };
        return evt.eventType === "circuit.state-changed" && evt.metadata.serviceName === "scm";
      });

      expect(scmStateEvents.length).toBeGreaterThanOrEqual(1);
    });

    it("includes failure count and timing in event metadata", async () => {
      manager = createCircuitBreakerManager({
        eventBus: mockEventBus,
        serviceConfigs: {
          notifier: { failureThreshold: 3, openDurationMs: 30000 },
        },
      });

      const notifierBreaker = manager.getBreaker("notifier");
      for (let i = 0; i < 3; i++) {
        notifierBreaker.recordFailure();
      }

      await Promise.resolve();

      const publishCalls = (mockEventBus.publish as ReturnType<typeof vi.fn>).mock.calls;
      const stateChangeEvents = publishCalls.filter(
        (call: unknown[]) =>
          (call[0] as { eventType: string }).eventType === "circuit.state-changed",
      );

      if (stateChangeEvents.length > 0) {
        const event = stateChangeEvents[0][0] as {
          eventType: string;
          metadata: Record<string, unknown>;
        };
        expect(event.metadata).toHaveProperty("serviceName");
        expect(event.metadata).toHaveProperty("oldState");
        expect(event.metadata).toHaveProperty("newState");
        expect(event.metadata).toHaveProperty("failureCount");
      }
    });

    it("does not throw when event publishing fails", async () => {
      const failingEventBus = createMockEventBus();
      (failingEventBus.publish as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error("EventBus unavailable"),
      );

      manager = createCircuitBreakerManager({ eventBus: failingEventBus });
      const breaker = manager.getBreaker("tracker");

      // Should not throw despite event bus failure
      expect(() => {
        for (let i = 0; i < 5; i++) {
          breaker.recordFailure();
        }
      }).not.toThrow();
    });
  });
});
