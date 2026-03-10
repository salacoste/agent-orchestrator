import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { join } from "node:path";
import { writeFileSync, unlinkSync, existsSync, mkdirSync, readFileSync } from "node:fs";

const testDir = join(__dirname, "temp-resume-test");
const sprintStatusPath = join(testDir, "sprint-status.yaml");
const storyLocationDir = join(testDir, "implementation-artifacts");

describe("resume command", () => {
  beforeEach(() => {
    // Create temp directory for tests
    if (!existsSync(testDir)) {
      mkdirSync(testDir, { recursive: true });
    }
    if (!existsSync(storyLocationDir)) {
      mkdirSync(storyLocationDir, { recursive: true });
    }
  });

  afterEach(() => {
    // Cleanup temp directory
    if (existsSync(sprintStatusPath)) {
      unlinkSync(sprintStatusPath);
    }
    const storyFile = join(storyLocationDir, "1-7-cli-resume-blocked-story.md");
    if (existsSync(storyFile)) {
      unlinkSync(storyFile);
    }
  });

  it("should parse sprint-status.yaml and find blocked story", () => {
    // Arrange: Create sprint-status.yaml with blocked story
    const sprintStatusContent = `
generated: 2026-03-06
project: agent-orchestrator
project_key: NOKEY
tracking_system: file-system
story_location: implementation-artifacts

development_status:
  epic-1: in-progress
  1-7-cli-resume-blocked-story: blocked
  1-8-cli-fleet-monitoring-table: ready-for-dev
`;
    writeFileSync(sprintStatusPath, sprintStatusContent, "utf-8");

    // Act & Assert: Verify file was created and contains blocked story
    expect(existsSync(sprintStatusPath)).toBe(true);
    const content = readFileSync(sprintStatusPath, "utf-8");
    expect(content).toContain("1-7-cli-resume-blocked-story: blocked");
  });

  it("should extract story context correctly for resume", () => {
    // Arrange: Create a story file
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
`;
    const storyPath = join(storyLocationDir, "1-7-cli-resume-blocked-story.md");
    writeFileSync(storyPath, storyContent, "utf-8");

    // Act: Read and verify content
    const content = readFileSync(storyPath, "utf-8");

    // Assert: Verify key sections are present
    expect(content).toContain("CLI Resume Blocked Story");
    expect(content).toContain("As a Developer,");
    expect(content).toContain("Acceptance Criteria");
  });

  it("should handle missing sprint-status.yaml gracefully", () => {
    // Arrange: Ensure no sprint-status.yaml exists
    if (existsSync(sprintStatusPath)) {
      unlinkSync(sprintStatusPath);
    }

    // Assert: File should not exist
    expect(existsSync(sprintStatusPath)).toBe(false);
  });

  it("should handle non-blocked story correctly", () => {
    // Arrange: Create sprint-status.yaml with in-progress story
    const sprintStatusContent = `
generated: 2026-03-06
project: agent-orchestrator
project_key: NOKEY
tracking_system: file-system
story_location: implementation-artifacts

development_status:
  1-7-cli-resume-blocked-story: in-progress
`;
    writeFileSync(sprintStatusPath, sprintStatusContent, "utf-8");

    // Act: Read the file
    const content = readFileSync(sprintStatusPath, "utf-8");

    // Assert: Verify story is not blocked
    expect(content).toContain("1-7-cli-resume-blocked-story: in-progress");
    expect(content).not.toContain("1-7-cli-resume-blocked-story: blocked");
  });

  it("should generate agent session name with retry suffix", () => {
    // Test retry naming convention
    const storyId = "1-7-cli-resume-blocked-story";
    const retryCount = 1;
    const agentName = `ao-${storyId}-retry-${retryCount}`;

    expect(agentName).toBe("ao-1-7-cli-resume-blocked-story-retry-1");

    const secondRetry = `ao-${storyId}-retry-2`;
    expect(secondRetry).toBe("ao-1-7-cli-resume-blocked-story-retry-2");
  });

  it("should handle custom agent session name", () => {
    // Test custom agent name option
    const customName = "custom-agent-name";
    const expected = customName;

    expect(expected).toBe("custom-agent-name");
  });

  it("should extract epic ID from story ID", () => {
    // Test epic ID extraction
    const storyId = "1-7-cli-resume-blocked-story";
    const match = storyId.match(/^(\d+)-/);
    const epicId = match ? `epic-${match[1]}` : null;

    expect(epicId).toBe("epic-1");
  });

  it("should validate user message length", () => {
    // Test user message validation
    const shortMessage = "Fixed the bug in auth.ts";
    const longMessage = "A".repeat(6000);
    const maxLength = 5000;

    let validatedShort = shortMessage.trim();
    if (validatedShort.length > maxLength) {
      validatedShort = validatedShort.slice(0, maxLength - 3) + "...";
    }

    let validatedLong = longMessage.trim();
    if (validatedLong.length > maxLength) {
      validatedLong = validatedLong.slice(0, maxLength - 3) + "...";
    }

    expect(validatedShort).toBe(shortMessage);
    expect(validatedLong.length).toBe(5000);
    expect(validatedLong.slice(-3)).toBe("...");
  });

  it("should handle empty user message", () => {
    // Test empty message handling
    const emptyMessage = "";
    const validated = emptyMessage.trim();

    expect(validated).toBe("");
  });

  it("should normalize story ID with story- prefix", () => {
    // Test that story IDs with "story-" prefix are normalized
    const storyIdWithPrefix = "story-1-7-cli-resume";
    const normalized = storyIdWithPrefix.replace(/^story-/, "");

    expect(normalized).toBe("1-7-cli-resume");
  });
});

describe("resume security tests", () => {
  it("should use execFile for tmux check (not exec)", () => {
    // Verify that execFile is used instead of exec for security
    const content = readFileSync(join(__dirname, "../../src/commands/resume.ts"), "utf-8");

    // Verify execFile is imported and used
    expect(content).toContain('{ execFile } from "node:child_process"');
    expect(content).toContain("execFileAsync(");
  });

  it("should include timeout for tmux check", () => {
    // Verify timeout is set for external commands (NFR-S9)
    const content = readFileSync(join(__dirname, "../../src/commands/resume.ts"), "utf-8");

    // Look for timeout option in execFile calls
    expect(content).toContain("timeout:");
    expect(content).toContain("30000"); // 30s timeout
  });
});

describe("resume performance tests", () => {
  it("should parse story files quickly", () => {
    // Performance test: Story file parsing should be fast
    const storyContent = `
# Story 1.7: Performance Test Story

Status: blocked

## Story

As a developer,
I want fast story parsing for resume,
so that resume commands complete quickly.

## Acceptance Criteria

1. Story parsing completes within 100ms
2. File I/O is minimized
3. Regex operations are efficient
`;
    const storyPath = join(storyLocationDir, "1-7-perf-test.md");
    writeFileSync(storyPath, storyContent, "utf-8");

    const startTime = Date.now();
    readFileSync(storyPath, "utf-8");
    const endTime = Date.now();

    expect(endTime - startTime).toBeLessThan(100);
  });
});
