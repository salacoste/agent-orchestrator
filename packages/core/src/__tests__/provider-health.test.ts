/**
 * Unit tests for Story 58.6: Provider Health & Graceful Degradation.
 * Covers: health polling, circuit breaker integration, recovery, fallback,
 *         health check rule integration, config parsing, factory isolation,
 *         bootstrap from config, session-manager fallback integration.
 * AC: #7
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  createProviderHealthMonitor,
  bootstrapProviderHealth,
  createProviderHealthRule,
  type ProviderHealthMonitor,
} from "../provider-health.js";
import type { SessionEnhancementProvider, ProviderHealth, ProviderHealthConfig } from "../types.js";
import { createCircuitBreaker, type CircuitBreaker } from "../circuit-breaker.js";
import {
  registerProviderHealthMonitor,
  getProviderHealthMonitor,
  clearServiceRegistry,
} from "../service-registry.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createMockProvider(): {
  provider: SessionEnhancementProvider;
  setHealth: (healthy: boolean, message?: string) => void;
} {
  let healthResult: ProviderHealth = {
    healthy: true,
    lastCheck: new Date(),
  };

  const provider: SessionEnhancementProvider = {
    name: "mock-provider",
    async install(): Promise<void> {},
    async configure(): Promise<void> {},
    async enhance(session) {
      return session;
    },
    async teardown(): Promise<void> {},
    async healthCheck(): Promise<ProviderHealth> {
      return { ...healthResult };
    },
  };

  return {
    provider,
    setHealth(healthy: boolean, message?: string) {
      healthResult = {
        healthy,
        message,
        lastCheck: new Date(),
      };
    },
  };
}

// ---------------------------------------------------------------------------
// AC #1, #2 — Health polling and circuit breaker integration
// ---------------------------------------------------------------------------

describe("ProviderHealthMonitor", () => {
  let mockProvider: ReturnType<typeof createMockProvider>;
  let breaker: CircuitBreaker;
  let monitor: ProviderHealthMonitor;

  beforeEach(() => {
    vi.useFakeTimers();
    mockProvider = createMockProvider();
    breaker = createCircuitBreaker({ config: { failureThreshold: 3, openDurationMs: 60000 } });
  });

  afterEach(() => {
    monitor?.stop();
    vi.useRealTimers();
  });

  it("records success when provider is healthy", async () => {
    mockProvider.setHealth(true);
    monitor = createProviderHealthMonitor({
      provider: mockProvider.provider,
      breaker,
      healthCheckIntervalMs: 1000,
    });

    monitor.start();
    await vi.advanceTimersByTimeAsync(1100);

    const status = monitor.getStatus();
    expect(status.checkCount).toBe(1);
    expect(status.lastHealth?.healthy).toBe(true);
    expect(breaker.getState()).toBe("closed");
  });

  it("records failure when provider is unhealthy", async () => {
    mockProvider.setHealth(false, "service down");
    monitor = createProviderHealthMonitor({
      provider: mockProvider.provider,
      breaker,
      healthCheckIntervalMs: 1000,
    });

    monitor.start();
    await vi.advanceTimersByTimeAsync(1100);

    expect(breaker.getFailureCount()).toBe(1);
    expect(monitor.getStatus().lastHealth?.healthy).toBe(false);
  });

  it("trips breaker after N consecutive failures", async () => {
    mockProvider.setHealth(false, "service down");
    monitor = createProviderHealthMonitor({
      provider: mockProvider.provider,
      breaker,
      healthCheckIntervalMs: 1000,
    });

    monitor.start();
    // 3 failures = threshold
    await vi.advanceTimersByTimeAsync(3100);

    expect(breaker.getState()).toBe("open");
    expect(monitor.isProviderAvailable()).toBe(false);
  });

  it("does not trip breaker if failures are interspersed with successes", async () => {
    monitor = createProviderHealthMonitor({
      provider: mockProvider.provider,
      breaker,
      healthCheckIntervalMs: 1000,
    });

    monitor.start();

    // Failure, success, failure — never 3 consecutive
    mockProvider.setHealth(false);
    await vi.advanceTimersByTimeAsync(1100);

    mockProvider.setHealth(true);
    await vi.advanceTimersByTimeAsync(1100);

    mockProvider.setHealth(false);
    await vi.advanceTimersByTimeAsync(1100);

    expect(breaker.getState()).toBe("closed");
  });

  // AC #4 — Recovery and restoration
  it("recovers when breaker transitions from OPEN to CLOSED after healthy probe", async () => {
    mockProvider.setHealth(false);
    monitor = createProviderHealthMonitor({
      provider: mockProvider.provider,
      breaker,
      healthCheckIntervalMs: 1000,
    });

    monitor.start();
    // Trip the breaker
    await vi.advanceTimersByTimeAsync(3100);
    expect(breaker.getState()).toBe("open");

    // Wait past cool-down so breaker auto-transitions to HALF-OPEN on next getState()
    await vi.advanceTimersByTimeAsync(61000);
    expect(breaker.getState()).toBe("half-open");

    // Set provider healthy, then use checkNow() to trigger the probe
    mockProvider.setHealth(true);
    await monitor.checkNow();

    expect(breaker.getState()).toBe("closed");
    expect(monitor.isProviderAvailable()).toBe(true);
  });

  it("re-opens breaker if recovery probe fails", async () => {
    mockProvider.setHealth(false);
    monitor = createProviderHealthMonitor({
      provider: mockProvider.provider,
      breaker,
      healthCheckIntervalMs: 1000,
    });

    monitor.start();
    await vi.advanceTimersByTimeAsync(3100);
    expect(breaker.getState()).toBe("open");

    // Wait past cool-down so breaker auto-transitions to HALF-OPEN
    await vi.advanceTimersByTimeAsync(61000);
    expect(breaker.getState()).toBe("half-open");

    // Provider stays unhealthy; probe in half-open should re-open
    await monitor.checkNow();
    expect(breaker.getState()).toBe("open");
  });

  // AC #3 — isProviderAvailable()
  it("returns false when breaker is OPEN", async () => {
    mockProvider.setHealth(false);
    monitor = createProviderHealthMonitor({
      provider: mockProvider.provider,
      breaker,
      healthCheckIntervalMs: 1000,
    });

    monitor.start();
    await vi.advanceTimersByTimeAsync(3100);

    expect(monitor.isProviderAvailable()).toBe(false);
  });

  it("returns true when breaker is CLOSED", () => {
    monitor = createProviderHealthMonitor({
      provider: mockProvider.provider,
      breaker,
      healthCheckIntervalMs: 1000,
    });

    expect(monitor.isProviderAvailable()).toBe(true);
  });

  // Lifecycle
  it("does not start polling twice", async () => {
    mockProvider.setHealth(true);
    monitor = createProviderHealthMonitor({
      provider: mockProvider.provider,
      breaker,
      healthCheckIntervalMs: 1000,
    });

    monitor.start();
    monitor.start(); // Second call should be no-op
    await vi.advanceTimersByTimeAsync(1100);

    expect(monitor.getStatus().checkCount).toBe(1);
  });

  it("stops polling when stop() is called", async () => {
    mockProvider.setHealth(true);
    monitor = createProviderHealthMonitor({
      provider: mockProvider.provider,
      breaker,
      healthCheckIntervalMs: 1000,
    });

    monitor.start();
    await vi.advanceTimersByTimeAsync(1100);
    expect(monitor.getStatus().checkCount).toBe(1);

    monitor.stop();
    await vi.advanceTimersByTimeAsync(2100);
    expect(monitor.getStatus().checkCount).toBe(1); // No additional checks
    expect(monitor.getStatus().monitoring).toBe(false);
  });

  // checkNow
  it("checkNow() performs an immediate health check", async () => {
    mockProvider.setHealth(true);
    monitor = createProviderHealthMonitor({
      provider: mockProvider.provider,
      breaker,
      healthCheckIntervalMs: 30000,
    });

    const health = await monitor.checkNow();
    expect(health.healthy).toBe(true);
    expect(monitor.getStatus().checkCount).toBe(1);
  });

  // Graceful error handling
  it("handles provider healthCheck() throwing an exception", async () => {
    const throwingProvider: SessionEnhancementProvider = {
      name: "thrower",
      async install() {},
      async configure() {},
      async enhance(s) {
        return s;
      },
      async teardown() {},
      async healthCheck(): Promise<ProviderHealth> {
        throw new Error("connection refused");
      },
    };

    monitor = createProviderHealthMonitor({
      provider: throwingProvider,
      breaker,
      healthCheckIntervalMs: 1000,
    });

    monitor.start();
    await vi.advanceTimersByTimeAsync(1100);

    expect(monitor.getStatus().lastHealth?.healthy).toBe(false);
    expect(monitor.getStatus().lastHealth?.message).toContain("exception");
    expect(breaker.getFailureCount()).toBe(1);
  });

  // getStatus
  it("reports correct status before and after monitoring", () => {
    monitor = createProviderHealthMonitor({
      provider: mockProvider.provider,
      breaker,
      healthCheckIntervalMs: 1000,
    });

    const before = monitor.getStatus();
    expect(before.monitoring).toBe(false);
    expect(before.checkCount).toBe(0);
    expect(before.lastHealth).toBeNull();
    expect(before.breakerState).toBe("closed");
  });
});

// ---------------------------------------------------------------------------
// AC #5 — Health check rule integration
// ---------------------------------------------------------------------------

describe("createProviderHealthRule", () => {
  it("maps healthy ProviderHealth to healthy ComponentHealth", async () => {
    const { provider } = createMockProvider();
    const rule = createProviderHealthRule(provider);

    const result = await rule.check();
    expect(result.component).toBe("session-enhancement-provider");
    expect(result.status).toBe("healthy");
    expect(result.message).toContain("healthy");
  });

  it("maps unhealthy ProviderHealth to unhealthy ComponentHealth", async () => {
    const { provider, setHealth } = createMockProvider();
    setHealth(false, "API key expired");
    const rule = createProviderHealthRule(provider);

    const result = await rule.check();
    expect(result.status).toBe("unhealthy");
    expect(result.message).toContain("API key expired");
  });

  it("uses custom component name for both name and component", async () => {
    const { provider } = createMockProvider();
    const rule = createProviderHealthRule(provider, "custom-provider");

    expect(rule.name).toBe("custom-provider");
    const result = await rule.check();
    expect(result.component).toBe("custom-provider");
  });

  it("handles provider throwing during health check", async () => {
    const throwingProvider: SessionEnhancementProvider = {
      name: "thrower",
      async install() {},
      async configure() {},
      async enhance(s) {
        return s;
      },
      async teardown() {},
      async healthCheck(): Promise<ProviderHealth> {
        throw new Error("timeout");
      },
    };

    const rule = createProviderHealthRule(throwingProvider);
    const result = await rule.check();
    expect(result.status).toBe("unhealthy");
    expect(result.message).toContain("timeout");
  });

  it("rule is not marked as critical", () => {
    const { provider } = createMockProvider();
    const rule = createProviderHealthRule(provider);
    expect(rule.critical).toBe(false);
  });

  it("default rule name matches component", () => {
    const { provider } = createMockProvider();
    const rule = createProviderHealthRule(provider);
    expect(rule.name).toBe("session-enhancement-provider");
    expect(rule.name).toBe(rule.component);
  });
});

// ---------------------------------------------------------------------------
// H1 — Bootstrap from config
// ---------------------------------------------------------------------------

describe("bootstrapProviderHealth", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("creates monitor with default config values when no health config provided", () => {
    const { provider } = createMockProvider();
    const monitor = bootstrapProviderHealth(provider);
    expect(monitor).toBeDefined();
    expect(monitor.getStatus().breakerState).toBe("closed");
  });

  it("creates monitor with configured thresholds", async () => {
    vi.useFakeTimers();
    const { provider, setHealth } = createMockProvider();
    const healthConfig: ProviderHealthConfig = {
      healthCheckIntervalMs: 500,
      failureThreshold: 2,
      openDurationMs: 5000,
    };

    const monitor = bootstrapProviderHealth(provider, healthConfig);
    setHealth(false);

    monitor.start();
    // 2 failures = custom threshold
    await vi.advanceTimersByTimeAsync(1100);

    expect(monitor.isProviderAvailable()).toBe(false);
    monitor.stop();
  });

  it("created monitor is independent of other monitors", async () => {
    vi.useFakeTimers();
    const { provider: p1 } = createMockProvider();
    const { provider: p2 } = createMockProvider();

    const m1 = bootstrapProviderHealth(p1, { failureThreshold: 2, healthCheckIntervalMs: 1000 });
    const m2 = bootstrapProviderHealth(p2, { failureThreshold: 2, healthCheckIntervalMs: 1000 });

    // Start only m1
    m1.start();
    await vi.advanceTimersByTimeAsync(1100);

    expect(m1.getStatus().checkCount).toBeGreaterThan(0);
    expect(m2.getStatus().checkCount).toBe(0);

    m1.stop();
  });
});

// ---------------------------------------------------------------------------
// M2 — Service registry cleanup stops monitor
// ---------------------------------------------------------------------------

describe("service registry cleanup", () => {
  it("clearServiceRegistry stops registered monitor", () => {
    const { provider } = createMockProvider();
    const monitor = bootstrapProviderHealth(provider);
    registerProviderHealthMonitor(monitor);
    monitor.start();

    expect(getProviderHealthMonitor()?.getStatus().monitoring).toBe(true);

    clearServiceRegistry();

    // Monitor should have been stopped
    expect(monitor.getStatus().monitoring).toBe(false);
    expect(getProviderHealthMonitor()).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Factory isolation
// ---------------------------------------------------------------------------

describe("factory isolation", () => {
  it("each monitor has independent state", async () => {
    vi.useFakeTimers();
    const { provider: provider1 } = createMockProvider();
    const { provider: provider2 } = createMockProvider();
    const breaker1 = createCircuitBreaker({ config: { failureThreshold: 3 } });
    const breaker2 = createCircuitBreaker({ config: { failureThreshold: 3 } });

    const monitor1 = createProviderHealthMonitor({
      provider: provider1,
      breaker: breaker1,
      healthCheckIntervalMs: 1000,
    });
    const monitor2 = createProviderHealthMonitor({
      provider: provider2,
      breaker: breaker2,
      healthCheckIntervalMs: 1000,
    });

    monitor1.start();
    // Don't start monitor2

    await vi.advanceTimersByTimeAsync(1100);

    expect(monitor1.getStatus().checkCount).toBe(1);
    expect(monitor2.getStatus().checkCount).toBe(0);

    monitor1.stop();
    vi.useRealTimers();
  });
});

// ---------------------------------------------------------------------------
// M3 — Session-manager fallback integration
// ---------------------------------------------------------------------------

describe("session-manager fallback integration", () => {
  afterEach(() => {
    clearServiceRegistry();
    vi.useRealTimers();
  });

  it("isProviderAvailable=false causes session-manager to use raw fallback path", async () => {
    // Register a health monitor with an OPEN breaker
    const { provider, setHealth } = createMockProvider();
    vi.useFakeTimers();
    const monitor = bootstrapProviderHealth(provider, {
      failureThreshold: 1,
      healthCheckIntervalMs: 1000,
    });
    registerProviderHealthMonitor(monitor);

    // Trip the breaker
    setHealth(false);
    monitor.start();
    await vi.advanceTimersByTimeAsync(1100);
    expect(monitor.isProviderAvailable()).toBe(false);

    // Simulate the session-manager check logic
    const activeProviderName: string = "omc";
    let providerFallback = false;

    if (activeProviderName !== "raw") {
      const healthMon = getProviderHealthMonitor();
      if (healthMon && !healthMon.isProviderAvailable()) {
        providerFallback = true;
      }
    }

    expect(providerFallback).toBe(true);
    monitor.stop();
  });

  it("isProviderAvailable=true does not trigger fallback", () => {
    const { provider, setHealth } = createMockProvider();
    setHealth(true);
    const monitor = bootstrapProviderHealth(provider);
    registerProviderHealthMonitor(monitor);

    expect(monitor.isProviderAvailable()).toBe(true);

    const activeProviderName: string = "omc";
    let providerFallback = false;

    if (activeProviderName !== "raw") {
      const healthMon = getProviderHealthMonitor();
      if (healthMon && !healthMon.isProviderAvailable()) {
        providerFallback = true;
      }
    }

    expect(providerFallback).toBe(false);
  });

  it("no registered monitor does not trigger fallback", () => {
    clearServiceRegistry();

    const activeProviderName: string = "omc";
    let providerFallback = false;

    if (activeProviderName !== "raw") {
      const healthMon = getProviderHealthMonitor();
      if (healthMon && !healthMon.isProviderAvailable()) {
        providerFallback = true;
      }
    }

    expect(providerFallback).toBe(false);
  });
});
