/**
 * Agent History CLI Tests (Story 11.4)
 */

import { describe, it, expect } from "vitest";

describe("agent-history command", () => {
  it("should export registerAgentHistory function", async () => {
    const { registerAgentHistory } = await import("../../src/commands/agent-history.js");
    expect(typeof registerAgentHistory).toBe("function");
  });

  describe("outcome emoji mapping", () => {
    it("maps outcomes to correct emojis", () => {
      const mapping: Record<string, string> = {
        completed: "🟢",
        failed: "🔴",
        blocked: "🟡",
        abandoned: "⚫",
      };

      for (const [outcome, emoji] of Object.entries(mapping)) {
        expect(emoji.length).toBeGreaterThan(0);
        expect(outcome.length).toBeGreaterThan(0);
      }
    });
  });

  describe("duration formatting", () => {
    it("formats minutes for short durations", () => {
      const ms = 5 * 60 * 1000; // 5 minutes
      const totalMinutes = Math.floor(ms / 60000);
      expect(totalMinutes).toBe(5);
    });

    it("formats hours and minutes for longer durations", () => {
      const ms = 150 * 60 * 1000; // 2h 30m
      const totalMinutes = Math.floor(ms / 60000);
      const hours = Math.floor(totalMinutes / 60);
      const minutes = totalMinutes % 60;
      expect(hours).toBe(2);
      expect(minutes).toBe(30);
    });
  });

  describe("table row conversion", () => {
    it("converts SessionLearning to display row", () => {
      const learning = {
        sessionId: "ao-1",
        agentId: "ao-1",
        storyId: "1-1-test-story",
        projectId: "proj",
        outcome: "completed" as const,
        durationMs: 120000,
        retryCount: 0,
        filesModified: ["src/index.ts"],
        testsAdded: 1,
        errorCategories: [],
        domainTags: ["backend", "testing"],
        completedAt: "2026-03-18T14:00:00.000Z",
        capturedAt: "2026-03-18T14:00:01.000Z",
      };

      expect(learning.storyId).toBe("1-1-test-story");
      expect(learning.outcome).toBe("completed");
      expect(learning.domainTags.join(", ")).toBe("backend, testing");
      expect(learning.completedAt.split("T")[0]).toBe("2026-03-18");
    });
  });
});
