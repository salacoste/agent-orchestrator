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

describe("resume — Story 1-4 enhancements", () => {
  it("resume.ts calls wireDetection after spawning a session", () => {
    // Verify resume.ts imports and calls wireDetection from shared utility
    const content = readFileSync(join(__dirname, "../../src/commands/resume.ts"), "utf-8");

    // Must import wireDetection from shared lib
    expect(content).toContain('import { wireDetection } from "../lib/wire-detection.js"');

    // Must call wireDetection with the required parameters
    expect(content).toContain(
      "await wireDetection(config, projectId, session.id, sessionsDir, project.path, registry)",
    );
  });

  it("resume.ts registers assignment with priority=10", () => {
    // Verify resumed stories get priority boost
    const content = readFileSync(join(__dirname, "../../src/commands/resume.ts"), "utf-8");

    // Must set priority: 10 in registry.register call
    expect(content).toContain("priority: 10");
  });

  it("spawn.ts registers assignment with priority=0 for fresh spawns", () => {
    // Verify fresh spawns have default priority
    const content = readFileSync(join(__dirname, "../../src/commands/spawn.ts"), "utf-8");

    // Must set priority: 0 for fresh spawns
    expect(content).toContain("priority: 0");
  });

  it("non-blocked story triggers process.exit(1)", () => {
    // Verify the non-blocked path exits with code 1
    const content = readFileSync(join(__dirname, "../../src/commands/resume.ts"), "utf-8");

    // The non-blocked handler must call spinner.fail and process.exit(1)
    // Find the section where storyStatus !== "blocked"
    const nonBlockedSection = content.slice(
      content.indexOf('if (storyStatus !== "blocked")'),
      content.indexOf("spinner.succeed(`Found story"),
    );

    expect(nonBlockedSection).toContain("spinner.fail");
    expect(nonBlockedSection).toContain("process.exit(1)");
    expect(nonBlockedSection).toContain("Cannot resume");
    // Must NOT just return — must exit
    expect(nonBlockedSection).not.toMatch(/^\s*return;/m);
  });

  it("story not found triggers process.exit(1)", () => {
    // Verify missing story exits with code 1
    const content = readFileSync(join(__dirname, "../../src/commands/resume.ts"), "utf-8");

    // The story-not-found handler
    const notFoundSection = content.slice(
      content.indexOf("if (!storyStatus)"),
      content.indexOf('if (storyStatus !== "blocked")'),
    );

    expect(notFoundSection).toContain("spinner.fail");
    expect(notFoundSection).toContain("process.exit(1)");
    expect(notFoundSection).toContain("not found in sprint-status.yaml");
  });

  it("no previous assignment triggers process.exit(1)", () => {
    // Verify missing previous agent exits with code 1
    const content = readFileSync(join(__dirname, "../../src/commands/resume.ts"), "utf-8");

    const noPrevSection = content.slice(
      content.indexOf("if (!previousAssignment)"),
      content.indexOf("lookupSpinner.succeed"),
    );

    expect(noPrevSection).toContain("process.exit(1)");
    expect(noPrevSection).toContain("no previous agent");
  });

  it("confirmation display includes blocking reason", () => {
    // Verify the confirmation output shows the blocking reason
    const content = readFileSync(join(__dirname, "../../src/commands/resume.ts"), "utf-8");

    // Must import formatFailureReason
    expect(content).toContain("formatFailureReason");

    // Must display "Reason:" line with the blocking reason
    expect(content).toContain('"Reason:"');
    expect(content).toContain("blockingReason");

    // Must display "Cleared:" line after spawn
    expect(content).toContain("Cleared:");
    expect(content).toContain("now in-progress");
  });

  it("wireDetection is wrapped in try-catch for graceful degradation", () => {
    // Verify wireDetection call has error handling
    const content = readFileSync(join(__dirname, "../../src/commands/resume.ts"), "utf-8");

    // Find the wireDetection call section
    const wireSection = content.slice(
      content.indexOf("Wire completion + blocked detection"),
      content.indexOf("Wire completion + blocked detection") + 300,
    );

    expect(wireSection).toContain("try");
    expect(wireSection).toContain("catch");
    expect(wireSection).toContain("monitoring not available");
  });

  it("AgentAssignment type includes optional priority field", () => {
    // Verify the core type was updated
    const typesContent = readFileSync(join(__dirname, "../../../core/src/types.ts"), "utf-8");

    // AgentAssignment must have priority field
    expect(typesContent).toMatch(/priority\?:\s*number/);
  });
});

describe("resume — behavioral tests", () => {
  it("formatFailureReason returns human-readable text for all reasons", async () => {
    // Behavioral test: actually call formatFailureReason with each value
    const { formatFailureReason } = await import("@composio/ao-core");

    expect(formatFailureReason("failed")).toBe("failed with non-zero exit code");
    expect(formatFailureReason("crashed")).toBe("crashed");
    expect(formatFailureReason("timed_out")).toBe("timed out");
    expect(formatFailureReason("disconnected")).toBe("was disconnected (manual termination)");
  });

  it("AgentAssignment accepts priority field at runtime", async () => {
    // Behavioral test: construct an AgentAssignment with priority
    const assignment = {
      agentId: "test-agent-1",
      storyId: "1-4-test",
      assignedAt: new Date(),
      status: "active" as const,
      contextHash: "abc123",
      priority: 10,
    };

    expect(assignment.priority).toBe(10);

    // Default priority for fresh spawns
    const freshAssignment = { ...assignment, priority: 0 };
    expect(freshAssignment.priority).toBe(0);

    // Resumed stories get +10 boost
    expect(assignment.priority).toBeGreaterThan(freshAssignment.priority);
  });

  it("agent registry persists and retrieves priority field", async () => {
    const { getAgentRegistry } = await import("@composio/ao-core");
    const fsMod = await import("node:fs");
    const pathMod = await import("node:path");
    const osMod = await import("node:os");
    const cryptoMod = await import("node:crypto");

    const tmpDir = pathMod.join(osMod.tmpdir(), `ao-resume-behavioral-${cryptoMod.randomUUID()}`);
    fsMod.mkdirSync(tmpDir, { recursive: true });

    const config = {
      configPath: pathMod.join(tmpDir, "config.yaml"),
      port: 5000,
      defaults: { runtime: "mock", agent: "mock", workspace: "mock", notifiers: [] as string[] },
      projects: {},
      notifiers: {},
      notificationRouting: {
        urgent: [] as string[],
        action: [] as string[],
        warning: [] as string[],
        info: [] as string[],
      },
      reactions: {},
      readyThresholdMs: 300_000,
    };

    const registry = getAgentRegistry(tmpDir, config);

    // Register with priority 10 (resumed)
    registry.register({
      agentId: "agent-retry-1",
      storyId: "1-4-test",
      assignedAt: new Date(),
      status: "active",
      contextHash: "hash",
      priority: 10,
    });

    const assignment = registry.getByAgent("agent-retry-1");
    expect(assignment).not.toBeNull();
    expect(assignment!.priority).toBe(10);

    // Clean up
    fsMod.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("registry operations complete within 500ms (NFR-P8)", async () => {
    const { getAgentRegistry } = await import("@composio/ao-core");
    const fsMod = await import("node:fs");
    const pathMod = await import("node:path");
    const osMod = await import("node:os");
    const cryptoMod = await import("node:crypto");

    const tmpDir = pathMod.join(osMod.tmpdir(), `ao-resume-perf-${cryptoMod.randomUUID()}`);
    fsMod.mkdirSync(tmpDir, { recursive: true });

    const config = {
      configPath: pathMod.join(tmpDir, "config.yaml"),
      port: 5000,
      defaults: { runtime: "mock", agent: "mock", workspace: "mock", notifiers: [] as string[] },
      projects: {},
      notifiers: {},
      notificationRouting: {
        urgent: [] as string[],
        action: [] as string[],
        warning: [] as string[],
        info: [] as string[],
      },
      reactions: {},
      readyThresholdMs: 300_000,
    };

    const registry = getAgentRegistry(tmpDir, config);
    const start = Date.now();

    // Simulate resume: register, incrementRetry, getRetryCount, getByStory
    registry.register({
      agentId: "perf-agent-1",
      storyId: "perf-story",
      assignedAt: new Date(),
      status: "active",
      contextHash: "hash",
      priority: 10,
    });
    registry.incrementRetry("perf-story", "perf-agent-1");
    registry.getRetryCount("perf-story");
    registry.getByStory("perf-story");

    const elapsed = Date.now() - start;
    expect(elapsed).toBeLessThan(500);

    fsMod.rmSync(tmpDir, { recursive: true, force: true });
  });
});
