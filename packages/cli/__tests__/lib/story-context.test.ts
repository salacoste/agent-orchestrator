import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, writeFileSync, copyFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import {
  readSprintStatus,
  findStoryFile,
  parseStoryFile,
  formatStoryPrompt,
  extractEpicId,
  formatDuration,
} from "../../src/lib/story-context.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const FIXTURE_DIR = join(__dirname, "..", "fixtures");

let tmpDir: string;

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), "ao-story-ctx-test-"));
});

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true });
});

describe("readSprintStatus", () => {
  it("reads and parses sprint-status.yaml", () => {
    copyFileSync(join(FIXTURE_DIR, "sprint-status-spawn.yaml"), join(tmpDir, "sprint-status.yaml"));

    const status = readSprintStatus(tmpDir);
    expect(status).not.toBeNull();
    expect(status!.project).toBe("test-project");
    expect(status!.development_status["1-2-story-aware-agent-spawning"]).toBe("ready-for-dev");
  });

  it("returns null when file does not exist", () => {
    const status = readSprintStatus(tmpDir);
    expect(status).toBeNull();
  });

  it("returns null for malformed YAML", () => {
    writeFileSync(join(tmpDir, "sprint-status.yaml"), "{{invalid: yaml: [}", "utf-8");

    const status = readSprintStatus(tmpDir);
    expect(status).toBeNull();
  });

  it("returns null when development_status is missing", () => {
    writeFileSync(join(tmpDir, "sprint-status.yaml"), "project: test\n", "utf-8");

    const status = readSprintStatus(tmpDir);
    expect(status).toBeNull();
  });

  it("parses dependencies section", () => {
    copyFileSync(join(FIXTURE_DIR, "sprint-status-spawn.yaml"), join(tmpDir, "sprint-status.yaml"));

    const status = readSprintStatus(tmpDir);
    expect(status!.dependencies).toBeDefined();
    expect(status!.dependencies!["1-2-story-aware-agent-spawning"]).toEqual([
      "1-1-sprint-plan-cli",
    ]);
    expect(status!.dependencies!["1-3-agent-story-status-tracking"]).toEqual([
      "1-2-story-aware-agent-spawning",
      "2-1-bmad-tracker-sync-bridge",
    ]);
  });
});

describe("extractEpicId", () => {
  it("extracts epic from story ID", () => {
    expect(extractEpicId("1-2-cli-spawn-agent")).toBe("epic-1");
    expect(extractEpicId("3-1-notification-routing")).toBe("epic-3");
  });

  it("returns null for non-matching ID", () => {
    expect(extractEpicId("epic-1")).toBeNull();
    expect(extractEpicId("")).toBeNull();
  });
});

describe("findStoryFile", () => {
  it("finds direct match by story ID", () => {
    const storyPath = join(tmpDir, "1-2-test-story.md");
    writeFileSync(storyPath, "# Story 1.2", "utf-8");

    const result = findStoryFile("1-2-test-story", tmpDir);
    expect(result).toBe(storyPath);
  });

  it("finds story- prefixed file", () => {
    const storyPath = join(tmpDir, "story-1-2-test-story.md");
    writeFileSync(storyPath, "# Story 1.2", "utf-8");

    const result = findStoryFile("1-2-test-story", tmpDir);
    expect(result).toBe(storyPath);
  });

  it("returns null when file not found", () => {
    const result = findStoryFile("1-2-nonexistent", tmpDir);
    expect(result).toBeNull();
  });
});

describe("parseStoryFile", () => {
  it("extracts title, description, acceptance criteria, status, and epic", () => {
    const filePath = join(FIXTURE_DIR, "1-2-test-story.md");
    const result = parseStoryFile(filePath, "1-2-test-story");

    expect(result).not.toBeNull();
    expect(result!.id).toBe("1-2-test-story");
    expect(result!.title).toBe("1.2: Story-Aware Agent Spawning");
    expect(result!.status).toBe("ready-for-dev");
    expect(result!.description).toContain("Product Manager");
    expect(result!.acceptanceCriteria).toContain("ao spawn --story");
    expect(result!.epic).toBe("epic-1");
  });

  it("returns null for empty file", () => {
    const emptyFile = join(tmpDir, "empty.md");
    writeFileSync(emptyFile, "", "utf-8");

    const result = parseStoryFile(emptyFile, "empty");
    expect(result).toBeNull();
  });

  it("returns null for file without title and description", () => {
    const badFile = join(tmpDir, "bad.md");
    writeFileSync(badFile, "just some text", "utf-8");

    const result = parseStoryFile(badFile, "bad");
    expect(result).toBeNull();
  });

  it("returns null for nonexistent file", () => {
    const result = parseStoryFile(join(tmpDir, "nonexistent.md"), "nonexistent");
    expect(result).toBeNull();
  });
});

describe("formatStoryPrompt", () => {
  it("formats story context as markdown prompt", () => {
    const prompt = formatStoryPrompt({
      id: "1-2-test-story",
      title: "Story-Aware Agent Spawning",
      status: "ready-for-dev",
      description: "As a PM, I want to spawn agents with context.",
      acceptanceCriteria: "1. Must work\n2. Must be fast",
      epic: "epic-1",
    });

    expect(prompt).toContain("# Story: Story-Aware Agent Spawning");
    expect(prompt).toContain("**Story ID:** 1-2-test-story");
    expect(prompt).toContain("**Epic:** epic-1");
    expect(prompt).toContain("**Status:** ready-for-dev");
    expect(prompt).toContain("## Description");
    expect(prompt).toContain("## Acceptance Criteria");
    expect(prompt).toContain("1. Must work");
  });

  it("includes dependencies section when present", () => {
    const prompt = formatStoryPrompt({
      id: "1-3-tracking",
      title: "Tracking",
      status: "backlog",
      description: "Track things.",
      acceptanceCriteria: "1. Track",
      dependencies: ["1-1-foundation", "1-2-spawning"],
    });

    expect(prompt).toContain("## Dependencies");
    expect(prompt).toContain("1-1-foundation, 1-2-spawning");
  });

  it("omits dependencies section when empty", () => {
    const prompt = formatStoryPrompt({
      id: "1-1-foundation",
      title: "Foundation",
      status: "done",
      description: "Foundation work.",
      acceptanceCriteria: "1. Done",
    });

    expect(prompt).not.toContain("## Dependencies");
  });

  it("omits epic when not present", () => {
    const prompt = formatStoryPrompt({
      id: "1-1-test",
      title: "Test",
      status: "done",
      description: "Test desc.",
      acceptanceCriteria: "",
    });

    expect(prompt).not.toContain("**Epic:**");
  });

  describe("Commander's Intent (Story 18.1)", () => {
    it("includes Commander's Intent section with goal from title", () => {
      const prompt = formatStoryPrompt({
        id: "16-1-artifact-type-definition",
        title: "Artifact Type Definition",
        status: "ready-for-dev",
        description: "Define artifact types.",
        acceptanceCriteria: "1. Types defined",
      });

      expect(prompt).toContain("## Commander's Intent");
      expect(prompt).toContain("The intent of this story is to artifact Type Definition");
      expect(prompt).toContain("any solution that achieves this goal");
    });

    it("strips leading story number prefix from intent", () => {
      const prompt = formatStoryPrompt({
        id: "16-2-workflow-state-machine",
        title: "16.2: Workflow State Machine Model",
        status: "ready-for-dev",
        description: "Build state machine.",
        acceptanceCriteria: "1. State machine works",
      });

      expect(prompt).toContain("## Commander's Intent");
      // Should strip "16.2: " prefix
      expect(prompt).toContain("The intent of this story is to workflow State Machine Model");
    });

    it("places Commander's Intent after Acceptance Criteria", () => {
      const prompt = formatStoryPrompt({
        id: "1-1-test",
        title: "Test Feature",
        status: "ready-for-dev",
        description: "Test.",
        acceptanceCriteria: "1. Must work",
      });

      const acIndex = prompt.indexOf("## Acceptance Criteria");
      const intentIndex = prompt.indexOf("## Commander's Intent");
      const separatorIndex = prompt.indexOf("---");

      expect(acIndex).toBeLessThan(intentIndex);
      expect(intentIndex).toBeLessThan(separatorIndex);
    });
  });
});

describe("formatDuration", () => {
  it("returns 'just now' for recent timestamps", () => {
    const result = formatDuration(new Date());
    expect(result).toBe("just now");
  });

  it("returns minutes for timestamps under 1 hour", () => {
    const thirtyMinsAgo = new Date(Date.now() - 30 * 60000);
    const result = formatDuration(thirtyMinsAgo);
    expect(result).toBe("30m ago");
  });

  it("returns hours for timestamps under 1 day", () => {
    const fiveHoursAgo = new Date(Date.now() - 5 * 3600000);
    const result = formatDuration(fiveHoursAgo);
    expect(result).toBe("5h ago");
  });

  it("returns days for older timestamps", () => {
    const threeDaysAgo = new Date(Date.now() - 3 * 86400000);
    const result = formatDuration(threeDaysAgo);
    expect(result).toBe("3d ago");
  });
});
