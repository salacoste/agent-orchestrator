/**
 * Tests for ResilientEventBus — wraps EventBus with circuit breaker + retry
 */

import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { createResilientEventBus, type ResilientEventBus } from "../resilient-event-bus.js";
import type { EventBus } from "../types.js";
import {
  createCircuitBreakerManager,
  type CircuitBreakerManager,
} from "../circuit-breaker-manager.js";

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

describe("ResilientEventBus", () => {
  let innerBus: EventBus;
  let cbManager: CircuitBreakerManager;
  let resilientBus: ResilientEventBus;

  beforeEach(() => {
    vi.useFakeTimers();
    innerBus = createMockEventBus();
    cbManager = createCircuitBreakerManager({});
    resilientBus = createResilientEventBus({
      inner: innerBus,
      circuitBreakerManager: cbManager,
      retryConfig: {
        maxAttempts: 3,
        initialBackoffMs: 100,
        maxBackoffMs: 1000,
        jitterPercent: 0,
      },
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("publish", () => {
    it("delegates to inner event bus on success", async () => {
      await resilientBus.publish({
        eventType: "story.completed",
        metadata: { storyId: "1-1" },
      });

      expect(innerBus.publish).toHaveBeenCalledTimes(1);
      expect(innerBus.publish).toHaveBeenCalledWith({
        eventType: "story.completed",
        metadata: { storyId: "1-1" },
      });
    });

    it("retries on transient failure then succeeds", async () => {
      const publishMock = innerBus.publish as ReturnType<typeof vi.fn>;
      publishMock
        .mockRejectedValueOnce(new Error("Connection timeout"))
        .mockResolvedValueOnce(undefined);

      const publishPromise = resilientBus.publish({
        eventType: "story.started",
        metadata: {},
      });

      // Advance past the first retry backoff (100ms)
      await vi.advanceTimersByTimeAsync(200);
      await publishPromise;

      expect(publishMock).toHaveBeenCalledTimes(2);
    });

    it("records failure on circuit breaker after all retries exhausted", async () => {
      const publishMock = innerBus.publish as ReturnType<typeof vi.fn>;
      publishMock.mockRejectedValue(new Error("Permanently down"));

      const publishPromise = resilientBus.publish({
        eventType: "test.event",
        metadata: {},
      });

      // Advance through all retry backoffs
      await vi.advanceTimersByTimeAsync(5000);
      await publishPromise.catch(() => {});

      const breaker = cbManager.getBreaker("event-bus");
      expect(breaker.getFailureCount()).toBeGreaterThan(0);
    });

    it("fast-fails when circuit is open without calling inner bus", async () => {
      // Trip the breaker manually
      const breaker = cbManager.getBreaker("event-bus");
      for (let i = 0; i < 5; i++) {
        breaker.recordFailure();
      }
      expect(breaker.getState()).toBe("open");

      const publishMock = innerBus.publish as ReturnType<typeof vi.fn>;
      publishMock.mockClear();

      // Should not call inner bus
      await resilientBus.publish({
        eventType: "test.event",
        metadata: {},
      });

      expect(publishMock).not.toHaveBeenCalled();
    });

    it("does not throw on publish failure (isolation)", async () => {
      const publishMock = innerBus.publish as ReturnType<typeof vi.fn>;
      publishMock.mockRejectedValue(new Error("Catastrophic failure"));

      const publishPromise = resilientBus.publish({
        eventType: "test.event",
        metadata: {},
      });

      await vi.advanceTimersByTimeAsync(5000);

      // Should not throw — failures are swallowed
      await expect(publishPromise).resolves.toBeUndefined();
    });

    it("records success on circuit breaker after successful publish", async () => {
      // Record some failures first (but don't trip)
      const breaker = cbManager.getBreaker("event-bus");
      breaker.recordFailure();
      breaker.recordFailure();
      expect(breaker.getFailureCount()).toBe(2);

      await resilientBus.publish({
        eventType: "test.event",
        metadata: {},
      });

      expect(breaker.getFailureCount()).toBe(0);
    });
  });

  describe("passthrough methods", () => {
    it("delegates subscribe to inner bus", async () => {
      const callback = vi.fn();
      await resilientBus.subscribe(callback);
      expect(innerBus.subscribe).toHaveBeenCalledWith(callback);
    });

    it("delegates isConnected to inner bus", () => {
      (innerBus.isConnected as ReturnType<typeof vi.fn>).mockReturnValue(false);
      expect(resilientBus.isConnected()).toBe(false);
    });

    it("delegates isDegraded to inner bus", () => {
      (innerBus.isDegraded as ReturnType<typeof vi.fn>).mockReturnValue(true);
      expect(resilientBus.isDegraded()).toBe(true);
    });

    it("delegates getQueueSize to inner bus", () => {
      (innerBus.getQueueSize as ReturnType<typeof vi.fn>).mockReturnValue(42);
      expect(resilientBus.getQueueSize()).toBe(42);
    });

    it("delegates close to inner bus", async () => {
      await resilientBus.close();
      expect(innerBus.close).toHaveBeenCalledTimes(1);
    });

    it("returns inner bus name", () => {
      expect(resilientBus.name).toBe("mock-event-bus");
    });

    it("breaker state persists in manager after close and re-create", async () => {
      // Trip the breaker via failures
      const breaker = cbManager.getBreaker("event-bus");
      for (let i = 0; i < 5; i++) {
        breaker.recordFailure();
      }
      expect(breaker.getState()).toBe("open");

      // Close the resilient bus
      await resilientBus.close();

      // Re-create a new resilient bus with the same manager
      const resilientBus2 = createResilientEventBus({
        inner: innerBus,
        circuitBreakerManager: cbManager,
        retryConfig: { maxAttempts: 1, initialBackoffMs: 100, jitterPercent: 0 },
      });

      // Breaker state should persist — still open
      const publishMock = innerBus.publish as ReturnType<typeof vi.fn>;
      publishMock.mockClear();

      await resilientBus2.publish({ eventType: "test.after-close", metadata: {} });
      expect(publishMock).not.toHaveBeenCalled(); // fast-fail, circuit still open
    });
  });

  describe("DLQ integration (circuit breaker open → DLQ)", () => {
    it("enqueues to DLQ when circuit is open and DLQ is configured", async () => {
      const mockDlq = {
        enqueue: vi.fn().mockResolvedValue("dlq-id"),
      };

      const busWithDlq = createResilientEventBus({
        inner: innerBus,
        circuitBreakerManager: cbManager,
        retryConfig: { maxAttempts: 1, initialBackoffMs: 100, jitterPercent: 0 },
        dlq: mockDlq as never,
      });

      // Trip the breaker
      const breaker = cbManager.getBreaker("event-bus");
      for (let i = 0; i < 5; i++) {
        breaker.recordFailure();
      }
      expect(breaker.getState()).toBe("open");

      await busWithDlq.publish({ eventType: "test.queued", metadata: { key: "val" } });

      expect(mockDlq.enqueue).toHaveBeenCalledTimes(1);
      expect(mockDlq.enqueue).toHaveBeenCalledWith(
        expect.objectContaining({
          operation: "event_publish",
          payload: { eventType: "test.queued", metadata: { key: "val" } },
          failureReason: "Circuit breaker open for event-bus",
        }),
      );
    });

    it("silently drops when circuit is open and no DLQ configured", async () => {
      const breaker = cbManager.getBreaker("event-bus");
      for (let i = 0; i < 5; i++) {
        breaker.recordFailure();
      }

      const publishMock = innerBus.publish as ReturnType<typeof vi.fn>;
      publishMock.mockClear();

      // No DLQ configured — should just return silently
      await resilientBus.publish({ eventType: "test.dropped", metadata: {} });
      expect(publishMock).not.toHaveBeenCalled();
    });
  });
});
