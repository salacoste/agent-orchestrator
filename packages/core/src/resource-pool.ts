/**
 * Resource pool — shared agent capacity (Story 46b.3).
 *
 * Manages per-project and total agent limits.
 * When no config provided, all operations are unlimited.
 */

/** Resource pool configuration. */
export interface ResourcePoolConfig {
  total: number;
  projects: Record<string, number>;
}

/** Per-project usage. */
export interface ProjectUsage {
  used: number;
  max: number | null;
}

/** Pool state snapshot. */
export interface PoolState {
  total: { used: number; max: number | null };
  projects: Record<string, ProjectUsage>;
}

/** Resource pool interface. */
export interface ResourcePool {
  canSpawn(projectId: string): boolean;
  acquire(projectId: string): boolean;
  release(projectId: string): void;
  getState(): PoolState;
}

/**
 * Create a resource pool manager.
 * When config is undefined, all operations are unlimited.
 */
export function createResourcePool(config?: ResourcePoolConfig): ResourcePool {
  // Validate total is a positive finite number if config provided
  if (config && (!Number.isFinite(config.total) || config.total < 0)) {
    throw new Error(`Invalid resource pool total: ${config.total}`);
  }
  if (config) {
    for (const [pid, limit] of Object.entries(config.projects)) {
      if (!Number.isFinite(limit) || limit < 0) {
        throw new Error(`Invalid resource pool limit for project "${pid}": ${limit}`);
      }
    }
  }

  const usage = new Map<string, number>();

  function getProjectUsage(projectId: string): number {
    return usage.get(projectId) ?? 0;
  }

  function getTotalUsage(): number {
    let total = 0;
    for (const count of usage.values()) total += count;
    return total;
  }

  return {
    canSpawn(projectId) {
      if (!config) return true;

      // Check per-project limit
      const projectLimit = config.projects[projectId];
      if (projectLimit !== undefined && getProjectUsage(projectId) >= projectLimit) {
        return false;
      }

      // Check total limit
      if (getTotalUsage() >= config.total) {
        return false;
      }

      return true;
    },

    acquire(projectId) {
      // In unlimited mode, still track usage for accurate getState()
      if (!config) {
        usage.set(projectId, getProjectUsage(projectId) + 1);
        return true;
      }

      // Check limits via closure (not this — safe for destructuring)
      const projectLimit = config.projects[projectId];
      if (projectLimit !== undefined && getProjectUsage(projectId) >= projectLimit) {
        return false;
      }
      if (getTotalUsage() >= config.total) {
        return false;
      }

      usage.set(projectId, getProjectUsage(projectId) + 1);
      return true;
    },

    release(projectId) {
      const current = getProjectUsage(projectId);
      if (current > 0) {
        usage.set(projectId, current - 1);
      }
      if (usage.get(projectId) === 0) {
        usage.delete(projectId);
      }
    },

    getState() {
      const projects: Record<string, ProjectUsage> = {};

      if (config) {
        // Include all configured projects
        for (const [pid, max] of Object.entries(config.projects)) {
          projects[pid] = { used: getProjectUsage(pid), max };
        }
        // Include active but unconfigured projects
        for (const [pid, count] of usage) {
          if (!projects[pid]) {
            projects[pid] = { used: count, max: null };
          }
        }

        return {
          total: { used: getTotalUsage(), max: config.total },
          projects,
        };
      }

      // No config — unlimited
      for (const [pid, count] of usage) {
        projects[pid] = { used: count, max: null };
      }
      return {
        total: { used: getTotalUsage(), max: null },
        projects,
      };
    },
  };
}
