/**
 * Resilient Service Wrapper — generic circuit breaker + retry composition
 *
 * Provides:
 * - withResilience<T>() — wraps any async operation with circuit breaker + retry
 * - Service-specific breaker instances (tracker, scm, notifier)
 * - Fast-fail when circuit is open
 * - Automatic success/failure recording on circuit breaker
 */

import { createRetryService, type RetryService, type RetryServiceConfig } from "./retry-service.js";
import { SILENT_LOGGER, type CircuitBreakerManager } from "./circuit-breaker-manager.js";
import type { DeadLetterQueueService } from "./dead-letter-queue.js";

/** Dependencies for resilient operations */
export interface ResilienceDeps {
  /** Circuit breaker manager for obtaining service-specific breakers */
  circuitBreakerManager: CircuitBreakerManager;
  /** Optional retry configuration overrides */
  retryConfig?: Partial<RetryServiceConfig>;
  /** Optional DLQ — when provided, open-circuit operations are queued instead of throwing */
  dlq?: DeadLetterQueueService;
  /** Operation type for DLQ entries (required when dlq is provided) */
  operationType?: string;
}

/** Default retry config for service operations */
const DEFAULT_SERVICE_RETRY: RetryServiceConfig = {
  maxAttempts: 3,
  initialBackoffMs: 1000,
  maxBackoffMs: 60000,
  jitterPercent: 0.1,
};

/** Cached RetryService instances per config fingerprint to avoid per-call allocation */
const retryServiceCache = new Map<string, RetryService>();

/** Clear the retry service cache (for testing and shutdown cleanup) */
export function clearRetryServiceCache(): void {
  retryServiceCache.clear();
}

function getRetryService(config: RetryServiceConfig): RetryService {
  const key = `${config.maxAttempts}:${config.initialBackoffMs}:${config.maxBackoffMs}:${config.jitterPercent}`;
  const cached = retryServiceCache.get(key);
  if (cached) {
    return cached;
  }
  const service = createRetryService({ config });
  retryServiceCache.set(key, service);
  return service;
}

/**
 * Execute an async operation with circuit breaker + retry protection.
 *
 * Records one circuit breaker failure per logical call (not per retry attempt),
 * so a 5-failure-threshold breaker requires 5 separate withResilience calls
 * that each exhaust all retries before the circuit opens.
 *
 * @param operation - The async operation to execute
 * @param serviceName - Name of the service (used to obtain the circuit breaker)
 * @param deps - Dependencies (circuit breaker manager, retry config)
 * @returns The operation result
 * @throws When circuit is open or all retries are exhausted
 */
export async function withResilience<T>(
  operation: () => Promise<T>,
  serviceName: string,
  deps: ResilienceDeps,
): Promise<T | undefined> {
  const breaker = deps.circuitBreakerManager.getBreaker(serviceName);

  // Fast-fail if circuit is open
  if (!breaker.allowRequest()) {
    // When DLQ is configured, enqueue instead of throwing
    if (deps.dlq) {
      await deps.dlq
        .enqueue({
          operation: deps.operationType ?? serviceName,
          payload: { serviceName },
          failureReason: `Circuit breaker open for ${serviceName}`,
          retryCount: 0,
          originalError: { message: "Circuit breaker open", name: "CircuitBreakerOpenError" },
        })
        .catch(() => {
          // DLQ enqueue failure should never propagate
        });
      return undefined;
    }
    throw new Error(`Circuit breaker is open for service: ${serviceName}`);
  }

  const retryConfig = { ...DEFAULT_SERVICE_RETRY, ...deps.retryConfig };
  const retryService = getRetryService(retryConfig);

  try {
    const result = await retryService.execute(operation, {
      operationName: `${serviceName}.operation`,
      maxAttempts: retryConfig.maxAttempts,
      logger: SILENT_LOGGER,
    });
    breaker.recordSuccess();
    return result;
  } catch (error) {
    breaker.recordFailure();
    throw error;
  }
}
