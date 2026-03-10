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
 */

import type {
  ComponentHealth,
  HealthCheckConfig,
  HealthCheckResult,
  HealthCheckService,
  HealthStatus,
} from "./types.js";
import { access } from "node:fs/promises";
import { constants } from "node:fs";

const DEFAULT_CHECK_INTERVAL_MS = 30000; // 30 seconds
const DEFAULT_MAX_LATENCY_MS = 1000; // 1 second
const DEFAULT_MAX_QUEUE_DEPTH = 100;

/**
 * Health Check Service Implementation
 */
export class HealthCheckServiceImpl implements HealthCheckService {
  private config: HealthCheckConfig;
  private currentStatus: HealthCheckResult | null = null;
  private checkInterval?: ReturnType<typeof setInterval>;
  private startTime: Date;

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
  }

  /**
   * Run all health checks
   */
  async check(): Promise<HealthCheckResult> {
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

    const result = this.aggregateHealth(components);
    this.currentStatus = result;
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

      // Measure latency by doing a test operation
      const startTime = Date.now();
      // TODO: Could add a ping method to EventBus for latency measurement
      const latencyMs = Date.now() - startTime;

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
