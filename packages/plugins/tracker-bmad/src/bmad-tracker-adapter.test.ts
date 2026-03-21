import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ProjectConfig, StoryState } from "@composio/ao-core";

// Mock node:fs before importing the module under test
vi.mock("node:fs", () => ({
  readFileSync: vi.fn(),
  writeFileSync: vi.fn(),
  existsSync: vi.fn(),
  mkdirSync: vi.fn(),
  appendFileSync: vi.fn(),
  statSync: vi.fn(),
}));

vi.mock("./history.js", () => ({
  appendHistory: vi.fn(),
}));

import { readFileSync, writeFileSync, existsSync, statSync } from "node:fs";
import { createBMADTrackerAdapter } from "./bmad-tracker-adapter.js";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const PROJECT = {
  name: "Test Project",
  repo: "org/test-project",
  path: "/fake/project",
  defaultBranch: "main",
  sessionPrefix: "test",
  tracker: { plugin: "bmad", outputDir: "_bmad-output" },
} as ProjectConfig;

/** Helper: sprint-status.yaml content with structured entries */
function makeSprintYaml(
  entries: Record<string, { status: string; epic?: string; assignedSession?: string }>,
): string {
  const lines = ["development_status:"];
  for (const [id, entry] of Object.entries(entries)) {
    lines.push(`  ${id}:`);
    lines.push(`    status: ${entry.status}`);
    if (entry.epic) lines.push(`    epic: ${entry.epic}`);
    if (entry.assignedSession) lines.push(`    assignedSession: ${entry.assignedSession}`);
  }
  return lines.join("\n") + "\n";
}

const BASIC_YAML = makeSprintYaml({
  "epic-1": { status: "done" },
  "1-1-foundation": { status: "done", epic: "epic-1" },
  "1-2-spawning": { status: "in-progress", epic: "epic-1", assignedSession: "sess-abc" },
  "epic-2": { status: "in-progress" },
  "2-1-sync-bridge": { status: "ready-for-dev", epic: "epic-2" },
  "epic-1-retrospective": { status: "done" },
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("createBMADTrackerAdapter", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  // -------------------------------------------------------------------------
  // Factory
  // -------------------------------------------------------------------------

  it("creates an adapter with the correct name", () => {
    const adapter = createBMADTrackerAdapter(PROJECT);
    expect(adapter.name).toBe("bmad-tracker");
  });

  // -------------------------------------------------------------------------
  // isAvailable()
  // -------------------------------------------------------------------------

  describe("isAvailable()", () => {
    it("returns true when sprint-status.yaml exists", async () => {
      vi.mocked(existsSync).mockReturnValue(true);
      const adapter = createBMADTrackerAdapter(PROJECT);
      expect(await adapter.isAvailable()).toBe(true);
    });

    it("returns false when sprint-status.yaml does not exist", async () => {
      vi.mocked(existsSync).mockReturnValue(false);
      const adapter = createBMADTrackerAdapter(PROJECT);
      expect(await adapter.isAvailable()).toBe(false);
    });

    it("returns false when existsSync throws", async () => {
      vi.mocked(existsSync).mockImplementation(() => {
        throw new Error("permission denied");
      });
      const adapter = createBMADTrackerAdapter(PROJECT);
      expect(await adapter.isAvailable()).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // getStory()
  // -------------------------------------------------------------------------

  describe("getStory()", () => {
    it("returns a StoryState for a known story", async () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue(BASIC_YAML);
      vi.mocked(statSync).mockReturnValue({ mtimeMs: 1710500000000 } as ReturnType<
        typeof statSync
      >);

      const adapter = createBMADTrackerAdapter(PROJECT);
      const story = await adapter.getStory("1-2-spawning");

      expect(story).not.toBeNull();
      expect(story!.id).toBe("1-2-spawning");
      expect(story!.status).toBe("in-progress");
      expect(story!.title).toBe("1-2-spawning");
      expect(story!.assignedAgent).toBe("sess-abc");
      expect(story!.version).toMatch(/^v\d+-flat$/);
      expect(story!.updatedAt).toBeDefined();
    });

    it("returns null for an unknown story", async () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue(BASIC_YAML);
      vi.mocked(statSync).mockReturnValue({ mtimeMs: 1710500000000 } as ReturnType<
        typeof statSync
      >);

      const adapter = createBMADTrackerAdapter(PROJECT);
      const story = await adapter.getStory("nonexistent");
      expect(story).toBeNull();
    });

    it("filters out epic entries", async () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue(BASIC_YAML);
      vi.mocked(statSync).mockReturnValue({ mtimeMs: 1710500000000 } as ReturnType<
        typeof statSync
      >);

      const adapter = createBMADTrackerAdapter(PROJECT);
      // epics are not stories
      const story = await adapter.getStory("epic-1");
      expect(story).toBeNull();
    });

    it("filters out retrospective entries", async () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue(BASIC_YAML);
      vi.mocked(statSync).mockReturnValue({ mtimeMs: 1710500000000 } as ReturnType<
        typeof statSync
      >);

      const adapter = createBMADTrackerAdapter(PROJECT);
      const story = await adapter.getStory("epic-1-retrospective");
      expect(story).toBeNull();
    });

    it("maps valid StoryStatus values correctly", async () => {
      const yaml = makeSprintYaml({
        "s-1": { status: "backlog" },
        "s-2": { status: "ready-for-dev" },
        "s-3": { status: "in-progress" },
        "s-4": { status: "review" },
        "s-5": { status: "done" },
        "s-6": { status: "blocked" },
      });
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue(yaml);
      vi.mocked(statSync).mockReturnValue({ mtimeMs: 1710500000000 } as ReturnType<
        typeof statSync
      >);

      const adapter = createBMADTrackerAdapter(PROJECT);
      for (const [id, expected] of [
        ["s-1", "backlog"],
        ["s-2", "ready-for-dev"],
        ["s-3", "in-progress"],
        ["s-4", "review"],
        ["s-5", "done"],
        ["s-6", "blocked"],
      ] as const) {
        const story = await adapter.getStory(id);
        expect(story!.status).toBe(expected);
      }
    });

    it("defaults unknown status values to 'backlog'", async () => {
      const yaml = makeSprintYaml({
        "s-1": { status: "unknown-status" },
      });
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue(yaml);
      vi.mocked(statSync).mockReturnValue({ mtimeMs: 1710500000000 } as ReturnType<
        typeof statSync
      >);

      const adapter = createBMADTrackerAdapter(PROJECT);
      const story = await adapter.getStory("s-1");
      expect(story!.status).toBe("backlog");
    });
  });

  // -------------------------------------------------------------------------
  // updateStory()
  // -------------------------------------------------------------------------

  describe("updateStory()", () => {
    it("writes the updated status to sprint-status.yaml", async () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue(BASIC_YAML);
      vi.mocked(statSync).mockReturnValue({ mtimeMs: 1710500000000 } as ReturnType<
        typeof statSync
      >);

      const adapter = createBMADTrackerAdapter(PROJECT);
      const state: StoryState = {
        id: "1-2-spawning",
        status: "done",
        title: "1-2-spawning",
        version: "v123-flat",
        updatedAt: new Date().toISOString(),
      };

      await adapter.updateStory("1-2-spawning", state);

      // writeStoryStatus reads then writes — verify writeFileSync was called
      expect(writeFileSync).toHaveBeenCalled();
      const writtenContent = vi.mocked(writeFileSync).mock.calls[0]![1] as string;
      expect(writtenContent).toContain("done");
    });

    it("throws when story is not found", async () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue(BASIC_YAML);

      const adapter = createBMADTrackerAdapter(PROJECT);
      const state: StoryState = {
        id: "nonexistent",
        status: "done",
        title: "nonexistent",
        version: "v1",
        updatedAt: new Date().toISOString(),
      };

      await expect(adapter.updateStory("nonexistent", state)).rejects.toThrow("not found");
    });

    it("updates assignedSession when assignedAgent is set", async () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue(BASIC_YAML);

      const adapter = createBMADTrackerAdapter(PROJECT);
      const state: StoryState = {
        id: "2-1-sync-bridge",
        status: "in-progress",
        title: "2-1-sync-bridge",
        assignedAgent: "session-xyz",
        version: "v1",
        updatedAt: new Date().toISOString(),
      };

      await adapter.updateStory("2-1-sync-bridge", state);

      expect(writeFileSync).toHaveBeenCalled();
      const writtenContent = vi.mocked(writeFileSync).mock.calls[0]![1] as string;
      expect(writtenContent).toContain("in-progress");
    });
  });

  // -------------------------------------------------------------------------
  // listStories()
  // -------------------------------------------------------------------------

  describe("listStories()", () => {
    it("returns only story entries (no epics, no retrospectives)", async () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue(BASIC_YAML);
      vi.mocked(statSync).mockReturnValue({ mtimeMs: 1710500000000 } as ReturnType<
        typeof statSync
      >);

      const adapter = createBMADTrackerAdapter(PROJECT);
      const stories = await adapter.listStories();

      // Should contain only actual stories, not epics or retrospectives
      expect(stories.has("1-1-foundation")).toBe(true);
      expect(stories.has("1-2-spawning")).toBe(true);
      expect(stories.has("2-1-sync-bridge")).toBe(true);

      // Should NOT contain epics or retrospectives
      expect(stories.has("epic-1")).toBe(false);
      expect(stories.has("epic-2")).toBe(false);
      expect(stories.has("epic-1-retrospective")).toBe(false);

      expect(stories.size).toBe(3);
    });

    it("returns StoryState objects with correct fields", async () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue(BASIC_YAML);
      vi.mocked(statSync).mockReturnValue({ mtimeMs: 1710500000000 } as ReturnType<
        typeof statSync
      >);

      const adapter = createBMADTrackerAdapter(PROJECT);
      const stories = await adapter.listStories();
      const story = stories.get("1-2-spawning")!;

      expect(story.id).toBe("1-2-spawning");
      expect(story.status).toBe("in-progress");
      expect(story.title).toBe("1-2-spawning");
      expect(story.assignedAgent).toBe("sess-abc");
      expect(story.version).toMatch(/^v\d+-flat$/);
      expect(story.updatedAt).toBeDefined();
    });

    it("returns empty map when file does not exist", async () => {
      vi.mocked(existsSync).mockReturnValue(false);

      const adapter = createBMADTrackerAdapter(PROJECT);
      const stories = await adapter.listStories();
      expect(stories.size).toBe(0);
    });
  });
});
