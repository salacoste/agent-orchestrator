/**
 * Forecast change broadcaster (Story 55.4).
 *
 * Pub/sub for forecast change events. The SSE events route subscribes
 * and broadcasts `forecast-changed` events when the Monte Carlo route
 * detects a significant P50 shift (>2 days).
 *
 * Follows the same globalThis singleton pattern as conflict-broadcaster.ts.
 */
import type { ForecastDiff } from "@composio/ao-plugin-tracker-bmad";

export type { ForecastDiff } from "@composio/ao-plugin-tracker-bmad";

type ForecastChangeCallback = (projectId: string, diff: ForecastDiff, newP50: string) => void;

const globalForForecast = globalThis as typeof globalThis & {
  _aoForecastChangeBroadcaster?: {
    listeners: Set<ForecastChangeCallback>;
  };
};

function getState(): { listeners: Set<ForecastChangeCallback> } {
  if (!globalForForecast._aoForecastChangeBroadcaster) {
    globalForForecast._aoForecastChangeBroadcaster = {
      listeners: new Set(),
    };
  }
  return globalForForecast._aoForecastChangeBroadcaster;
}

/**
 * Subscribe to forecast change events.
 * Returns an unsubscribe function. Caller MUST invoke it when the
 * SSE stream closes to prevent memory leaks.
 */
export function subscribeForecastChanges(callback: ForecastChangeCallback): () => void {
  const state = getState();
  state.listeners.add(callback);
  return () => {
    state.listeners.delete(callback);
  };
}

/**
 * Broadcast a forecast change to all subscribers.
 * Called from the Monte Carlo API route after detecting a significant
 * P50 shift.
 */
export function broadcastForecastChange(
  projectId: string,
  diff: ForecastDiff,
  newP50: string,
): void {
  const state = getState();
  for (const cb of state.listeners) {
    try {
      cb(projectId, diff, newP50);
    } catch {
      // Listener error must not break fan-out
    }
  }
}

/** @internal test-only helper */
export function _resetForecastChangeBroadcaster(): void {
  const state = globalForForecast._aoForecastChangeBroadcaster;
  if (state) {
    state.listeners.clear();
  }
  globalForForecast._aoForecastChangeBroadcaster = undefined;
}
