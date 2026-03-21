/**
 * Circuit Breaker Manager — creates and manages named circuit breaker instances per service
 *
 * Provides:
 * - Named breaker instances (event-bus, tracker, scm, notifier)
 * - Service-specific configuration overrides
 * - Aggregate state view for health monitoring
 * - Event publishing on state transitions (with circular publishing guard for event-bus)
 * - Bulk reset and cleanup
 */

import {
  createCircuitBreaker,
  type CircuitBreaker,
  type CircuitBreakerConfig,
  type CircuitBreakerState,
} from "./circuit-breaker.js";
import type { EventBus } from "./types.js";

/** State snapshot for a single breaker */
export interface BreakerStateSnapshot {
  state: CircuitBreakerState;
  failureCount: number;
  lastFailureTime: number | undefined;
  openedAt: number | undefined;
}

/** Configuration for the manager */
export interface CircuitBreakerManagerConfig {
  /** EventBus for publishing state transition events */
  eventBus?: EventBus;
  /** Per-service circuit breaker config overrides */
  serviceConfigs?: Record<string, Partial<CircuitBreakerConfig>>;
}

/** Public interface for the manager */
export interface CircuitBreakerManager {
  /** Get or create a named circuit breaker for a service */
  getBreaker(serviceName: string): CircuitBreaker;
  /** Get state snapshots for all managed breakers */
  getAllStates(): Record<string, BreakerStateSnapshot>;
  /** Reset all breakers to closed state */
  resetAll(): void;
  /** Close the manager and clear all breakers */
  close(): void;
}

/**
 * Create a circuit breaker manager
 */
export function createCircuitBreakerManager(
  config: CircuitBreakerManagerConfig = {},
): CircuitBreakerManager {
  return new CircuitBreakerManagerImpl(config);
}

/** Silent logger to suppress internal console output from circuit breakers and retry services */
export const SILENT_LOGGER: Pick<Console, "log" | "warn" | "error" | "info"> = {
  log() {},
  warn() {},
  error() {},
  info() {},
};

class CircuitBreakerManagerImpl implements CircuitBreakerManager {
  private breakers = new Map<string, CircuitBreaker>();
  private eventBus?: EventBus;
  private readonly serviceConfigs: Record<string, Partial<CircuitBreakerConfig>>;

  constructor(config: CircuitBreakerManagerConfig) {
    this.eventBus = config.eventBus;
    this.serviceConfigs = config.serviceConfigs ?? {};
  }

  getBreaker(serviceName: string): CircuitBreaker {
    const existing = this.breakers.get(serviceName);
    if (existing) {
      return existing;
    }

    const serviceConfig = this.serviceConfigs[serviceName] ?? {};
    const breaker = createCircuitBreaker({
      config: {
        ...serviceConfig,
        // Use silent logger unless the caller provided one — prevents noisy console output
        // when multiple services have breakers transitioning simultaneously
        logger: serviceConfig.logger ?? SILENT_LOGGER,
        onStateChange: (oldState, newState) => {
          // Call user-provided callback if any
          serviceConfig.onStateChange?.(oldState, newState);
          // Publish event (with circular guard for event-bus)
          this.publishStateChange(serviceName, oldState, newState, breaker);
        },
      },
    });

    this.breakers.set(serviceName, breaker);
    return breaker;
  }

  getAllStates(): Record<string, BreakerStateSnapshot> {
    const states: Record<string, BreakerStateSnapshot> = {};
    for (const [name, breaker] of this.breakers.entries()) {
      states[name] = {
        state: breaker.getState(),
        failureCount: breaker.getFailureCount(),
        lastFailureTime: breaker.getLastFailureTime(),
        openedAt: breaker.getOpenedAt(),
      };
    }
    return states;
  }

  resetAll(): void {
    for (const breaker of this.breakers.values()) {
      breaker.reset();
    }
  }

  close(): void {
    // Clear event bus reference first to prevent spurious "circuit recovered"
    // events being published during shutdown when reset() transitions open→closed
    this.eventBus = undefined;
    for (const breaker of this.breakers.values()) {
      breaker.reset();
    }
    this.breakers.clear();
  }

  private publishStateChange(
    serviceName: string,
    oldState: CircuitBreakerState,
    newState: CircuitBreakerState,
    breaker: CircuitBreaker,
  ): void {
    // Circular publishing guard: event-bus breaker must NOT publish through the event bus
    if (serviceName === "event-bus") {
      return;
    }

    if (!this.eventBus) {
      return;
    }

    // Fire-and-forget: never let event publishing failures propagate
    void this.eventBus
      .publish({
        eventType: "circuit.state-changed",
        metadata: {
          serviceName,
          oldState,
          newState,
          failureCount: breaker.getFailureCount(),
          openedAt: breaker.getOpenedAt(),
          timeUntilClose: breaker.getTimeUntilClose(),
        },
      })
      .catch(() => {
        // Silently swallow — event publishing is best-effort
      });
  }
}
