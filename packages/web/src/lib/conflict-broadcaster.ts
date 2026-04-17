/**
 * Conflict detection broadcaster (Story 52.2).
 *
 * Pub/sub for resource conflict events. The SSE events route calls
 * `detectAndBroadcast()` on its polling interval, which runs
 * `checkResourceConflicts` and notifies subscribers of new conflicts.
 *
 * Follows the same globalThis singleton pattern as cascade-detector-shared.ts.
 */
import {
  checkResourceConflicts,
  createResourceConflictStore,
  type OrchestratorConfig,
  type ResourceConflict,
  type ResourceConflictStore,
} from "@composio/ao-core";

type ConflictCallback = (conflicts: ResourceConflict[]) => void;

const globalForConflict = globalThis as typeof globalThis & {
  _aoConflictBroadcaster?: {
    listeners: Set<ConflictCallback>;
    knownIds: Set<string>;
    store: ResourceConflictStore | null;
  };
};

function getState(): {
  listeners: Set<ConflictCallback>;
  knownIds: Set<string>;
  store: ResourceConflictStore | null;
} {
  if (!globalForConflict._aoConflictBroadcaster) {
    globalForConflict._aoConflictBroadcaster = {
      listeners: new Set(),
      knownIds: new Set(),
      store: null,
    };
  }
  return globalForConflict._aoConflictBroadcaster;
}

/**
 * Subscribe to conflict detection events.
 * Returns an unsubscribe function. Caller MUST invoke it when the
 * SSE stream closes to prevent memory leaks.
 */
export function subscribeConflictChanges(callback: ConflictCallback): () => void {
  const state = getState();
  state.listeners.add(callback);
  return () => {
    state.listeners.delete(callback);
  };
}

/**
 * Run conflict detection and broadcast new conflicts to subscribers.
 * Called from the SSE events route polling loop.
 */
export function detectAndBroadcast(config: OrchestratorConfig): ResourceConflict[] {
  const state = getState();

  if (!state.store) {
    state.store = createResourceConflictStore(config.configPath);
  }

  const result = checkResourceConflicts(config, state.store);

  const newConflicts = result.conflicts.filter((c) => !state.knownIds.has(c.id));

  // Update known IDs (full replace)
  state.knownIds = new Set(result.conflicts.map((c) => c.id));

  if (newConflicts.length > 0) {
    for (const cb of state.listeners) {
      try {
        cb(newConflicts);
      } catch {
        // Listener error must not break fan-out
      }
    }
  }

  return newConflicts;
}

/** @internal test-only helper */
export function _resetConflictBroadcaster(): void {
  const state = globalForConflict._aoConflictBroadcaster;
  if (state) {
    state.listeners.clear();
    state.knownIds.clear();
    state.store = null;
  }
  globalForConflict._aoConflictBroadcaster = undefined;
}
