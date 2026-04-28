---
title: Hooks & Extensions
nav_order: 4
parent: Advanced Topics
description: Compaction survival hooks, hook registry API, story-type profiles, workspace hooks, custom hook registration, and event tracking — with code examples and configuration reference.
---

# Hooks & Extensions

## Overview

When an AI coding agent runs for an extended period, the LLM provider may compact (truncate) the conversation context to stay within token limits. Without intervention, this destroys working state — the agent forgets what it was doing, what files it modified, and what decisions it made.

The Agent Orchestrator solves this with a **compaction survival** hook system. Hooks are lifecycle callbacks that execute before and after compaction events, saving working state to persistent storage and reloading it afterward. The system is per-session, error-isolated, and configurable per story type.

The hook system has two layers:

1. **Compaction hooks** — registered in a `HookRegistry` per session, execute around compaction events to save/restore context via the notepad and project memory
2. **Workspace hooks** — agent-specific, write configuration files (e.g., `.claude/settings.json`) that run metadata collection scripts on tool use events

**Core types:** `packages/core/src/types.ts`
**Hook implementation:** `packages/core/src/hooks.ts`
**Notepad module:** `packages/core/src/notepad.ts`

**Related docs:** [Custom Plugin Development](custom-plugins/), [Sessions](../core-concepts/sessions/)

## Compaction Survival

### The Problem

LLM providers compact conversations by removing older messages when the context window fills. An agent working on a story may lose:

- What task it was working on
- What blocking issues it encountered
- What files it modified
- What key decisions it made
- What learnings it collected

### The Solution

The hook system wraps compaction events in two phases:

```
Session running → Compaction imminent
  → preCompact hooks fire (save state to notepad + project memory)
  → LLM compacts the conversation
  → postCompact hooks fire (read saved state, return as context string)
  → Agent continues with restored context
```

### Data Flow

```
Session Metadata          Notepad (.omc/notepad.md)     Project Memory
┌─────────────────┐      ┌──────────────────────┐     (.omc/project-memory.json)
│ currentTask     │──────│ Working Memory section│
│ blockingIssues  │      │ Priority section      │
│ keyDecisions    │      │ Manual section        │     ┌────────────────────┐
│ filesModified   │      └──────────────────────┘     │ merged learnings   │
│ lastAction      │                │                   │ (first-write wins) │
│ learnings (JSON)│────────────────│───────────────────│                    │
└─────────────────┘                │                   └────────────────────┘
                                   │
                     postCompact reads back
                     and returns context string
                     for re-injection
```

## Hook Types

**Source:** `packages/core/src/types.ts`

### HookPhase

Two lifecycle phases:

```typescript
type HookPhase = "preCompact" | "postCompact";
```

| Phase | When | Purpose |
|-------|------|---------|
| `preCompact` | Before compaction | Save working state to persistent storage |
| `postCompact` | After compaction | Read saved state and return context for re-injection |

### PreCompactHook

Function signature that saves state before compaction:

```typescript
type PreCompactHook = (
  worktreePath: string,
  sessionMetadata: Record<string, string>,
) => Promise<void>;
```

Parameters:
- `worktreePath` — absolute path to the session's workspace
- `sessionMetadata` — key-value pairs extracted from the session (current task, blocking issues, etc.)

### PostCompactHook

Function signature that restores state after compaction:

```typescript
type PostCompactHook = (worktreePath: string) => Promise<string>;
```

Parameters:
- `worktreePath` — absolute path to the session's workspace

Returns a context string that gets re-injected into the agent session. Multiple post-compact hooks' return values are concatenated with `"\n\n"`.

### HookRegistry

Per-session registry that manages hook registration and execution:

```typescript
interface HookRegistry {
  register(
    phase: HookPhase,
    name: string,
    hook: PreCompactHook | PostCompactHook,
  ): void;
  runPreCompact(
    worktreePath: string,
    sessionMetadata: Record<string, string>,
  ): Promise<void>;
  runPostCompact(worktreePath: string): Promise<string>;
}
```

3 methods:
- `register()` — add a named hook to a phase (overwrites existing hook with same name+phase, logs warning)
- `runPreCompact()` — execute all pre-compact hooks in registration order
- `runPostCompact()` — execute all post-compact hooks, return concatenated context strings

### HookProfile

Configuration that controls which hooks and phases to enable for a given story type:

```typescript
interface HookProfile {
  phases: HookPhase[];
  enabledHooks: string[];
  metadata: Record<string, string>;
}
```

3 fields:
- `phases` — which phases to enable (subset of `["preCompact", "postCompact"]`)
- `enabledHooks` — names of built-in hooks to register (e.g., `["notepad", "projectMemory"]`)
- `metadata` — additional key-value pairs passed to hooks via `sessionMetadata`

### StoryType

Classification used to select hook profiles automatically:

```typescript
type StoryType =
  | "exploration"
  | "implementation"
  | "bugfix"
  | "review"
  | "default";
```

## Hook Registry

The registry is created fresh for each session — no cross-session contamination.

**Source:** `packages/core/src/hooks.ts`

### Creating a Registry

```typescript
import { createHookRegistry } from "@composio/ao-core";

const registry = createHookRegistry();
// Empty registry — no hooks registered yet
```

### Registering Hooks

```typescript
registry.register("preCompact", "myHook", async (worktreePath, metadata) => {
  // Save state before compaction
});

registry.register("postCompact", "myHook", async (worktreePath) => {
  // Restore state after compaction
  return "Restored context string";
});
```

Hooks are stored in `Map<string, Hook>` keyed by unique name within each phase. Re-registering with the same name logs a warning and overwrites.

### Error Handling

Hook failures are **caught and logged** — they never block the compact cycle or prevent other hooks from running:

```typescript
// Internal behavior of runPreCompact()
for (const [name, hook] of preCompactHooks) {
  try {
    await hook(worktreePath, sessionMetadata);
  } catch (err) {
    console.warn(`[hooks] pre-compact hook "${name}" failed:`, err);
  }
}
```

This ensures that a broken custom hook doesn't prevent built-in hooks from saving state.

## Built-in Hooks

Three hooks are registered by default in every session (via `registerDefaultHooks()`):

**Source:** `packages/core/src/hooks.ts`

### notepadPreCompact

Extracts task state from session metadata and writes it to the notepad's Working Memory section.

```typescript
// Session metadata keys consumed:
// - currentTask: "Implementing login form validation"
// - blockingIssues: "missing API endpoint,cors error"
// - keyDecisions: "use Zod for validation,skip rate limiting"
// - filesModified: "src/auth.ts,src/validators.ts"
// - lastAction: "Added Zod schema for email validation"
```

The hook formats these into lines and writes them via `writeNotepadSection(worktreePath, "working", content)`.

### notepadPostCompact

Reads the full notepad (Priority, Working Memory, Manual sections) and returns a formatted context string for re-injection:

```
[COMPACTION RECOVERY — Context Restored from Notepad]

## Priority
Story context from notepad...

## Working Memory
Current Task: Implementing login form validation
Blocking Issues:
- missing API endpoint
- cors error
...

## Manual
Developer free-form notes...
```

If all sections are empty, returns an empty string (nothing to inject).

### projectMemoryPreCompact

Reads `.omc/project-memory.json`, merges new learnings from `sessionMetadata["learnings"]`, and writes it back using an atomic write pattern (temp file + rename) to prevent corruption.

Merge rule: **first-write wins** — existing keys are never overwritten by new learnings.

### registerDefaultHooks()

Convenience function that registers all three built-in hooks:

```typescript
import { registerDefaultHooks, createHookRegistry } from "@composio/ao-core";

const registry = createHookRegistry();
registerDefaultHooks(registry);
// Registers:
//   "notepad" → preCompact (notepadPreCompact)
//   "notepad" → postCompact (notepadPostCompact)
//   "projectMemory" → preCompact (projectMemoryPreCompact)
```

## Hook Profiles

Profiles control which hooks and phases to enable based on story type. This adapts the compaction survival strategy to the nature of the work.

**Source:** `packages/core/src/hooks.ts`

### HOOK_PROFILES

Five profiles, one per `StoryType`:

| StoryType | Phases | Enabled Hooks | Metadata | Use Case |
|-----------|--------|---------------|----------|----------|
| `exploration` | preCompact | notepad | `{ mode: "read-only" }` | Spikes, research — save state only |
| `implementation` | preCompact, postCompact | notepad, projectMemory | `{ mode: "full", verify: "true" }` | Feature work — full survival |
| `bugfix` | preCompact, postCompact | notepad, projectMemory | `{ mode: "targeted", verify: "true" }` | Bug fixes — full survival |
| `review` | postCompact | notepad | `{ mode: "read-only" }` | Code review — restore context only |
| `default` | preCompact, postCompact | notepad, projectMemory | `{}` | Unknown type — full survival |

### detectStoryType()

Infers story type from the story ID and title using keyword heuristics:

```typescript
import { detectStoryType } from "@composio/ao-core";

detectStoryType("62-51-hooks-extensions");           // "default"
detectStoryType("62-5-spike-auth-options");           // "exploration"
detectStoryType("62-8-fix-null-pointer");             // "bugfix"
detectStoryType("62-10-review-security-audit");       // "review"
```

| Keywords | StoryType |
|----------|-----------|
| `spike`, `investigat`, `explor`, `research` | `exploration` |
| `fix`, `bug`, `patch`, `hotfix` | `bugfix` |
| `review`, `audit`, `refactor` | `review` |
| (none match) | `default` |

Note: `implementation` is never auto-detected — most stories are implementation by default. The `default` profile provides the same behavior.

### registerHooksForProfile()

Selectively registers built-in hooks based on a profile:

```typescript
import {
  createHookRegistry,
  registerHooksForProfile,
  HOOK_PROFILES,
  detectStoryType,
} from "@composio/ao-core";

const storyType = detectStoryType("62-8-fix-null-pointer"); // "bugfix"
const profile = HOOK_PROFILES[storyType];

const registry = createHookRegistry();
registerHooksForProfile(registry, profile);
// Only registers hooks listed in profile.enabledHooks
// Only for phases listed in profile.phases
```

## Workspace Hooks

Workspace hooks are agent-level — they configure the agent tool itself (not the hook registry) to collect metadata during normal operation.

**Source:** `packages/plugins/agent-claude-code/src/index.ts`

### Agent.setupWorkspaceHooks()

The `Agent` interface has an optional `setupWorkspaceHooks()` method:

```typescript
interface WorkspaceHooksConfig {
  dataDir: string;     // Where session metadata is stored
  sessionId?: string;  // May not be known at init time
}

// On the Agent interface:
setupWorkspaceHooks?(
  workspacePath: string,
  config: WorkspaceHooksConfig,
): Promise<void>;
```

This method is called once per workspace during `ao init` and when creating new worktrees.

### Claude Code Implementation

The Claude Code agent plugin implements `setupWorkspaceHooks()` by:

1. Writing a `metadata-updater.sh` script to `.claude/` in the workspace
2. Adding a `PostToolUse` hook to `.claude/settings.json` that triggers on `Bash` tool calls
3. The hook runs the metadata updater script, which captures session activity data

```json
// .claude/settings.json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": "/absolute/path/to/.claude/metadata-updater.sh",
            "timeout": 5000
          }
        ]
      }
    ]
  }
}
```

This is a different layer from the compaction hooks — workspace hooks run on every tool use to keep metadata fresh, while compaction hooks run only around compaction events to persist and restore state.

## Configuration

### hookProfile Override

The `SessionEnhancementConfig` interface accepts an optional `hookProfile` field:

```typescript
interface SessionEnhancementConfig {
  provider: string;
  config?: Record<string, unknown>;
  hookProfile?: Partial<HookProfile>; // Merged on top of detected profile
}
```

When provided, the config override is **merged on top of** the profile detected from story type. This lets you enable additional hooks or phases without fully replacing the auto-detected profile.

### Per-Project Override

In `agent-orchestrator.yaml`:

```yaml
sessionEnhancement:
  provider: omc
  config:
    autoInstall: true
    mergeStrategy: append
  hookProfile:
    phases:
      - preCompact
      - postCompact
    enabledHooks:
      - notepad
      - projectMemory
    metadata:
      mode: full
```

Per-project override:

```yaml
projects:
  critical-service:
    sessionEnhancement:
      provider: omc
      hookProfile:
        enabledHooks:
          - notepad
          - projectMemory
```

## Custom Hooks

### Writing a Custom PreCompact Hook

A custom hook that saves a list of open TODOs to a file:

```typescript
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { PreCompactHook } from "@composio/ao-core";

const todoPreCompact: PreCompactHook = async (worktreePath, sessionMetadata) => {
  const todos = sessionMetadata["openTodos"]; // Comma-separated
  if (!todos) return;

  await writeFile(
    join(worktreePath, ".omc", "todos.md"),
    `# Open TODOs\n${todos.split(",").map((t) => `- ${t.trim()}`).join("\n")}\n`,
    "utf-8",
  );
};
```

### Writing a Custom PostCompact Hook

A custom hook that reads the TODO file and returns context:

```typescript
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { PostCompactHook } from "@composio/ao-core";

const todoPostCompact: PostCompactHook = async (worktreePath) => {
  try {
    const content = await readFile(
      join(worktreePath, ".omc", "todos.md"),
      "utf-8",
    );
    return `[TODO RECOVERY]\n${content}`;
  } catch {
    return ""; // File missing — nothing to restore
  }
};
```

### Registering Custom Hooks

```typescript
import { createHookRegistry, registerDefaultHooks } from "@composio/ao-core";

const registry = createHookRegistry();
registerDefaultHooks(registry); // Built-in hooks first

// Add custom hooks alongside built-in ones
registry.register("preCompact", "todoSaver", todoPreCompact);
registry.register("postCompact", "todoRestorer", todoPostCompact);
```

Custom hooks run after built-in hooks (registration order). Errors are isolated — a failing custom hook won't prevent built-in hooks from saving state.

### Testing Custom Hooks

```typescript
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdir, rm, readFile } from "node:fs/promises";
import { join } from "node:path";
import { createHookRegistry } from "@composio/ao-core";

const TMP = join(import.meta.dirname, "__test_tmp__");

describe("custom todo hooks", () => {
  beforeEach(async () => {
    await mkdir(join(TMP, ".omc"), { recursive: true });
  });

  afterEach(async () => {
    await rm(TMP, { recursive: true, force: true });
  });

  it("saves and restores todos", async () => {
    const registry = createHookRegistry();
    registry.register("preCompact", "todoSaver", todoPreCompact);
    registry.register("postCompact", "todoRestorer", todoPostCompact);

    await registry.runPreCompact(TMP, {
      openTodos: "Add tests,Fix edge case,Update docs",
    });

    const context = await registry.runPostCompact(TMP);
    expect(context).toContain("Add tests");
    expect(context).toContain("Fix edge case");
  });
});
```

## Event Tracking

The session timeline records hook execution as replay events. When the session management layer runs hooks, it logs `hook_fire` and `hook_result` events to the session's event log — these are not emitted by the hooks themselves but tracked by the orchestration layer for observability.

**Source:** `packages/core/src/types.ts` (event types), `packages/core/src/timeline.ts` (rendering)

### Event Types

Two hook-related event types exist in `ReplayEventType`:

| Event | When Recorded | Purpose |
|-------|-------------|---------|
| `hook_fire` | When a hook begins execution | Track which hooks run and when |
| `hook_result` | When a hook completes | Track hook outcomes and results |

### ReplayEvent Fields

Hook events use the standard `ReplayEvent` structure with the `event` field discriminating the type and `tool` carrying the hook name:

```typescript
// Hook events in the session timeline
{
  event: "hook_fire",   // or "hook_result"
  tool: "notepad",      // Hook name
  agent: "system",
  agent_type: "system",
  // ...timestamp and other fields
}
```

These events appear in the session timeline and are rendered by `timeline.ts` in the dashboard's agent activity timeline.

## Config Examples

### Basic Hook Profile Override

Override the default profile to disable project memory persistence:

```yaml
sessionEnhancement:
  provider: omc
  hookProfile:
    enabledHooks:
      - notepad
    metadata:
      mode: lightweight
```

### Custom PreCompact Hook Registration

Programmatic registration with built-in hooks:

```typescript
import {
  createHookRegistry,
  registerDefaultHooks,
} from "@composio/ao-core";

const registry = createHookRegistry();
registerDefaultHooks(registry);

// Add a custom hook that runs after built-in hooks
registry.register(
  "preCompact",
  "slackNotify",
  async (worktreePath, metadata) => {
    const task = metadata["currentTask"] ?? "Unknown task";
    // Send notification about impending compaction
    await fetch("https://hooks.slack.com/services/...", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: `Compaction imminent: ${task}` }),
    });
  },
);
```

### Per-Project Hook Configuration

Different projects get different hook profiles:

```yaml
# Global defaults
sessionEnhancement:
  provider: omc
  config:
    autoInstall: true
    mergeStrategy: append

# Critical project — full compaction survival
projects:
  payment-service:
    name: "Payment Service"
    repo: "org/payment-service"
    path: "~/projects/payment-service"
    defaultBranch: main
    sessionPrefix: "pay"
    sessionEnhancement:
      provider: omc
      hookProfile:
        phases:
          - preCompact
          - postCompact
        enabledHooks:
          - notepad
          - projectMemory
        metadata:
          mode: full
          verify: "true"
```

---

- **Parent** — [Advanced Topics](.)
- **Siblings** — [Cross-Project Orchestration](cross-project/), [Monte Carlo Simulations](monte-carlo/), [Custom Plugin Development](custom-plugins/), [Prompt Layers](prompt-layers/), [Production Deployment](production-deployment/)
- **Related** — [Sessions](../core-concepts/sessions/), [Memory & Learning](../core-concepts/memory-learning/)
- **Getting Started** — [Installation](../getting-started/installation/), [Quick Start](../getting-started/quick-start/)
- **Configuration** — [Configuration Reference](../getting-started/configuration/)
