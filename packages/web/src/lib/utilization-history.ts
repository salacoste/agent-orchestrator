import type { UtilizationSnapshot } from "./utilization-metrics-types";

/**
 * In-memory utilization snapshot history store — globalThis singleton.
 * Follows broadcaster singleton pattern from risk-alert-broadcaster.ts.
 * Story 56.6 Task 3.
 */

const DEFAULT_MAX_AGE_MS = 7 * 24 * 3600 * 1000; // 7 days
const MAX_SNAPSHOTS_PER_AGENT = 20160; // ~7 days at 1 snapshot/30s (M2)

interface HistoryState {
  snapshots: UtilizationSnapshot[];
}

const globalForHistory = globalThis as typeof globalThis & {
  _aoUtilizationHistory?: HistoryState;
};

function getState(): HistoryState {
  if (!globalForHistory._aoUtilizationHistory) {
    globalForHistory._aoUtilizationHistory = { snapshots: [] };
  }
  return globalForHistory._aoUtilizationHistory;
}

/**
 * Append snapshots and prune stale entries.
 */
export function recordSnapshots(
  snapshots: UtilizationSnapshot[],
  maxAgeMs: number = DEFAULT_MAX_AGE_MS,
): void {
  const state = getState();

  // M3: Deduplicate by (agentId, timestamp) — skip if identical already exists
  const existingKeys = new Set(state.snapshots.map((s) => `${s.agentId}:${s.timestamp}`));
  const deduped = snapshots.filter((s) => !existingKeys.has(`${s.agentId}:${s.timestamp}`));

  state.snapshots.push(...deduped);
  pruneHistory(maxAgeMs);

  // M2: Cap per-agent history to prevent unbounded growth
  const agentCounts = new Map<string, number>();
  for (const s of state.snapshots) {
    agentCounts.set(s.agentId, (agentCounts.get(s.agentId) ?? 0) + 1);
  }
  const overCapAgents = [...agentCounts.entries()].filter(([, c]) => c > MAX_SNAPSHOTS_PER_AGENT);
  if (overCapAgents.length > 0) {
    const toRemove = new Set<string>();
    for (const [agentId, count] of overCapAgents) {
      const excess = count - MAX_SNAPSHOTS_PER_AGENT;
      let removed = 0;
      // Remove oldest entries first (snapshots are append-only, so first N are oldest)
      for (let i = 0; i < state.snapshots.length && removed < excess; i++) {
        const s = state.snapshots[i];
        if (s.agentId === agentId && !toRemove.has(`${i}`)) {
          toRemove.add(`${i}`);
          removed++;
        }
      }
    }
    if (toRemove.size > 0) {
      state.snapshots = state.snapshots.filter((_, i) => !toRemove.has(`${i}`));
    }
  }
}

/**
 * Retrieve time-series for a specific agent.
 */
export function getAgentHistory(agentId: string, sinceMs?: number): UtilizationSnapshot[] {
  const state = getState();
  return state.snapshots.filter(
    (s) => s.agentId === agentId && (sinceMs === undefined || s.timestamp >= sinceMs),
  );
}

/**
 * Retrieve all snapshots for a project.
 */
export function getProjectHistory(projectId: string, sinceMs?: number): UtilizationSnapshot[] {
  const state = getState();
  return state.snapshots.filter(
    (s) => s.projectId === projectId && (sinceMs === undefined || s.timestamp >= sinceMs),
  );
}

/**
 * Retrieve all snapshots, optionally filtered by age.
 */
export function getAllHistory(sinceMs?: number): UtilizationSnapshot[] {
  const state = getState();
  return sinceMs === undefined
    ? state.snapshots
    : state.snapshots.filter((s) => s.timestamp >= sinceMs);
}

/**
 * Remove entries older than maxAgeMs from now.
 */
export function pruneHistory(maxAgeMs: number = DEFAULT_MAX_AGE_MS): void {
  const state = getState();
  const cutoff = Date.now() - maxAgeMs;
  state.snapshots = state.snapshots.filter((s) => s.timestamp >= cutoff);
}

/** Test-only reset */
export function _resetUtilizationHistory(): void {
  globalForHistory._aoUtilizationHistory = undefined;
}
