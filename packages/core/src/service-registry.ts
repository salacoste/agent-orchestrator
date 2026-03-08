/**
 * Simple in-memory service registry for accessing shared service instances
 * Used by CLI to access application-level services like EventPublisher and DegradedModeService
 */

import type { DegradedModeService } from "./degraded-mode.js";
import type { EventPublisher } from "./types.js";

interface ServiceRegistry {
  degradedModeService?: DegradedModeService;
  eventPublisher?: EventPublisher;
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
 * Clear all registered services
 * Called during application shutdown
 */
export function clearServiceRegistry(): void {
  registry = {};
}
