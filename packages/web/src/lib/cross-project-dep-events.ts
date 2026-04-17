/**
 * Cross-Project Dependency Change Events (Story 51.5).
 *
 * In-memory pub/sub for cross-project dependency mutations.
 * API routes publish events; SSE endpoint subscribes and broadcasts to clients.
 *
 * NOTE: This module uses module-level state (subscriber list). In a multi-instance
 * deployment (e.g., multiple Next.js server processes), events will only propagate
 * within the same process. For multi-instance coordination, replace this with a
 * shared pub/sub backend (Redis, NATS, etc.). Single-instance deployments are unaffected.
 */

/** Actions that trigger cross-project dep change events. */
export type CrossProjectDepChangeAction = "created" | "deleted";

/** Event emitted when a cross-project dependency is modified. */
export interface CrossProjectDepChangeEvent {
  readonly action: CrossProjectDepChangeAction;
  readonly depId: string;
  readonly timestamp: string;
}

/** Callback for cross-project dependency change events. */
export type CrossProjectDepChangeCallback = (event: CrossProjectDepChangeEvent) => void;

// ---------------------------------------------------------------------------
// In-memory subscriber list
// ---------------------------------------------------------------------------

const subscribers: CrossProjectDepChangeCallback[] = [];

/**
 * Notify all subscribers of a cross-project dependency change.
 * Called by POST/DELETE routes after successful operations.
 */
export function notifyCrossProjectDepChange(event: CrossProjectDepChangeEvent): void {
  for (const cb of subscribers) {
    try {
      cb(event);
    } catch {
      // Subscriber errors must not block the publisher
    }
  }
}

/**
 * Subscribe to cross-project dependency change events.
 * Returns an unsubscribe function.
 */
export function subscribeCrossProjectDepChanges(cb: CrossProjectDepChangeCallback): () => void {
  subscribers.push(cb);
  return () => {
    const idx = subscribers.indexOf(cb);
    if (idx !== -1) {
      subscribers.splice(idx, 1);
    }
  };
}
