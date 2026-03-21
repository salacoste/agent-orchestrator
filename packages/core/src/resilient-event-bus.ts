/**
 * Resilient Event Bus — wraps an EventBus with circuit breaker + retry logic
 *
 * Provides:
 * - Automatic retry with exponential backoff on transient publish failures
 * - Circuit breaker protection to fast-fail when event bus is persistently down
 * - Failure isolation — publish errors never propagate to the caller
 * - Passthrough for all non-publish methods (subscribe, isConnected, etc.)
 */

import { createRetryService, type RetryServiceConfig } from "./retry-service.js";
import { SILENT_LOGGER, type CircuitBreakerManager } from "./circuit-breaker-manager.js";
import type { DeadLetterQueueService } from "./dead-letter-queue.js";
import type { EventBus, EventSubscriber } from "./types.js";

/** Dependencies for creating a resilient event bus */
export interface ResilientEventBusDeps {
  /** The underlying event bus to wrap */
  inner: EventBus;
  /** Circuit breaker manager for obtaining the event-bus breaker */
  circuitBreakerManager: CircuitBreakerManager;
  /** Optional retry configuration overrides */
  retryConfig?: Partial<RetryServiceConfig>;
  /** Optional DLQ — when provided, open-circuit events are queued instead of dropped */
  dlq?: DeadLetterQueueService;
}

/** Resilient event bus interface (same as EventBus) */
export type ResilientEventBus = EventBus;

/** Default retry config for event bus operations */
const DEFAULT_EVENT_BUS_RETRY: RetryServiceConfig = {
  maxAttempts: 5,
  initialBackoffMs: 500,
  maxBackoffMs: 30000,
  jitterPercent: 0.1,
};

/**
 * Create a resilient event bus wrapper
 */
export function createResilientEventBus(deps: ResilientEventBusDeps): ResilientEventBus {
  const { inner, circuitBreakerManager, dlq } = deps;
  const retryConfig = { ...DEFAULT_EVENT_BUS_RETRY, ...deps.retryConfig };
  const retryService = createRetryService({ config: retryConfig });
  const breaker = circuitBreakerManager.getBreaker("event-bus");

  return {
    get name() {
      return inner.name;
    },

    // Records one circuit breaker failure per logical publish call (not per retry attempt).
    // A 5-failure-threshold breaker requires 5 separate publish calls that each exhaust all
    // retries before the circuit opens. Errors are swallowed for failure isolation (AC7).
    async publish(event) {
      // Fast-fail if circuit is open
      if (!breaker.allowRequest()) {
        // When DLQ is configured, enqueue instead of silently dropping
        if (dlq) {
          await dlq
            .enqueue({
              operation: "event_publish",
              payload: event,
              failureReason: "Circuit breaker open for event-bus",
              retryCount: 0,
              originalError: { message: "Circuit breaker open", name: "CircuitBreakerOpenError" },
            })
            .catch(() => {
              // DLQ enqueue failure should never propagate
            });
        }
        return;
      }

      try {
        await retryService.execute(() => inner.publish(event), {
          operationName: "event-bus.publish",
          maxAttempts: retryConfig.maxAttempts,
          logger: SILENT_LOGGER,
        });
        breaker.recordSuccess();
      } catch {
        breaker.recordFailure();
      }
    },

    // Passthrough: subscribe does not need resilience wrapping for in-process event bus.
    // If the inner bus becomes network-based, subscribe may need its own retry logic.
    subscribe(callback: EventSubscriber) {
      return inner.subscribe(callback);
    },

    isConnected() {
      return inner.isConnected();
    },

    isDegraded() {
      return inner.isDegraded();
    },

    getQueueSize() {
      return inner.getQueueSize();
    },

    close() {
      return inner.close();
    },
  };
}
