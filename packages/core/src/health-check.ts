/**
 * Health Check Service
 *
 * Monitors system health across all components including:
 * - Event bus (connection, latency, queue depth)
 * - BMAD tracker (availability)
 * - Local state (file access, integrity)
 * - Agent registry (active agents)
 *
 * Provides configurable thresholds, watch mode, and proper exit codes.
 * Includes rate limiting to prevent health check spam.
 */

import type {
  ComponentHealth,
  HealthCheckConfig,
  HealthCheckResult,
  HealthCheckService,
  HealthStatus,
  LifecycleManager,
} from "./types.js";
import { access, readdir } from "node:fs/promises";
import { constants } from "node:fs";

const DEFAULT_CHECK_INTERVAL_MS = 30000; // 30 seconds
const DEFAULT_MAX_LATENCY_MS = 1000; // 1 second
const DEFAULT_MAX_QUEUE_DEPTH = 100;
const DEFAULT_MIN_CHECK_INTERVAL_MS = 1000; // 1 second minimum between checks
const DEFAULT_RATE_LIMIT_WINDOW_MS = 60000; // 1 minute window for rate limiting
const DEFAULT_MAX_CHECKS_PER_WINDOW = 60; // Max 60 checks per minute (1 per second average)

/**
 * Health Check Service Implementation
 */
export class HealthCheckServiceImpl implements HealthCheckService {
  private config: HealthCheckConfig;
  private currentStatus: HealthCheckResult | null = null;
  private previousOverallStatus: HealthStatus | null = null;
  private checkInterval?: ReturnType<typeof setInterval>;
  private startTime: Date;
  // Rate limiting state
  private lastCheckTime = 0;
  private checkTimestamps: number[] = [];
  private readonly minCheckIntervalMs: number;
  private readonly rateLimitWindowMs: number;
  private readonly maxChecksPerWindow: number;

  constructor(config: HealthCheckConfig) {
    // Validate thresholds
    if (config.thresholds) {
      if (config.thresholds.maxLatencyMs !== undefined && config.thresholds.maxLatencyMs < 0) {
        throw new Error("maxLatencyMs must be non-negative");
      }
      if (config.thresholds.maxQueueDepth !== undefined && config.thresholds.maxQueueDepth < 0) {
        throw new Error("maxQueueDepth must be non-negative");
      }
    }

    this.config = config;
    this.startTime = new Date();
    // Rate limiting configuration
    this.minCheckIntervalMs = config.minCheckIntervalMs ?? DEFAULT_MIN_CHECK_INTERVAL_MS;
    this.rateLimitWindowMs = config.rateLimitWindowMs ?? DEFAULT_RATE_LIMIT_WINDOW_MS;
    this.maxChecksPerWindow = config.maxChecksPerWindow ?? DEFAULT_MAX_CHECKS_PER_WINDOW;
  }

  /**
   * Prune check timestamps older than the rate limit window
   */
  private pruneOldCheckTimestamps(now: number): void {
    const cutoff = now - this.rateLimitWindowMs;
    this.checkTimestamps = this.checkTimestamps.filter((ts) => ts >= cutoff);
  }

  /**
   * Check if rate limiting is in effect
   */
  isRateLimited(): boolean {
    const now = Date.now();
    this.pruneOldCheckTimestamps(now);
    return this.checkTimestamps.length >= this.maxChecksPerWindow;
  }

  /**
   * Get current rate limit status
   */
  getRateLimitStatus(): { checksInWindow: number; maxChecks: number; windowMs: number } {
    const now = Date.now();
    this.pruneOldCheckTimestamps(now);
    return {
      checksInWindow: this.checkTimestamps.length,
      maxChecks: this.maxChecksPerWindow,
      windowMs: this.rateLimitWindowMs,
    };
  }

  /**
   * Run all health checks
   * Implements rate limiting to prevent check spam
   */
  async check(): Promise<HealthCheckResult> {
    const now = Date.now();

    // Rate limit check: enforce minimum interval between checks
    if (now - this.lastCheckTime < this.minCheckIntervalMs) {
      // Return cached status if available
      if (this.currentStatus) {
        return this.currentStatus;
      }
    }

    // Rate limit check: enforce max checks per time window
    this.pruneOldCheckTimestamps(now);
    if (this.checkTimestamps.length >= this.maxChecksPerWindow) {
      // Return cached status or create a rate-limited response
      if (this.currentStatus) {
        return {
          ...this.currentStatus,
          rateLimited: true,
          rateLimitMessage: `Rate limit exceeded: ${this.maxChecksPerWindow} checks per ${this.rateLimitWindowMs / 1000}s`,
        };
      }
    }

    // Record this check
    this.lastCheckTime = now;
    this.checkTimestamps.push(now);

    const components: ComponentHealth[] = [];

    // Check Event Bus
    if (this.config.eventBus) {
      components.push(await this.checkEventBus());
    }

    // Check BMAD Tracker
    if (this.config.bmadTracker) {
      components.push(await this.checkBmadTracker());
    }

    // Check Local State (via StateManager)
    if (this.config.stateManager) {
      components.push(await this.checkLocalState());
    }

    // Check Agent Registry
    if (this.config.agentRegistry) {
      components.push(await this.checkAgentRegistry());
    }

    // Check Data Directory (agent registry file availability)
    if (this.config.dataDir) {
      components.push(await this.checkDataDir());
    }

    // Check Lifecycle Manager
    if (this.config.lifecycleManager) {
      components.push(await this.checkLifecycleManager());
    }

    // Check Circuit Breakers
    if (this.config.circuitBreakerStates) {
      components.push(this.checkCircuitBreakers());
    }

    // Check Dead Letter Queue
    if (this.config.dlq) {
      components.push(await this.checkDLQ());
    }

    // Run custom checks from rules engine (if configured)
    if (this.config.rulesEngine) {
      try {
        const customChecks = await this.config.rulesEngine.runCustomChecks();
        components.push(...customChecks);
      } catch {
        // Custom check failures should not break health check
      }
    }

    // Aggregate: use weighted scoring if rules engine available, otherwise simple hierarchy
    let result: HealthCheckResult;
    if (this.config.rulesEngine) {
      try {
        result = this.config.rulesEngine.aggregateWithWeights(components);
      } catch {
        result = this.aggregateHealth(components);
      }
    } else {
      result = this.aggregateHealth(components);
    }
    this.currentStatus = result;

    // Publish health status transition event if status changed
    if (
      this.config.eventBus &&
      this.config.alertOnTransition !== false &&
      this.previousOverallStatus !== null &&
      this.previousOverallStatus !== result.overall
    ) {
      this.config.eventBus
        .publish({
          eventType: "health.status_changed",
          metadata: {
            from: this.previousOverallStatus,
            to: result.overall,
            components: result.components.map((c) => ({
              component: c.component,
              status: c.status,
              message: c.message,
            })),
          },
        })
        .catch(() => {
          // Health transition notification failure should never propagate
        });
    }
    this.previousOverallStatus = result.overall;

    return result;
  }

  /**
   * Check health of a specific component
   */
  async checkComponent(component: string): Promise<ComponentHealth> {
    switch (component) {
      case "event-bus":
        if (this.config.eventBus) {
          return this.checkEventBus();
        }
        break;
      case "bmad-tracker":
        if (this.config.bmadTracker) {
          return this.checkBmadTracker();
        }
        break;
      case "local-state":
        if (this.config.stateManager) {
          return this.checkLocalState();
        }
        break;
      case "agent-registry":
        if (this.config.agentRegistry) {
          return this.checkAgentRegistry();
        }
        break;
      case "data-dir":
        if (this.config.dataDir) {
          return this.checkDataDir();
        }
        break;
      case "lifecycle-manager":
        if (this.config.lifecycleManager) {
          return this.checkLifecycleManager();
        }
        break;
      case "circuit-breakers":
        if (this.config.circuitBreakerStates) {
          return this.checkCircuitBreakers();
        }
        break;
      case "dlq":
        if (this.config.dlq) {
          return this.checkDLQ();
        }
        break;
    }

    return {
      component,
      status: "unhealthy",
      message: `Component "${component}" not configured or unknown`,
      timestamp: new Date(),
    };
  }

  /**
   * Get current health status
   */
  getStatus(): HealthCheckResult {
    if (!this.currentStatus) {
      return {
        overall: "healthy",
        components: [],
        timestamp: new Date(),
        exitCode: 0,
      };
    }
    return { ...this.currentStatus };
  }

  /**
   * Start periodic health checks
   */
  async start(): Promise<void> {
    const interval = this.config.checkIntervalMs ?? DEFAULT_CHECK_INTERVAL_MS;

    // Run initial check
    await this.check();

    // Start periodic checks
    this.checkInterval = setInterval(async () => {
      await this.check();
    }, interval);
  }

  /**
   * Stop health checks and cleanup
   */
  async stop(): Promise<void> {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = undefined;
    }
  }

  /**
   * Close health check service
   */
  async close(): Promise<void> {
    await this.stop();
  }

  // ===========================================================================
  // Component Health Checks
  // ===========================================================================

  /**
   * Check Event Bus health
   */
  private async checkEventBus(): Promise<ComponentHealth> {
    const eventBus = this.config.eventBus;
    if (!eventBus) {
      return {
        component: "Event Bus",
        status: "unhealthy",
        message: "Not configured",
        timestamp: new Date(),
      };
    }

    try {
      // Check connection status
      const connected = eventBus.isConnected();
      if (!connected) {
        return {
          component: "Event Bus",
          status: "unhealthy",
          message: "Not connected",
          timestamp: new Date(),
        };
      }

      // Check degraded mode
      if (eventBus.isDegraded()) {
        return {
          component: "Event Bus",
          status: "degraded",
          message: "Operating in degraded mode",
          timestamp: new Date(),
        };
      }

      // Check queue depth
      const queueDepth = eventBus.getQueueSize();
      const maxQueueDepth = this.config.thresholds?.maxQueueDepth ?? DEFAULT_MAX_QUEUE_DEPTH;
      if (queueDepth > maxQueueDepth) {
        return {
          component: "Event Bus",
          status: "degraded",
          message: `Queue depth high: ${queueDepth}/${maxQueueDepth}`,
          latencyMs: 0,
          details: [`Consider draining events or increasing threshold`],
          timestamp: new Date(),
        };
      }

      // Measure latency by pinging the event bus
      let latencyMs = 0;
      if (eventBus.ping) {
        const measuredLatency = await eventBus.ping();
        latencyMs = measuredLatency ?? 0;
      }

      const maxLatency = this.config.thresholds?.maxLatencyMs ?? DEFAULT_MAX_LATENCY_MS;
      if (latencyMs > maxLatency) {
        return {
          component: "Event Bus",
          status: "degraded",
          message: `High latency: ${latencyMs}ms`,
          latencyMs,
          details: [`Threshold: ${maxLatency}ms`],
          timestamp: new Date(),
        };
      }

      return {
        component: "Event Bus",
        status: "healthy",
        message: "Connected",
        latencyMs,
        timestamp: new Date(),
      };
    } catch (error) {
      return {
        component: "Event Bus",
        status: "unhealthy",
        message: `Health check failed: ${error instanceof Error ? error.message : String(error)}`,
        timestamp: new Date(),
      };
    }
  }

  /**
   * Check BMAD Tracker health
   */
  private async checkBmadTracker(): Promise<ComponentHealth> {
    const tracker = this.config.bmadTracker;
    if (!tracker) {
      return {
        component: "BMAD Tracker",
        status: "unhealthy",
        message: "Not configured",
        timestamp: new Date(),
      };
    }

    try {
      const startTime = Date.now();
      const available = await tracker.isAvailable();
      const latencyMs = Date.now() - startTime;

      if (!available) {
        return {
          component: "BMAD Tracker",
          status: "unhealthy",
          message: "Not available",
          timestamp: new Date(),
        };
      }

      const maxLatency = this.config.thresholds?.maxLatencyMs ?? DEFAULT_MAX_LATENCY_MS;
      if (latencyMs > maxLatency) {
        return {
          component: "BMAD Tracker",
          status: "degraded",
          message: `High latency: ${latencyMs}ms`,
          latencyMs,
          details: [`Threshold: ${maxLatency}ms`],
          timestamp: new Date(),
        };
      }

      return {
        component: "BMAD Tracker",
        status: "healthy",
        message: "Available",
        latencyMs,
        timestamp: new Date(),
      };
    } catch (error) {
      return {
        component: "BMAD Tracker",
        status: "unhealthy",
        message: `Health check failed: ${error instanceof Error ? error.message : String(error)}`,
        timestamp: new Date(),
      };
    }
  }

  /**
   * Check Local State health
   */
  private async checkLocalState(): Promise<ComponentHealth> {
    const stateManager = this.config.stateManager;
    if (!stateManager) {
      return {
        component: "Local State",
        status: "unhealthy",
        message: "Not configured",
        timestamp: new Date(),
      };
    }

    try {
      const yamlPath = (stateManager as { yamlPath?: string }).yamlPath;
      if (!yamlPath) {
        return {
          component: "Local State",
          status: "healthy",
          message: "State manager has no YAML path (in-memory mode)",
          timestamp: new Date(),
        };
      }

      // Check file accessibility
      try {
        await access(yamlPath, constants.R_OK);
      } catch (error) {
        return {
          component: "Local State",
          status: "unhealthy",
          message: `Cannot access YAML file: ${error instanceof Error ? error.message : String(error)}`,
          timestamp: new Date(),
        };
      }

      // Validate YAML integrity
      const verifyFn = (
        stateManager as { verify?: () => Promise<{ valid: boolean; error?: string }> }
      ).verify;
      if (verifyFn) {
        const health = await verifyFn();
        if (!health.valid) {
          return {
            component: "Local State",
            status: "unhealthy",
            message: `YAML validation failed: ${health.error || "Unknown error"}`,
            timestamp: new Date(),
          };
        }
      }

      return {
        component: "Local State",
        status: "healthy",
        message: "File accessible and valid",
        timestamp: new Date(),
      };
    } catch (error) {
      return {
        component: "Local State",
        status: "unhealthy",
        message: `Health check failed: ${error instanceof Error ? error.message : String(error)}`,
        timestamp: new Date(),
      };
    }
  }

  /**
   * Check Agent Registry health
   */
  private async checkAgentRegistry(): Promise<ComponentHealth> {
    const registry = this.config.agentRegistry;
    if (!registry) {
      return {
        component: "Agent Registry",
        status: "unhealthy",
        message: "Not configured",
        timestamp: new Date(),
      };
    }

    try {
      // Try to get active agents count
      const getActiveAgentsFn = (registry as { getActiveAgents?: () => Promise<number> })
        .getActiveAgents;

      if (getActiveAgentsFn) {
        const count = await getActiveAgentsFn();
        return {
          component: "Agent Registry",
          status: "healthy",
          message: `${count} active agents`,
          details: [`${count} agents registered`],
          timestamp: new Date(),
        };
      }

      // Registry doesn't support getting active count, just check availability
      return {
        component: "Agent Registry",
        status: "healthy",
        message: "Available",
        timestamp: new Date(),
      };
    } catch (error) {
      return {
        component: "Agent Registry",
        status: "unhealthy",
        message: `Health check failed: ${error instanceof Error ? error.message : String(error)}`,
        timestamp: new Date(),
      };
    }
  }

  /**
   * Check Data Directory health (agent registry file availability)
   */
  private async checkDataDir(): Promise<ComponentHealth> {
    const dataDir = this.config.dataDir;
    if (!dataDir) {
      return {
        component: "Data Directory",
        status: "unhealthy",
        message: "Not configured",
        timestamp: new Date(),
      };
    }

    try {
      // Check if data directory exists and is readable
      await access(dataDir, constants.R_OK);

      // Check if we can list the directory contents
      const files = await readdir(dataDir);
      const sessionCount = files.filter((f) => f.endsWith(".meta")).length;

      return {
        component: "Data Directory",
        status: "healthy",
        message: `Directory accessible (${sessionCount} session files)`,
        details: [`Path: ${dataDir}`],
        timestamp: new Date(),
      };
    } catch (error) {
      return {
        component: "Data Directory",
        status: "unhealthy",
        message: `Cannot access data directory: ${error instanceof Error ? error.message : String(error)}`,
        details: [`Path: ${dataDir}`],
        timestamp: new Date(),
      };
    }
  }

  /**
   * Check Lifecycle Manager health
   */
  private async checkLifecycleManager(): Promise<ComponentHealth> {
    const lifecycleManager = this.config.lifecycleManager as LifecycleManager | undefined;
    if (!lifecycleManager) {
      return {
        component: "Lifecycle Manager",
        status: "unhealthy",
        message: "Not configured",
        timestamp: new Date(),
      };
    }

    try {
      // Get session states count
      const states = lifecycleManager.getStates();
      const sessionCount = states.size;

      // Check degraded mode status if available
      const degradedStatus = lifecycleManager.getDegradedModeStatus?.();
      if (degradedStatus && degradedStatus.mode !== "normal") {
        // Get unavailable services from the services record
        const unavailableServices = Object.entries(degradedStatus.services)
          .filter(([, availability]) => !availability.available)
          .map(([service]) => service);

        return {
          component: "Lifecycle Manager",
          status: "degraded",
          message: `Operating in degraded mode (${sessionCount} sessions)`,
          details: unavailableServices.map((s) => `Service unavailable: ${s}`),
          timestamp: new Date(),
        };
      }

      return {
        component: "Lifecycle Manager",
        status: "healthy",
        message: `Running (${sessionCount} active sessions)`,
        timestamp: new Date(),
      };
    } catch (error) {
      return {
        component: "Lifecycle Manager",
        status: "unhealthy",
        message: `Health check failed: ${error instanceof Error ? error.message : String(error)}`,
        timestamp: new Date(),
      };
    }
  }

  /**
   * Check Circuit Breaker health
   */
  private checkCircuitBreakers(): ComponentHealth {
    const states = this.config.circuitBreakerStates;
    if (!states || Object.keys(states).length === 0) {
      return {
        component: "Circuit Breakers",
        status: "healthy",
        message: "No circuit breakers registered",
        timestamp: new Date(),
      };
    }

    const entries = Object.entries(states);
    const openBreakers = entries.filter(([, s]) => s.state === "open");
    const halfOpenBreakers = entries.filter(([, s]) => s.state === "half-open");

    if (openBreakers.length > 0) {
      return {
        component: "Circuit Breakers",
        status: "degraded",
        message: `${openBreakers.length}/${entries.length} circuit(s) open`,
        details: openBreakers.map(([name]) => `${name}: OPEN`),
        timestamp: new Date(),
      };
    }

    if (halfOpenBreakers.length > 0) {
      return {
        component: "Circuit Breakers",
        status: "degraded",
        message: `${halfOpenBreakers.length}/${entries.length} circuit(s) half-open`,
        details: halfOpenBreakers.map(([name]) => `${name}: HALF-OPEN`),
        timestamp: new Date(),
      };
    }

    return {
      component: "Circuit Breakers",
      status: "healthy",
      message: `All ${entries.length} circuit(s) closed`,
      timestamp: new Date(),
    };
  }

  /**
   * Check Dead Letter Queue health
   */
  private async checkDLQ(): Promise<ComponentHealth> {
    const dlq = this.config.dlq;
    if (!dlq) {
      return {
        component: "Dead Letter Queue",
        status: "unhealthy",
        message: "Not configured",
        timestamp: new Date(),
      };
    }

    try {
      const stats = await dlq.getStats();

      if (stats.atCapacity) {
        return {
          component: "Dead Letter Queue",
          status: "unhealthy",
          message: `At capacity (${stats.totalEntries} entries)`,
          details: Object.entries(stats.byOperation).map(([op, count]) => `${op}: ${count}`),
          timestamp: new Date(),
        };
      }

      if (stats.totalEntries > 0) {
        return {
          component: "Dead Letter Queue",
          status: "degraded",
          message: `${stats.totalEntries} entries pending`,
          details: Object.entries(stats.byOperation).map(([op, count]) => `${op}: ${count}`),
          timestamp: new Date(),
        };
      }

      return {
        component: "Dead Letter Queue",
        status: "healthy",
        message: "Empty",
        timestamp: new Date(),
      };
    } catch (error) {
      return {
        component: "Dead Letter Queue",
        status: "unhealthy",
        message: `Health check failed: ${error instanceof Error ? error.message : String(error)}`,
        timestamp: new Date(),
      };
    }
  }

  // ===========================================================================
  // Health Aggregation
  // ===========================================================================

  /**
   * Aggregate component health into overall status
   */
  private aggregateHealth(components: ComponentHealth[]): HealthCheckResult {
    const timestamp = new Date();

    // Determine overall status
    let overall: HealthStatus = "healthy";
    let exitCode = 0;

    for (const component of components) {
      if (component.status === "unhealthy") {
        overall = "unhealthy";
        exitCode = 1;
        break;
      }
      if (component.status === "degraded" && overall === "healthy") {
        overall = "degraded";
      }
    }

    return {
      overall,
      components,
      timestamp,
      exitCode,
    };
  }
}

/**
 * Factory function to create a HealthCheck service
 */
export function createHealthCheckService(config: HealthCheckConfig): HealthCheckService {
  return new HealthCheckServiceImpl(config);
}

// Re-export types for convenience
export type {
  ComponentHealth,
  HealthCheckConfig,
  HealthCheckResult,
  HealthCheckService,
  HealthCheckThresholds,
  HealthStatus,
} from "./types.js";
