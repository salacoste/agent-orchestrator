/**
 * Health Check Service Tests
 *
 * Tests for the health check service that monitors system components.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createHealthCheckService } from "../health-check.js";
import type {
  HealthCheckConfig,
  BMADTracker,
  AgentRegistry,
  StateManager,
  EventBus,
} from "../types.js";

/**
 * Helper to create a mock EventBus with configurable behavior
 */
function createMockEventBus(overrides: Partial<EventBus> = {}): EventBus {
  return {
    name: "mock",
    publish: async () => {},
    subscribe: async () => () => {},
    close: async () => {},
    isConnected: () => true,
    isDegraded: () => false,
    getQueueSize: () => 0,
    ...overrides,
  };
}

describe("HealthCheckService", () => {
  let mockEventBus: EventBus;
  let mockBmadTracker: BMADTracker;
  let mockStateManager: StateManager;
  let mockAgentRegistry: AgentRegistry;

  beforeEach(() => {
    // Mock event bus instance (not the plugin, but the actual event bus)
    mockEventBus = createMockEventBus({
      isConnected: () => true,
      isDegraded: () => false,
      getQueueSize: () => 5,
    });

    // Mock BMAD tracker
    mockBmadTracker = {
      isAvailable: async () => true,
    } as unknown as BMADTracker;

    // Mock state manager
    mockStateManager = {
      verify: async () => ({ valid: true }),
    } as unknown as StateManager;

    // Mock agent registry
    mockAgentRegistry = {
      getActiveAgents: async () => 3,
    } as unknown as AgentRegistry;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("check", () => {
    it("should return healthy status when all components are healthy", async () => {
      const config: HealthCheckConfig = {
        eventBus: mockEventBus,
        bmadTracker: mockBmadTracker,
        stateManager: mockStateManager,
        agentRegistry: mockAgentRegistry,
      };

      const service = createHealthCheckService(config);
      const result = await service.check();

      expect(result.overall).toBe("healthy");
      expect(result.exitCode).toBe(0);
      expect(result.components).toHaveLength(4);
      expect(result.components.every((c) => c.status === "healthy")).toBe(true);

      await service.close();
    });

    it("should return unhealthy status when any component is unhealthy", async () => {
      const unavailableTracker = {
        name: "bmad",
        isAvailable: async () => false,
      } as unknown as BMADTracker;

      const config: HealthCheckConfig = {
        bmadTracker: unavailableTracker,
      };

      const service = createHealthCheckService(config);
      const result = await service.check();

      expect(result.overall).toBe("unhealthy");
      expect(result.exitCode).toBe(1);

      await service.close();
    });

    it("should return degraded status when any component is degraded", async () => {
      const degradedBus = createMockEventBus({
        isConnected: () => true,
        isDegraded: () => true,
        getQueueSize: () => 5,
      });

      const config: HealthCheckConfig = {
        eventBus: degradedBus,
      };

      const service = createHealthCheckService(config);
      const result = await service.check();

      expect(result.overall).toBe("degraded");
      expect(result.exitCode).toBe(0);

      await service.close();
    });

    it("should check event bus connection status", async () => {
      const disconnectedBus = createMockEventBus({
        isConnected: () => false,
        isDegraded: () => false,
        getQueueSize: () => 0,
      });

      const config: HealthCheckConfig = {
        eventBus: disconnectedBus,
      };

      const service = createHealthCheckService(config);
      const result = await service.check();

      const eventBusHealth = result.components.find((c) => c.component === "Event Bus");
      expect(eventBusHealth?.status).toBe("unhealthy");
      expect(eventBusHealth?.message).toContain("Not connected");

      await service.close();
    });

    it("should check event bus queue depth against threshold", async () => {
      const highQueueBus = createMockEventBus({
        isConnected: () => true,
        isDegraded: () => false,
        getQueueSize: () => 150,
      });

      const config: HealthCheckConfig = {
        eventBus: highQueueBus,
        thresholds: {
          maxQueueDepth: 100,
        },
      };

      const service = createHealthCheckService(config);
      const result = await service.check();

      const eventBusHealth = result.components.find((c) => c.component === "Event Bus");
      expect(eventBusHealth?.status).toBe("degraded");
      expect(eventBusHealth?.message).toContain("Queue depth high");

      await service.close();
    });

    it("should skip components that are not configured", async () => {
      const config: HealthCheckConfig = {
        // No components configured
      };

      const service = createHealthCheckService(config);
      const result = await service.check();

      expect(result.overall).toBe("healthy");
      expect(result.components).toHaveLength(0);

      await service.close();
    });
  });

  describe("checkComponent", () => {
    it("should check a specific component by name", async () => {
      const config: HealthCheckConfig = {
        eventBus: mockEventBus,
        bmadTracker: mockBmadTracker,
      };

      const service = createHealthCheckService(config);
      const result = await service.checkComponent("event-bus");

      expect(result.component).toBe("Event Bus");
      expect(result.status).toBe("healthy");

      await service.close();
    });

    it("should return unhealthy for unknown component", async () => {
      const config: HealthCheckConfig = {};

      const service = createHealthCheckService(config);
      const result = await service.checkComponent("unknown");

      expect(result.status).toBe("unhealthy");
      expect(result.message).toContain("not configured or unknown");

      await service.close();
    });
  });

  describe("getStatus", () => {
    it("should return current health status", async () => {
      const config: HealthCheckConfig = {
        eventBus: mockEventBus,
      };

      const service = createHealthCheckService(config);

      // Before any check, should return healthy default
      let status = service.getStatus();
      expect(status.overall).toBe("healthy");

      // After a check, should return the checked status
      await service.check();
      status = service.getStatus();
      expect(status.overall).toBe("healthy");

      await service.close();
    });
  });

  describe("start and stop", () => {
    it("should start periodic health checks", async () => {
      const config: HealthCheckConfig = {
        eventBus: mockEventBus,
        checkIntervalMs: 100,
      };

      const service = createHealthCheckService(config);

      // Start should run initial check
      await service.start();

      // Wait a bit for the check to run
      await new Promise((resolve) => setTimeout(resolve, 150));

      const status = service.getStatus();
      expect(status.components.length).toBeGreaterThan(0);

      await service.stop();
      await service.close();
    });

    it("should stop periodic health checks", async () => {
      const config: HealthCheckConfig = {
        eventBus: mockEventBus,
        checkIntervalMs: 100,
      };

      const service = createHealthCheckService(config);
      await service.start();
      await service.stop();

      // Should not throw
      await service.close();
    });
  });

  describe("BMADTracker health check", () => {
    it("should return unhealthy when tracker is unavailable", async () => {
      const unavailableTracker = {
        name: "bmad",
        isAvailable: async () => false,
      } as unknown as BMADTracker;

      const config: HealthCheckConfig = {
        bmadTracker: unavailableTracker,
      };

      const service = createHealthCheckService(config);
      const result = await service.check();

      const trackerHealth = result.components.find((c) => c.component === "BMAD Tracker");
      expect(trackerHealth?.status).toBe("unhealthy");
      expect(trackerHealth?.message).toContain("Not available");

      await service.close();
    });

    it("should measure tracker availability latency", async () => {
      const slowTracker = {
        name: "bmad",
        isAvailable: async () => {
          await new Promise((resolve) => setTimeout(resolve, 50));
          return true;
        },
      } as unknown as BMADTracker;

      const config: HealthCheckConfig = {
        bmadTracker: slowTracker,
      };

      const service = createHealthCheckService(config);
      const result = await service.check();

      const trackerHealth = result.components.find((c) => c.component === "BMAD Tracker");
      expect(trackerHealth?.latencyMs).toBeGreaterThanOrEqual(50);
      expect(trackerHealth?.status).toBe("healthy");

      await service.close();
    });

    it("should return degraded when tracker latency exceeds threshold", async () => {
      const slowTracker = {
        name: "bmad",
        isAvailable: async () => {
          await new Promise((resolve) => setTimeout(resolve, 200));
          return true;
        },
      } as unknown as BMADTracker;

      const config: HealthCheckConfig = {
        bmadTracker: slowTracker,
        thresholds: {
          maxLatencyMs: 100,
        },
      };

      const service = createHealthCheckService(config);
      const result = await service.check();

      const trackerHealth = result.components.find((c) => c.component === "BMAD Tracker");
      expect(trackerHealth?.status).toBe("degraded");
      expect(trackerHealth?.latencyMs).toBeGreaterThanOrEqual(200);

      await service.close();
    });
  });

  describe("StateManager health check", () => {
    it("should return healthy when state manager has no YAML path (in-memory mode)", async () => {
      const inMemoryStateManager = {
        verify: async () => ({ valid: false, error: "This should not be checked" }),
      } as unknown as StateManager;

      const config: HealthCheckConfig = {
        stateManager: inMemoryStateManager,
      };

      const service = createHealthCheckService(config);
      const result = await service.check();

      const stateHealth = result.components.find((c) => c.component === "Local State");
      expect(stateHealth?.status).toBe("healthy");
      expect(stateHealth?.message).toContain("in-memory mode");

      await service.close();
    });

    it("should return healthy when verify method is not available", async () => {
      const stateManagerWithoutVerify = {} as StateManager;

      const config: HealthCheckConfig = {
        stateManager: stateManagerWithoutVerify,
      };

      const service = createHealthCheckService(config);
      const result = await service.check();

      const stateHealth = result.components.find((c) => c.component === "Local State");
      expect(stateHealth?.status).toBe("healthy");

      await service.close();
    });
  });

  describe("AgentRegistry health check", () => {
    it("should return healthy with active agent count", async () => {
      const registryWithCount = {
        getActiveAgents: async () => 5,
      } as unknown as AgentRegistry;

      const config: HealthCheckConfig = {
        agentRegistry: registryWithCount,
      };

      const service = createHealthCheckService(config);
      const result = await service.check();

      const registryHealth = result.components.find((c) => c.component === "Agent Registry");
      expect(registryHealth?.status).toBe("healthy");
      expect(registryHealth?.message).toContain("5 active agents");

      await service.close();
    });

    it("should return healthy when getActiveAgents is not available", async () => {
      const registryWithoutCount = {} as AgentRegistry;

      const config: HealthCheckConfig = {
        agentRegistry: registryWithoutCount,
      };

      const service = createHealthCheckService(config);
      const result = await service.check();

      const registryHealth = result.components.find((c) => c.component === "Agent Registry");
      expect(registryHealth?.status).toBe("healthy");
      expect(registryHealth?.message).toContain("Available");

      await service.close();
    });
  });

  describe("latency metrics", () => {
    it("should include latency in component health when available", async () => {
      const config: HealthCheckConfig = {
        eventBus: mockEventBus,
        bmadTracker: mockBmadTracker,
      };

      const service = createHealthCheckService(config);
      const result = await service.check();

      const eventBusHealth = result.components.find((c) => c.component === "Event Bus");
      const trackerHealth = result.components.find((c) => c.component === "BMAD Tracker");

      // Latency should be reported
      expect(eventBusHealth?.latencyMs).toBeDefined();
      expect(trackerHealth?.latencyMs).toBeDefined();

      await service.close();
    });
  });

  describe("thresholds", () => {
    it("should use default thresholds when not configured", async () => {
      const config: HealthCheckConfig = {
        eventBus: mockEventBus,
        // No thresholds configured
      };

      const service = createHealthCheckService(config);
      const result = await service.check();

      expect(result.overall).toBe("healthy");

      await service.close();
    });

    it("should respect configured max latency threshold", async () => {
      const slowTracker = {
        name: "bmad",
        isAvailable: async () => {
          await new Promise((resolve) => setTimeout(resolve, 200));
          return true;
        },
      } as unknown as BMADTracker;

      const config: HealthCheckConfig = {
        bmadTracker: slowTracker,
        thresholds: {
          maxLatencyMs: 100,
        },
      };

      const service = createHealthCheckService(config);
      const result = await service.check();

      expect(result.overall).toBe("degraded");

      await service.close();
    });
  });

  describe("error handling", () => {
    it("should handle event bus check errors gracefully", async () => {
      const errorBus = createMockEventBus({
        name: "redis",
        isConnected: () => {
          throw new Error("Connection failed");
        },
      });

      const config: HealthCheckConfig = {
        eventBus: errorBus,
      };

      const service = createHealthCheckService(config);
      const result = await service.check();

      const eventBusHealth = result.components.find((c) => c.component === "Event Bus");
      expect(eventBusHealth?.status).toBe("unhealthy");
      expect(eventBusHealth?.message).toContain("Health check failed");

      await service.close();
    });

    it("should handle tracker check errors gracefully", async () => {
      const errorTracker = {
        name: "bmad",
        isAvailable: async () => {
          throw new Error("Network error");
        },
      } as unknown as BMADTracker;

      const config: HealthCheckConfig = {
        bmadTracker: errorTracker,
      };

      const service = createHealthCheckService(config);
      const result = await service.check();

      const trackerHealth = result.components.find((c) => c.component === "BMAD Tracker");
      expect(trackerHealth?.status).toBe("unhealthy");
      expect(trackerHealth?.message).toContain("Health check failed");

      await service.close();
    });
  });

  describe("close", () => {
    it("should cleanup resources when closed", async () => {
      const config: HealthCheckConfig = {
        eventBus: mockEventBus,
      };

      const service = createHealthCheckService(config);
      await service.start();

      // Should not throw
      await service.close();
    });
  });

  describe("threshold validation", () => {
    it("should throw error for negative maxLatencyMs", () => {
      const config: HealthCheckConfig = {
        eventBus: mockEventBus,
        thresholds: {
          maxLatencyMs: -1,
        },
      };

      expect(() => createHealthCheckService(config)).toThrow("maxLatencyMs must be non-negative");
    });

    it("should throw error for negative maxQueueDepth", () => {
      const config: HealthCheckConfig = {
        eventBus: mockEventBus,
        thresholds: {
          maxQueueDepth: -1,
        },
      };

      expect(() => createHealthCheckService(config)).toThrow("maxQueueDepth must be non-negative");
    });

    it("should accept zero thresholds", () => {
      const config: HealthCheckConfig = {
        eventBus: mockEventBus,
        thresholds: {
          maxLatencyMs: 0,
          maxQueueDepth: 0,
        },
      };

      expect(() => createHealthCheckService(config)).not.toThrow();
    });
  });
});
