/**
 * Hook registry for compaction survival.
 *
 * Provides a per-session registry of named hooks that execute before and after
 * context compaction. Built-in hooks save working state to the notepad and
 * project-memory.json files.
 *
 * Epic 59, Story 59-2 (FR-S1-2, FR-S1-3).
 */

import { readFile, writeFile, rename, mkdir, unlink } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { join } from "node:path";
import type {
  HookPhase,
  PreCompactHook,
  PostCompactHook,
  HookRegistry,
  HookProfile,
  StoryType,
} from "./types.js";
import { writeNotepadSection, readNotepad } from "./notepad.js";

// ---------------------------------------------------------------------------
// Hook Registry Implementation
// ---------------------------------------------------------------------------

/**
 * Create a new per-session hook registry.
 * Hooks are stored in Maps keyed by unique name, preserving insertion order.
 */
export function createHookRegistry(): HookRegistry {
  const preCompactHooks = new Map<string, PreCompactHook>();
  const postCompactHooks = new Map<string, PostCompactHook>();

  return {
    register(phase: HookPhase, name: string, hook: PreCompactHook | PostCompactHook): void {
      if (phase === "preCompact") {
        if (preCompactHooks.has(name)) {
          // eslint-disable-next-line no-console
          console.warn(`[hooks] overwriting existing pre-compact hook "${name}"`);
        }
        preCompactHooks.set(name, hook as PreCompactHook);
      } else {
        if (postCompactHooks.has(name)) {
          // eslint-disable-next-line no-console
          console.warn(`[hooks] overwriting existing post-compact hook "${name}"`);
        }
        postCompactHooks.set(name, hook as PostCompactHook);
      }
    },

    async runPreCompact(
      worktreePath: string,
      sessionMetadata: Record<string, string>,
    ): Promise<void> {
      for (const [name, hook] of preCompactHooks) {
        try {
          await hook(worktreePath, sessionMetadata);
        } catch (err) {
          console.warn(`[hooks] pre-compact hook "${name}" failed:`, err);
        }
      }
    },

    async runPostCompact(worktreePath: string): Promise<string> {
      const contexts: string[] = [];
      for (const [name, hook] of postCompactHooks) {
        try {
          const ctx = await hook(worktreePath);
          if (ctx) {
            contexts.push(ctx);
          }
        } catch (err) {
          console.warn(`[hooks] post-compact hook "${name}" failed:`, err);
        }
      }
      return contexts.join("\n\n");
    },
  };
}

// ---------------------------------------------------------------------------
// Built-in hook: notepadPreCompact
// ---------------------------------------------------------------------------

/**
 * Save current task state to the notepad Working Memory section before
 * compaction. Extracts context from session metadata.
 */
export const notepadPreCompact: PreCompactHook = async (
  worktreePath: string,
  sessionMetadata: Record<string, string>,
): Promise<void> => {
  const lines: string[] = [];

  const currentTask = sessionMetadata["currentTask"] ?? "Unknown";
  lines.push(`Current Task: ${currentTask}`);

  // Blocking issues
  const blocking = sessionMetadata["blockingIssues"];
  if (blocking) {
    lines.push("Blocking Issues:");
    for (const issue of blocking.split(",")) {
      lines.push(`- ${issue.trim()}`);
    }
  }

  // Key decisions
  const decisions = sessionMetadata["keyDecisions"];
  if (decisions) {
    lines.push("Key Decisions:");
    for (const decision of decisions.split(",")) {
      lines.push(`- ${decision.trim()}`);
    }
  }

  // Files modified
  const files = sessionMetadata["filesModified"];
  if (files) {
    lines.push("Files Modified:");
    for (const file of files.split(",")) {
      lines.push(`- ${file.trim()}`);
    }
  }

  // Last action
  const lastAction = sessionMetadata["lastAction"];
  if (lastAction) {
    lines.push(`Last Action: ${lastAction}`);
  }

  await writeNotepadSection(worktreePath, "working", lines.join("\n"));
};

// ---------------------------------------------------------------------------
// Built-in hook: notepadPostCompact
// ---------------------------------------------------------------------------

/**
 * Read the full notepad and return formatted context for re-injection after
 * compaction.
 */
export const notepadPostCompact: PostCompactHook = async (
  worktreePath: string,
): Promise<string> => {
  let notepad;
  try {
    notepad = await readNotepad(worktreePath);
  } catch {
    // Notepad file missing or unreadable — nothing to restore
    return "";
  }
  const parts: string[] = [];

  parts.push("[COMPACTION RECOVERY — Context Restored from Notepad]");

  if (notepad.priority) {
    parts.push("## Priority");
    parts.push(notepad.priority);
  }

  if (notepad.working) {
    parts.push("## Working Memory");
    parts.push(notepad.working);
  }

  if (notepad.manual) {
    parts.push("## Manual");
    parts.push(notepad.manual);
  }

  // If all sections are empty, return empty string (nothing to inject)
  if (parts.length <= 1) {
    return "";
  }

  return parts.join("\n\n");
};

// ---------------------------------------------------------------------------
// Built-in hook: projectMemoryPreCompact
// ---------------------------------------------------------------------------

/**
 * Read .omc/project-memory.json, merge session learnings from metadata,
 * and write back using atomic write pattern.
 */
export const projectMemoryPreCompact: PreCompactHook = async (
  worktreePath: string,
  sessionMetadata: Record<string, string>,
): Promise<void> => {
  const memoryPath = join(worktreePath, ".omc", "project-memory.json");

  // Read existing memory
  let memory: Record<string, unknown>;
  try {
    const raw = await readFile(memoryPath, "utf-8");
    memory = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    // File doesn't exist or is invalid — start fresh
    memory = {};
  }

  // Merge learnings from session metadata
  const learnings = sessionMetadata["learnings"];
  if (learnings) {
    try {
      const parsed = JSON.parse(learnings) as Record<string, unknown>;
      for (const [key, value] of Object.entries(parsed)) {
        // Don't overwrite existing entries — first write wins
        if (!(key in memory)) {
          memory[key] = value;
        }
      }
    } catch {
      // Invalid JSON in learnings — skip
    }
  }

  // Atomic write: temp file then rename (PID+UUID suffix prevents collision)
  const content = JSON.stringify(memory, null, 2) + "\n";
  await mkdir(join(worktreePath, ".omc"), { recursive: true });
  const tmpPath = `${memoryPath}.${process.pid}.${randomUUID().slice(0, 8)}.tmp`;
  await writeFile(tmpPath, content, "utf-8");
  try {
    await rename(tmpPath, memoryPath);
  } catch (err) {
    try {
      await unlink(tmpPath);
    } catch {
      // Best effort
    }
    throw err;
  }
};

// ---------------------------------------------------------------------------
// Convenience: register all built-in hooks
// ---------------------------------------------------------------------------

/**
 * Register all built-in compaction survival hooks on the given registry.
 * Called once per session during spawn.
 */
export function registerDefaultHooks(registry: HookRegistry): void {
  registry.register("preCompact", "notepad", notepadPreCompact);
  registry.register("postCompact", "notepad", notepadPostCompact);
  registry.register("preCompact", "projectMemory", projectMemoryPreCompact);
}

// ---------------------------------------------------------------------------
// Story-type hook profiles (Epic 59, Story 59-5)
// ---------------------------------------------------------------------------

/** Keyword-to-story-type detection patterns. */
const STORY_TYPE_PATTERNS: [RegExp, StoryType][] = [
  [/\b(spike|investigat|explor|research)/, "exploration"],
  [/\b(fix|bug|patch|hotfix)/, "bugfix"],
  [/\b(review|audit|refactor)/, "review"],
];

/**
 * Per-story-type hook profiles defining which phases and hooks to enable.
 * The "default" profile matches the behavior of `registerDefaultHooks()`.
 */
export const HOOK_PROFILES: Record<StoryType, HookProfile> = {
  exploration: {
    phases: ["preCompact"],
    enabledHooks: ["notepad"],
    metadata: { mode: "read-only" },
  },
  implementation: {
    phases: ["preCompact", "postCompact"],
    enabledHooks: ["notepad", "projectMemory"],
    metadata: { mode: "full", verify: "true" },
  },
  bugfix: {
    phases: ["preCompact", "postCompact"],
    enabledHooks: ["notepad", "projectMemory"],
    metadata: { mode: "targeted", verify: "true" },
  },
  review: {
    phases: ["postCompact"],
    enabledHooks: ["notepad"],
    metadata: { mode: "read-only" },
  },
  default: {
    phases: ["preCompact", "postCompact"],
    enabledHooks: ["notepad", "projectMemory"],
    metadata: {},
  },
};

/**
 * Detect story type from the story ID and title using keyword heuristics.
 * Returns "default" when no specific keywords match.
 */
export function detectStoryType(storyId: string, storyTitle?: string): StoryType {
  const combined = `${storyId} ${storyTitle ?? ""}`.toLowerCase();
  for (const [pattern, storyType] of STORY_TYPE_PATTERNS) {
    if (pattern.test(combined)) {
      return storyType;
    }
  }
  return "default";
}

/** Map of built-in hook names to their [phase, hook] implementations. */
const BUILT_IN_HOOKS: Record<
  string,
  { phase: HookPhase; hook: PreCompactHook | PostCompactHook }[]
> = {
  notepad: [
    { phase: "preCompact", hook: notepadPreCompact },
    { phase: "postCompact", hook: notepadPostCompact },
  ],
  projectMemory: [{ phase: "preCompact", hook: projectMemoryPreCompact }],
};

/**
 * Selectively register built-in hooks based on a hook profile.
 * Only registers hooks whose names appear in `profile.enabledHooks`
 * and whose phases appear in `profile.phases`.
 */
export function registerHooksForProfile(registry: HookRegistry, profile: HookProfile): void {
  for (const hookName of profile.enabledHooks) {
    const definitions = BUILT_IN_HOOKS[hookName];
    if (!definitions) continue;
    for (const { phase, hook } of definitions) {
      if (profile.phases.includes(phase)) {
        registry.register(phase, hookName, hook);
      }
    }
  }
}
