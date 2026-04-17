/**
 * Unit tests for project-memory module (Story 60-9, AC #1, #2, #3).
 */
import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { readProjectMemory, writeProjectMemory, emptyProjectMemory } from "../project-memory.js";

describe("project-memory", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "pm-test-"));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  // ---------------------------------------------------------------------------
  // emptyProjectMemory
  // ---------------------------------------------------------------------------

  it("returns a frozen empty object", () => {
    const mem = emptyProjectMemory();
    expect(mem.entries).toEqual([]);
    expect(Object.isFrozen(mem)).toBe(true);
  });

  // ---------------------------------------------------------------------------
  // readProjectMemory
  // ---------------------------------------------------------------------------

  it("reads valid project memory file", async () => {
    const omcDir = join(tempDir, ".omc");
    await import("node:fs/promises").then((fs) => fs.mkdir(omcDir));
    const entries = [
      {
        id: "abc-123",
        type: "convention",
        content: "Use kebab-case for files",
        source: "session-1",
        timestamp: "2026-04-17T12:00:00Z",
      },
    ];
    await writeFile(join(omcDir, "project-memory.json"), JSON.stringify({ entries }, null, 2));

    const mem = await readProjectMemory(tempDir);
    expect(mem.entries).toHaveLength(1);
    expect(mem.entries[0]!.type).toBe("convention");
    expect(mem.entries[0]!.content).toBe("Use kebab-case for files");
  });

  it("returns empty when file is missing", async () => {
    const mem = await readProjectMemory(tempDir);
    expect(mem.entries).toEqual([]);
  });

  it("returns empty for malformed JSON", async () => {
    const omcDir = join(tempDir, ".omc");
    await import("node:fs/promises").then((fs) => fs.mkdir(omcDir));
    await writeFile(join(omcDir, "project-memory.json"), "not valid json{{{");

    const mem = await readProjectMemory(tempDir);
    expect(mem.entries).toEqual([]);
  });

  it("handles legacy format by wrapping string values as entries", async () => {
    const omcDir = join(tempDir, ".omc");
    await import("node:fs/promises").then((fs) => fs.mkdir(omcDir));
    await writeFile(
      join(omcDir, "project-memory.json"),
      JSON.stringify({ convention1: "Use tabs", decision2: "Use React" }),
    );

    const mem = await readProjectMemory(tempDir);
    expect(mem.entries).toHaveLength(2);
    expect(mem.entries.some((e) => e.content === "convention1: Use tabs")).toBe(true);
    expect(mem.entries.some((e) => e.content === "decision2: Use React")).toBe(true);
    // Legacy entries get type "learning"
    for (const entry of mem.entries) {
      expect(entry.type).toBe("learning");
      expect(typeof entry.id).toBe("string");
    }
  });

  // ---------------------------------------------------------------------------
  // writeProjectMemory
  // ---------------------------------------------------------------------------

  it("creates file with atomic write", async () => {
    const entries = [
      {
        id: "e1",
        type: "decision" as const,
        content: "Use ESM modules",
      },
    ];

    await writeProjectMemory(tempDir, { entries });

    const raw = await readFile(join(tempDir, ".omc", "project-memory.json"), "utf-8");
    const parsed = JSON.parse(raw);
    expect(parsed.entries).toHaveLength(1);
    expect(parsed.entries[0].type).toBe("decision");
  });

  it("creates .omc directory if missing", async () => {
    await writeProjectMemory(tempDir, {
      entries: [{ id: "e1", type: "convention", content: "Use strict mode" }],
    });

    const raw = await readFile(join(tempDir, ".omc", "project-memory.json"), "utf-8");
    expect(JSON.parse(raw).entries).toHaveLength(1);
  });

  it("throws on entry missing type", async () => {
    await expect(
      writeProjectMemory(tempDir, {
        entries: [{ id: "e1", type: "", content: "some content" } as never],
      }),
    ).rejects.toThrow("Invalid entry");
  });

  it("throws on entry missing content", async () => {
    await expect(
      writeProjectMemory(tempDir, {
        entries: [{ id: "e1", type: "convention", content: "" } as never],
      }),
    ).rejects.toThrow("Invalid entry");
  });

  it("round-trips read then write", async () => {
    const entries = [
      {
        id: "rt-1",
        type: "learning" as const,
        content: "Avoid exec()",
        source: "session-5",
        timestamp: "2026-04-17T00:00:00Z",
      },
    ];

    await writeProjectMemory(tempDir, { entries });
    const mem = await readProjectMemory(tempDir);

    expect(mem.entries).toHaveLength(1);
    expect(mem.entries[0]).toEqual(entries[0]);
  });
});
