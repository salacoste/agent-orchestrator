/**
 * Unit tests for Story 58.3: OMC Provider Implementation.
 * Covers: install, configure, enhance, teardown, healthCheck, plugin registration.
 * AC: #8
 */

import { describe, it, expect, afterEach } from "vitest";
import { mkdtemp, rm, stat, readFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { create } from "../index.js";
import type { Session, StoryContext } from "@composio/ao-core";

let tempDir: string;

/** Strip single-line JSONC comments for test parsing */
function stripJsoncComments(text: string): string {
  return text
    .split("\n")
    .filter((line) => !line.trim().startsWith("//"))
    .join("\n");
}

/** Parse JSONC file as JSON (strips comments first) */
function parseJsonc(text: string): OmcConfig {
  return JSON.parse(stripJsoncComments(text)) as OmcConfig;
}

interface OmcConfig {
  agents: Record<string, { model: string }>;
  routing: { enabled: boolean; defaultTier: string; tierModels: Record<string, string> };
  features: { parallelExecution: boolean; autoContextInjection: boolean };
}

async function createTempDir(): Promise<string> {
  tempDir = await mkdtemp(join(tmpdir(), "omc-test-"));
  return tempDir;
}

afterEach(async () => {
  if (tempDir) {
    try {
      await rm(tempDir, { recursive: true, force: true });
    } catch {
      // ignore cleanup errors
    }
    tempDir = "";
  }
});

// ---------------------------------------------------------------------------
// AC #2 — install() creates .omc/ directory structure
// ---------------------------------------------------------------------------

describe("install()", () => {
  it("creates all required directories and files", async () => {
    const worktree = await createTempDir();
    const provider = create();

    await provider.install(worktree, {});

    // Directories should exist
    for (const dir of ["state", "plans", "logs"]) {
      const s = await stat(join(worktree, ".omc", dir));
      expect(s.isDirectory()).toBe(true);
    }

    // notepad.md should have three sections
    const notepad = await readFile(join(worktree, ".omc", "notepad.md"), "utf-8");
    expect(notepad).toContain("## Priority");
    expect(notepad).toContain("## Working Memory");
    expect(notepad).toContain("## Manual");

    // project-memory.json should be empty object
    const memory = await readFile(join(worktree, ".omc", "project-memory.json"), "utf-8");
    expect(JSON.parse(memory)).toEqual({});
  });

  it("is idempotent — calling install() twice succeeds without error", async () => {
    const worktree = await createTempDir();
    const provider = create();

    await provider.install(worktree, {});
    await provider.install(worktree, {});

    // Verify files still exist and are valid
    const notepad = await readFile(join(worktree, ".omc", "notepad.md"), "utf-8");
    expect(notepad).toContain("## Priority");
  });
});

// ---------------------------------------------------------------------------
// AC #3 — configure() generates omc.jsonc and populates notepad
// ---------------------------------------------------------------------------

describe("configure()", () => {
  it("generates .claude/omc.jsonc with expected structure", async () => {
    const worktree = await createTempDir();
    const provider = create();

    await provider.install(worktree, {});
    await provider.configure(worktree, { storyId: "58-3" });

    const config = parseJsonc(await readFile(join(worktree, ".claude", "omc.jsonc"), "utf-8"));

    // Should have agents section
    expect(config.agents).toBeDefined();
    expect(config.agents.executor).toEqual({ model: "claude-sonnet-4-6" });
    expect(config.agents.explore).toEqual({ model: "claude-haiku-4-5" });

    // Should have routing section
    expect(config.routing).toBeDefined();
    expect(config.routing.enabled).toBe(true);
    expect(config.routing.tierModels).toEqual({
      LOW: "haiku",
      MEDIUM: "sonnet",
      HIGH: "opus",
    });

    // Should have features section
    expect(config.features.parallelExecution).toBe(true);
    expect(config.features.autoContextInjection).toBe(true);
  });

  it("generates JSONC with descriptive comments", async () => {
    const worktree = await createTempDir();
    const provider = create();

    await provider.install(worktree, {});
    await provider.configure(worktree, { storyId: "test" });

    const raw = await readFile(join(worktree, ".claude", "omc.jsonc"), "utf-8");
    // Should contain JSONC comments
    expect(raw).toContain("// Agent model assignments");
    expect(raw).toContain("// Model routing configuration");
    expect(raw).toContain("// Feature flags");
    // Should still be parseable after stripping comments
    const parsed = parseJsonc(raw);
    expect(parsed.agents).toBeDefined();
  });

  it("uses model tiers from provider config", async () => {
    const worktree = await createTempDir();
    const provider = create({
      modelTiers: { low: "mini", medium: "pro", high: "ultra" },
    });

    await provider.install(worktree, {});
    await provider.configure(worktree, { storyId: "test" });

    const config = parseJsonc(await readFile(join(worktree, ".claude", "omc.jsonc"), "utf-8"));
    expect(config.routing.tierModels).toEqual({
      LOW: "mini",
      MEDIUM: "pro",
      HIGH: "ultra",
    });
  });

  it("uses custom agent models from provider config", async () => {
    const worktree = await createTempDir();
    const provider = create({
      agents: { executor: { model: "custom-model" } },
    });

    await provider.install(worktree, {});
    await provider.configure(worktree, { storyId: "test" });

    const config = parseJsonc(await readFile(join(worktree, ".claude", "omc.jsonc"), "utf-8"));
    expect(config.agents.executor).toEqual({ model: "custom-model" });
    // Other agents should still use defaults
    expect(config.agents.explore).toEqual({ model: "claude-haiku-4-5" });
  });

  it("populates notepad Priority section with story context", async () => {
    const worktree = await createTempDir();
    const provider = create();

    const context: StoryContext = {
      storyId: "58-3",
      storyTitle: "OMC Provider",
      acceptanceCriteria: ["AC1: Provider package", "AC2: install creates dirs"],
      relevantFiles: ["packages/plugins/provider-omc/src/index.ts"],
      dependencies: ["58-1", "58-2"],
    };

    await provider.install(worktree, {});
    await provider.configure(worktree, context);

    const notepad = await readFile(join(worktree, ".omc", "notepad.md"), "utf-8");
    expect(notepad).toContain("Story: 58-3");
    expect(notepad).toContain("Title: OMC Provider");
    expect(notepad).toContain("- AC1: Provider package");
    expect(notepad).toContain("- packages/plugins/provider-omc/src/index.ts");
    expect(notepad).toContain("- 58-1");
  });

  it("handles empty story context gracefully", async () => {
    const worktree = await createTempDir();
    const provider = create();

    await provider.install(worktree, {});
    await provider.configure(worktree, { storyId: "" });

    // Notepad should still have the three sections (unchanged)
    const notepad = await readFile(join(worktree, ".omc", "notepad.md"), "utf-8");
    expect(notepad).toContain("## Priority");
    expect(notepad).toContain("## Working Memory");
  });

  it("works without prior install() — creates .omc/ on the fly", async () => {
    const worktree = await createTempDir();
    const provider = create();

    // Call configure() directly without install()
    await provider.configure(worktree, { storyId: "58-3" });

    // omc.jsonc should exist
    const config = parseJsonc(await readFile(join(worktree, ".claude", "omc.jsonc"), "utf-8"));
    expect(config.agents).toBeDefined();

    // notepad.md should be created with story context
    const notepad = await readFile(join(worktree, ".omc", "notepad.md"), "utf-8");
    expect(notepad).toContain("Story: 58-3");
  });
});

// ---------------------------------------------------------------------------
// AC #4 — enhance() injects agent catalog
// ---------------------------------------------------------------------------

describe("enhance()", () => {
  function makeSession(): Session {
    return {
      id: "test-1",
      projectId: "myapp",
      status: "working",
      activity: null,
      branch: null,
      issueId: null,
      pr: null,
      workspacePath: null,
      runtimeHandle: null,
      agentInfo: null,
      createdAt: new Date(),
      lastActivityAt: new Date(),
      metadata: {},
    };
  }

  it("adds OMC metadata to session without mutating input", async () => {
    const provider = create();
    const session = makeSession();
    const result = await provider.enhance(session);

    // Result has OMC metadata
    expect(result.metadata["omc:agents"]).toBeDefined();
    expect(result.metadata["omc:executionMode"]).toBe("standard");
    expect(result.metadata["omc:configured"]).toBe("true");

    // Original session is NOT mutated
    expect(result).not.toBe(session);
    expect(session.metadata["omc:agents"]).toBeUndefined();
    expect(session.metadata["omc:executionMode"]).toBeUndefined();
    expect(session.metadata["omc:configured"]).toBeUndefined();
  });

  it("omc:agents contains valid JSON array of agent names", async () => {
    const provider = create();
    const session = makeSession();
    const result = await provider.enhance(session);

    const agents = JSON.parse(result.metadata["omc:agents"]);
    expect(Array.isArray(agents)).toBe(true);
    expect(agents).toContain("executor");
    expect(agents).toContain("verifier");
    expect(agents).toContain("explore");
  });

  it("handles frozen input session without throwing", async () => {
    const provider = create();
    // Enhance should not throw even when the input session is frozen —
    // it creates a new object via spread, so it works fine.
    const session = Object.freeze(makeSession());
    const result = await provider.enhance(session);
    // Should return a new object (not the frozen one) with metadata
    expect(result).not.toBe(session);
    expect(result.metadata["omc:configured"]).toBe("true");
  });
});

// ---------------------------------------------------------------------------
// AC #5 — teardown() cleans up
// ---------------------------------------------------------------------------

describe("teardown()", () => {
  it("removes .omc/ directory from worktree", async () => {
    const worktree = await createTempDir();
    const provider = create();

    await provider.install(worktree, {});
    await provider.teardown(worktree);

    await expect(stat(join(worktree, ".omc"))).rejects.toThrow();
  });

  it("does not throw when .omc/ does not exist", async () => {
    const worktree = await createTempDir();
    const provider = create();

    // teardown without install — should not throw
    await expect(provider.teardown(worktree)).resolves.toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// AC #6 — healthCheck()
// ---------------------------------------------------------------------------

describe("healthCheck()", () => {
  it("returns healthy result with current date", async () => {
    const provider = create();
    const before = new Date();
    const result = await provider.healthCheck();
    const after = new Date();

    expect(result.healthy).toBe(true);
    expect(result.lastCheck.getTime()).toBeGreaterThanOrEqual(before.getTime());
    expect(result.lastCheck.getTime()).toBeLessThanOrEqual(after.getTime());
  });
});

// ---------------------------------------------------------------------------
// AC #7 — Plugin manifest
// ---------------------------------------------------------------------------

describe("plugin manifest", () => {
  it("has correct manifest properties", async () => {
    const { manifest } = await import("../index.js");
    expect(manifest.name).toBe("omc");
    expect(manifest.slot).toBe("provider");
    expect(manifest.description).toBeTruthy();
    expect(manifest.version).toBe("0.1.0");
  });
});
