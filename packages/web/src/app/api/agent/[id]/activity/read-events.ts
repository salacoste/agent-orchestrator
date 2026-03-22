/**
 * Event log reader — reads agent events from JSONL backup log.
 */
import { readFile, stat, open } from "node:fs/promises";
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

/** Maximum bytes to read from the tail of events.jsonl (512KB). */
const MAX_READ_BYTES = 512 * 1024;

/**
 * Read events for a specific agent from the JSONL event backup log.
 */
export async function readAgentEvents(
  agentId: string,
  configPath: string,
  limit: number,
): Promise<ActivityEvent[]> {
  const events: ActivityEvent[] = [];

  // Resolve events.jsonl path — check config directory first, then cwd.
  // Audit trail writes to cwd-relative events.jsonl; config dir may differ in deployment.
  if (!configPath || typeof configPath !== "string") {
    return events;
  }
  const configDir = join(configPath, "..");
  const candidates = [join(configDir, "events.jsonl")];
  // Also check cwd if it differs from configDir (audit-trail uses cwd-relative path)
  const cwdCandidate = join(process.cwd(), "events.jsonl");
  if (cwdCandidate !== candidates[0]) {
    candidates.push(cwdCandidate);
  }
  const eventsLogPath = candidates.find((p) => existsSync(p));

  if (!eventsLogPath) {
    return events;
  }

  try {
    // Read only the last MAX_READ_BYTES to avoid loading a full 10MB file
    const stats = await stat(eventsLogPath);
    const fileSize = stats.size;
    let content: string;

    if (fileSize <= MAX_READ_BYTES) {
      content = await readFile(eventsLogPath, "utf-8");
    } else {
      // Read only the tail of the file.
      // Trade-off: 512KB alloc per request. Acceptable for dashboard polling (~5s interval).
      // For high-traffic: switch to createReadStream with start offset.
      const buffer = Buffer.alloc(MAX_READ_BYTES);
      const fh = await open(eventsLogPath, "r");
      try {
        await fh.read(buffer, 0, MAX_READ_BYTES, fileSize - MAX_READ_BYTES);
      } finally {
        await fh.close();
      }
      // Drop the first partial line (we likely started mid-line)
      const raw = buffer.toString("utf-8");
      const firstNewline = raw.indexOf("\n");
      content = firstNewline >= 0 ? raw.slice(firstNewline + 1) : raw;
    }

    const lines = content.trim().split("\n").filter(Boolean);

    for (const line of lines) {
      try {
        const entry = JSON.parse(line) as EventLogEntry;
        // Shape guard: skip entries missing required fields
        if (!entry.eventType || !entry.timestamp) continue;
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
