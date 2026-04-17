/**
 * Event-specific Telegram message formatter.
 *
 * Formats Notification objects into Telegram MarkdownV2 messages
 * with event-type-specific details and /command suggestions.
 * Story 57.2 Tasks 1.
 */

import type { Notification } from "@composio/ao-core";
import { escapeMarkdownV2 } from "./markdown-escape.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface EventFormatter {
  /** Emoji prefix for the event type */
  emoji: string;
  /** Human-readable title */
  title: string;
  /** Format metadata fields as MarkdownV2 lines */
  formatFields: (metadata: Record<string, unknown>) => string;
  /** Suggested /command for quick action */
  commandSuggestion: (metadata: Record<string, unknown>) => string;
}

// ---------------------------------------------------------------------------
// Priority emoji mapping
// ---------------------------------------------------------------------------

/** Map NotificationPriority to emoji. */
function priorityEmoji(priority: string): string {
  switch (priority) {
    case "critical":
      return "\u{1f534}"; // red circle
    case "warning":
      return "\u{1f7e1}"; // yellow circle
    case "medium":
      return "\u{1f7e0}"; // orange circle
    case "info":
      return "\u2139\ufe0f"; // info
    default:
      return "\u2139\ufe0f";
  }
}

// ---------------------------------------------------------------------------
// Event-specific formatters
// ---------------------------------------------------------------------------

const EVENT_FORMATTERS: Record<string, EventFormatter> = {
  "agent.blocked": {
    emoji: "\u{1f534}",
    title: "Agent Blocked",
    formatFields: (m) => {
      const lines: string[] = [];
      if (m.agentId) lines.push(`*Agent:* ${escapeMarkdownV2(String(m.agentId))}`);
      if (m.storyId) lines.push(`*Story:* ${escapeMarkdownV2(String(m.storyId))}`);
      if (m.reason) lines.push(`*Reason:* ${escapeMarkdownV2(String(m.reason))}`);
      return lines.join("\n");
    },
    commandSuggestion: (m) => (m.agentId ? `/status ${String(m.agentId)}` : "/fleet"),
  },

  "story.blocked": {
    emoji: "\u{1f534}",
    title: "Story Blocked",
    formatFields: (m) => {
      const lines: string[] = [];
      if (m.storyId) lines.push(`*Story:* ${escapeMarkdownV2(String(m.storyId))}`);
      if (m.reason) lines.push(`*Reason:* ${escapeMarkdownV2(String(m.reason))}`);
      return lines.join("\n");
    },
    commandSuggestion: (m) => (m.storyId ? `/resume ${String(m.storyId)}` : "/fleet"),
  },

  "conflict.detected": {
    emoji: "\u{1f534}",
    title: "Conflict Detected",
    formatFields: (m) => {
      const lines: string[] = [];
      if (m.storyId) lines.push(`*Story:* ${escapeMarkdownV2(String(m.storyId))}`);
      if (m.conflictType) lines.push(`*Type:* ${escapeMarkdownV2(String(m.conflictType))}`);
      return lines.join("\n");
    },
    commandSuggestion: () => "/conflicts",
  },

  "eventbus.backlog": {
    emoji: "\u{1f534}",
    title: "Event Bus Backlog",
    formatFields: (m) => {
      if (m.queueDepth !== undefined) {
        return `*Queue depth:* ${escapeMarkdownV2(String(m.queueDepth))}`;
      }
      return "";
    },
    commandSuggestion: () => "/health",
  },

  "agent.offline": {
    emoji: "\u{1f7e1}",
    title: "Agent Offline",
    formatFields: (m) => {
      if (m.agentId) {
        return `*Agent:* ${escapeMarkdownV2(String(m.agentId))}`;
      }
      return "";
    },
    commandSuggestion: (m) => (m.agentId ? `/status ${String(m.agentId)}` : "/fleet"),
  },

  "dependency.blocking": {
    emoji: "\u{1f7e1}",
    title: "Dependency Blocking",
    formatFields: (m) => {
      const lines: string[] = [];
      if (m.storyId) lines.push(`*Story:* ${escapeMarkdownV2(String(m.storyId))}`);
      if (m.blockingStoryId) {
        const project = m.blockingProject
          ? ` \\(${escapeMarkdownV2(String(m.blockingProject))}\\)`
          : "";
        lines.push(`*Blocked by:* ${escapeMarkdownV2(String(m.blockingStoryId))}${project}`);
      }
      return lines.join("\n");
    },
    commandSuggestion: () => "/status",
  },
};

// ---------------------------------------------------------------------------
// Dedup count formatting
// ---------------------------------------------------------------------------

/**
 * Format a dedup occurrence count line for Telegram MarkdownV2.
 * Returns empty string when occurrences <= 1 (no duplicates suppressed).
 */
export function formatDedupCountLine(occurrences: number, windowMs: number): string {
  if (occurrences <= 1) return "";
  const minutes = Math.max(1, Math.round(windowMs / 60000));
  return `\u{1f4ca} Occurred ${escapeMarkdownV2(String(occurrences))} times in the last ${escapeMarkdownV2(String(minutes))} min\\.`;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Format a Notification as a Telegram MarkdownV2 message with
 * event-specific details and /command suggestions.
 */
export function formatNotificationMessage(notification: Notification): string {
  const { eventType, priority, message, metadata } = notification;
  const formatter = EVENT_FORMATTERS[eventType];

  if (formatter) {
    const title = escapeMarkdownV2(formatter.title);
    const fields = formatter.formatFields(metadata ?? {});
    const command = formatter.commandSuggestion(metadata ?? {});
    const body = escapeMarkdownV2(message);

    const lines = [`${formatter.emoji} *${title}*`, `*Priority:* ${escapeMarkdownV2(priority)}`];

    if (fields) {
      lines.push("");
      lines.push(fields);
    }

    lines.push("");
    lines.push(body);

    // Append dedup occurrence count when duplicates were suppressed
    const dedupLine = formatDedupCountLine(
      (metadata?._dedupOccurrences as number | undefined) ?? 0,
      (metadata?._dedupWindowMs as number | undefined) ?? 0,
    );
    if (dedupLine) {
      lines.push("");
      lines.push(dedupLine);
    }

    lines.push("");
    lines.push(`Commands: ${escapeMarkdownV2(command)}`);

    return lines.join("\n");
  }

  // Fallback for unknown event types
  const emoji = priorityEmoji(priority);
  const title = escapeMarkdownV2(eventType);
  const body = escapeMarkdownV2(message);

  const fallbackLines = [
    `${emoji} *${title}*`,
    `*Priority:* ${escapeMarkdownV2(priority)}`,
    "",
    body,
  ];

  const fallbackDedupLine = formatDedupCountLine(
    (metadata?._dedupOccurrences as number | undefined) ?? 0,
    (metadata?._dedupWindowMs as number | undefined) ?? 0,
  );
  if (fallbackDedupLine) {
    fallbackLines.push("");
    fallbackLines.push(fallbackDedupLine);
  }

  fallbackLines.push("");
  fallbackLines.push(`Commands: ${escapeMarkdownV2("/status")}`);

  return fallbackLines.join("\n");
}
