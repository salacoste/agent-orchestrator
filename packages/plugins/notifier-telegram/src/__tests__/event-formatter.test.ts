/**
 * Tests for event-specific Telegram message formatter.
 * Story 57.2 Task 4 — verify event-type-specific formatting with /commands.
 */
import { describe, it, expect } from "vitest";
import { formatNotificationMessage, formatDedupCountLine } from "../event-formatter.js";
import type { Notification } from "@composio/ao-core";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeNotification(eventType: string, overrides?: Partial<Notification>): Notification {
  return {
    eventId: "test-1",
    eventType,
    priority: "critical",
    title: "Test",
    message: "Something happened",
    metadata: {},
    timestamp: "2026-04-08T00:00:00.000Z",
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("formatNotificationMessage", () => {
  // --- agent.blocked ---
  describe("agent.blocked", () => {
    it("shows event-specific title and metadata fields", () => {
      const result = formatNotificationMessage(
        makeNotification("agent.blocked", {
          message: "Agent is blocked",
          metadata: { agentId: "agent-1", storyId: "story-5", reason: "CI failed" },
        }),
      );

      expect(result).toContain("Agent Blocked");
      expect(result).toContain("agent\\-1");
      expect(result).toContain("story\\-5");
      expect(result).toContain("CI failed");
      expect(result).toContain("/status agent\\-1");
      expect(result).not.toContain("session.needs_input");
    });

    it("falls back to /fleet when no agentId", () => {
      const result = formatNotificationMessage(
        makeNotification("agent.blocked", {
          metadata: { storyId: "story-5" },
        }),
      );

      expect(result).toContain("/fleet");
    });
  });

  // --- story.blocked ---
  describe("story.blocked", () => {
    it("shows story ID, reason, and /resume command", () => {
      const result = formatNotificationMessage(
        makeNotification("story.blocked", {
          message: "Story blocked",
          metadata: { storyId: "story-10", reason: "dependency" },
        }),
      );

      expect(result).toContain("Story Blocked");
      expect(result).toContain("story\\-10");
      expect(result).toContain("dependency");
      expect(result).toContain("/resume story\\-10");
      expect(result).not.toContain("session.needs_input");
    });

    it("falls back to /fleet when no storyId", () => {
      const result = formatNotificationMessage(makeNotification("story.blocked", { metadata: {} }));

      expect(result).toContain("/fleet");
    });
  });

  // --- conflict.detected ---
  describe("conflict.detected", () => {
    it("shows story, conflict type, and /conflicts command", () => {
      const result = formatNotificationMessage(
        makeNotification("conflict.detected", {
          message: "Conflict detected",
          metadata: { storyId: "story-3", conflictType: "file-edit" },
        }),
      );

      expect(result).toContain("Conflict Detected");
      expect(result).toContain("story\\-3");
      expect(result).toContain("file\\-edit");
      expect(result).toContain("/conflicts");
      expect(result).not.toContain("session.needs_input");
    });
  });

  // --- eventbus.backlog ---
  describe("eventbus.backlog", () => {
    it("shows queue depth and /health command", () => {
      const result = formatNotificationMessage(
        makeNotification("eventbus.backlog", {
          message: "Backlog detected",
          metadata: { queueDepth: 75 },
        }),
      );

      expect(result).toContain("Event Bus Backlog");
      expect(result).toContain("75");
      expect(result).toContain("/health");
      expect(result).not.toContain("session.needs_input");
    });

    it("handles missing queueDepth gracefully", () => {
      const result = formatNotificationMessage(
        makeNotification("eventbus.backlog", { metadata: {} }),
      );

      expect(result).toContain("Event Bus Backlog");
      expect(result).toContain("Something happened");
      expect(result).toContain("/health");
    });
  });

  // --- agent.offline ---
  describe("agent.offline", () => {
    it("shows agent ID and /status command", () => {
      const result = formatNotificationMessage(
        makeNotification("agent.offline", {
          priority: "warning",
          message: "Agent went offline",
          metadata: { agentId: "agent-7" },
        }),
      );

      expect(result).toContain("Agent Offline");
      expect(result).toContain("agent\\-7");
      expect(result).toContain("/status agent\\-7");
    });

    it("falls back to /fleet when no agentId", () => {
      const result = formatNotificationMessage(
        makeNotification("agent.offline", {
          priority: "warning",
          metadata: {},
        }),
      );

      expect(result).toContain("/fleet");
    });
  });

  // --- dependency.blocking ---
  describe("dependency.blocking", () => {
    it("shows blocked story, blocking dependency, and /status command", () => {
      const result = formatNotificationMessage(
        makeNotification("dependency.blocking", {
          priority: "warning",
          message: "Cross-project dependency blocking",
          metadata: {
            storyId: "story-20",
            blockingStoryId: "story-15",
            blockingProject: "other-app",
          },
        }),
      );

      expect(result).toContain("Dependency Blocking");
      expect(result).toContain("story\\-20");
      expect(result).toContain("story\\-15");
      expect(result).toContain("other\\-app");
      expect(result).toContain("/status");
    });

    it("handles missing blockingStoryId", () => {
      const result = formatNotificationMessage(
        makeNotification("dependency.blocking", {
          priority: "warning",
          metadata: { storyId: "story-20" },
        }),
      );

      expect(result).toContain("story\\-20");
      expect(result).toContain("/status");
    });
  });

  // --- Fallback ---
  describe("unknown event type", () => {
    it("produces generic fallback message", () => {
      const result = formatNotificationMessage(
        makeNotification("custom.event", {
          message: "Custom event happened",
        }),
      );

      expect(result).toContain("custom\\.event");
      expect(result).toContain("Custom event happened");
      expect(result).toContain("Priority");
      expect(result).toContain("/status");
      expect(result).not.toContain("session.needs_input");
    });

    it("escapes dynamic content in fallback", () => {
      const result = formatNotificationMessage(
        makeNotification("some.type", {
          message: "Hello_World.Test",
        }),
      );

      expect(result).toContain("Hello\\_World\\.Test");
    });
  });

  // --- MarkdownV2 escaping ---
  describe("MarkdownV2 escaping", () => {
    it("escapes special characters in metadata values", () => {
      const result = formatNotificationMessage(
        makeNotification("agent.blocked", {
          metadata: { agentId: "my-app.agent_1", storyId: "story.2" },
        }),
      );

      expect(result).toContain("my\\-app\\.agent\\_1");
      expect(result).toContain("story\\.2");
    });

    it("does not escape static bold markers", () => {
      const result = formatNotificationMessage(
        makeNotification("agent.blocked", {
          metadata: { agentId: "a" },
        }),
      );

      // Static * used for bold formatting should appear unescaped
      expect(result).toContain("*Agent:*");
      expect(result).toContain("*Priority:*");
    });
  });

  // --- Priority display ---
  describe("priority display", () => {
    it("shows priority value in message", () => {
      const result = formatNotificationMessage(
        makeNotification("agent.blocked", {
          priority: "critical",
          metadata: {},
        }),
      );

      expect(result).toContain("*Priority:* critical");
    });

    it("shows warning emoji for warning priority", () => {
      const result = formatNotificationMessage(
        makeNotification("agent.offline", {
          priority: "warning",
          metadata: {},
        }),
      );

      // Yellow circle emoji
      expect(result).toContain("\u{1f7e1}");
    });

    it("shows orange emoji for medium priority", () => {
      const result = formatNotificationMessage(
        makeNotification("custom.event", {
          priority: "medium",
          metadata: {},
        }),
      );

      // Orange circle emoji
      expect(result).toContain("\u{1f7e0}");
    });
  });

  // --- Dedup count line (Story 57.15) ---
  describe("formatDedupCountLine", () => {
    it("returns correct MarkdownV2 string for occurrences > 1", () => {
      const line = formatDedupCountLine(5, 300000);
      expect(line).toContain("5");
      expect(line).toContain("5");
      expect(line).toContain("min");
      expect(line).toContain("\u{1f4ca}"); // chart emoji
    });

    it("returns empty string for occurrences = 1", () => {
      expect(formatDedupCountLine(1, 300000)).toBe("");
    });

    it("returns empty string for occurrences = 0", () => {
      expect(formatDedupCountLine(0, 300000)).toBe("");
    });

    it("escapes numbers in MarkdownV2", () => {
      const line = formatDedupCountLine(12, 600000);
      // Numbers don't need escaping in MarkdownV2, but the period after "min" should be escaped
      expect(line).toContain("min\\.");
    });

    it("clamps windowMs=0 to minimum 1 min", () => {
      const line = formatDedupCountLine(3, 0);
      expect(line).toContain("1 min");
      expect(line).not.toContain("0 min");
    });

    it("clamps small windowMs (<30s) to minimum 1 min", () => {
      const line = formatDedupCountLine(3, 10000);
      expect(line).toContain("1 min");
    });
  });

  // --- formatNotificationMessage with dedup counts (Story 57.15) ---
  describe("dedup count in formatted messages", () => {
    it("includes dedup line when _dedupOccurrences > 1", () => {
      const result = formatNotificationMessage(
        makeNotification("agent.blocked", {
          metadata: {
            agentId: "agent-1",
            _dedupOccurrences: 3,
            _dedupWindowMs: 300000,
          },
        }),
      );

      expect(result).toContain("\u{1f4ca}"); // chart emoji
      expect(result).toContain("3 times");
      expect(result).toContain("5 min");
    });

    it("omits dedup line when no _dedupOccurrences", () => {
      const result = formatNotificationMessage(
        makeNotification("agent.blocked", {
          metadata: { agentId: "agent-1" },
        }),
      );

      expect(result).not.toContain("\u{1f4ca}");
      expect(result).not.toContain("times");
    });

    it("omits dedup line when _dedupOccurrences = 1", () => {
      const result = formatNotificationMessage(
        makeNotification("agent.blocked", {
          metadata: {
            agentId: "agent-1",
            _dedupOccurrences: 1,
            _dedupWindowMs: 300000,
          },
        }),
      );

      expect(result).not.toContain("\u{1f4ca}");
      expect(result).not.toContain("times");
    });

    it("includes dedup line in fallback for unknown event types", () => {
      const result = formatNotificationMessage(
        makeNotification("custom.event", {
          metadata: {
            _dedupOccurrences: 7,
            _dedupWindowMs: 600000,
          },
        }),
      );

      expect(result).toContain("\u{1f4ca}");
      expect(result).toContain("7 times");
      expect(result).toContain("10 min");
    });
  });
});
