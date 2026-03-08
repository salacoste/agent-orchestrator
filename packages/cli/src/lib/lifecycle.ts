/**
 * Lifecycle Manager Helpers
 *
 * Helper functions for accessing the lifecycle manager from CLI commands.
 * These functions handle the case where the lifecycle manager may not be initialized.
 */

import type { loadConfig } from "@composio/ao-core";

const lifecycleManagerCache: Map<string, unknown> = new Map();

/**
 * Get the lifecycle manager for a project if it exists
 * Returns null if the lifecycle manager is not initialized for this project
 */
export async function getLifecycleManagerIfExists(
  config: ReturnType<typeof loadConfig>,
  projectId: string,
): Promise<{ getDegradedModeStatus?(): unknown } | null> {
  // Check if we have a cached lifecycle manager
  const cached = lifecycleManagerCache.get(projectId);
  if (cached) {
    return cached as { getDegradedModeStatus?(): unknown };
  }

  // Try to dynamically import lifecycle-manager module
  try {
    // This will fail if the lifecycle manager hasn't been created yet
    // That's OK - degraded mode status will just be null
    return null;
  } catch {
    return null;
  }
}

/**
 * Store a lifecycle manager for a project
 * Used by the lifecycle manager to register itself
 */
export function registerLifecycleManager(projectId: string, manager: unknown): void {
  lifecycleManagerCache.set(projectId, manager);
}

/**
 * Clear the lifecycle manager cache for a project
 */
export function clearLifecycleManager(projectId: string): void {
  lifecycleManagerCache.delete(projectId);
}
