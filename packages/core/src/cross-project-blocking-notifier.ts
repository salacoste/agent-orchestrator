/**
 * Cross-Project Dependency Blocking Notifier — event bus integration (Story 51.5).
 *
 * Orchestrates blocking time tracking and publishes dependency.blocking events
 * to the event bus for notification routing.
 *
 * FR-F3-5: Users receive notifications when cross-project dependencies are blocking progress.
 */

import {
  type CrossProjectDependency,
  type DependencyBlockingAlert,
  type SprintDataMap,
  DEFAULT_BLOCKING_THRESHOLD_MS,
} from "./cross-project-deps.js";
import type { BlockingTimesStore } from "./cross-project-blocking-times.js";

// =============================================================================
// EVENT TYPES
// =============================================================================

/** Event type for cross-project dependency blocking notifications. */
export const DEP_BLOCKING_EVENT_TYPE = "dependency.blocking";

/** Event published when a cross-project dependency has been blocking beyond threshold. */
export interface DependencyBlockingEvent {
  readonly type: typeof DEP_BLOCKING_EVENT_TYPE;
  readonly priority: "warning";
  readonly timestamp: string;
  readonly data: {
    readonly depId: string;
    readonly sourceProjectId: string;
    readonly sourceStoryId: string;
    readonly targetProjectId: string;
    readonly targetStoryId: string;
    readonly blockingDurationMs: number;
    readonly blockingDurationLabel: string;
    readonly thresholdExceeded: boolean;
  };
}

// =============================================================================
// EVENT BUS INTERFACE (minimal — avoids importing full types.ts)
// =============================================================================

/** Minimal event bus interface needed by the notifier. */
export interface EventBusLike {
  publish(event: {
    type: string;
    priority: string;
    timestamp: string;
    data: Record<string, unknown>;
  }): void;
}

// =============================================================================
// NOTIFIER
// =============================================================================

/**
 * Check cross-project dependencies for blocking conditions and publish alerts.
 *
 * Orchestrates:
 * 1. Refresh blocking start times via store
 * 2. Filter to threshold-exceeded alerts
 * 3. Publish dependency.blocking event for each via event bus
 *
 * @returns All alerts (including below-threshold ones) and which were published
 */
export function checkAndNotifyBlockingDeps(
  deps: CrossProjectDependency[],
  sprintDataMap: SprintDataMap,
  store: BlockingTimesStore,
  eventBus: EventBusLike,
  thresholdMs: number = DEFAULT_BLOCKING_THRESHOLD_MS,
  now?: Date,
): { alerts: DependencyBlockingAlert[]; published: DependencyBlockingAlert[] } {
  const { alerts } = store.refresh(deps, sprintDataMap, thresholdMs, now);

  // Only publish events for threshold-exceeded alerts
  const thresholdAlerts = alerts.filter((a) => a.thresholdExceeded);
  const published: DependencyBlockingAlert[] = [];

  for (const alert of thresholdAlerts) {
    const event: DependencyBlockingEvent = {
      type: DEP_BLOCKING_EVENT_TYPE,
      priority: "warning",
      timestamp: (now ?? new Date()).toISOString(),
      data: {
        depId: alert.dep.id,
        sourceProjectId: alert.blockedProjectId,
        sourceStoryId: alert.blockedStoryId,
        targetProjectId: alert.blockingProjectId,
        targetStoryId: alert.blockingStoryId,
        blockingDurationMs: alert.blockingDurationMs,
        blockingDurationLabel: alert.blockingDurationLabel,
        thresholdExceeded: alert.thresholdExceeded,
      },
    };

    try {
      eventBus.publish(event);
      published.push(alert);
    } catch (err) {
      // Best-effort — don't let a single publish failure block other alerts
      console.warn(
        `Failed to publish blocking event for dep ${alert.dep.id}:`,
        err instanceof Error ? err.message : err,
      );
    }
  }

  return { alerts, published };
}
