/**
 * Event Bus Backlog Monitor — monitors queue depth and triggers alerts
 *
 * Polls EventBus.getQueueSize() at a configurable interval and fires an alert
 * callback when the queue depth exceeds a threshold. Deduplicates alerts so
 * the callback fires only once per threshold breach (re-arms when queue drops
 * below threshold).
 */

import type { EventBus } from "./types.js";

/** Configuration for the backlog monitor */
export interface BacklogMonitorConfig {
  /** Queue depth threshold that triggers an alert */
  backlogThreshold: number;
  /** Polling interval in milliseconds */
  checkIntervalMs: number;
  /** Callback fired when backlog exceeds threshold */
  onAlert: (size: number) => void;
}

/** Backlog monitor interface */
export interface EventBusBacklogMonitor {
  /** Start monitoring */
  start(eventBus: EventBus): void;
  /** Stop monitoring and clean up */
  stop(): void;
  /** Get current backlog size (from last poll) */
  getBacklogSize(): number;
}

/**
 * Create an event bus backlog monitor
 */
export function createEventBusBacklogMonitor(config: BacklogMonitorConfig): EventBusBacklogMonitor {
  let intervalId: ReturnType<typeof setInterval> | undefined;
  let lastSize = 0;
  let alertFired = false;

  return {
    start(eventBus: EventBus): void {
      // Clear any existing interval
      if (intervalId !== undefined) {
        clearInterval(intervalId);
      }

      intervalId = setInterval(() => {
        lastSize = eventBus.getQueueSize();

        if (lastSize > config.backlogThreshold) {
          // Only fire alert once per breach (deduplicate)
          if (!alertFired) {
            alertFired = true;
            config.onAlert(lastSize);
          }
        } else {
          // Re-arm alert when queue drops below threshold
          alertFired = false;
        }
      }, config.checkIntervalMs);
    },

    stop(): void {
      if (intervalId !== undefined) {
        clearInterval(intervalId);
        intervalId = undefined;
      }
    },

    getBacklogSize(): number {
      return lastSize;
    },
  };
}
