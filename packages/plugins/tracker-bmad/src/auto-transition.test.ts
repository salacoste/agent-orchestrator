import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ProjectConfig } from "@composio/ao-core";

// Mock node:fs before importing the module under test
vi.mock("node:fs", () => ({
  readFileSync: vi.fn(),
  writeFileSync: vi.fn(),
  existsSync: vi.fn(),
  mkdirSync: vi.fn(),
  appendFileSync: vi.fn(),
}));

vi.mock("./history.js", () => ({
  appendHistory: vi.fn(),
}));

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { appendHistory } from "./history.js";
import { transitionOnMerge, writeStoryStatus, findStoryForPR } from "./auto-transition.js";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const PROJECT = {
  name: "Test Project",
  repo: "org/test-project",
  path: "/tmp/test-project",
  defaultBranch: "main",
  sessionPrefix: "test",
  tracker: { plugin: "bmad", outputDir: "_bmad-output" },
} as ProjectConfig;

const SPRINT_STATUS_PATH = "/tmp/test-project/_bmad-output/sprint-status.yaml";

const SPRINT_YAML = `
development_status:
  story-1:
    status: review
    epic: epic-1
  story-2:
    status: in-progress
    epic: epic-1
  story-3:
    status: done
    epic: epic-2
  story-4:
    status: backlog
    epic: epic-2
  story-1-2:
    status: ready-for-dev
    epic: epic-1
`;

// ---------------------------------------------------------------------------
// Typed mock helpers
// ---------------------------------------------------------------------------

const mockReadFileSync = readFileSync as ReturnType<typeof vi.fn>;
const mockWriteFileSync = writeFileSync as ReturnType<typeof vi.fn>;
const mockExistsSync = existsSync as ReturnType<typeof vi.fn>;
const mockAppendHistory = appendHistory as ReturnType<typeof vi.fn>;

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
  // Default: sprint-status.yaml exists and returns our fixture
  mockExistsSync.mockReturnValue(true);
  mockReadFileSync.mockReturnValue(SPRINT_YAML);
});

// ---------------------------------------------------------------------------
// transitionOnMerge
// ---------------------------------------------------------------------------

describe("transitionOnMerge", () => {
  it("transitions a story from 'review' to 'done' and returns an event", () => {
    const result = transitionOnMerge(PROJECT, "story-1", "https://github.com/org/repo/pull/42");

    expect(result.transitioned).toBe(true);
    expect(result.storyId).toBe("story-1");
    expect(result.previousStatus).toBe("review");
    expect(result.newStatus).toBe("done");
    expect(result.reason).toBe("transitioned");

    // Event should be populated
    expect(result.event).not.toBeNull();
    expect(result.event?.type).toBe("tracker.story_done");
    expect(result.event?.storyId).toBe("story-1");
    expect(result.event?.previousStatus).toBe("review");
    expect(result.event?.prUrl).toBe("https://github.com/org/repo/pull/42");
    // Timestamp should be a valid ISO-8601 string
    expect(result.event?.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("transitions a story from 'in-progress' to 'done'", () => {
    const result = transitionOnMerge(PROJECT, "story-2");

    expect(result.transitioned).toBe(true);
    expect(result.storyId).toBe("story-2");
    expect(result.previousStatus).toBe("in-progress");
    expect(result.newStatus).toBe("done");
    expect(result.reason).toBe("transitioned");
    expect(result.event).not.toBeNull();
    expect(result.event?.previousStatus).toBe("in-progress");
    // prUrl is undefined when not provided
    expect(result.event?.prUrl).toBeUndefined();
  });

  it("returns 'already_done' when story is already done", () => {
    const result = transitionOnMerge(PROJECT, "story-3");

    expect(result.transitioned).toBe(false);
    expect(result.storyId).toBe("story-3");
    expect(result.previousStatus).toBe("done");
    expect(result.newStatus).toBe("done");
    expect(result.reason).toBe("already_done");
    expect(result.event).toBeNull();

    // Should NOT have written anything
    expect(mockWriteFileSync).not.toHaveBeenCalled();
    expect(mockAppendHistory).not.toHaveBeenCalled();
  });

  it("returns 'story_not_found' when story does not exist", () => {
    const result = transitionOnMerge(PROJECT, "nonexistent-story");

    expect(result.transitioned).toBe(false);
    expect(result.storyId).toBe("nonexistent-story");
    expect(result.previousStatus).toBe("");
    expect(result.newStatus).toBe("");
    expect(result.reason).toBe("story_not_found");
    expect(result.event).toBeNull();

    // Should NOT have written anything
    expect(mockWriteFileSync).not.toHaveBeenCalled();
    expect(mockAppendHistory).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// writeStoryStatus
// ---------------------------------------------------------------------------

describe("writeStoryStatus", () => {
  it("writes updated YAML with the new status", () => {
    writeStoryStatus(PROJECT, "story-1", "done");

    expect(mockWriteFileSync).toHaveBeenCalledOnce();
    const [calledPath, calledContent, calledEncoding] = mockWriteFileSync.mock.calls[0] as [
      string,
      string,
      string,
    ];

    expect(calledPath).toBe(SPRINT_STATUS_PATH);
    expect(calledEncoding).toBe("utf-8");
    // The written content should contain the new status
    expect(calledContent).toContain("done");
    // Should still be valid YAML with the story ID present
    expect(calledContent).toContain("story-1");
  });

  it("preserves other story entries and fields when updating one story", () => {
    writeStoryStatus(PROJECT, "story-1", "done");

    const [, calledContent] = mockWriteFileSync.mock.calls[0] as [string, string, string];

    // All other stories should still be present
    expect(calledContent).toContain("story-2");
    expect(calledContent).toContain("story-3");
    expect(calledContent).toContain("story-4");
    // Epic fields should be preserved
    expect(calledContent).toContain("epic-1");
    expect(calledContent).toContain("epic-2");
    // story-2 should still be in-progress
    expect(calledContent).toContain("in-progress");
  });
});

// ---------------------------------------------------------------------------
// findStoryForPR
// ---------------------------------------------------------------------------

describe("findStoryForPR", () => {
  it("matches a story ID found in the branch name", () => {
    const result = findStoryForPR(PROJECT, "feat/story-1-add-auth");

    // Should match "story-1" (not "story-1-2" since "story-1-2" does not appear in the branch)
    expect(result).toBe("story-1");
  });

  it("returns null when no story ID matches the branch", () => {
    const result = findStoryForPR(PROJECT, "feat/unrelated-feature");

    expect(result).toBeNull();
  });

  it("returns the correct match when multiple stories could match", () => {
    // Branch contains "story-1-2" which should match "story-1-2" (longer, more specific)
    // rather than "story-1"
    const result = findStoryForPR(PROJECT, "feat/story-1-2-implement-feature");

    expect(result).toBe("story-1-2");
  });

  it("matches story IDs without a prefix", () => {
    const result = findStoryForPR(PROJECT, "story-4-dashboard");

    expect(result).toBe("story-4");
  });

  it("returns null for an empty branch name", () => {
    const result = findStoryForPR(PROJECT, "");

    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// History is appended when transition occurs
// ---------------------------------------------------------------------------

describe("history integration", () => {
  it("appends history when a transition occurs", () => {
    transitionOnMerge(PROJECT, "story-1", "https://github.com/org/repo/pull/42");

    expect(mockAppendHistory).toHaveBeenCalledOnce();
    expect(mockAppendHistory).toHaveBeenCalledWith(PROJECT, "story-1", "review", "done");
  });

  it("does not append history when story is already done", () => {
    transitionOnMerge(PROJECT, "story-3");

    expect(mockAppendHistory).not.toHaveBeenCalled();
  });

  it("does not append history when story is not found", () => {
    transitionOnMerge(PROJECT, "nonexistent");

    expect(mockAppendHistory).not.toHaveBeenCalled();
  });
});
