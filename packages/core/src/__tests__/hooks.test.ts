/**
 * Tests for compaction survival hooks (Story 59-2).
 *
 * Covers:
 * - createHookRegistry() factory
 * - register() phase routing
 * - runPreCompact() / runPostCompact() execution
 * - Built-in notepad and project-memory hooks
 * - Hook failure isolation
 * - Per-session registry isolation
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mkdirSync, rmSync, writeFileSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";
import {
  createHookRegistry,
  notepadPreCompact,
  notepadPostCompact,
  projectMemoryPreCompact,
  registerDefaultHooks,
  HOOK_PROFILES,
  detectStoryType,
  registerHooksForProfile,
} from "../hooks.js";
import type { HookProfile, StoryType } from "../types.js";

let tmpDir: string;

beforeEach(() => {
  tmpDir = join(tmpdir(), `ao-hooks-test-${randomUUID()}`);
  mkdirSync(tmpDir, { recursive: true });
});

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// createHookRegistry & register
// ---------------------------------------------------------------------------

describe("createHookRegistry", () => {
  it("returns a registry with empty hook maps", () => {
    const registry = createHookRegistry();

    // Registry should have the required methods
    expect(typeof registry.register).toBe("function");
    expect(typeof registry.runPreCompact).toBe("function");
    expect(typeof registry.runPostCompact).toBe("function");
  });

  it("runPreCompact does nothing on empty registry", async () => {
    const registry = createHookRegistry();
    // Should not throw
    await registry.runPreCompact(tmpDir, {});
  });

  it("runPostCompact returns empty string on empty registry", async () => {
    const registry = createHookRegistry();
    const result = await registry.runPostCompact(tmpDir);
    expect(result).toBe("");
  });
});

describe("register", () => {
  it("adds pre-compact hooks to the correct phase", async () => {
    const registry = createHookRegistry();
    const calls: string[] = [];
    registry.register("preCompact", "test", async () => {
      calls.push("pre");
    });

    await registry.runPreCompact(tmpDir, {});
    expect(calls).toEqual(["pre"]);
  });

  it("adds post-compact hooks to the correct phase", async () => {
    const registry = createHookRegistry();
    registry.register("postCompact", "test", async () => "post-result");

    const result = await registry.runPostCompact(tmpDir);
    expect(result).toBe("post-result");
  });

  it("does not cross phases — pre-compact hooks not called in runPostCompact", async () => {
    const registry = createHookRegistry();
    let preCalled = false;
    registry.register("preCompact", "pre", async () => {
      preCalled = true;
    });

    await registry.runPostCompact(tmpDir);
    expect(preCalled).toBe(false);
  });
});

describe("runPreCompact", () => {
  it("calls all registered hooks in insertion order", async () => {
    const registry = createHookRegistry();
    const order: string[] = [];

    registry.register("preCompact", "first", async () => {
      order.push("first");
    });
    registry.register("preCompact", "second", async () => {
      order.push("second");
    });
    registry.register("preCompact", "third", async () => {
      order.push("third");
    });

    await registry.runPreCompact(tmpDir, {});
    expect(order).toEqual(["first", "second", "third"]);
  });

  it("passes worktreePath and sessionMetadata to hooks", async () => {
    const registry = createHookRegistry();
    let receivedPath = "";
    let receivedMeta: Record<string, string> = {};

    registry.register("preCompact", "test", async (path, meta) => {
      receivedPath = path;
      receivedMeta = meta;
    });

    const meta = { currentTask: "implement hooks", issue: "STORY-1" };
    await registry.runPreCompact("/some/path", meta);

    expect(receivedPath).toBe("/some/path");
    expect(receivedMeta).toEqual(meta);
  });
});

describe("runPostCompact", () => {
  it("returns concatenated context from all hooks", async () => {
    const registry = createHookRegistry();

    registry.register("postCompact", "a", async () => "Context A");
    registry.register("postCompact", "b", async () => "Context B");

    const result = await registry.runPostCompact(tmpDir);
    expect(result).toBe("Context A\n\nContext B");
  });

  it("skips hooks that return empty string", async () => {
    const registry = createHookRegistry();

    registry.register("postCompact", "a", async () => "Has content");
    registry.register("postCompact", "empty", async () => "");
    registry.register("postCompact", "b", async () => "Also has content");

    const result = await registry.runPostCompact(tmpDir);
    expect(result).toBe("Has content\n\nAlso has content");
  });
});

// ---------------------------------------------------------------------------
// Hook failure isolation
// ---------------------------------------------------------------------------

describe("hook failure isolation", () => {
  it("pre-compact: failed hook does not block subsequent hooks", async () => {
    const registry = createHookRegistry();
    const order: string[] = [];

    registry.register("preCompact", "ok1", async () => {
      order.push("ok1");
    });
    registry.register("preCompact", "failing", async () => {
      order.push("failing");
      throw new Error("hook exploded");
    });
    registry.register("preCompact", "ok2", async () => {
      order.push("ok2");
    });

    // Suppress console.warn for this test
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    await registry.runPreCompact(tmpDir, {});
    warnSpy.mockRestore();

    expect(order).toEqual(["ok1", "failing", "ok2"]);
  });

  it("post-compact: failed hook does not block subsequent hooks", async () => {
    const registry = createHookRegistry();

    registry.register("postCompact", "ok1", async () => "first");
    registry.register("postCompact", "failing", async () => {
      throw new Error("hook exploded");
    });
    registry.register("postCompact", "ok2", async () => "third");

    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const result = await registry.runPostCompact(tmpDir);
    warnSpy.mockRestore();

    expect(result).toBe("first\n\nthird");
  });

  it("logs warning with hook name on failure", async () => {
    const registry = createHookRegistry();
    registry.register("preCompact", "myHook", async () => {
      throw new Error("boom");
    });

    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    await registry.runPreCompact(tmpDir, {});

    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("myHook"), expect.any(Error));
    warnSpy.mockRestore();
  });
});

// ---------------------------------------------------------------------------
// Per-session isolation
// ---------------------------------------------------------------------------

describe("per-session registry isolation", () => {
  it("hooks registered in one registry do not leak to another", async () => {
    const registry1 = createHookRegistry();
    const registry2 = createHookRegistry();

    const calls: string[] = [];
    registry1.register("preCompact", "r1-hook", async () => {
      calls.push("r1");
    });
    registry2.register("preCompact", "r2-hook", async () => {
      calls.push("r2");
    });

    await registry1.runPreCompact(tmpDir, {});
    expect(calls).toEqual(["r1"]);

    await registry2.runPreCompact(tmpDir, {});
    expect(calls).toEqual(["r1", "r2"]);
  });

  it("post-compact results are independent between registries", async () => {
    const registry1 = createHookRegistry();
    const registry2 = createHookRegistry();

    registry1.register("postCompact", "r1", async () => "from-r1");
    registry2.register("postCompact", "r2", async () => "from-r2");

    const result1 = await registry1.runPostCompact(tmpDir);
    const result2 = await registry2.runPostCompact(tmpDir);

    expect(result1).toBe("from-r1");
    expect(result2).toBe("from-r2");
  });
});

// ---------------------------------------------------------------------------
// registerDefaultHooks
// ---------------------------------------------------------------------------

describe("registerDefaultHooks", () => {
  it("registers notepad pre-compact hook", async () => {
    const registry = createHookRegistry();
    registerDefaultHooks(registry);

    // Exercise by running pre-compact — should call writeNotepadSection
    // which creates .omc/notepad.md
    const omcDir = join(tmpDir, ".omc");
    mkdirSync(omcDir, { recursive: true });

    await registry.runPreCompact(tmpDir, { currentTask: "test task" });

    const notepadPath = join(omcDir, "notepad.md");
    expect(existsSync(notepadPath)).toBe(true);
    const content = readFileSync(notepadPath, "utf-8");
    expect(content).toContain("test task");
  });

  it("registers notepad post-compact hook", async () => {
    const registry = createHookRegistry();
    registerDefaultHooks(registry);

    // First write a notepad so post-compact has something to read
    const omcDir = join(tmpDir, ".omc");
    mkdirSync(omcDir, { recursive: true });
    writeFileSync(
      join(omcDir, "notepad.md"),
      "## Priority\npriority text\n\n## Working Memory\nworking text\n\n## Manual\nmanual text\n",
      "utf-8",
    );

    const result = await registry.runPostCompact(tmpDir);
    expect(result).toContain("[COMPACTION RECOVERY");
    expect(result).toContain("priority text");
    expect(result).toContain("working text");
  });

  it("registers projectMemory pre-compact hook", async () => {
    const registry = createHookRegistry();
    registerDefaultHooks(registry);

    const omcDir = join(tmpDir, ".omc");
    mkdirSync(omcDir, { recursive: true });
    writeFileSync(join(omcDir, "project-memory.json"), "{}", "utf-8");

    await registry.runPreCompact(tmpDir, {
      learnings: JSON.stringify({ "key-insight": "test value" }),
    });

    const memory = JSON.parse(readFileSync(join(omcDir, "project-memory.json"), "utf-8"));
    expect(memory["key-insight"]).toBe("test value");
  });
});

// ---------------------------------------------------------------------------
// Built-in hook: notepadPreCompact
// ---------------------------------------------------------------------------

describe("notepadPreCompact", () => {
  it("writes working memory section with task state", async () => {
    // Create .omc dir and notepad so writeNotepadSection has a file to update
    const omcDir = join(tmpDir, ".omc");
    mkdirSync(omcDir, { recursive: true });
    writeFileSync(
      join(omcDir, "notepad.md"),
      "## Priority\n\n## Working Memory\n\n## Manual\n",
      "utf-8",
    );

    await notepadPreCompact(tmpDir, {
      currentTask: "Implement hooks",
      blockingIssues: "bug-1,bug-2",
      keyDecisions: "use Map for ordering",
      filesModified: "hooks.ts,types.ts",
      lastAction: "wrote tests",
    });

    const content = readFileSync(join(omcDir, "notepad.md"), "utf-8");
    expect(content).toContain("Implement hooks");
    expect(content).toContain("bug-1");
    expect(content).toContain("bug-2");
    expect(content).toContain("use Map for ordering");
    expect(content).toContain("hooks.ts");
    expect(content).toContain("types.ts");
    expect(content).toContain("wrote tests");
  });

  it("handles empty metadata gracefully", async () => {
    const omcDir = join(tmpDir, ".omc");
    mkdirSync(omcDir, { recursive: true });
    writeFileSync(
      join(omcDir, "notepad.md"),
      "## Priority\n\n## Working Memory\n\n## Manual\n",
      "utf-8",
    );

    await notepadPreCompact(tmpDir, {});

    const content = readFileSync(join(omcDir, "notepad.md"), "utf-8");
    expect(content).toContain("Unknown"); // default currentTask
  });
});

// ---------------------------------------------------------------------------
// Built-in hook: notepadPostCompact
// ---------------------------------------------------------------------------

describe("notepadPostCompact", () => {
  it("reads notepad and returns formatted recovery context", async () => {
    const omcDir = join(tmpDir, ".omc");
    mkdirSync(omcDir, { recursive: true });
    writeFileSync(
      join(omcDir, "notepad.md"),
      "## Priority\nStory context\n\n## Working Memory\ntask state\n\n## Manual\nnotes\n",
      "utf-8",
    );

    const result = await notepadPostCompact(tmpDir);

    expect(result).toContain("[COMPACTION RECOVERY");
    expect(result).toContain("Story context");
    expect(result).toContain("task state");
    expect(result).toContain("notes");
  });

  it("returns empty string when notepad has no content", async () => {
    // No .omc directory — readNotepad returns empty sections
    const result = await notepadPostCompact(tmpDir);
    expect(result).toBe("");
  });

  it("includes only non-empty sections", async () => {
    const omcDir = join(tmpDir, ".omc");
    mkdirSync(omcDir, { recursive: true });
    writeFileSync(
      join(omcDir, "notepad.md"),
      "## Priority\n\n## Working Memory\nimportant state\n\n## Manual\n",
      "utf-8",
    );

    const result = await notepadPostCompact(tmpDir);
    expect(result).toContain("Working Memory");
    expect(result).toContain("important state");
    expect(result).not.toContain("## Priority\n\n"); // empty priority not included
    expect(result).not.toContain("## Manual"); // empty manual not included
  });
});

// ---------------------------------------------------------------------------
// Built-in hook: projectMemoryPreCompact
// ---------------------------------------------------------------------------

describe("projectMemoryPreCompact", () => {
  it("creates project-memory.json if it does not exist", async () => {
    const omcDir = join(tmpDir, ".omc");
    mkdirSync(omcDir, { recursive: true });

    await projectMemoryPreCompact(tmpDir, {
      learnings: JSON.stringify({ insight: "learned something" }),
    });

    const memoryPath = join(omcDir, "project-memory.json");
    expect(existsSync(memoryPath)).toBe(true);
    const memory = JSON.parse(readFileSync(memoryPath, "utf-8"));
    expect(memory.insight).toBe("learned something");
  });

  it("merges new learnings into existing memory without overwriting", async () => {
    const omcDir = join(tmpDir, ".omc");
    mkdirSync(omcDir, { recursive: true });
    writeFileSync(
      join(omcDir, "project-memory.json"),
      JSON.stringify({ existing: "keep this", shared: "original" }),
      "utf-8",
    );

    await projectMemoryPreCompact(tmpDir, {
      learnings: JSON.stringify({ newKey: "new value", shared: "should not overwrite" }),
    });

    const memory = JSON.parse(readFileSync(join(omcDir, "project-memory.json"), "utf-8"));
    expect(memory.existing).toBe("keep this");
    expect(memory.shared).toBe("original"); // first-write wins
    expect(memory.newKey).toBe("new value");
  });

  it("handles invalid JSON in learnings gracefully", async () => {
    const omcDir = join(tmpDir, ".omc");
    mkdirSync(omcDir, { recursive: true });
    writeFileSync(join(omcDir, "project-memory.json"), "{}", "utf-8");

    // Should not throw
    await projectMemoryPreCompact(tmpDir, {
      learnings: "not-valid-json{{{",
    });

    // Memory should remain unchanged
    const memory = JSON.parse(readFileSync(join(omcDir, "project-memory.json"), "utf-8"));
    expect(memory).toEqual({});
  });

  it("handles missing learnings metadata gracefully", async () => {
    const omcDir = join(tmpDir, ".omc");
    mkdirSync(omcDir, { recursive: true });
    writeFileSync(join(omcDir, "project-memory.json"), '{"a":"b"}', "utf-8");

    await projectMemoryPreCompact(tmpDir, {}); // no learnings key

    const memory = JSON.parse(readFileSync(join(omcDir, "project-memory.json"), "utf-8"));
    expect(memory).toEqual({ a: "b" }); // unchanged
  });
});

// ---------------------------------------------------------------------------
// Story-type hook profiles (Story 59-5)
// ---------------------------------------------------------------------------

describe("detectStoryType", () => {
  it("detects exploration from spike/investigate keywords", () => {
    expect(detectStoryType("spike-42")).toBe("exploration");
    expect(detectStoryType("42", "Investigate auth flow")).toBe("exploration");
    expect(detectStoryType("42", "Explore caching options")).toBe("exploration");
    expect(detectStoryType("42", "Research migration paths")).toBe("exploration");
  });

  it("detects bugfix from fix/bug/patch/hotfix keywords", () => {
    expect(detectStoryType("fix-login-bug")).toBe("bugfix");
    expect(detectStoryType("42", "Fix null pointer in parser")).toBe("bugfix");
    expect(detectStoryType("42", "Hotfix: rate limit exceeded")).toBe("bugfix");
    expect(detectStoryType("42", "Apply patch for CVE-2024")).toBe("bugfix");
  });

  it("detects review from review/audit/refactor keywords", () => {
    expect(detectStoryType("review-auth")).toBe("review");
    expect(detectStoryType("42", "Audit logging module")).toBe("review");
    expect(detectStoryType("42", "Refactor data layer")).toBe("review");
  });

  it("returns default when no keywords match", () => {
    expect(detectStoryType("42")).toBe("default");
    expect(detectStoryType("implement-user-model", "Add user model")).toBe("default");
    expect(detectStoryType("")).toBe("default");
  });

  it("returns default when title is undefined", () => {
    expect(detectStoryType("implement-thing", undefined)).toBe("default");
  });

  it("is case-insensitive", () => {
    expect(detectStoryType("42", "FIX THE BUG")).toBe("bugfix");
    expect(detectStoryType("SPIKE-99", undefined)).toBe("exploration");
    expect(detectStoryType("42", "REVIEW security")).toBe("review");
  });
});

describe("HOOK_PROFILES", () => {
  const storyTypes: StoryType[] = ["exploration", "implementation", "bugfix", "review", "default"];

  it("has a profile for every story type", () => {
    for (const st of storyTypes) {
      expect(HOOK_PROFILES[st]).toBeDefined();
    }
  });

  it("each profile has phases, enabledHooks, and metadata", () => {
    for (const st of storyTypes) {
      const profile: HookProfile = HOOK_PROFILES[st];
      expect(Array.isArray(profile.phases)).toBe(true);
      expect(profile.phases.length).toBeGreaterThan(0);
      expect(Array.isArray(profile.enabledHooks)).toBe(true);
      expect(profile.enabledHooks.length).toBeGreaterThan(0);
      expect(typeof profile.metadata).toBe("object");
    }
  });

  it("default profile registers same hooks as registerDefaultHooks", () => {
    // default profile should enable notepad (both phases) + projectMemory (preCompact)
    const profile = HOOK_PROFILES["default"];
    expect(profile.phases).toContain("preCompact");
    expect(profile.phases).toContain("postCompact");
    expect(profile.enabledHooks).toContain("notepad");
    expect(profile.enabledHooks).toContain("projectMemory");
  });

  it("exploration profile only uses preCompact phase", () => {
    expect(HOOK_PROFILES.exploration.phases).toEqual(["preCompact"]);
  });

  it("review profile only uses postCompact phase", () => {
    expect(HOOK_PROFILES.review.phases).toEqual(["postCompact"]);
  });
});

describe("registerHooksForProfile", () => {
  it("registers only enabled hooks for listed phases", async () => {
    const registry = createHookRegistry();
    registerHooksForProfile(registry, {
      phases: ["preCompact"],
      enabledHooks: ["notepad"],
      metadata: {},
    });

    // Create .omc so notepadPreCompact can write
    const omcDir = join(tmpDir, ".omc");
    mkdirSync(omcDir, { recursive: true });

    await registry.runPreCompact(tmpDir, { currentTask: "test" });

    const notepadPath = join(omcDir, "notepad.md");
    expect(existsSync(notepadPath)).toBe(true);
  });

  it("does not register hooks for phases not in profile", async () => {
    const registry = createHookRegistry();
    registerHooksForProfile(registry, {
      phases: ["preCompact"],
      enabledHooks: ["notepad"],
      metadata: {},
    });

    // Post-compact should produce nothing since only preCompact is enabled
    const omcDir = join(tmpDir, ".omc");
    mkdirSync(omcDir, { recursive: true });
    writeFileSync(
      join(omcDir, "notepad.md"),
      "## Priority\n\n## Working Memory\nhas content\n\n## Manual\n",
      "utf-8",
    );

    const result = await registry.runPostCompact(tmpDir);
    expect(result).toBe("");
  });

  it("with empty enabledHooks registers nothing", async () => {
    const registry = createHookRegistry();
    registerHooksForProfile(registry, {
      phases: ["preCompact", "postCompact"],
      enabledHooks: [],
      metadata: {},
    });

    const omcDir = join(tmpDir, ".omc");
    mkdirSync(omcDir, { recursive: true });

    await registry.runPreCompact(tmpDir, { currentTask: "test" });
    expect(existsSync(join(omcDir, "notepad.md"))).toBe(false);
  });

  it("ignores unknown hook names", () => {
    const registry = createHookRegistry();
    // Should not throw
    expect(() =>
      registerHooksForProfile(registry, {
        phases: ["preCompact"],
        enabledHooks: ["nonexistent-hook"],
        metadata: {},
      }),
    ).not.toThrow();
  });

  it("registers projectMemory for implementation profile", async () => {
    const registry = createHookRegistry();
    registerHooksForProfile(registry, HOOK_PROFILES.implementation);

    const omcDir = join(tmpDir, ".omc");
    mkdirSync(omcDir, { recursive: true });
    writeFileSync(join(omcDir, "project-memory.json"), "{}", "utf-8");

    await registry.runPreCompact(tmpDir, {
      learnings: JSON.stringify({ key: "value" }),
    });

    const memory = JSON.parse(readFileSync(join(omcDir, "project-memory.json"), "utf-8"));
    expect(memory.key).toBe("value");
  });

  it("backward compat: default profile produces same behavior as registerDefaultHooks", async () => {
    const registryProfile = createHookRegistry();
    registerHooksForProfile(registryProfile, HOOK_PROFILES["default"]);

    const registryDefault = createHookRegistry();
    registerDefaultHooks(registryDefault);

    const omcDir = join(tmpDir, ".omc");
    mkdirSync(omcDir, { recursive: true });

    // Both should write to notepad on preCompact
    await registryProfile.runPreCompact(tmpDir, { currentTask: "profile" });
    const profileContent = readFileSync(join(omcDir, "notepad.md"), "utf-8");

    // Reset notepad
    writeFileSync(
      join(omcDir, "notepad.md"),
      "## Priority\n\n## Working Memory\n\n## Manual\n",
      "utf-8",
    );

    await registryDefault.runPreCompact(tmpDir, { currentTask: "default" });
    const defaultContent = readFileSync(join(omcDir, "notepad.md"), "utf-8");

    // Both should have written task info
    expect(profileContent).toContain("profile");
    expect(defaultContent).toContain("default");
  });
});
