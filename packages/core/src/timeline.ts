/**
 * Agent timeline — reads OMC replay trace data and maps to dashboard entries.
 *
 * Parses `.omc/state/agent-replay-{sessionId}.jsonl` into sorted TimelineEntry[]
 * objects suitable for the dashboard timeline API.
 *
 * Epic 60, Story 60-3 (FR-D2-1, FR-D2-3).
 */

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { ReplayEvent, ReplayEventType, TimelineEntry } from "./types.js";

const VALID_EVENT_TYPES: ReadonlySet<string> = new Set<ReplayEventType>([
  "agent_start",
  "agent_stop",
  "tool_start",
  "tool_end",
  "file_touch",
  "intervention",
  "error",
  "hook_fire",
  "hook_result",
  "keyword_detected",
  "skill_activated",
  "skill_invoked",
  "mode_change",
]);

/**
 * Runtime guard: verify a parsed JSON object has the minimum required fields
 * of a ReplayEvent (valid `event` type and numeric `t`).
 */
function isValidReplayEvent(obj: unknown): obj is ReplayEvent {
  if (typeof obj !== "object" || obj === null) return false;
  const rec = obj as Record<string, unknown>;
  return (
    typeof rec.event === "string" && VALID_EVENT_TYPES.has(rec.event) && typeof rec.t === "number"
  );
}

/**
 * Map a ReplayEventType + optional context to a human-readable action string.
 */
function describeAction(
  event: ReplayEventType,
  agent: string,
  tool?: string,
  file?: string,
): string {
  switch (event) {
    case "agent_start":
      return `Agent ${agent} started`;
    case "agent_stop":
      return `Agent ${agent} stopped`;
    case "tool_start":
      return `Called ${tool ?? "unknown tool"}`;
    case "tool_end":
      return `Finished ${tool ?? "unknown tool"}`;
    case "file_touch":
      return `Modified ${file ?? "unknown file"}`;
    case "intervention":
      return "Human intervention";
    case "error":
      return "Error occurred";
    case "hook_fire":
      return `Hook ${tool ?? "unknown"} fired`;
    case "hook_result":
      return `Hook ${tool ?? "unknown"} completed`;
    case "keyword_detected":
      return "Keyword detected";
    case "skill_activated":
      return `Skill ${tool ?? "unknown"} activated`;
    case "skill_invoked":
      return `Skill ${tool ?? "unknown"} invoked`;
    case "mode_change":
      return "Mode changed";
    default: {
      const _exhaustive: never = event;
      return "Unknown event";
    }
  }
}

/**
 * Map a raw ReplayEvent to a processed TimelineEntry.
 */
function mapToTimelineEntry(replay: ReplayEvent): TimelineEntry {
  return {
    agent: replay.agent,
    agentType: replay.agent_type,
    action: describeAction(replay.event, replay.agent, replay.tool, replay.file),
    event: replay.event,
    timestamp: replay.t,
    duration: replay.duration_ms,
    tool: replay.tool,
    file: replay.file,
    success: replay.success,
    model: replay.model,
  };
}

/**
 * Read agent timeline entries from OMC replay JSONL.
 *
 * Reads `.omc/state/agent-replay-{sessionId}.jsonl` line by line, parses
 * each line as a ReplayEvent, maps to TimelineEntry, and sorts ascending by
 * timestamp. Returns empty array when the file doesn't exist or on any IO error.
 */
export async function readTimeline(
  workspacePath: string,
  sessionId: string,
): Promise<TimelineEntry[]> {
  const filePath = join(workspacePath, ".omc/state", `agent-replay-${sessionId}.jsonl`);

  let content: string;
  try {
    content = await readFile(filePath, "utf-8");
  } catch {
    // File doesn't exist or permission error — return empty
    return [];
  }

  const lines = content.split("\n").filter((line) => line.trim() !== "");
  const entries: TimelineEntry[] = [];

  for (const line of lines) {
    try {
      const parsed: unknown = JSON.parse(line);
      if (!isValidReplayEvent(parsed)) continue;
      entries.push(mapToTimelineEntry(parsed));
    } catch {
      // Skip malformed lines
    }
  }

  return entries.sort((a, b) => a.timestamp - b.timestamp);
}
