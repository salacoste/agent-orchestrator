/**
 * Tests for RetryService with exponential backoff
 */

import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { createRetryService, type RetryService, type RetryServiceConfig } from "../index.js";

describe("RetryService", () => {
  let retryService: RetryService;

  beforeEach(() => {
    vi.useFakeTimers();
    retryService = createRetryService({
      config: {
        maxAttempts: 7,
        initialBackoffMs: 1000,
        maxBackoffMs: 60000,
      },
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("initialization", () => {
    it("creates service with default config", () => {
      const service = createRetryService({});
      expect(service).toBeDefined();
    });

    it("creates service with custom config", () => {
      const config: Partial<RetryServiceConfig> = {
        maxAttempts: 5,
        initialBackoffMs: 500,
        maxBackoffMs: 30000,
      };
      const service = createRetryService({ config });
      expect(service).toBeDefined();
    });
  });

  describe("exponential backoff", () => {
    beforeEach(() => {
      // Mock the delay function to avoid actual delays
      vi.spyOn(retryService as any, "delay").mockResolvedValue(undefined);
    });

    it("retries with delays: 1s, 2s, 4s, 8s, 16s (with jitter)", async () => {
      const operation = vi.fn();
      // Fail 5 times then succeed
      operation
        .mockRejectedValueOnce(new Error("Transient error 1"))
        .mockRejectedValueOnce(new Error("Transient error 2"))
        .mockRejectedValueOnce(new Error("Transient error 3"))
        .mockRejectedValueOnce(new Error("Transient error 4"))
        .mockRejectedValueOnce(new Error("Transient error 5"))
        .mockResolvedValueOnce("success");

      const delays: number[] = [];
      const delaySpy = vi.spyOn(retryService as any, "delay");
      (delaySpy as any).mockImplementation(async (ms: number) => {
        delays.push(ms);
      });

      const result = await retryService.execute(operation, { isRetryable: () => true });

      expect(operation).toHaveBeenCalledTimes(6); // 5 failures + 1 success
      expect(result).toBe("success");
      expect(delays).toHaveLength(5); // 5 retries

      // Check each delay is within expected range (base ± 10% jitter)
      const expectedDelays = [1000, 2000, 4000, 8000, 16000];
      for (let i = 0; i < delays.length; i++) {
        const expected = expectedDelays[i];
        const minAllowed = expected - expected * 0.1; // -10%
        const maxAllowed = expected + expected * 0.1; // +10%
        expect(delays[i]).toBeGreaterThanOrEqual(minAllowed);
        expect(delays[i]).toBeLessThanOrEqual(maxAllowed);
      }
    });

    it("stops retrying after max attempts", async () => {
      const operation = vi.fn();
      operation.mockRejectedValue(new Error("Always fails"));

      // Mock the delay to avoid test timeout
      vi.spyOn(retryService as any, "delay").mockResolvedValue(undefined);

      await expect(retryService.execute(operation, { isRetryable: () => true })).rejects.toThrow(
        "Always fails",
      );

      expect(operation).toHaveBeenCalledTimes(7); // maxAttempts
    });

    it("does not retry non-retryable errors", async () => {
      const operation = vi.fn();
      operation.mockRejectedValue(new Error("Non-retryable error"));

      await expect(retryService.execute(operation, { isRetryable: () => false })).rejects.toThrow(
        "Non-retryable error",
      );

      expect(operation).toHaveBeenCalledTimes(1); // No retries
    });

    it("respects maxBackoffMs limit (with jitter)", async () => {
      const operation = vi.fn();
      // Fail 6 times to hit max backoff (then succeed on 7th)
      for (let i = 0; i < 6; i++) {
        operation.mockRejectedValueOnce(new Error(`Transient error ${i}`));
      }
      operation.mockResolvedValueOnce("success");

      const delays: number[] = [];
      const delaySpy2 = vi.spyOn(retryService as any, "delay");
      (delaySpy2 as any).mockImplementation(async (ms: number) => {
        delays.push(ms);
      });

      await retryService.execute(operation, { isRetryable: () => true });

      // Expected delays: 1s, 2s, 4s, 8s, 16s, 32s (6 retries)
      // Each with ±10% jitter
      const expectedDelays = [1000, 2000, 4000, 8000, 16000, 32000];
      expect(delays).toHaveLength(6);

      // Check each delay is within expected range (base ± 10% jitter)
      for (let i = 0; i < delays.length; i++) {
        const expected = expectedDelays[i];
        const minAllowed = expected - expected * 0.1; // -10%
        const maxAllowed = expected + expected * 0.1; // +10%
        expect(delays[i]).toBeGreaterThanOrEqual(minAllowed);
        expect(delays[i]).toBeLessThanOrEqual(maxAllowed);
      }

      // Ensure none exceed maxBackoffMs (60000)
      for (const delay of delays) {
        expect(delay).toBeLessThanOrEqual(60000);
      }
    });
  });

  describe("logging", () => {
    it("logs each retry attempt", async () => {
      const operation = vi.fn();
      operation.mockRejectedValueOnce(new Error("Attempt 1")).mockResolvedValueOnce("success");

      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      // Mock the delay function to avoid actual delays
      vi.spyOn(retryService as any, "delay").mockResolvedValue(undefined);

      await retryService.execute(operation, {
        isRetryable: () => true,
        operationName: "testOperation",
      });

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("Retry attempt"));

      consoleSpy.mockRestore();
    });
  });
});
