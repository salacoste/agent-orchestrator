import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  CrossProjectDepFileStore,
  createCrossProjectDepStore,
  CROSS_PROJECT_DEPS_FILENAME,
} from "../cross-project-deps.js";
import { mkdtempSync, rmSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { parse } from "yaml";

// ── Helpers ──────────────────────────────────────────────────────────────────

let tmpDir: string;

function makeStore(): CrossProjectDepFileStore {
  return new CrossProjectDepFileStore(join(tmpDir, CROSS_PROJECT_DEPS_FILENAME));
}

// ── Setup/Teardown ───────────────────────────────────────────────────────────

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), "ao-cpd-test-"));
});

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true });
});

// ── CrossProjectDepFileStore ────────────────────────────────────────────────

describe("CrossProjectDepFileStore", () => {
  it("returns empty list when file does not exist", () => {
    const store = makeStore();
    expect(store.list()).toEqual([]);
  });

  it("adds a dependency and persists it", () => {
    const store = makeStore();
    const added = store.add({
      sourceProjectId: "p-a",
      sourceStoryId: "s-1",
      targetProjectId: "p-b",
      targetStoryId: "s-2",
    });

    expect(added.id).toMatch(/^dep-/);
    expect(added.sourceProjectId).toBe("p-a");

    // Verify persisted to disk
    const filePath = join(tmpDir, CROSS_PROJECT_DEPS_FILENAME);
    expect(existsSync(filePath)).toBe(true);
    const data = parse(readFileSync(filePath, "utf-8"));
    expect(data.dependencies).toHaveLength(1);
    expect(data.dependencies[0].id).toBe(added.id);
  });

  it("loads previously saved dependencies", () => {
    const store1 = makeStore();
    const added = store1.add({
      sourceProjectId: "p-a",
      sourceStoryId: "s-1",
      targetProjectId: "p-b",
      targetStoryId: "s-2",
    });

    // Create a new store instance pointing to the same file
    const store2 = makeStore();
    const deps = store2.list();
    expect(deps).toHaveLength(1);
    expect(deps[0].id).toBe(added.id);
  });

  it("removes a dependency by ID", () => {
    const store = makeStore();
    const added = store.add({
      sourceProjectId: "p-a",
      sourceStoryId: "s-1",
      targetProjectId: "p-b",
      targetStoryId: "s-2",
    });

    const removed = store.remove(added.id);
    expect(removed).toEqual(added);
    expect(store.list()).toHaveLength(0);
  });

  it("returns null when removing nonexistent dep", () => {
    const store = makeStore();
    expect(store.remove("nonexistent")).toBeNull();
  });

  it("getForStory returns deps where story is source or target", () => {
    const store = makeStore();
    store.add({
      sourceProjectId: "p-a",
      sourceStoryId: "s-1",
      targetProjectId: "p-b",
      targetStoryId: "s-2",
    });
    store.add({
      sourceProjectId: "p-c",
      sourceStoryId: "s-3",
      targetProjectId: "p-a",
      targetStoryId: "s-1",
    });

    const deps = store.getForStory("p-a", "s-1");
    expect(deps).toHaveLength(2);
  });

  it("list filters by project", () => {
    const store = makeStore();
    store.add({
      sourceProjectId: "p-a",
      sourceStoryId: "s-1",
      targetProjectId: "p-b",
      targetStoryId: "s-2",
    });
    store.add({
      sourceProjectId: "p-c",
      sourceStoryId: "s-3",
      targetProjectId: "p-d",
      targetStoryId: "s-4",
    });

    expect(store.list({ projectId: "p-a" })).toHaveLength(1);
    expect(store.list({ projectId: "p-b" })).toHaveLength(1);
    expect(store.list({ projectId: "p-z" })).toHaveLength(0);
    expect(store.list()).toHaveLength(2);
  });

  it("throws on duplicate add", () => {
    const store = makeStore();
    store.add({
      sourceProjectId: "p-a",
      sourceStoryId: "s-1",
      targetProjectId: "p-b",
      targetStoryId: "s-2",
    });

    expect(() =>
      store.add({
        sourceProjectId: "p-a",
        sourceStoryId: "s-1",
        targetProjectId: "p-b",
        targetStoryId: "s-2",
      }),
    ).toThrow("Duplicate dependency");
  });
});

// ── createCrossProjectDepStore ──────────────────────────────────────────────

describe("createCrossProjectDepStore", () => {
  it("creates store with correct file path", () => {
    const store = createCrossProjectDepStore(join(tmpDir, "orchestrator.yaml"));
    expect(store.filePath).toBe(join(tmpDir, CROSS_PROJECT_DEPS_FILENAME));
  });
});
