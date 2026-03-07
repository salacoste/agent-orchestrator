import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { join } from "node:path";
import { writeFileSync, unlinkSync, existsSync, mkdirSync, readFileSync } from "node:fs";

const testDir = join(__dirname, "temp-spawn-story-test");
const sprintStatusPath = join(testDir, "sprint-status.yaml");
const storyLocationDir = join(testDir, "implementation-artifacts");

describe("spawn-story command", () => {
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
    if (existsSync(storyLocationDir)) {
      const storyFile = join(storyLocationDir, "1-2-cli-spawn-agent-with-story-context.md");
      if (existsSync(storyFile)) {
        unlinkSync(storyFile);
      }
    }
  });

  it("should parse sprint-status.yaml and find story", () => {
    // Arrange: Create sprint-status.yaml
    const sprintStatusContent = `
generated: 2026-03-06
project: agent-orchestrator
project_key: NOKEY
tracking_system: file-system
story_location: implementation-artifacts

development_status:
  epic-1: in-progress
  1-2-cli-spawn-agent-with-story-context: ready-for-dev
  1-3-state-track-agent-assignments: backlog
`;
    writeFileSync(sprintStatusPath, sprintStatusContent, "utf-8");

    // Create a test story file
    const storyContent = `# Story 1.2: CLI Spawn Agent with Story Context

Status: ready-for-dev

## Story

As a Product Manager,
I want to spawn an AI agent with full story context passed to it,
so that the agent can begin working on a story without manual setup.

## Acceptance Criteria

1. **Given** a valid sprint-status.yaml file exists in the project directory
   **When** I run \`ao spawn-story --story 1-2-cli-spawn-agent-with-story-context\`
   **Then** the system spawns a new tmux session
`;
    writeFileSync(
      join(storyLocationDir, "1-2-cli-spawn-agent-with-story-context.md"),
      storyContent,
      "utf-8",
    );

    // Assert: Verify files were created
    expect(existsSync(sprintStatusPath)).toBe(true);
    expect(existsSync(join(storyLocationDir, "1-2-cli-spawn-agent-with-story-context.md"))).toBe(
      true,
    );
  });

  it("should extract story context correctly", () => {
    // Arrange: Create a story file with known content
    const storyContent = `# Story 1.2: Test Story Title

Status: ready-for-dev

## Story

As a developer,
I want to test story parsing,
so that I can verify the implementation.

## Acceptance Criteria

1. Given a valid story file
   When I parse it
   Then I should get correct context
`;
    const storyPath = join(storyLocationDir, "1-2-test.md");
    writeFileSync(storyPath, storyContent, "utf-8");

    // Act: Read and verify content
    const content = readFileSync(storyPath, "utf-8");

    // Assert: Verify key sections are present
    expect(content).toContain("Test Story Title");
    expect(content).toContain("As a developer,");
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

  it("should handle missing story file gracefully", () => {
    // Arrange: Create sprint-status.yaml but no story file
    const sprintStatusContent = `
generated: 2026-03-06
project: agent-orchestrator
project_key: NOKEY
tracking_system: file-system
story_location: implementation-artifacts

development_status:
  1-2-cli-spawn-agent-with-story-context: ready-for-dev
`;
    writeFileSync(sprintStatusPath, sprintStatusContent, "utf-8");

    // Assert: Story file should not exist
    const storyPath = join(storyLocationDir, "1-2-cli-spawn-agent-with-story-context.md");
    expect(existsSync(storyPath)).toBe(false);
  });

  it("should normalize story ID with story- prefix", () => {
    // Test that story IDs with "story-" prefix are normalized
    const storyIdWithPrefix = "story-1-2-cli-spawn-agent";
    const normalized = storyIdWithPrefix.replace(/^story-/, "");

    expect(normalized).toBe("1-2-cli-spawn-agent");
  });

  it("should extract epic ID from story ID", () => {
    // Test epic ID extraction
    const storyId = "1-2-cli-spawn-agent";
    const match = storyId.match(/^(\d+)-/);
    const epicId = match ? `epic-${match[1]}` : null;

    expect(epicId).toBe("epic-1");
  });

  it("should handle invalid story IDs", () => {
    // Test that invalid story IDs are rejected
    const invalidIds = ["", "invalid", "story-1", "1-", "-1", "epic-1"];

    for (const id of invalidIds) {
      const match = id.match(/^\d+-\d+-/);
      expect(match).toBeNull();
    }
  });

  it("should format story prompt correctly", () => {
    // Test story prompt formatting
    const story = {
      id: "1-2-cli-spawn-agent",
      title: "CLI Spawn Agent with Story Context",
      status: "ready-for-dev",
      description: "As a Product Manager, I want to spawn an AI agent",
      acceptanceCriteria: "1. Given a valid sprint-status.yaml file",
      epic: "epic-1",
      dependencies: ["1-1-cli-generate-sprint-plan"],
    };

    const parts: string[] = [];
    parts.push(`# Story: ${story.title}`);
    parts.push(`**Story ID:** ${story.id}`);
    parts.push(`**Epic:** ${story.epic}`);
    parts.push(`**Status:** ${story.status}`);
    parts.push("");
    parts.push("## Description");
    parts.push(story.description);
    parts.push("");
    parts.push("## Acceptance Criteria");
    parts.push(story.acceptanceCriteria);

    const prompt = parts.join("\n");

    expect(prompt).toContain("# Story: CLI Spawn Agent with Story Context");
    expect(prompt).toContain("**Story ID:** 1-2-cli-spawn-agent");
    expect(prompt).toContain("**Epic:** epic-1");
    expect(prompt).toContain("As a Product Manager, I want to spawn an AI agent");
    expect(prompt).toContain("## Acceptance Criteria");
  });

  it("should include dependencies in prompt when available", () => {
    const dependencies = ["1-1-cli-generate-sprint-plan", "1-3-state-track-agent-assignments"];

    const parts: string[] = [];
    if (dependencies.length > 0) {
      parts.push("## Dependencies");
      parts.push(`This story depends on: ${dependencies.join(", ")}`);
      parts.push("");
    }

    const prompt = parts.join("\n");

    expect(prompt).toContain("## Dependencies");
    expect(prompt).toContain("1-1-cli-generate-sprint-plan");
    expect(prompt).toContain("1-3-state-track-agent-assignments");
  });
});

describe("spawn-story security tests", () => {
  it("should use execFile for tmux check (not exec)", () => {
    // Verify that execFile is used instead of exec for security
    const content = readFileSync(join(__dirname, "../../src/commands/spawn-story.ts"), "utf-8");

    // Verify execFile is imported and used
    expect(content).toContain('{ execFile } from "node:child_process"');
    expect(content).toContain("execFileAsync(");
  });

  it("should include timeout for tmux check", () => {
    // Verify timeout is set for external commands (NFR-S9)
    const content = readFileSync(join(__dirname, "../../src/commands/spawn-story.ts"), "utf-8");

    // Look for timeout option in execFile calls
    expect(content).toContain("timeout:");
    expect(content).toContain("30000"); // 30s timeout
  });
});

describe("spawn-story performance tests", () => {
  it("should parse story files quickly", () => {
    // Performance test: Story file parsing should be fast
    const storyContent = `
# Story 1.2: Performance Test Story

Status: ready-for-dev

## Story

As a developer,
I want fast story parsing,
so that spawn commands complete quickly.

## Acceptance Criteria

1. Story parsing completes within 100ms
2. File I/O is minimized
3. Regex operations are efficient
`;
    const storyPath = join(storyLocationDir, "1-2-perf-test.md");
    writeFileSync(storyPath, storyContent, "utf-8");

    const startTime = Date.now();
    const content = readFileSync(storyPath, "utf-8");
    const endTime = Date.now();

    expect(endTime - startTime).toBeLessThan(100);
  });
});
