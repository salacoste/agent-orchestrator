/**
 * Cascade failure detector (Story 19.3).
 *
 * Tracks agent failure timestamps in a sliding window.
 * Triggers cascade alert when 3+ failures occur within 5 minutes.
 * Pure module — no side effects, testable.
 */

/** Cascade detection configuration. */
export interface CascadeConfig {
  /** Number of failures to trigger cascade (default: 3). */
  threshold: number;
  /** Sliding window in milliseconds (default: 300000 = 5 minutes). */
  windowMs: number;
}

/** Cascade detection result. */
export interface CascadeStatus {
  /** Whether cascade is currently triggered. */
  triggered: boolean;
  /** Number of failures in the current window. */
  failureCount: number;
  /** Whether agents are paused due to cascade. */
  paused: boolean;
}

const DEFAULT_CONFIG: CascadeConfig = {
  threshold: 3,
  windowMs: 5 * 60 * 1000, // 5 minutes
};

/**
 * Create a cascade failure detector.
 *
 * Tracks failure events in a sliding time window. When the count
 * exceeds the threshold, the cascade is triggered and agents should
 * be paused.
 */
export function createCascadeDetector(config: Partial<CascadeConfig> = {}) {
  const cfg: CascadeConfig = { ...DEFAULT_CONFIG, ...config };
  const failureTimestamps: number[] = [];
  let paused = false;

  function pruneOldFailures(now: number): void {
    const cutoff = now - cfg.windowMs;
    while (failureTimestamps.length > 0 && failureTimestamps[0] < cutoff) {
      failureTimestamps.shift();
    }
  }

  return {
    /**
     * Record an agent failure. Returns true if cascade was triggered.
     */
    recordFailure(timestamp?: number): boolean {
      const now = timestamp ?? Date.now();
      failureTimestamps.push(now);
      pruneOldFailures(now);

      if (failureTimestamps.length >= cfg.threshold && !paused) {
        paused = true;
        return true; // Cascade triggered
      }
      return false;
    },

    /**
     * Get current cascade status.
     */
    getStatus(): CascadeStatus {
      pruneOldFailures(Date.now());
      return {
        triggered: failureTimestamps.length >= cfg.threshold,
        failureCount: failureTimestamps.length,
        paused,
      };
    },

    /**
     * Resume from cascade pause (manual "Resume All" action).
     */
    resume(): void {
      paused = false;
      failureTimestamps.length = 0;
    },

    /**
     * Reset detector state (for testing).
     */
    reset(): void {
      paused = false;
      failureTimestamps.length = 0;
    },
  };
}
