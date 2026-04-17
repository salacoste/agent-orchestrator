/**
 * Risk alert broadcaster — globalThis singleton pub/sub for risk threshold alerts.
 *
 * Follows the same pattern as conflict-broadcaster.ts.
 * The SSE events route subscribes and enqueues alerts to connected clients.
 * Alert evaluation runs on each poll cycle using cached score data.
 *
 * The risk score route updates the cache via updateScoreCache().
 * The events route calls evaluateCachedAndBroadcast() each poll cycle.
 */

import type { RiskAlert, RiskAlertConfig } from "./risk-alert-types";
import { evaluateRiskAlerts } from "./risk-alert-evaluation";
import type { RiskScoreResult } from "./risk-score";
import type { EmergingRisk } from "./emerging-risk-detection";

type AlertCallback = (alerts: RiskAlert[]) => void;

interface AlertState {
  listeners: Set<AlertCallback>;
  knownAlertIds: Set<string>;
  activeAlerts: RiskAlert[];
  /** Cached score results — updated by the risk score route. */
  cachedScoreResults: RiskScoreResult[];
  /** Cached emerging risks — updated by the risk score route. */
  cachedEmergingRisks: Map<string, EmergingRisk[]>;
}

const globalForAlerts = globalThis as typeof globalThis & {
  _aoRiskAlertBroadcaster?: AlertState;
};

function getState(): AlertState {
  if (!globalForAlerts._aoRiskAlertBroadcaster) {
    globalForAlerts._aoRiskAlertBroadcaster = {
      listeners: new Set(),
      knownAlertIds: new Set(),
      activeAlerts: [],
      cachedScoreResults: [],
      cachedEmergingRisks: new Map(),
    };
  }
  return globalForAlerts._aoRiskAlertBroadcaster;
}

/**
 * Subscribe to risk alert events.
 * Returns an unsubscribe function. Caller MUST invoke it when the
 * SSE stream closes to prevent memory leaks.
 */
export function subscribeRiskAlerts(callback: AlertCallback): () => void {
  const state = getState();
  state.listeners.add(callback);
  return () => {
    state.listeners.delete(callback);
  };
}

/**
 * Update the cached score data. Called by the risk score route after computing scores.
 */
export function updateScoreCache(
  scoreResults: RiskScoreResult[],
  emergingRisks: Map<string, EmergingRisk[]>,
): void {
  const state = getState();
  state.cachedScoreResults = scoreResults;
  state.cachedEmergingRisks = emergingRisks;
}

/**
 * Run alert evaluation using cached score data and broadcast new alerts.
 * Called from the SSE events route polling loop.
 *
 * Returns the newly triggered alerts (empty if none).
 */
export function evaluateCachedAndBroadcast(config: RiskAlertConfig): RiskAlert[] {
  const state = getState();
  return evaluateAndBroadcastInternal(state, config);
}

/**
 * Run alert evaluation with explicit data and broadcast new alerts.
 * Useful for tests or one-shot evaluation.
 */
export function evaluateAndBroadcast(
  scoreResults: RiskScoreResult[],
  emergingRisks: Map<string, EmergingRisk[]>,
  config: RiskAlertConfig,
): RiskAlert[] {
  const state = getState();
  state.cachedScoreResults = scoreResults;
  state.cachedEmergingRisks = emergingRisks;
  return evaluateAndBroadcastInternal(state, config);
}

function evaluateAndBroadcastInternal(state: AlertState, config: RiskAlertConfig): RiskAlert[] {
  const newAlerts = evaluateRiskAlerts({
    scoreResults: state.cachedScoreResults,
    emergingRisks: state.cachedEmergingRisks,
    config,
    knownAlertIds: state.knownAlertIds,
  });

  if (newAlerts.length > 0) {
    // Register new alert IDs so they won't fire again
    for (const alert of newAlerts) {
      state.knownAlertIds.add(alert.id);
    }
    // Add to active alerts
    state.activeAlerts.push(...newAlerts);

    // Broadcast to listeners
    for (const cb of state.listeners) {
      try {
        cb(newAlerts);
      } catch {
        // Listener error must not break fan-out
      }
    }
  }

  return newAlerts;
}

/**
 * Get all currently active (unacknowledged) alerts.
 */
export function getActiveAlerts(): RiskAlert[] {
  return getState().activeAlerts.filter((a) => !a.acknowledged);
}

/**
 * Get all alerts including recently acknowledged ones.
 */
export function getAllAlerts(): RiskAlert[] {
  return [...getState().activeAlerts];
}

/**
 * Acknowledge an alert by ID.
 */
export function acknowledgeAlert(alertId: string): boolean {
  const state = getState();
  const alert = state.activeAlerts.find((a) => a.id === alertId);
  if (alert) {
    alert.acknowledged = true;
    return true;
  }
  return false;
}

/** @internal test-only helper */
export function _resetRiskAlertBroadcaster(): void {
  const state = globalForAlerts._aoRiskAlertBroadcaster;
  if (state) {
    state.listeners.clear();
    state.knownAlertIds.clear();
    state.activeAlerts.length = 0;
    state.cachedScoreResults = [];
    state.cachedEmergingRisks = new Map();
  }
  globalForAlerts._aoRiskAlertBroadcaster = undefined;
}
