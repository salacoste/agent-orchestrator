/**
 * Shared SSE constants for resource conflict events.
 *
 * Used by both the server-side events route and the client-side
 * useConflictSSE hook to maintain a consistent event type contract.
 */

/** SSE event type emitted when new resource conflicts are detected. */
export const CONFLICT_SSE_EVENT_TYPE = "conflict-detected";
