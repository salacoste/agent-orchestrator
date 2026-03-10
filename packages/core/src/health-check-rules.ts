/**
 * Health Check Rules Engine
 *
 * Provides custom health check rules with:
 * - Per-component threshold configuration
 * - Weighted health aggregation
 * - Custom health check function support
 *
 * This extends the base HealthCheckService with more sophisticated
 * health evaluation capabilities.
 */

import type { ComponentHealth, HealthStatus, HealthCheckResult } from "./types.js";

/** Per-component threshold configuration */
export interface ComponentThresholds {
  /** Maximum latency in milliseconds */
  maxLatencyMs?: number;

  /** Maximum queue depth */
  maxQueueDepth?: number;

  /** Maximum error rate (0-1) */
  maxErrorRate?: number;

  /** Minimum availability (0-1) */
  minAvailability?: number;

  /** Custom threshold values */
  [key: string]: number | undefined;
}

/** Weight configuration for a component */
export interface ComponentWeight {
  /** Component name */
  component: string;

  /** Weight value (0-1, default: 1.0) */
  weight: number;

  /** Whether this component is critical (unhealthy = overall unhealthy) */
  critical?: boolean;
}

/** Custom health check function */
export type CustomHealthCheckFn = () => Promise<ComponentHealth> | ComponentHealth;

/** Custom health check rule definition */
export interface CustomHealthCheckRule {
  /** Rule name/identifier */
  name: string;

  /** Component name for the health check result */
  component: string;

  /** Health check function */
  check: CustomHealthCheckFn;

  /** Optional timeout in milliseconds */
  timeout?: number;

  /** Whether this check is critical */
  critical?: boolean;

  /** Weight for aggregation */
  weight?: number;
}

/** Rules engine configuration */
export interface HealthCheckRulesConfig {
  /** Per-component thresholds */
  componentThresholds?: Record<string, ComponentThresholds>;

  /** Component weights for aggregation */
  weights?: ComponentWeight[];

  /** Custom health check rules */
  customRules?: CustomHealthCheckRule[];

  /** Default weight for components without explicit weight */
  defaultWeight?: number;

  /** Threshold for overall health score (0-1) */
  healthyThreshold?: number;

  /** Threshold for degraded health score (0-1) */
  degradedThreshold?: number;
}

/** Aggregated health result with scores */
export interface WeightedHealthResult extends HealthCheckResult {
  /** Overall health score (0-1) */
  score: number;

  /** Weighted component scores */
  componentScores: Array<{
    component: string;
    score: number;
    weight: number;
    weightedScore: number;
  }>;

  /** Custom check results */
  customChecks: ComponentHealth[];
}

/** Health check rules engine */
export interface HealthCheckRulesEngine {
  /** Register a custom health check rule */
  registerRule(rule: CustomHealthCheckRule): void;

  /** Unregister a custom health check rule */
  unregisterRule(name: string): boolean;

  /** Set component weight */
  setWeight(component: string, weight: number, critical?: boolean): void;

  /** Set component thresholds */
  setThresholds(component: string, thresholds: ComponentThresholds): void;

  /** Run custom health checks */
  runCustomChecks(): Promise<ComponentHealth[]>;

  /** Aggregate health with weights */
  aggregateWithWeights(components: ComponentHealth[]): WeightedHealthResult;

  /** Get component score (0-1) */
  getComponentScore(health: ComponentHealth): number;

  /** Get all registered rules */
  getRules(): CustomHealthCheckRule[];

  /** Get component weights */
  getWeights(): Map<string, ComponentWeight>;
}

/**
 * Create a health check rules engine
 */
export function createHealthCheckRulesEngine(
  config: HealthCheckRulesConfig = {},
): HealthCheckRulesEngine {
  const componentThresholds = new Map<string, ComponentThresholds>();
  const weights = new Map<string, ComponentWeight>();
  const customRules = new Map<string, CustomHealthCheckRule>();

  const defaultWeight = config.defaultWeight ?? 1.0;
  const healthyThreshold = config.healthyThreshold ?? 0.9;
  const degradedThreshold = config.degradedThreshold ?? 0.7;

  // Initialize from config
  if (config.componentThresholds) {
    for (const [component, thresholds] of Object.entries(config.componentThresholds)) {
      componentThresholds.set(component, thresholds);
    }
  }

  if (config.weights) {
    for (const weight of config.weights) {
      weights.set(weight.component, weight);
    }
  }

  if (config.customRules) {
    for (const rule of config.customRules) {
      customRules.set(rule.name, rule);
    }
  }

  /**
   * Calculate component score from health status
   */
  function getComponentScore(health: ComponentHealth): number {
    switch (health.status) {
      case "healthy":
        return 1.0;
      case "degraded":
        return 0.6;
      case "unhealthy":
        return 0.0;
      default:
        return 0.5;
    }
  }

  /**
   * Register a custom health check rule
   */
  function registerRule(rule: CustomHealthCheckRule): void {
    customRules.set(rule.name, rule);

    // Auto-register weight if specified
    if (rule.weight !== undefined || rule.critical !== undefined) {
      weights.set(rule.component, {
        component: rule.component,
        weight: rule.weight ?? defaultWeight,
        critical: rule.critical,
      });
    }
  }

  /**
   * Unregister a custom health check rule
   */
  function unregisterRule(name: string): boolean {
    return customRules.delete(name);
  }

  /**
   * Set component weight
   */
  function setWeight(component: string, weight: number, critical?: boolean): void {
    weights.set(component, { component, weight, critical });
  }

  /**
   * Set component thresholds
   */
  function setThresholds(component: string, thresholds: ComponentThresholds): void {
    componentThresholds.set(component, thresholds);
  }

  /**
   * Run a single custom check with timeout
   */
  async function runSingleCheck(rule: CustomHealthCheckRule): Promise<ComponentHealth> {
    const timeout = rule.timeout ?? 5000;

    try {
      const result = await Promise.race([
        Promise.resolve(rule.check()),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("Health check timeout")), timeout),
        ),
      ]);
      return result;
    } catch (error) {
      return {
        component: rule.component,
        status: "unhealthy",
        message: `Custom check failed: ${error instanceof Error ? error.message : String(error)}`,
        timestamp: new Date(),
      };
    }
  }

  /**
   * Run all custom health checks
   */
  async function runCustomChecks(): Promise<ComponentHealth[]> {
    const results: ComponentHealth[] = [];

    for (const rule of customRules.values()) {
      const result = await runSingleCheck(rule);
      results.push(result);
    }

    return results;
  }

  /**
   * Aggregate health with weights
   */
  function aggregateWithWeights(components: ComponentHealth[]): WeightedHealthResult {
    const timestamp = new Date();
    const componentScores: Array<{
      component: string;
      score: number;
      weight: number;
      weightedScore: number;
    }> = [];

    let totalWeight = 0;
    let weightedSum = 0;
    let hasCriticalUnhealthy = false;

    for (const health of components) {
      const score = getComponentScore(health);
      const weightConfig = weights.get(health.component);
      const weight = weightConfig?.weight ?? defaultWeight;

      const weightedScore = score * weight;
      componentScores.push({
        component: health.component,
        score,
        weight,
        weightedScore,
      });

      totalWeight += weight;
      weightedSum += weightedScore;

      // Check critical status
      if (weightConfig?.critical && health.status === "unhealthy") {
        hasCriticalUnhealthy = true;
      }
    }

    // Calculate overall score (0-1)
    const overallScore = totalWeight > 0 ? weightedSum / totalWeight : 1.0;

    // Determine overall status
    let overall: HealthStatus;
    let exitCode: number;

    if (hasCriticalUnhealthy) {
      overall = "unhealthy";
      exitCode = 1;
    } else if (overallScore >= healthyThreshold) {
      overall = "healthy";
      exitCode = 0;
    } else if (overallScore >= degradedThreshold) {
      overall = "degraded";
      exitCode = 0;
    } else {
      overall = "unhealthy";
      exitCode = 1;
    }

    return {
      overall,
      components,
      timestamp,
      exitCode,
      score: overallScore,
      componentScores,
      customChecks: [],
    };
  }

  /**
   * Get all registered rules
   */
  function getRules(): CustomHealthCheckRule[] {
    return Array.from(customRules.values());
  }

  /**
   * Get component weights
   */
  function getWeights(): Map<string, ComponentWeight> {
    return new Map(weights);
  }

  return {
    registerRule,
    unregisterRule,
    setWeight,
    setThresholds,
    runCustomChecks,
    aggregateWithWeights,
    getComponentScore,
    getRules,
    getWeights,
  };
}

/**
 * Predefined health check rules for common scenarios
 */
export const CommonHealthRules = {
  /**
   * Memory usage health check
   */
  memoryUsage(maxHeapMB: number = 512, component: string = "Memory"): CustomHealthCheckRule {
    return {
      name: "memory-usage",
      component,
      check: () => {
        const usage = process.memoryUsage();
        const heapUsedMB = usage.heapUsed / (1024 * 1024);

        if (heapUsedMB > maxHeapMB) {
          return {
            component,
            status: "unhealthy" as const,
            message: `High memory usage: ${heapUsedMB.toFixed(1)}MB (max: ${maxHeapMB}MB)`,
            timestamp: new Date(),
          };
        }

        if (heapUsedMB > maxHeapMB * 0.8) {
          return {
            component,
            status: "degraded" as const,
            message: `Memory usage elevated: ${heapUsedMB.toFixed(1)}MB (max: ${maxHeapMB}MB)`,
            timestamp: new Date(),
          };
        }

        return {
          component,
          status: "healthy" as const,
          message: `Memory usage normal: ${heapUsedMB.toFixed(1)}MB`,
          timestamp: new Date(),
        };
      },
    };
  },

  /**
   * CPU load health check
   */
  cpuLoad(maxLoad: number = 0.9, component: string = "CPU"): CustomHealthCheckRule {
    return {
      name: "cpu-load",
      component,
      check: () => {
        const load = process.cpuUsage();
        const total = load.user + load.system;
        // This is a simplified check - in production you'd want to track over time
        const loadPercent = total / 1000000; // Convert microseconds to approximate seconds

        if (loadPercent > maxLoad) {
          return {
            component,
            status: "unhealthy" as const,
            message: `High CPU load detected`,
            timestamp: new Date(),
          };
        }

        return {
          component,
          status: "healthy" as const,
          message: `CPU load normal`,
          timestamp: new Date(),
        };
      },
    };
  },

  /**
   * Event loop lag health check
   */
  eventLoopLag(maxLagMs: number = 100, component: string = "Event Loop"): CustomHealthCheckRule {
    return {
      name: "event-loop-lag",
      component,
      check: () => {
        return new Promise((resolve) => {
          const start = Date.now();
          setImmediate(() => {
            const lag = Date.now() - start;

            if (lag > maxLagMs) {
              resolve({
                component,
                status: "unhealthy" as const,
                message: `Event loop lag: ${lag}ms (max: ${maxLagMs}ms)`,
                timestamp: new Date(),
              });
            } else if (lag > maxLagMs * 0.5) {
              resolve({
                component,
                status: "degraded" as const,
                message: `Event loop lag elevated: ${lag}ms`,
                timestamp: new Date(),
              });
            } else {
              resolve({
                component,
                status: "healthy" as const,
                message: `Event loop responsive: ${lag}ms lag`,
                timestamp: new Date(),
              });
            }
          });
        });
      },
    };
  },

  /**
   * File system health check
   */
  fileSystem(path: string, component: string = "File System"): CustomHealthCheckRule {
    return {
      name: `filesystem-${path}`,
      component,
      check: async () => {
        const { access, constants } = await import("node:fs/promises");
        try {
          await access(path, constants.R_OK | constants.W_OK);
          return {
            component,
            status: "healthy" as const,
            message: `Path accessible: ${path}`,
            timestamp: new Date(),
          };
        } catch {
          return {
            component,
            status: "unhealthy" as const,
            message: `Cannot access path: ${path}`,
            timestamp: new Date(),
          };
        }
      },
    };
  },
};
