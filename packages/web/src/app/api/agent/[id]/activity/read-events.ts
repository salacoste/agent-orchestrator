/**
 * Event log reader — reads agent events from JSONL backup log.
 */
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";

interface EventLogEntry {
  eventId: string;
  eventType: string;
  timestamp: string;
  metadata: Record<string, unknown>;
}

export interface ActivityEvent {
  timestamp: string;
  type: string;
  description: string;
  metadata: Record<string, unknown>;
}

/**
 * Read events for a specific agent from the JSONL event backup log.
 */
export async function readAgentEvents(
  agentId: string,
  configPath: string,
  limit: number,
): Promise<ActivityEvent[]> {
  const events: ActivityEvent[] = [];

  // Look for events.jsonl in the config directory
  const configDir = configPath ? join(configPath, "..") : process.cwd();
  const eventsLogPath = join(configDir, "events.jsonl");

  if (!existsSync(eventsLogPath)) {
    return events;
  }

  try {
    const content = await readFile(eventsLogPath, "utf-8");
    const lines = content.trim().split("\n").filter(Boolean);

    for (const line of lines) {
      try {
        const entry = JSON.parse(line) as EventLogEntry;
        const meta = entry.metadata ?? {};

        if (
          meta.agentId === agentId ||
          meta.newAgentId === agentId ||
          meta.previousAgentId === agentId
        ) {
          events.push({
            timestamp: entry.timestamp,
            type: entry.eventType,
            description: formatEventDescription(entry.eventType, meta),
            metadata: meta,
          });
        }
      } catch {
        // Skip malformed lines
      }
    }
  } catch {
    // Log read failure is non-fatal
  }

  events.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  return events.slice(0, limit);
}

/** Format a human-readable description from an event type and metadata. */
function formatEventDescription(eventType: string, meta: Record<string, unknown>): string {
  const storyId = meta.storyId as string | undefined;
  switch (eventType) {
    case "story.started":
      return `Started working on story ${storyId ?? "unknown"}`;
    case "story.completed":
      return `Completed story ${storyId ?? "unknown"}`;
    case "story.blocked":
      return `Blocked on story ${storyId ?? "unknown"}: ${meta.reason ?? "unknown reason"}`;
    case "story.assigned":
      return `Assigned to story ${storyId ?? "unknown"}`;
    case "story.unblocked":
      return `Story ${storyId ?? "unknown"} unblocked`;
    case "agent.resumed":
      return `Agent resumed for story ${storyId ?? "unknown"}`;
    default:
      return `${eventType} for story ${storyId ?? "unknown"}`;
  }
}
