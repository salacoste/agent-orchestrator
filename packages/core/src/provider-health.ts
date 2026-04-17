/**
 * Provider Health Monitor — Periodic health polling with circuit breaker integration
 *
 * Epic 58, Story 58.6: Provider Health & Graceful Degradation
 *
 * Periodically polls `SessionEnhancementProvider.healthCheck()` and feeds results
 * into a circuit breaker via `CircuitBreakerManager.getBreaker("provider")`.
 * When the breaker trips OPEN, new sessions fall back to RawProvider.
 *
 * Also provides a `CustomHealthCheckRule` for integration with the existing
 * HealthCheckRulesEngine and dashboard SSE notifications.
 */

import type {
  ComponentHealth,
  ProviderHealth,
  ProviderHealthConfig,
  SessionEnhancementProvider,
} from "./types.js";
import {
  createCircuitBreaker,
  type CircuitBreaker,
  type CircuitBreakerState,
} from "./circuit-breaker.js";
import type { CustomHealthCheckRule } from "./health-check-rules.js";

/** Configuration for the provider health monitor */
export interface ProviderHealthMonitorConfig {
  /** The provider to monitor */
  provider: SessionEnhancementProvider;
  /** Circuit breaker to feed health results into */
  breaker: CircuitBreaker;
  /** Health check interval in ms (default: 30000) */
  healthCheckIntervalMs?: number;
}

/** Current status of the provider health monitor */
export interface ProviderHealthStatus {
  /** Current circuit breaker state */
  breakerState: CircuitBreakerState;
  /** Last health check result (null if never checked) */
  lastHealth: ProviderHealth | null;
  /** Whether the monitor is currently running */
  monitoring: boolean;
  /** Number of health checks performed */
  checkCount: number;
}

/** Public interface for the provider health monitor */
export interface ProviderHealthMonitor {
  /** Start periodic health polling */
  start(): void;
  /** Stop periodic health polling */
  stop(): void;
  /** Check if provider is available (breaker allows requests) */
  isProviderAvailable(): boolean;
  /** Get current provider health status */
  getStatus(): ProviderHealthStatus;
  /** Perform a single health check (used by the health check rule) */
  checkNow(): Promise<ProviderHealth>;
}

/**
 * Create a provider health monitor
 */
export function createProviderHealthMonitor(
  config: ProviderHealthMonitorConfig,
): ProviderHealthMonitor {
  const provider = config.provider;
  const breaker = config.breaker;
  const intervalMs = config.healthCheckIntervalMs ?? 30000;

  let timer: ReturnType<typeof setInterval> | undefined;
  let lastHealth: ProviderHealth | null = null;
  let checkCount = 0;
  let monitoring = false;

  async function performCheck(): Promise<ProviderHealth> {
    try {
      const health = await provider.healthCheck();
      lastHealth = health;
      checkCount++;

      if (health.healthy) {
        breaker.recordSuccess();
      } else {
        breaker.recordFailure();
      }

      return health;
    } catch {
      const health: ProviderHealth = {
        healthy: false,
        message: "Health check threw an exception",
        lastCheck: new Date(),
      };
      lastHealth = health;
      checkCount++;
      breaker.recordFailure();
      return health;
    }
  }

  function start(): void {
    if (monitoring) return;
    monitoring = true;
    timer = setInterval(() => {
      void performCheck().catch(() => {
        // Prevent unhandled rejection if performCheck throws
        // synchronously after the catch block above (defensive).
      });
    }, intervalMs);
  }

  function stop(): void {
    if (timer !== undefined) {
      clearInterval(timer);
      timer = undefined;
    }
    monitoring = false;
  }

  function isProviderAvailable(): boolean {
    return breaker.allowRequest();
  }

  function getStatus(): ProviderHealthStatus {
    return {
      breakerState: breaker.getState(),
      lastHealth,
      monitoring,
      checkCount,
    };
  }

  return {
    start,
    stop,
    isProviderAvailable,
    getStatus,
    checkNow: performCheck,
  };
}

/**
 * Bootstrap a provider health monitor from config values.
 *
 * Reads `ProviderHealthConfig` (healthCheckIntervalMs, failureThreshold, openDurationMs)
 * and wires them into a `CircuitBreaker` + `ProviderHealthMonitor`. This ensures the
 * config schema values are actually consumed at runtime.
 *
 * @param provider - The session enhancement provider to monitor
 * @param healthConfig - Health config from SessionEnhancementConfig.health
 * @returns The created monitor (not yet started — caller must call start())
 */
export function bootstrapProviderHealth(
  provider: SessionEnhancementProvider,
  healthConfig?: ProviderHealthConfig,
): ProviderHealthMonitor {
  const failureThreshold = healthConfig?.failureThreshold ?? 3;
  const openDurationMs = healthConfig?.openDurationMs ?? 60000;
  const healthCheckIntervalMs = healthConfig?.healthCheckIntervalMs ?? 30000;

  const breaker = createCircuitBreaker({
    config: { failureThreshold, openDurationMs },
  });

  return createProviderHealthMonitor({
    provider,
    breaker,
    healthCheckIntervalMs,
  });
}

/**
 * Create a CustomHealthCheckRule that checks provider health and maps
 * the result to a ComponentHealth for the HealthCheckRulesEngine.
 *
 * AC #5: Integrates with the existing health check dashboard and SSE notifications.
 *
 * @param provider - The session enhancement provider to check
 * @param component - Component name for the health check result (default: "session-enhancement-provider")
 */
export function createProviderHealthRule(
  provider: SessionEnhancementProvider,
  component: string = "session-enhancement-provider",
): CustomHealthCheckRule {
  return {
    name: component,
    component,
    check: async (): Promise<ComponentHealth> => {
      try {
        const health = await provider.healthCheck();
        return {
          component,
          status: health.healthy ? "healthy" : "unhealthy",
          message: health.healthy
            ? "Provider is healthy"
            : (health.message ?? "Provider health check failed"),
          timestamp: health.lastCheck,
        };
      } catch (err) {
        return {
          component,
          status: "unhealthy",
          message: `Provider health check error: ${err instanceof Error ? err.message : String(err)}`,
          timestamp: new Date(),
        };
      }
    },
    critical: false,
  };
}
