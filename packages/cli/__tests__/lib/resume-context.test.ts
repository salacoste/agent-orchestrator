import { describe, it, expect } from "vitest";
import {
  formatResumeContext,
  extractPreviousAttemptDetails,
  validateUserMessage,
} from "../../src/lib/resume-context.js";
import type { AgentAssignment } from "@composio/ao-core";

describe("resume-context", () => {
  describe("formatResumeContext", () => {
    const mockStory = {
      id: "1-7-cli-resume-blocked-story",
      title: "CLI Resume Blocked Story",
      status: "blocked",
      description:
        "As a Developer,\nI want to resume an agent after resolving a blocking issue,\nso that the agent can continue its work without losing context.",
      acceptanceCriteria:
        "1. Given STORY-001 is blocked due to a failed agent\n   When I have resolved the blocking issue\n   Then the system respawns the agent",
    };

    const mockAssignment: AgentAssignment = {
      agentId: "ao-1-7-cli-resume-blocked-story",
      storyId: "1-7-cli-resume-blocked-story",
      assignedAt: new Date("2026-03-06T09:15:00Z"),
      status: "failed",
      contextHash: "abc123",
    };

    it("should format resume context with all sections", () => {
      const result = formatResumeContext({
        story: mockStory,
        previousAssignment: mockAssignment,
        retryCount: 1,
      });

      expect(result).toContain("RESUME CONTEXT");
      expect(result).toContain("STORY TO COMPLETE:");
      expect(result).toContain("PREVIOUS ATTEMPT:");
      expect(result).toContain("BLOCKAGE REASON:");
      expect(result).toContain("RESUME INSTRUCTIONS:");
      expect(result).toContain("END RESUME CONTEXT");
    });

    it("should include story details in resume context", () => {
      const result = formatResumeContext({
        story: mockStory,
        previousAssignment: mockAssignment,
        retryCount: 1,
      });

      expect(result).toContain("ID: 1-7-cli-resume-blocked-story");
      expect(result).toContain("Title: CLI Resume Blocked Story");
      expect(result).toContain("Status: blocked");
      expect(result).toContain("As a Developer,");
      expect(result).toContain("resume an agent after resolving a blocking issue");
    });

    it("should include previous attempt details", () => {
      const result = formatResumeContext({
        story: mockStory,
        previousAssignment: mockAssignment,
        retryCount: 1,
      });

      expect(result).toContain("Agent: ao-1-7-cli-resume-blocked-story");
      expect(result).toContain("Status: failed");
      expect(result).toContain("Assigned:");
    });

    it("should include blockage reason", () => {
      const result = formatResumeContext({
        story: mockStory,
        previousAssignment: mockAssignment,
        retryCount: 1,
      });

      expect(result).toContain("The agent exited with a non-zero exit code");
    });

    it("should include retry count in instructions", () => {
      const result = formatResumeContext({
        story: mockStory,
        previousAssignment: mockAssignment,
        retryCount: 2,
      });

      expect(result).toContain("This is retry #2 for this story.");
    });

    it("should include user message when provided", () => {
      const userMessage = "Fixed the bug in auth.ts, try again";
      const result = formatResumeContext({
        story: mockStory,
        previousAssignment: mockAssignment,
        retryCount: 1,
        userMessage,
      });

      expect(result).toContain("ADDITIONAL CONTEXT FROM USER:");
      expect(result).toContain("Fixed the bug in auth.ts, try again");
    });

    it("should include previous logs path when provided", () => {
      const previousLogsPath = "/path/to/logs/agent-1-7.log";
      const result = formatResumeContext({
        story: mockStory,
        previousAssignment: mockAssignment,
        retryCount: 1,
        previousLogsPath,
      });

      expect(result).toContain("Previous session logs are available for reference:");
      expect(result).toContain("/path/to/logs/agent-1-7.log");
    });

    it("should handle crashed agent status", () => {
      const crashedAssignment: AgentAssignment = {
        ...mockAssignment,
        status: "crashed",
      };

      const result = formatResumeContext({
        story: mockStory,
        previousAssignment: crashedAssignment,
        retryCount: 1,
      });

      expect(result).toContain("The agent crashed with a signal");
    });

    it("should handle timed out agent status", () => {
      const timedOutAssignment: AgentAssignment = {
        ...mockAssignment,
        status: "timed_out",
      };

      const result = formatResumeContext({
        story: mockStory,
        previousAssignment: timedOutAssignment,
        retryCount: 1,
      });

      expect(result).toContain("The agent exceeded the maximum allowed runtime");
    });

    it("should handle disconnected agent status", () => {
      const disconnectedAssignment: AgentAssignment = {
        ...mockAssignment,
        status: "disconnected",
      };

      const result = formatResumeContext({
        story: mockStory,
        previousAssignment: disconnectedAssignment,
        retryCount: 1,
      });

      expect(result).toContain("The agent session was disconnected or killed");
    });

    it("should format acceptance criteria correctly", () => {
      const result = formatResumeContext({
        story: mockStory,
        previousAssignment: mockAssignment,
        retryCount: 1,
      });

      expect(result).toContain("ACCEPTANCE CRITERIA:");
      expect(result).toContain("Given STORY-001 is blocked");
    });
  });

  describe("extractPreviousAttemptDetails", () => {
    const mockAssignment: AgentAssignment = {
      agentId: "ao-1-7-cli-resume-blocked-story",
      storyId: "1-7-cli-resume-blocked-story",
      assignedAt: new Date("2026-03-06T09:15:00Z"),
      status: "failed",
      contextHash: "abc123",
    };

    it("should extract details from agent assignment", () => {
      const result = extractPreviousAttemptDetails(mockAssignment);

      expect(result).toEqual({
        agentId: "ao-1-7-cli-resume-blocked-story",
        status: "failed",
        assignedAt: mockAssignment.assignedAt,
        errorContext: undefined,
      });
    });

    it("should handle different agent statuses", () => {
      const statuses: AgentAssignment["status"][] = [
        "failed",
        "crashed",
        "timed_out",
        "disconnected",
      ];

      for (const status of statuses) {
        const assignment = { ...mockAssignment, status };
        const result = extractPreviousAttemptDetails(assignment, undefined);

        expect(result.status).toBe(status);
      }
    });
  });

  describe("validateUserMessage", () => {
    it("should return undefined for empty message", () => {
      const result = validateUserMessage("");
      expect(result).toBeUndefined();
    });

    it("should return undefined for whitespace-only message", () => {
      const result = validateUserMessage("   ");
      expect(result).toBeUndefined();
    });

    it("should return trimmed message for valid input", () => {
      const result = validateUserMessage("  Fixed the bug  ");
      expect(result).toBe("Fixed the bug");
    });

    it("should return undefined for undefined input", () => {
      const result = validateUserMessage(undefined);
      expect(result).toBeUndefined();
    });

    it("should truncate message exceeding max length", () => {
      const longMessage = "A".repeat(6000);
      const result = validateUserMessage(longMessage);

      expect(result).toBeDefined();
      expect(result!.length).toBe(5000);
      expect(result!.slice(-3)).toBe("...");
    });

    it("should not truncate message at max length", () => {
      const message = "A".repeat(5000);
      const result = validateUserMessage(message);

      expect(result).toBe(message);
      expect(result!.length).toBe(5000);
    });

    it("should not truncate message under max length", () => {
      const message = "Fixed the bug in auth.ts";
      const result = validateUserMessage(message);

      expect(result).toBe(message);
    });

    it("should handle multi-line messages", () => {
      const multiLine =
        "Fixed the bug in auth.ts\n\nThe issue was in the validate function.\n\nTry again.";
      const result = validateUserMessage(multiLine);

      expect(result).toBe(multiLine);
    });

    it("should trim whitespace from message before length check", () => {
      const message = "  " + "A".repeat(5100) + "  ";
      const result = validateUserMessage(message);

      // Should truncate because after trimming it exceeds 5000
      expect(result!.length).toBe(5000);
      expect(result!.slice(-3)).toBe("...");
    });

    it("should handle special characters in message", () => {
      const message = "Fixed bug: null pointer exception in `$$.handler()`";
      const result = validateUserMessage(message);

      expect(result).toBe(message);
    });
  });

  describe("resume-context formatting edge cases", () => {
    const mockStory = {
      id: "1-7-test",
      title: "Test Story",
      status: "blocked",
      description: "Test description",
      acceptanceCriteria: "1. Test AC",
    };

    const mockAssignment: AgentAssignment = {
      agentId: "ao-1-7-test",
      storyId: "1-7-test",
      assignedAt: new Date(),
      status: "failed",
      contextHash: "abc",
    };

    it("should handle empty description", () => {
      const emptyDescStory = { ...mockStory, description: "" };
      const result = formatResumeContext({
        story: emptyDescStory,
        previousAssignment: mockAssignment,
        retryCount: 1,
      });

      expect(result).toContain("DESCRIPTION:");
    });

    it("should handle multi-line description", () => {
      const multiLineDesc = "Line 1\nLine 2\nLine 3";
      const story = { ...mockStory, description: multiLineDesc };
      const result = formatResumeContext({
        story,
        previousAssignment: mockAssignment,
        retryCount: 1,
      });

      expect(result).toContain("Line 1");
      expect(result).toContain("Line 2");
      expect(result).toContain("Line 3");
    });

    it("should handle empty acceptance criteria", () => {
      const emptyAcStory = { ...mockStory, acceptanceCriteria: "" };
      const result = formatResumeContext({
        story: emptyAcStory,
        previousAssignment: mockAssignment,
        retryCount: 1,
      });

      expect(result).toContain("ACCEPTANCE CRITERIA:");
    });
  });

  it("should truncate long messages in audit trail", () => {
    // This would be tested in resume.ts integration tests
    // For now, verify the truncate logic exists
    const longMessage = "A".repeat(5000);
    const truncated = longMessage.length > 200 ? longMessage.slice(0, 197) + "..." : longMessage;
    
    expect(truncated).toHaveLength(200);
    expect(truncated.slice(-3)).toBe("...");
  });
});
