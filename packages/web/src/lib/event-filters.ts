/**
 * Shared event filtering utilities for audit trail queries
 */

export interface AuditEvent {
  eventId: string;
  eventType: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
  hash: string;
}

export interface EventFilterParams {
  type?: string | null;
  storyId?: string | null;
  agentId?: string | null;
  search?: string | null;
  since?: string | null;
}

/**
 * Filter audit events based on provided criteria
 * @param events - Array of audit events to filter
 * @param params - Filter parameters
 * @returns Filtered array of events
 */
export function filterEvents(events: unknown[], params: EventFilterParams): unknown[] {
  return events.filter((event: unknown) => {
    if (!event || typeof event !== "object") return false;

    const evt = event as Record<string, unknown>;

    // Filter by event type
    if (params.type && evt.eventType !== params.type) {
      return false;
    }

    // Filter by story ID
    if (params.storyId) {
      const metadata = evt.metadata as Record<string, unknown> | undefined;
      if (metadata?.storyId !== params.storyId) {
        return false;
      }
    }

    // Filter by agent ID
    if (params.agentId) {
      const metadata = evt.metadata as Record<string, unknown> | undefined;
      if (metadata?.agentId !== params.agentId) {
        return false;
      }
    }

    // Filter by timestamp (since)
    if (params.since) {
      const eventTime = new Date(evt.timestamp as string);
      const sinceTime = new Date(params.since);
      if (eventTime < sinceTime) {
        return false;
      }
    }

    // Full-text search
    if (params.search) {
      const eventStr = JSON.stringify(event).toLowerCase();
      if (!eventStr.includes(params.search.toLowerCase())) {
        return false;
      }
    }

    return true;
  });
}

/**
 * Sort events by timestamp descending (newest first)
 * @param events - Array of events to sort
 * @returns Sorted array of events
 */
export function sortEventsByTimestamp(events: unknown[]): unknown[] {
  return events.sort((a, b) => {
    const aTime = new Date((a as Record<string, unknown>).timestamp as string);
    const bTime = new Date((b as Record<string, unknown>).timestamp as string);
    return bTime.getTime() - aTime.getTime();
  });
}
