/**
 * Tests for withResilience — generic wrapper composing circuit breaker + retry for any async operation
 */

import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { withResilience, type ResilienceDeps } from "../resilient-service-wrapper.js";
import {
  createCircuitBreakerManager,
  type CircuitBreakerManager,
} from "../circuit-breaker-manager.js";

describe("withResilience", () => {
  let cbManager: CircuitBreakerManager;
  let deps: ResilienceDeps;

  beforeEach(() => {
    vi.useFakeTimers();
    cbManager = createCircuitBreakerManager({});
    deps = {
      circuitBreakerManager: cbManager,
      retryConfig: {
        maxAttempts: 3,
        initialBackoffMs: 100,
        maxBackoffMs: 1000,
        jitterPercent: 0,
      },
    };
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("calls operation and returns result on success", async () => {
    const operation = vi.fn().mockResolvedValue("result-data");

    const result = await withResilience(operation, "tracker", deps);

    expect(result).toBe("result-data");
    expect(operation).toHaveBeenCalledTimes(1);
  });

  it("retries on transient failure then returns result", async () => {
    const operation = vi
      .fn()
      .mockRejectedValueOnce(new Error("Timeout"))
      .mockResolvedValueOnce("recovered");

    const promise = withResilience(operation, "scm", deps);
    await vi.advanceTimersByTimeAsync(200);
    const result = await promise;

    expect(result).toBe("recovered");
    expect(operation).toHaveBeenCalledTimes(2);
  });

  it("records success on circuit breaker after successful operation", async () => {
    const breaker = cbManager.getBreaker("tracker");
    breaker.recordFailure();
    breaker.recordFailure();
    expect(breaker.getFailureCount()).toBe(2);

    const operation = vi.fn().mockResolvedValue("ok");
    await withResilience(operation, "tracker", deps);

    expect(breaker.getFailureCount()).toBe(0);
  });

  it("records failure on circuit breaker after all retries exhausted", async () => {
    const operation = vi.fn().mockRejectedValue(new Error("Down"));

    let caughtError: Error | undefined;
    const promise = withResilience(operation, "notifier", deps).catch((e: Error) => {
      caughtError = e;
    });
    await vi.advanceTimersByTimeAsync(5000);
    await promise;

    expect(caughtError).toBeDefined();
    expect(caughtError!.message).toContain("Down");

    const breaker = cbManager.getBreaker("notifier");
    expect(breaker.getFailureCount()).toBeGreaterThan(0);
  });

  it("fast-fails when circuit is open", async () => {
    const breaker = cbManager.getBreaker("scm");
    for (let i = 0; i < 5; i++) {
      breaker.recordFailure();
    }
    expect(breaker.getState()).toBe("open");

    const operation = vi.fn().mockResolvedValue("should not be called");

    await expect(withResilience(operation, "scm", deps)).rejects.toThrow(
      "Circuit breaker is open for service: scm",
    );
    expect(operation).not.toHaveBeenCalled();
  });

  it("uses service-specific breaker per service name", async () => {
    const operation = vi.fn().mockRejectedValue(new Error("Fail"));

    // Exhaust retries on tracker — catch rejection immediately to avoid unhandled rejection
    const promise = withResilience(operation, "tracker", deps).catch(() => {});
    await vi.advanceTimersByTimeAsync(5000);
    await promise;

    // scm breaker should be unaffected
    const scmBreaker = cbManager.getBreaker("scm");
    expect(scmBreaker.getFailureCount()).toBe(0);
    expect(scmBreaker.getState()).toBe("closed");
  });

  it("isolates failures — different services have independent breakers", async () => {
    // Trip the tracker breaker
    const trackerBreaker = cbManager.getBreaker("tracker");
    for (let i = 0; i < 5; i++) {
      trackerBreaker.recordFailure();
    }
    expect(trackerBreaker.getState()).toBe("open");

    // notifier should still work
    const notifierOp = vi.fn().mockResolvedValue("notified");
    const result = await withResilience(notifierOp, "notifier", deps);
    expect(result).toBe("notified");
  });

  describe("DLQ integration (circuit breaker open → DLQ)", () => {
    it("enqueues to DLQ when circuit is open and DLQ is configured", async () => {
      const mockDlq = {
        enqueue: vi.fn().mockResolvedValue("dlq-id"),
      };

      const depsWithDlq: ResilienceDeps = {
        ...deps,
        dlq: mockDlq as never,
        operationType: "tracker_sync",
      };

      // Trip the breaker
      const breaker = cbManager.getBreaker("tracker");
      for (let i = 0; i < 5; i++) {
        breaker.recordFailure();
      }
      expect(breaker.getState()).toBe("open");

      const operation = vi.fn().mockResolvedValue("should not run");
      const result = await withResilience(operation, "tracker", depsWithDlq);

      expect(result).toBeUndefined();
      expect(operation).not.toHaveBeenCalled();
      expect(mockDlq.enqueue).toHaveBeenCalledTimes(1);
      expect(mockDlq.enqueue).toHaveBeenCalledWith(
        expect.objectContaining({
          operation: "tracker_sync",
          failureReason: "Circuit breaker open for tracker",
        }),
      );
    });

    it("throws when circuit is open and no DLQ configured (existing behavior)", async () => {
      const breaker = cbManager.getBreaker("scm");
      for (let i = 0; i < 5; i++) {
        breaker.recordFailure();
      }

      const operation = vi.fn();
      await expect(withResilience(operation, "scm", deps)).rejects.toThrow(
        "Circuit breaker is open for service: scm",
      );
      expect(operation).not.toHaveBeenCalled();
    });
  });
});
