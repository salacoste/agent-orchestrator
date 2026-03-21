/**
 * Integration test: Circuit breaker full lifecycle
 * Simulates 5 consecutive failures → circuit opens → fast-fail → wait 30s → half-open → success → closes
 */

import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import {
  createCircuitBreakerManager,
  type CircuitBreakerManager,
} from "../circuit-breaker-manager.js";
import { createResilientEventBus, type ResilientEventBus } from "../resilient-event-bus.js";
import { withResilience } from "../resilient-service-wrapper.js";
import type { EventBus } from "../types.js";
import { createHealthCheckService } from "../health-check.js";

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

describe("Circuit Breaker Integration", () => {
  let cbManager: CircuitBreakerManager;
  let innerBus: EventBus;
  let resilientBus: ResilientEventBus;

  beforeEach(() => {
    vi.useFakeTimers();
    innerBus = createMockEventBus();
    cbManager = createCircuitBreakerManager({
      eventBus: innerBus,
      serviceConfigs: {
        "event-bus": { failureThreshold: 5, openDurationMs: 30000 },
      },
    });
    resilientBus = createResilientEventBus({
      inner: innerBus,
      circuitBreakerManager: cbManager,
      retryConfig: { maxAttempts: 1, initialBackoffMs: 100, jitterPercent: 0 },
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("full lifecycle: CLOSED → OPEN → HALF-OPEN → CLOSED", async () => {
    const publishMock = innerBus.publish as ReturnType<typeof vi.fn>;
    const breaker = cbManager.getBreaker("event-bus");

    // Phase 1: 5 consecutive failures trip the circuit
    publishMock.mockRejectedValue(new Error("Connection refused"));

    for (let i = 0; i < 5; i++) {
      await resilientBus.publish({ eventType: "test.event", metadata: { attempt: i } });
    }

    expect(breaker.getState()).toBe("open");
    expect(breaker.getFailureCount()).toBe(5); // Threshold reached

    // Phase 2: Fast-fail while circuit is open (no calls to inner bus)
    publishMock.mockClear();
    await resilientBus.publish({ eventType: "test.while-open", metadata: {} });
    expect(publishMock).not.toHaveBeenCalled();

    // Phase 3: Wait 30 seconds → circuit transitions to half-open
    await vi.advanceTimersByTimeAsync(30001);
    expect(breaker.getState()).toBe("half-open");

    // Phase 4: Successful publish in half-open → circuit closes
    publishMock.mockResolvedValue(undefined);
    await resilientBus.publish({ eventType: "test.recovery", metadata: {} });

    expect(breaker.getState()).toBe("closed");
    expect(breaker.getFailureCount()).toBe(0);
    expect(publishMock).toHaveBeenCalledTimes(1);
  });

  it("half-open failure re-opens the circuit", async () => {
    const publishMock = innerBus.publish as ReturnType<typeof vi.fn>;
    const breaker = cbManager.getBreaker("event-bus");

    // Trip the circuit
    publishMock.mockRejectedValue(new Error("Down"));
    for (let i = 0; i < 5; i++) {
      await resilientBus.publish({ eventType: "test.event", metadata: {} });
    }
    expect(breaker.getState()).toBe("open");

    // Wait for half-open
    await vi.advanceTimersByTimeAsync(30001);
    expect(breaker.getState()).toBe("half-open");

    // Fail in half-open → re-opens
    await resilientBus.publish({ eventType: "test.still-down", metadata: {} });
    expect(breaker.getState()).toBe("open");
  });

  it("withResilience uses independent breakers per service", async () => {
    const trackerOp = vi.fn().mockRejectedValue(new Error("Tracker down"));
    const scmOp = vi.fn().mockResolvedValue({ pr: 42 });

    const resilienceDeps = {
      circuitBreakerManager: cbManager,
      retryConfig: { maxAttempts: 1, initialBackoffMs: 10, jitterPercent: 0 },
    };

    // Trip the tracker breaker
    for (let i = 0; i < 5; i++) {
      await withResilience(trackerOp, "tracker", resilienceDeps).catch(() => {});
    }

    const trackerBreaker = cbManager.getBreaker("tracker");
    expect(trackerBreaker.getState()).toBe("open");

    // SCM should still work independently
    const result = await withResilience(scmOp, "scm", resilienceDeps);
    expect(result).toEqual({ pr: 42 });

    const scmBreaker = cbManager.getBreaker("scm");
    expect(scmBreaker.getState()).toBe("closed");
  });

  it("health check reports circuit breaker status", async () => {
    const breaker = cbManager.getBreaker("tracker");
    for (let i = 0; i < 5; i++) {
      breaker.recordFailure();
    }

    const healthService = createHealthCheckService({
      circuitBreakerStates: cbManager.getAllStates(),
    });

    const result = await healthService.check();
    const cbComponent = result.components.find((c) => c.component === "Circuit Breakers");

    expect(cbComponent).toBeDefined();
    expect(cbComponent!.status).toBe("degraded");
    expect(cbComponent!.message).toContain("open");
    expect(cbComponent!.details).toBeDefined();
    expect(cbComponent!.details!.some((d) => d.includes("tracker"))).toBe(true);
  });

  it("health check reports healthy when all breakers closed", async () => {
    cbManager.getBreaker("event-bus");
    cbManager.getBreaker("tracker");

    const healthService = createHealthCheckService({
      circuitBreakerStates: cbManager.getAllStates(),
    });

    const result = await healthService.check();
    const cbComponent = result.components.find((c) => c.component === "Circuit Breakers");

    expect(cbComponent).toBeDefined();
    expect(cbComponent!.status).toBe("healthy");
    expect(cbComponent!.message).toContain("closed");
  });

  it("checkComponent returns 'not configured' when circuitBreakerStates absent", async () => {
    // No circuitBreakerStates in config
    const healthService = createHealthCheckService({});

    const result = await healthService.checkComponent("circuit-breakers");

    expect(result.status).toBe("unhealthy");
    expect(result.message).toContain("not configured");
  });

  it("getAllStates reflects current state of all managed breakers", () => {
    cbManager.getBreaker("event-bus");
    const tracker = cbManager.getBreaker("tracker");
    tracker.recordFailure();
    tracker.recordFailure();

    const states = cbManager.getAllStates();

    expect(Object.keys(states)).toHaveLength(2);
    expect(states["event-bus"].state).toBe("closed");
    expect(states["event-bus"].failureCount).toBe(0);
    expect(states["tracker"].state).toBe("closed");
    expect(states["tracker"].failureCount).toBe(2);
  });
});
