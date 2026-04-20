/**
 * Memory Bridge — write operation tests (removeEntry, updateEntry).
 * Story 61-2, AC #4, #5.
 */
import { describe, expect, it } from "vitest";
import { mkdir, rm, readFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";
import type { CrossSessionMemoryEntry } from "../types.js";
import {
  computeContentHash,
  appendEntries,
  loadAccumulatedMemory,
  removeEntry,
  updateEntry,
} from "../memory-bridge.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function makeTempDir(): Promise<string> {
  const dir = join(tmpdir(), `memory-bridge-write-test-${randomUUID()}`);
  await mkdir(dir, { recursive: true });
  return dir;
}

function makeEntry(overrides: Partial<CrossSessionMemoryEntry> = {}): CrossSessionMemoryEntry {
  return {
    id: randomUUID(),
    type: "convention",
    content: "Use kebab-case for files",
    contentHash: computeContentHash("convention", "Use kebab-case for files"),
    sourceSessionIds: ["session-1"],
    firstSeenAt: "2026-04-17T00:00:00Z",
    lastSeenAt: "2026-04-17T00:00:00Z",
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// removeEntry
// ---------------------------------------------------------------------------

describe("removeEntry", () => {
  it("removes entry matching contentHash", async () => {
    const dir = await makeTempDir();
    const entry1 = makeEntry();
    const entry2 = makeEntry({
      type: "decision",
      content: "Use vitest",
      contentHash: computeContentHash("decision", "Use vitest"),
    });

    await appendEntries(dir, [entry1, entry2]);
    await removeEntry(dir, entry1.contentHash);

    const loaded = await loadAccumulatedMemory(dir);
    expect(loaded).toHaveLength(1);
    expect(loaded[0].contentHash).toBe(entry2.contentHash);

    await rm(dir, { recursive: true, force: true });
  });

  it("is no-op when contentHash not found", async () => {
    const dir = await makeTempDir();
    const entry = makeEntry();
    await appendEntries(dir, [entry]);

    await removeEntry(dir, "nonexistent-hash");

    const loaded = await loadAccumulatedMemory(dir);
    expect(loaded).toHaveLength(1);

    await rm(dir, { recursive: true, force: true });
  });

  it("is no-op when no JSONL file exists", async () => {
    const dir = await makeTempDir();
    // Should not throw
    await removeEntry(dir, "some-hash");
    const loaded = await loadAccumulatedMemory(dir);
    expect(loaded).toEqual([]);
    await rm(dir, { recursive: true, force: true });
  });

  it("uses atomic rewrite (file is valid after removal)", async () => {
    const dir = await makeTempDir();
    const entries = [
      makeEntry({ content: "entry-a", contentHash: computeContentHash("convention", "entry-a") }),
      makeEntry({ content: "entry-b", contentHash: computeContentHash("convention", "entry-b") }),
      makeEntry({ content: "entry-c", contentHash: computeContentHash("convention", "entry-c") }),
    ];
    await appendEntries(dir, entries);

    // Remove middle entry
    await removeEntry(dir, entries[1].contentHash);

    // Verify file is valid JSONL
    const raw = await readFile(join(dir, ".omc", "cross-session-memory.jsonl"), "utf-8");
    const lines = raw
      .trim()
      .split("\n")
      .filter((l) => l.trim());
    for (const line of lines) {
      const parsed = JSON.parse(line) as CrossSessionMemoryEntry;
      expect(parsed.contentHash).not.toBe(entries[1].contentHash);
    }

    await rm(dir, { recursive: true, force: true });
  });
});

// ---------------------------------------------------------------------------
// updateEntry
// ---------------------------------------------------------------------------

describe("updateEntry", () => {
  it("updates entry content and lastSeenAt", async () => {
    const dir = await makeTempDir();
    const entry = makeEntry();
    await appendEntries(dir, [entry]);

    await updateEntry(dir, entry.contentHash, "Use PascalCase for files");

    const loaded = await loadAccumulatedMemory(dir);
    expect(loaded).toHaveLength(1);
    expect(loaded[0].content).toBe("Use PascalCase for files");
    // contentHash should be recomputed
    expect(loaded[0].contentHash).toBe(
      computeContentHash("convention", "Use PascalCase for files"),
    );
    // lastSeenAt should be updated
    expect(loaded[0].lastSeenAt).not.toBe("2026-04-17T00:00:00Z");
    // firstSeenAt should be preserved
    expect(loaded[0].firstSeenAt).toBe("2026-04-17T00:00:00Z");

    await rm(dir, { recursive: true, force: true });
  });

  it("is no-op when contentHash not found", async () => {
    const dir = await makeTempDir();
    const entry = makeEntry();
    await appendEntries(dir, [entry]);

    await updateEntry(dir, "nonexistent-hash", "new content");

    const loaded = await loadAccumulatedMemory(dir);
    expect(loaded).toHaveLength(1);
    expect(loaded[0].content).toBe(entry.content);

    await rm(dir, { recursive: true, force: true });
  });

  it("is no-op when no JSONL file exists", async () => {
    const dir = await makeTempDir();
    await updateEntry(dir, "some-hash", "new content");
    const loaded = await loadAccumulatedMemory(dir);
    expect(loaded).toEqual([]);
    await rm(dir, { recursive: true, force: true });
  });

  it("preserves other entries when updating one", async () => {
    const dir = await makeTempDir();
    const entry1 = makeEntry({
      content: "keep this",
      contentHash: computeContentHash("convention", "keep this"),
    });
    const entry2 = makeEntry({
      content: "update this",
      contentHash: computeContentHash("convention", "update this"),
    });
    await appendEntries(dir, [entry1, entry2]);

    await updateEntry(dir, entry2.contentHash, "updated content");

    const loaded = await loadAccumulatedMemory(dir);
    expect(loaded).toHaveLength(2);
    expect(loaded.some((e) => e.content === "keep this")).toBe(true);
    expect(loaded.some((e) => e.content === "updated content")).toBe(true);

    await rm(dir, { recursive: true, force: true });
  });
});
