/**
 * Time travel — historical state reconstruction (Story 45.2).
 *
 * Pure function. Replays audit events up to a target timestamp
 * to reconstruct project state at that point in time.
 */

/** Audit event from the JSONL event log. */
export interface AuditEvent {
  eventId: string;
  eventType: string;
  timestamp: string;
  metadata: Record<string, unknown>;
}

/** Reconstructed historical state at a point in time. */
export interface HistoricalState {
  /** Story statuses at the target time. */
  activeStories: Record<string, string>;
  /** Agent IDs that were active. */
  activeAgents: string[];
  /** Blocked story IDs. */
  blockers: string[];
  /** Timestamp of the last event processed. */
  lastEventAt: string | null;
  /** Total events processed. */
  eventsProcessed: number;
}

/**
 * Reconstruct project state at a given timestamp by replaying events.
 *
 * Events must be sorted chronologically (oldest first).
 * Only processes events with timestamp ≤ targetTimestamp.
 */
export function reconstructState(events: AuditEvent[], targetTimestamp: string): HistoricalState {
  const targetMs = new Date(targetTimestamp).getTime();
  const stories = new Map<string, string>();
  /** Maps agentId → storyId so we can remove agents when their story completes. */
  const agentStory = new Map<string, string>();
  const blockers = new Set<string>();
  let lastEventAt: string | null = null;
  let eventsProcessed = 0;

  for (const event of events) {
    const eventMs = new Date(event.timestamp).getTime();
    if (eventMs > targetMs) break;

    eventsProcessed++;
    lastEventAt = event.timestamp;

    const storyId = typeof event.metadata.storyId === "string" ? event.metadata.storyId : null;
    const agentId = typeof event.metadata.agentId === "string" ? event.metadata.agentId : null;

    switch (event.eventType) {
      case "story.started":
        if (storyId) stories.set(storyId, "in-progress");
        if (agentId && storyId) agentStory.set(agentId, storyId);
        break;
      case "story.completed":
        if (storyId) {
          stories.set(storyId, "done");
          blockers.delete(storyId);
          // Remove agents working on this completed story
          for (const [aid, sid] of agentStory) {
            if (sid === storyId) agentStory.delete(aid);
          }
        }
        break;
      case "story.blocked":
        if (storyId) {
          stories.set(storyId, "blocked");
          blockers.add(storyId);
        }
        break;
      case "story.unblocked":
        if (storyId) {
          stories.set(storyId, "in-progress");
          blockers.delete(storyId);
        }
        break;
      case "story.assigned":
        if (agentId && storyId) agentStory.set(agentId, storyId);
        break;
      case "agent.resumed":
        if (agentId && storyId) agentStory.set(agentId, storyId);
        break;
      default:
        break;
    }
  }

  return {
    activeStories: Object.fromEntries(stories),
    activeAgents: [...agentStory.keys()],
    blockers: [...blockers],
    lastEventAt,
    eventsProcessed,
  };
}
