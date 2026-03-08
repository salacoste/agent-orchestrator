/**
 * Integration tests for RetryService with CircuitBreaker
 */

import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import {
  createRetryService,
  createCircuitBreaker,
  type RetryService,
  type CircuitBreaker,
} from "../index.js";

describe("RetryService + CircuitBreaker Integration", () => {
  let retryService: RetryService;
  let circuitBreaker: CircuitBreaker;
  let stateChangeLog: Array<{ oldState: string; newState: string }>;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(Date, "now").mockReturnValue(new Date("2024-01-01T00:00:00.000Z").getTime());

    stateChangeLog = [];
    circuitBreaker = createCircuitBreaker({
      config: {
        failureThreshold: 3,
        openDurationMs: 30000,
        logger: console,
        onStateChange: (oldState, newState) => {
          stateChangeLog.push({ oldState, newState });
        },
      },
    });

    retryService = createRetryService({
      config: {
        maxAttempts: 5,
        initialBackoffMs: 1000,
        maxBackoffMs: 10000,
        jitterPercent: 0.1,
      },
    });

    // Mock delay to avoid actual timeouts in tests
    vi.spyOn(retryService as any, "delay").mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("Circuit breaker prevents retry cascades", () => {
    it("opens after threshold failures and blocks further attempts", async () => {
      const operation = vi.fn();
      operation.mockRejectedValue(new Error("Service unavailable"));

      // Create wrapper that checks circuit breaker and records results
      let attempts = 0;
      const wrappedOperation = async (): Promise<string> => {
        if (!circuitBreaker.allowRequest()) {
          throw new Error("Circuit breaker is OPEN - operation blocked");
        }
        attempts++;
        try {
          const result = await operation();
          circuitBreaker.recordSuccess();
          return result;
        } catch (error) {
          circuitBreaker.recordFailure();
          throw error;
        }
      };

      // First 3 attempts should trigger circuit breaker
      for (let i = 0; i < 3; i++) {
        try {
          await retryService.execute(wrappedOperation, {
            isRetryable: () => true,
            maxAttempts: 1, // Only 1 attempt per call, 3 calls total
          });
        } catch {
          // Expected to fail
        }
      }

      expect(attempts).toBe(3);
      expect(circuitBreaker.getState()).toBe("open");

      // Next attempt should be blocked immediately
      try {
        await retryService.execute(wrappedOperation, {
          isRetryable: () => true,
          maxAttempts: 1,
        });
        expect.fail("Should have thrown due to circuit breaker");
      } catch (error) {
        expect((error as Error).message).toContain("Circuit breaker is OPEN");
      }

      // Should only be 3 attempts total (threshold), not 5 (maxAttempts)
      expect(attempts).toBe(3);
    });

    it("resets failure count on success", async () => {
      const operation = vi.fn();

      // Fail twice, then succeed
      operation
        .mockRejectedValueOnce(new Error("Fail 1"))
        .mockRejectedValueOnce(new Error("Fail 2"))
        .mockResolvedValue("success");

      const wrappedOperation = async (): Promise<string> => {
        if (!circuitBreaker.allowRequest()) {
          throw new Error("Circuit breaker is OPEN");
        }
        try {
          const result = await operation();
          circuitBreaker.recordSuccess();
          return result;
        } catch (error) {
          circuitBreaker.recordFailure();
          throw error;
        }
      };

      // First two attempts fail
      try {
        await retryService.execute(wrappedOperation, {
          isRetryable: () => true,
          maxAttempts: 2,
        });
      } catch {
        // Expected
      }

      // Third attempt succeeds
      const result = await retryService.execute(wrappedOperation, {
        isRetryable: () => true,
        maxAttempts: 1,
      });

      expect(result).toBe("success");
      expect(circuitBreaker.getState()).toBe("closed"); // Never opened
      expect(circuitBreaker.getFailureCount()).toBe(0); // Reset by success
    });
  });

  describe("State transition logging", () => {
    it("logs all state transitions", async () => {
      const operation = vi.fn();
      operation.mockRejectedValue(new Error("Fail"));

      const wrappedOperation = async (): Promise<string> => {
        try {
          const result = await operation();
          circuitBreaker.recordSuccess();
          return result;
        } catch (error) {
          circuitBreaker.recordFailure();
          throw error;
        }
      };

      // Trigger failures to open circuit breaker
      for (let i = 0; i < 3; i++) {
        try {
          await retryService.execute(wrappedOperation, {
            isRetryable: () => true,
            maxAttempts: 1,
          });
        } catch {
          // Expected
        }
      }

      expect(circuitBreaker.getState()).toBe("open");
      expect(stateChangeLog).toEqual([{ oldState: "closed", newState: "open" }]);
    });

    it("logs CLOSE → HALF-OPEN → CLOSED transitions", async () => {
      // Open the circuit breaker first
      for (let i = 0; i < 3; i++) {
        circuitBreaker.recordFailure();
      }

      // Advance time past openDurationMs
      vi.spyOn(Date, "now").mockReturnValue(new Date("2024-01-01T00:00:31.000Z").getTime());

      // Check state triggers transition
      circuitBreaker.getState();

      // Now record success - should close
      circuitBreaker.recordSuccess();

      expect(stateChangeLog).toEqual([
        { oldState: "closed", newState: "open" },
        { oldState: "open", newState: "half-open" },
        { oldState: "half-open", newState: "closed" },
      ]);
    });
  });

  describe("getFormattedState and getTimeUntilClose", () => {
    it("returns formatted state for CLOSED circuit breaker", () => {
      const formatted = circuitBreaker.getFormattedState();
      expect(formatted).toContain("CLOSED");
    });

    it("returns formatted state with time information for OPEN circuit breaker", () => {
      // Open the circuit breaker
      for (let i = 0; i < 3; i++) {
        circuitBreaker.recordFailure();
      }

      const formatted = circuitBreaker.getFormattedState();
      expect(formatted).toContain("OPEN");
      expect(formatted).toContain("opened");
      expect(formatted).toContain("closes in");
    });

    it("returns time remaining until circuit closes", () => {
      // Open the circuit breaker
      for (let i = 0; i < 3; i++) {
        circuitBreaker.recordFailure();
      }

      // Immediately after opening, should be close to openDurationMs
      const timeRemaining = circuitBreaker.getTimeUntilClose();
      expect(timeRemaining).toBeDefined();
      expect(timeRemaining).toBeGreaterThan(29000); // ~30s minus small delta
      expect(timeRemaining).toBeLessThanOrEqual(30000);
    });

    it("returns undefined for non-OPEN states", () => {
      expect(circuitBreaker.getTimeUntilClose()).toBeUndefined();

      circuitBreaker.recordFailure();
      circuitBreaker.recordFailure();
      circuitBreaker.recordFailure();

      expect(circuitBreaker.getState()).toBe("open");
      const timeRemaining = circuitBreaker.getTimeUntilClose();
      expect(timeRemaining).toBeDefined();

      // Transition to HALF-OPEN
      vi.spyOn(Date, "now").mockReturnValue(new Date("2024-01-01T00:00:31.000Z").getTime());
      circuitBreaker.getState();

      expect(circuitBreaker.getTimeUntilClose()).toBeUndefined();
    });
  });

  describe("Jitter prevents thundering herd", () => {
    it("adds random jitter to each retry delay", async () => {
      const operation = vi.fn();
      operation.mockRejectedValueOnce(new Error("Fail 1")).mockResolvedValue("success");

      // Mock delay to capture values
      const delays: number[] = [];
      vi.spyOn(retryService as any, "delay").mockImplementation((...args: unknown[]) => {
        delays.push(args[0] as number);
        return Promise.resolve();
      });

      await retryService.execute(operation, {
        isRetryable: () => true,
        maxAttempts: 5,
      });

      expect(delays).toHaveLength(1);
      // Should be 1000ms ± 10% jitter
      expect(delays[0]).toBeGreaterThanOrEqual(900);
      expect(delays[0]).toBeLessThanOrEqual(1100);
    });
  });

  describe("Error context preservation", () => {
    it("attaches retry history to error", async () => {
      const operation = vi.fn();
      operation.mockRejectedValue(new Error("Failed"));

      try {
        await retryService.execute(operation, {
          isRetryable: () => true,
          maxAttempts: 3,
        });
      } catch (error) {
        const retryError = error as {
          retryHistory: Array<{ attempt: number; error: string; delay: number }>;
        };
        expect(retryError.retryHistory).toBeDefined();
        expect(retryError.retryHistory).toHaveLength(3); // 3 attempts
        expect(retryError.retryHistory[0].attempt).toBe(1);
        expect(retryError.retryHistory[0].delay).toBeGreaterThan(0);
      }
    });
  });

  describe("Non-retryable errors with DLQ indicator", () => {
    it("logs non-retryable errors appropriately", async () => {
      const operation = vi.fn();
      operation.mockRejectedValue(new Error("Authentication failed"));

      const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      try {
        await retryService.execute(operation, {
          isRetryable: () => false,
          maxAttempts: 3,
        });
      } catch {
        // Expected
      }

      expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("Non-retryable error"));
      expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("Authentication failed"));

      errorSpy.mockRestore();
    });
  });
});
