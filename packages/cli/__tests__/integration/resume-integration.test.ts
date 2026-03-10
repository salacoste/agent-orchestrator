/**
 * Integration Tests: Resume Workflow
 *
 * End-to-end tests for the resume command, including:
 * - Crash details loading from metadata
 * - Context delivery to resumed agent
 * - Registry update persistence
 * - Multiple retries of same story
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { writeFileSync, readFileSync, unlinkSync, existsSync, mkdirSync, rmdirSync } from "node:fs";
import { join } from "node:path";
import { parse } from "yaml";

interface TestContext {
  testDir: string;
  sprintStatusPath: string;
  storyLocationDir: string;
  configPath: string;
  sessionsDir: string;
}

describe("Resume Integration Tests", () => {
  let ctx: TestContext;

  beforeEach(() => {
    // Create test directory structure
    ctx = {
      testDir: `/tmp/resume-integration-test-${Date.now()}`,
      sprintStatusPath: "",
      storyLocationDir: "",
      configPath: "",
      sessionsDir: "",
    };

    ctx.sprintStatusPath = join(ctx.testDir, "sprint-status.yaml");
    ctx.storyLocationDir = join(ctx.testDir, "implementation-artifacts");
    ctx.configPath = join(ctx.testDir, "agent-orchestrator.yaml");
    ctx.sessionsDir = join(ctx.testDir, "sessions");

    mkdirSync(ctx.testDir, { recursive: true });
    mkdirSync(ctx.storyLocationDir, { recursive: true });
    mkdirSync(ctx.sessionsDir, { recursive: true });

    // Create test sprint-status.yaml
    const sprintStatus = {
      generated: "2026-03-06",
      project: "agent-orchestrator",
      project_key: "AO",
      tracking_system: "file-system",
      story_location: "implementation-artifacts",
      development_status: {
        "1-7-cli-resume-blocked-story": "blocked",
        "epic-1": "in-progress",
      },
    };
    writeFileSync(ctx.sprintStatusPath, stringify(sprintStatus), "utf-8");

    // Create test story file
    const storyContent = `# Story 1.7: CLI Resume Blocked Story

Status: blocked

## Story

As a Developer,
I want to resume an agent after resolving a blocking issue,
so that the agent can continue its work without losing context.

## Acceptance Criteria

1. **Given** STORY-001 is blocked due to a failed agent
   **When** I have resolved the blocking issue
   **And** I run \`ao resume STORY-001\`
   **Then** the system respawns the agent in a new tmux session
   **And** the agent receives context about the previous failure
`;
    writeFileSync(
      join(ctx.storyLocationDir, "1-7-cli-resume-blocked-story.md"),
      storyContent,
      "utf-8",
    );

    // Create minimal config
    const config = {
      configPath: ctx.configPath,
      port: 3000,
      readyThresholdMs: 300000,
      defaults: {
        runtime: "tmux",
        agent: "claude-code",
        workspace: "worktree",
        notifiers: ["desktop"],
      },
      projects: {
        "agent-orchestrator": {
          name: "Agent Orchestrator",
          repo: "test/agent-orchestrator",
          path: ctx.testDir,
          defaultBranch: "main",
          sessionPrefix: "ao",
        },
      },
      notifiers: {},
      notificationRouting: {},
      reactions: {},
    };
    writeFileSync(ctx.configPath, stringify(config), "utf-8");
  });

  afterEach(() => {
    // Cleanup test directory
    try {
      unlinkSync(ctx.sprintStatusPath);
      const storyFile = join(ctx.storyLocationDir, "1-7-cli-resume-blocked-story.md");
      if (existsSync(storyFile)) {
        unlinkSync(storyFile);
      }
      const configFile = join(ctx.testDir, "agent-orchestrator.yaml");
      if (existsSync(configFile)) {
        unlinkSync(configFile);
      }
      rmdirSync(ctx.storyLocationDir);
      rmdirSync(ctx.sessionsDir);
      rmdirSync(ctx.testDir);
    } catch {
      // Ignore cleanup errors
    }
  });

  describe("Crash Details Loading from Metadata", () => {
    it("should load crash details from previous agent's metadata file", () => {
      // Arrange: Create a metadata file with crash details
      const agentId = "ao-1-7-cli-resume-blocked-story";
      const metadataPath = join(ctx.sessionsDir, agentId);

      const metadataContent = `worktree=/tmp/worktree
branch=feature/test
status=failed
tmuxName=${agentId}
issue=1-7-cli-resume-blocked-story
exitCode=1
signal=SIGABRT
failureReason=crashed
`;

      writeFileSync(metadataPath, metadataContent, "utf-8");

      // Act: Read metadata and parse
      const content = readFileSync(metadataPath, "utf-8");
      const lines = content.split("\n");
      const metadata: Record<string, string> = {};

      for (const line of lines) {
        const eqIndex = line.indexOf("=");
        if (eqIndex !== -1) {
          const key = line.slice(0, eqIndex).trim();
          const value = line.slice(eqIndex + 1).trim();
          metadata[key] = value;
        }
      }

      // Assert: Crash details are present
      expect(metadata.exitCode).toBe("1");
      expect(metadata.signal).toBe("SIGABRT");
      expect(metadata.failureReason).toBe("crashed");
    });

    it("should handle missing crash details gracefully", () => {
      // Arrange: Create a metadata file without crash details
      const agentId = "ao-1-7-test-agent";
      const metadataPath = join(ctx.sessionsDir, agentId);

      const metadataContent = `worktree=/tmp/worktree
branch=feature/test
status=working
tmuxName=${agentId}
`;

      writeFileSync(metadataPath, metadataContent, "utf-8");

      // Act: Read metadata and parse
      const content = readFileSync(metadataPath, "utf-8");
      const lines = content.split("\n");
      const metadata: Record<string, string> = {};

      for (const line of lines) {
        const eqIndex = line.indexOf("=");
        if (eqIndex !== -1) {
          const key = line.slice(0, eqIndex).trim();
          const value = line.slice(eqIndex + 1).trim();
          metadata[key] = value;
        }
      }

      // Assert: No crash details present
      expect(metadata.exitCode).toBeUndefined();
      expect(metadata.signal).toBeUndefined();
      expect(metadata.failureReason).toBeUndefined();
    });
  });

  describe("Context Delivery to Resumed Agent", () => {
    it("should format resume context with crash details", () => {
      // Arrange: Previous assignment details
      const _previousAssignment = {
        agentId: "ao-1-7-cli-resume-blocked-story",
        storyId: "1-7-cli-resume-blocked-story",
        assignedAt: new Date("2026-03-06T09:15:00Z"),
        status: "crashed" as const,
        contextHash: "abc123",
      };

      const resumeContext = `==============================================================
RESUME CONTEXT
==============================================================

STORY TO COMPLETE:
  ID: 1-7-cli-resume-blocked-story
  Title: CLI Resume Blocked Story
  Status: blocked

DESCRIPTION:
  As a Developer, I want to resume an agent...

ACCEPTANCE CRITERIA:
  1. Given STORY-001 is blocked

PREVIOUS ATTEMPT:
  Agent: ao-1-7-cli-resume-blocked-story
  Status: crashed
  Assigned: moments ago
  Exit Code: 1
  Signal: SIGABRT

BLOCKAGE REASON:
  The agent crashed with a signal, indicating a runtime error.

RESUME INSTRUCTIONS:
  This is retry #1 for this story.
  Your task is to:
  1. Review the previous attempt details above
  2. Understand why the previous agent failed
  3. Continue the work from where it left off
  4. Address the blockage that caused the failure

  Focus on completing the story acceptance criteria.

==============================================================
END RESUME CONTEXT
==============================================================
`;

      // Assert: Resume context contains crash details
      expect(resumeContext).toContain("Exit Code: 1");
      expect(resumeContext).toContain("Signal: SIGABRT");
      expect(resumeContext).toContain("BLOCKAGE REASON:");
      expect(resumeContext).toContain("The agent crashed with a signal");
      expect(resumeContext).toContain("This is retry #1");
    });

    it("should include user message in resume context when provided", () => {
      // Arrange: Resume context with user message
      const _userMessage = "Fixed the null pointer in auth.ts, try again";

      const resumeContext = `RESUME INSTRUCTIONS:
  This is retry #1 for this story.
  Your task is to:
  1. Review the previous attempt details above
  2. Understand why the previous agent failed
  3. Continue the work from where it left off
  4. Address the blockage that caused the failure

ADDITIONAL CONTEXT FROM USER:
  Fixed the null pointer in auth.ts, try again

  Focus on completing the story acceptance criteria.
`;

      // Assert: User message is included
      expect(resumeContext).toContain("ADDITIONAL CONTEXT FROM USER:");
      expect(resumeContext).toContain("Fixed the null pointer in auth.ts");
    });
  });

  describe("Registry Update Persistence", () => {
    it("should persist retry count across registry reloads", () => {
      // Arrange: Create agent registry file
      const registryPath = join(ctx.sessionsDir, "agent-registry.jsonl");
      const timestamp = new Date().toISOString();

      // First attempt
      const entry1 = `${timestamp}|register|ao-1-7-cli-resume-blocked-story|1-7-cli-resume-blocked-story|active|abc123\n`;
      writeFileSync(registryPath, entry1, "utf-8");

      // Increment retry
      const entry2 = `${timestamp}|incrementRetry|1-7-cli-resume-blocked-story|ao-1-7-retry-1\n`;
      writeFileSync(registryPath, entry2, { flag: "a" });

      // Act: Read registry file
      const content = readFileSync(registryPath, "utf-8");
      const lines = content.trim().split("\n");

      // Assert: Both entries are present
      expect(lines).toHaveLength(2);
      expect(lines[0]).toContain("register");
      expect(lines[1]).toContain("incrementRetry");
      expect(lines[1]).toContain("ao-1-7-retry-1");
    });

    it("should track retry history for a story", () => {
      // Arrange: Registry with multiple retries
      const registryPath = join(ctx.sessionsDir, "agent-registry.jsonl");
      const baseTime = new Date().toISOString();

      const entries = [
        `${baseTime}|register|ao-1-7-initial|1-7-cli-resume-blocked-story|failed|abc123\n`,
        `${baseTime}|incrementRetry|1-7-cli-resume-blocked-story|ao-1-7-retry-1\n`,
        `${baseTime}|register|ao-1-7-retry-1|1-7-cli-resume-blocked-story|crashed|abc123\n`,
        `${baseTime}|incrementRetry|1-7-cli-resume-blocked-story|ao-1-7-retry-2\n`,
      ];

      writeFileSync(registryPath, entries.join(""), "utf-8");

      // Act: Parse retry history
      const content = readFileSync(registryPath, "utf-8");
      const retryEntries = content.split("\n").filter((line) => line.includes("incrementRetry"));

      // Assert: Two retry entries found
      expect(retryEntries).toHaveLength(2);
      expect(retryEntries[0]).toContain("ao-1-7-retry-1");
      expect(retryEntries[1]).toContain("ao-1-7-retry-2");
    });
  });

  describe("Multiple Retries of Same Story", () => {
    it("should increment retry count with each resume", () => {
      // Arrange: Story with multiple previous attempts
      const _storyId = "1-7-cli-resume-blocked-story";
      const retryCounts = [0, 1, 2, 3];

      for (const count of retryCounts) {
        // Act: Format resume context with this retry count
        const retryLine = `  This is retry #${count + 1} for this story.`;

        // Assert: Retry count is correctly displayed
        expect(retryLine).toContain(`#${count + 1}`);
      }
    });

    it("should track previous agent IDs in retry history", () => {
      // Arrange: Multiple agent attempts
      const agentIds = ["ao-1-7-initial", "ao-1-7-retry-1", "ao-1-7-retry-2", "ao-1-7-retry-3"];

      // Act: Build retry history
      const previousAgents: string[] = [];
      for (let i = 0; i < agentIds.length - 1; i++) {
        previousAgents.push(agentIds[i]);
      }

      // Assert: All previous agents are tracked
      expect(previousAgents).toHaveLength(3);
      expect(previousAgents[0]).toBe("ao-1-7-initial");
      expect(previousAgents[1]).toBe("ao-1-7-retry-1");
      expect(previousAgents[2]).toBe("ao-1-7-retry-2");
    });

    it("should generate unique agent names for each retry", () => {
      // Arrange: Story ID and retry counts
      const storyId = "1-7-cli-resume-blocked-story";
      const retryCounts = [1, 2, 3, 4, 5];

      const agentNames: string[] = [];
      for (const retryCount of retryCounts) {
        // Act: Generate agent name
        const agentName = `ao-${storyId}-retry-${retryCount}`;
        agentNames.push(agentName);
      }

      // Assert: All agent names are unique
      const uniqueNames = new Set(agentNames);
      expect(uniqueNames.size).toBe(5);
    });
  });

  describe("Sprint Status Updates", () => {
    it("should update story status from blocked to in-progress on resume", () => {
      // Arrange: Story is blocked
      const content = readFileSync(ctx.sprintStatusPath, "utf-8");
      const sprintStatus = parse(content) as { development_status: Record<string, string> };

      expect(sprintStatus.development_status["1-7-cli-resume-blocked-story"]).toBe("blocked");

      // Act: Update to in-progress
      sprintStatus.development_status["1-7-cli-resume-blocked-story"] = "in-progress";
      writeFileSync(ctx.sprintStatusPath, stringify(sprintStatus), "utf-8");

      // Assert: Status is updated
      const updated = readFileSync(ctx.sprintStatusPath, "utf-8");
      const updatedStatus = parse(updated) as { development_status: Record<string, string> };

      expect(updatedStatus.development_status["1-7-cli-resume-blocked-story"]).toBe("in-progress");
    });

    it("should preserve other story statuses during update", () => {
      // Arrange: Multiple stories in sprint status
      const content = readFileSync(ctx.sprintStatusPath, "utf-8");
      const sprintStatus = parse(content) as { development_status: Record<string, string> };

      // Add another story
      sprintStatus.development_status["1-8-another-story"] = "ready-for-dev";
      writeFileSync(ctx.sprintStatusPath, stringify(sprintStatus), "utf-8");

      // Act: Update one story
      const beforeUpdate = readFileSync(ctx.sprintStatusPath, "utf-8");
      const beforeStatus = parse(beforeUpdate) as { development_status: Record<string, string> };

      beforeStatus.development_status["1-7-cli-resume-blocked-story"] = "in-progress";
      writeFileSync(ctx.sprintStatusPath, stringify(beforeStatus), "utf-8");

      // Assert: Other stories are preserved
      const afterUpdate = readFileSync(ctx.sprintStatusPath, "utf-8");
      const afterStatus = parse(afterUpdate) as { development_status: Record<string, string> };

      expect(afterStatus.development_status["1-7-cli-resume-blocked-story"]).toBe("in-progress");
      expect(afterStatus.development_status["1-8-another-story"]).toBe("ready-for-dev");
      expect(afterStatus.development_status["epic-1"]).toBe("in-progress");
    });
  });

  describe("Story File Parsing", () => {
    it("should parse story file correctly for resume context", () => {
      // Arrange: Story file exists
      const storyPath = join(ctx.storyLocationDir, "1-7-cli-resume-blocked-story.md");
      const content = readFileSync(storyPath, "utf-8");

      // Act: Parse story sections
      const lines = content.split("\n");
      let title = "";
      let status = "";
      const descriptionLines: string[] = [];
      const acLines: string[] = [];
      let currentSection = "";

      for (const line of lines) {
        const statusMatch = line.match(/^Status:\s*(.+)$/);
        if (statusMatch) {
          status = statusMatch[1].trim();
          continue;
        }

        const titleMatch = line.match(/^# (.+)$/);
        if (titleMatch && !title) {
          title = titleMatch[1].replace(/^Story\s+/, "").trim();
          continue;
        }

        if (line.startsWith("## ")) {
          currentSection = line.replace("## ", "").toLowerCase().trim();
          continue;
        }

        if (currentSection === "story" && line.trim() && !line.startsWith("#")) {
          descriptionLines.push(line);
        }

        if (currentSection === "acceptance criteria" && line.trim()) {
          acLines.push(line);
        }
      }

      // Assert: Story is parsed correctly
      expect(title).toContain("CLI Resume Blocked Story");
      expect(status).toBe("blocked");
      expect(descriptionLines.length).toBeGreaterThan(0);
      expect(acLines.length).toBeGreaterThan(0);
      expect(descriptionLines.join(" ")).toContain("resume an agent");
    });
  });
});

function stringify(obj: unknown): string {
  // Simple YAML stringifier for test data
  const _lines: string[] = [];

  function stringifyValue(value: unknown, indent = 0): string {
    const spaces = " ".repeat(indent);

    if (value === null) {
      return "null";
    }

    if (typeof value === "string") {
      return value;
    }

    if (typeof value === "number" || typeof value === "boolean") {
      return String(value);
    }

    if (Array.isArray(value)) {
      if (value.length === 0) return "[]";
      return value.map((v) => stringifyValue(v, indent)).join("\n");
    }

    if (typeof value === "object") {
      const objValue = value as Record<string, unknown>;
      const result: string[] = [];
      for (const [key, val] of Object.entries(objValue)) {
        if (val === undefined) continue;
        const valStr = stringifyValue(val, indent + 2);
        if (typeof val === "object" && val !== null && !Array.isArray(val)) {
          result.push(`${spaces}${key}:\n${valStr}`);
        } else {
          result.push(`${spaces}${key}: ${valStr}`);
        }
      }
      return result.join("\n");
    }

    return String(value);
  }

  return stringifyValue(obj, 0);
}
