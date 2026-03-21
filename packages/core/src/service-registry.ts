/**
 * Simple in-memory service registry for accessing shared service instances
 * Used by CLI to access application-level services like EventPublisher and DegradedModeService
 */

import type { CircuitBreakerManager } from "./circuit-breaker-manager.js";
import type { DegradedModeService } from "./degraded-mode.js";
import type { LearningStore } from "./learning-store.js";
import type { BMADTracker, EventPublisher } from "./types.js";

interface ServiceRegistry {
  degradedModeService?: DegradedModeService;
  eventPublisher?: EventPublisher;
  bmadTracker?: BMADTracker;
  circuitBreakerManager?: CircuitBreakerManager;
  learningStore?: LearningStore;
}

// Global registry instance
let registry: ServiceRegistry = {};

/**
 * Register the DegradedModeService instance
 * Called by the application during initialization
 */
export function registerDegradedModeService(service: DegradedModeService): void {
  registry.degradedModeService = service;
}

/**
 * Register the EventPublisher instance
 * Called by the application during initialization
 */
export function registerEventPublisher(publisher: EventPublisher): void {
  registry.eventPublisher = publisher;
}

/**
 * Get the registered DegradedModeService instance
 * Returns undefined if not registered
 */
export function getDegradedModeService(): DegradedModeService | undefined {
  return registry.degradedModeService;
}

/**
 * Get the registered EventPublisher instance
 * Returns undefined if not registered
 */
export function getEventPublisher(): EventPublisher | undefined {
  return registry.eventPublisher;
}

/**
 * Register the BMADTracker instance
 * Called by the application during initialization
 */
export function registerBMADTracker(tracker: BMADTracker): void {
  registry.bmadTracker = tracker;
}

/**
 * Get the registered BMADTracker instance
 * Returns undefined if not registered
 */
export function getBMADTracker(): BMADTracker | undefined {
  return registry.bmadTracker;
}

/**
 * Register the CircuitBreakerManager instance
 * Called by the application during initialization
 */
export function registerCircuitBreakerManager(manager: CircuitBreakerManager): void {
  registry.circuitBreakerManager = manager;
}

/**
 * Get the registered CircuitBreakerManager instance
 * Returns undefined if not registered
 */
export function getCircuitBreakerManager(): CircuitBreakerManager | undefined {
  return registry.circuitBreakerManager;
}

/**
 * Register the LearningStore instance (Cycle 3 AI Intelligence)
 */
export function registerLearningStore(store: LearningStore): void {
  registry.learningStore = store;
}

/**
 * Get the registered LearningStore instance
 * Returns undefined if not registered (AI features opt-in)
 */
export function getLearningStore(): LearningStore | undefined {
  return registry.learningStore;
}

/**
 * Clear all registered services
 * Called during application shutdown
 */
export function clearServiceRegistry(): void {
  registry = {};
}
